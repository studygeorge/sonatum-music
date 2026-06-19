import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AuthService } from '@/lib/auth';
import { getCorsHeaders } from '@/lib/cors';
import { init as tinkoffInit } from '@/lib/tinkoff';

export const dynamic = 'force-dynamic';

const SITE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://sonatum-music.ru';

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request.headers.get('origin') || undefined),
  });
}

// POST /api/events/[id]/pay-publication
// Создаёт Tinkoff-платёж за публикацию события (250 ₽).
// После успешной оплаты колбэк tinkoff/notify пометит event.paid_at и переведёт в APPROVED при модерации.
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) {
    return NextResponse.json({ success: false, error: 'Требуется авторизация' }, { status: 401, headers: cors });
  }
  const session = await AuthService.validateSession(auth.substring(7));
  if (!session) {
    return NextResponse.json({ success: false, error: 'Сессия истекла' }, { status: 401, headers: cors });
  }

  const [ev] = (await prisma.$queryRawUnsafe(
    `SELECT e.id, e.author_id, e.title, e.status, e.paid_publication, e.publication_fee, u.email
       FROM events e JOIN users u ON u.id = e.author_id
      WHERE e.id = $1 LIMIT 1`,
    params.id
  )) as any[];

  if (!ev) {
    return NextResponse.json({ success: false, error: 'Событие не найдено' }, { status: 404, headers: cors });
  }
  if (ev.author_id !== session.userId) {
    return NextResponse.json({ success: false, error: 'Только автор события может оплатить публикацию' }, { status: 403, headers: cors });
  }
  if (ev.paid_publication) {
    return NextResponse.json({ success: false, error: 'Публикация этого события уже оплачена (или включена в подписку ПРОФИ)' }, { status: 409, headers: cors });
  }

  // Берём актуальную сумму из настроек или дефолт (250 ₽)
  const [setting] = (await prisma.$queryRawUnsafe(
    `SELECT value FROM platform_settings WHERE key = 'event_publication_fee' LIMIT 1`
  ).catch(() => [])) as any[];
  const feeRub = Number(setting?.value) || Number(ev.publication_fee) || 250;
  const amountKopecks = Math.round(feeRub * 100);

  const orderId = `evtpub_${ev.id}_${Date.now()}`;
  const description = `Публикация афиши на «Сонатум» · ${String(ev.title).slice(0, 60)}`;

  const r = await tinkoffInit({
    orderId,
    amountKopecks,
    description,
    email: ev.email,
    successUrl: `${SITE_URL}/author/events?published=${ev.id}`,
    failUrl: `${SITE_URL}/author/events?failed=${ev.id}`,
    notificationUrl: `${SITE_URL}/api/payments/tinkoff/notify`,
    receipt: {
      items: [{
        name: description.slice(0, 128),
        priceKopecks: amountKopecks,
        quantity: 1,
      }],
      taxation: 'usn_income',
    },
  });

  if (!r.ok || !r.paymentUrl) {
    return NextResponse.json({ success: false, error: r.error || 'Ошибка инициализации платежа' }, { status: 502, headers: cors });
  }

  // Сохраняем payment_id для последующей сверки в notify
  await prisma.$executeRawUnsafe(
    `UPDATE events SET publication_payment_id = $1, publication_fee = $2 WHERE id = $3`,
    r.paymentId || null,
    feeRub,
    ev.id
  ).catch(() => {
    // если колонка publication_payment_id отсутствует — пропускаем (миграция будет ниже)
  });

  return NextResponse.json({
    success: true,
    paymentUrl: r.paymentUrl,
    paymentId: r.paymentId,
    feeRub,
  }, { headers: cors });
}
