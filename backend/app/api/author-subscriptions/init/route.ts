import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AuthService } from '@/lib/auth';
import { getCorsHeaders } from '@/lib/cors';
import { init as tinkoffInit } from '@/lib/tinkoff';

export const dynamic = 'force-dynamic';
const SITE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://sonatum-music.ru';

function cuid() {
  return 'as_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request.headers.get('origin') || undefined),
  });
}

const PROFI_PRICE = 299; // ₽/мес

// POST /api/author-subscriptions/init — оформить ПРОФИ для автора (299 ₽/мес)
export async function POST(request: NextRequest) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) {
    return NextResponse.json(
      { success: false, error: 'Требуется авторизация' },
      { status: 401, headers: cors }
    );
  }
  const session = await AuthService.validateSession(auth.substring(7));
  if (!session) {
    return NextResponse.json(
      { success: false, error: 'Сессия истекла' },
      { status: 401, headers: cors }
    );
  }
  if (session.role !== 'ARTIST' && session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN') {
    return NextResponse.json(
      { success: false, error: 'ПРОФИ только для авторов' },
      { status: 403, headers: cors }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { email: true },
  });
  if (!user?.email) {
    return NextResponse.json(
      { success: false, error: 'Email не найден' },
      { status: 400, headers: cors }
    );
  }

  // Проверим, нет ли уже активной ПРОФИ
  const [existing] = (await prisma.$queryRawUnsafe(
    `SELECT status, ends_at FROM author_subscriptions WHERE user_id = $1 AND tier = 'PROFI' LIMIT 1`,
    session.userId
  )) as any[];
  if (existing?.status === 'ACTIVE' && (!existing.ends_at || new Date(existing.ends_at) > new Date())) {
    return NextResponse.json(
      { success: false, error: 'У вас уже активна подписка ПРОФИ' },
      { status: 409, headers: cors }
    );
  }

  const subId = cuid();
  await prisma.$executeRawUnsafe(
    `INSERT INTO author_subscriptions (id, user_id, tier, status, price)
     VALUES ($1, $2, 'PROFI', 'PENDING', $3)
     ON CONFLICT (user_id) DO UPDATE SET tier = 'PROFI', status = 'PENDING', price = $3`,
    subId,
    session.userId,
    PROFI_PRICE
  );

  const orderId = `prof_${subId}_${Date.now()}`;
  const r = await tinkoffInit({
    orderId,
    amountKopecks: PROFI_PRICE * 100,
    description: 'Подписка ПРОФИ · автор на «Сонатум»',
    email: user.email,
    successUrl: `${SITE_URL}/author/settings?profi=ok`,
    failUrl: `${SITE_URL}/author/settings?profi=fail`,
    receipt: {
      items: [
        {
          name: 'Подписка ПРОФИ · автор на «Сонатум»',
          quantity: 1,
          amount: PROFI_PRICE * 100,
          price: PROFI_PRICE * 100,
          tax: 'none',
          paymentMethod: 'full_payment',
          paymentObject: 'service',
        },
      ],
    },
  } as any);

  if (!r?.ok || !r.paymentUrl) {
    return NextResponse.json(
      { success: false, error: r?.error || 'Ошибка инициализации платежа' },
      { status: 502, headers: cors }
    );
  }

  if (r.paymentId) {
    await prisma.$executeRawUnsafe(
      `UPDATE author_subscriptions SET payment_id = $1 WHERE id = $2`,
      r.paymentId,
      subId
    );
  }

  return NextResponse.json(
    { success: true, paymentUrl: r.paymentUrl, subscriptionId: subId },
    { headers: cors }
  );
}

// GET /api/author-subscriptions/init — статус ПРОФИ
export async function GET(request: NextRequest) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) {
    return NextResponse.json(
      { success: false, error: 'Требуется авторизация' },
      { status: 401, headers: cors }
    );
  }
  const session = await AuthService.validateSession(auth.substring(7));
  if (!session) {
    return NextResponse.json(
      { success: false, error: 'Сессия истекла' },
      { status: 401, headers: cors }
    );
  }
  const [row] = (await prisma.$queryRawUnsafe(
    `SELECT tier, status, starts_at, ends_at FROM author_subscriptions WHERE user_id = $1 LIMIT 1`,
    session.userId
  )) as any[];

  return NextResponse.json(
    {
      success: true,
      data: row
        ? {
            tier: row.tier,
            status: row.status,
            startsAt: row.starts_at,
            endsAt: row.ends_at,
            isActive: row.status === 'ACTIVE' && (!row.ends_at || new Date(row.ends_at) > new Date()),
          }
        : null,
    },
    { headers: cors }
  );
}
