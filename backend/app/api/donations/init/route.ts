import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AuthService } from '@/lib/auth';
import { getCorsHeaders } from '@/lib/cors';
import { init as tinkoffInit } from '@/lib/tinkoff';

export const dynamic = 'force-dynamic';
const SITE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://sonatum-music.ru';

function cuid() {
  return 'don_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 12);
}

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request.headers.get('origin') || undefined),
  });
}

// POST /api/donations/init
// Body: { artistSlug?, collectiveSlug?, amount, message?, email? }
export async function POST(request: NextRequest) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  try {
    let body: any;
    try { body = await request.json(); } catch { body = {}; }

    const amount = Math.max(10, Math.min(100000, Math.floor(Number(body.amount) || 0)));
    if (!amount) {
      return NextResponse.json(
        { success: false, error: 'Минимальная сумма доната — 10 ₽' },
        { status: 400, headers: cors }
      );
    }

    let recipientArtistId: string | null = null;
    let recipientCollectiveId: string | null = null;
    let recipientName = '';
    let recipientEmail = '';

    if (body.artistSlug) {
      const a = await prisma.artist.findUnique({
        where: { slug: String(body.artistSlug) },
        include: { user: true },
      });
      if (!a) {
        return NextResponse.json(
          { success: false, error: 'Артист не найден' },
          { status: 404, headers: cors }
        );
      }
      recipientArtistId = a.id;
      recipientName = a.name;
      recipientEmail = a.user.email;
    } else if (body.collectiveSlug) {
      const c = await prisma.collective.findUnique({
        where: { slug: String(body.collectiveSlug) },
        include: { leader: true },
      });
      if (!c) {
        return NextResponse.json(
          { success: false, error: 'Коллектив не найден' },
          { status: 404, headers: cors }
        );
      }
      recipientCollectiveId = c.id;
      recipientName = c.name;
      recipientEmail = c.leader.email;
    } else {
      return NextResponse.json(
        { success: false, error: 'Не указан получатель' },
        { status: 400, headers: cors }
      );
    }

    // Donor
    let donorId: string | null = null;
    let donorNickname: string | null = body.nickname || null;
    let donorEmail = (body.email || '').trim();
    const auth = request.headers.get('Authorization');
    if (auth?.startsWith('Bearer ')) {
      const session = await AuthService.validateSession(auth.substring(7));
      if (session) {
        donorId = session.userId;
        const u = await prisma.user.findUnique({
          where: { id: session.userId },
          select: { email: true, username: true, firstName: true },
        });
        if (u?.email) donorEmail = u.email;
        if (!donorNickname) donorNickname = u?.username || u?.firstName || null;
      }
    }
    if (!donorEmail) {
      return NextResponse.json(
        { success: false, error: 'Укажите email' },
        { status: 400, headers: cors }
      );
    }

    const donId = cuid();
    await prisma.$executeRawUnsafe(
      `INSERT INTO donations
       (id, donor_id, donor_nickname, recipient_artist_id, recipient_collective_id, amount, message, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING')`,
      donId,
      donorId,
      donorNickname,
      recipientArtistId,
      recipientCollectiveId,
      amount,
      body.message || null
    );

    const orderId = `don_${donId}_${Date.now()}`;
    const description = `Донат · ${recipientName}`;
    const amountKopecks = amount * 100;
    const r = await tinkoffInit({
      orderId,
      amountKopecks,
      description,
      email: donorEmail,
      successUrl: `${SITE_URL}/donate-success?id=${donId}`,
      failUrl: `${SITE_URL}/donate-fail?id=${donId}`,
      receipt: {
        items: [
          {
            name: description.substring(0, 128),
            quantity: 1,
            amount: amountKopecks,
            price: amountKopecks,
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
        `UPDATE donations SET payment_id = $1 WHERE id = $2`,
        r.paymentId,
        donId
      );
    }

    return NextResponse.json(
      { success: true, paymentUrl: r.paymentUrl, donationId: donId },
      { headers: cors }
    );
  } catch (e: any) {
    console.error('[DONATE_INIT_ERR]', e);
    return NextResponse.json(
      { success: false, error: e?.message || 'Ошибка' },
      { status: 500, headers: cors }
    );
  }
}
