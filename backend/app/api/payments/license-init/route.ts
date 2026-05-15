import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AuthService } from '@/lib/auth';
import { getCorsHeaders } from '@/lib/cors';
import { init as tinkoffInit } from '@/lib/tinkoff';

export const dynamic = 'force-dynamic';

const SITE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://sonatum-music.ru';

function cuid() {
  return 'lp_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 12);
}

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request.headers.get('origin') || undefined),
  });
}

// POST /api/payments/license-init
// Body: { trackId, licenseCode, buyerEmail?, buyerName?, buyerCompany?, projectDescription? }
// — Если лицензия direct (requires_manager=false, isB2B=false): создаёт Tinkoff-платёж, возвращает paymentUrl
// — Если requires_manager: создаёт license_purchase со статусом 'AWAITING_MANAGER', менеджер свяжется
// — Если EXCLUSIVE: оповещение автора, без платежа на платформе
export async function POST(request: NextRequest) {
  const corsHeaders = getCorsHeaders(request.headers.get('origin') || undefined);
  try {
    let body: any;
    try { body = await request.json(); } catch { body = {}; }

    const { trackId, licenseCode, buyerEmail, buyerName, buyerCompany, projectDescription } = body;
    if (!trackId || !licenseCode) {
      return NextResponse.json(
        { success: false, error: 'Не указан трек или тип лицензии' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Найти лицензию
    const [lic] = (await prisma.$queryRawUnsafe(
      `SELECT * FROM license_catalog WHERE code = $1 AND active = true LIMIT 1`,
      licenseCode
    )) as any[];
    if (!lic) {
      return NextResponse.json(
        { success: false, error: 'Неизвестный тип лицензии' },
        { status: 404, headers: corsHeaders }
      );
    }

    // Найти трек
    const track = await prisma.track.findUnique({
      where: { id: trackId },
      include: { artist: { include: { user: true } } },
    });
    if (!track) {
      return NextResponse.json(
        { success: false, error: 'Трек не найден' },
        { status: 404, headers: corsHeaders }
      );
    }

    // Цена: из track_licenses или default из каталога
    const [tl] = (await prisma.$queryRawUnsafe(
      `SELECT price FROM track_licenses WHERE track_id = $1 AND license_code = $2 AND enabled = true LIMIT 1`,
      trackId,
      licenseCode
    )) as any[];
    const price = Number(tl?.price ?? lic.default_price);
    const commissionPct = Number(lic.commission_pct);
    const commissionAmount = (price * commissionPct) / 100;
    const artistAmount = price - commissionAmount;

    // Email покупателя
    let userId: string | null = null;
    let actualEmail = (buyerEmail || '').trim();
    const auth = request.headers.get('Authorization');
    if (auth?.startsWith('Bearer ')) {
      const session = await AuthService.validateSession(auth.substring(7));
      if (session) {
        userId = session.userId;
        const u = await prisma.user.findUnique({
          where: { id: session.userId },
          select: { email: true },
        });
        if (u?.email) actualEmail = u.email;
      }
    }
    if (!actualEmail) {
      return NextResponse.json(
        { success: false, error: 'Укажите email покупателя' },
        { status: 400, headers: corsHeaders }
      );
    }

    const lpId = cuid();
    const isB2B = lic.is_b2b;
    const requiresManager = lic.requires_manager;
    const isExclusive = lic.code === 'EXCLUSIVE';

    // Создаём запись license_purchase
    await prisma.$executeRawUnsafe(
      `INSERT INTO license_purchases
       (id, buyer_id, buyer_email, buyer_name, buyer_company, track_id, license_code,
        price, commission_pct, commission_amount, artist_amount, status, project_description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      lpId,
      userId,
      actualEmail,
      buyerName || null,
      buyerCompany || null,
      trackId,
      licenseCode,
      price,
      commissionPct,
      commissionAmount,
      artistAmount,
      isExclusive ? 'EXCLUSIVE_REQUESTED' : requiresManager ? 'AWAITING_MANAGER' : 'PENDING',
      projectDescription || null
    );

    if (isExclusive) {
      return NextResponse.json(
        {
          success: true,
          mode: 'EXCLUSIVE',
          message:
            '«Сонатум» не продаёт исключительные права. Запрос передан автору — он свяжется с вами при заинтересованности.',
          purchaseId: lpId,
        },
        { headers: corsHeaders }
      );
    }

    if (requiresManager) {
      return NextResponse.json(
        {
          success: true,
          mode: 'B2B_REQUEST',
          message: 'Заявка передана менеджеру. С вами свяжутся в течение 1 рабочего дня.',
          purchaseId: lpId,
        },
        { headers: corsHeaders }
      );
    }

    // Direct Tinkoff payment
    const orderId = `lic_${lpId}_${Date.now()}`;
    const description = `${lic.short_name || lic.name} · ${track.title}`;
    const amountKopecks = Math.round(price * 100);
    const r = await tinkoffInit({
      orderId,
      amountKopecks,
      description,
      email: actualEmail,
      successUrl: `${SITE_URL}/tracks/${track.slug}?paid=1`,
      failUrl: `${SITE_URL}/tracks/${track.slug}?paid=0`,
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
        { status: 502, headers: corsHeaders }
      );
    }

    if (r.paymentId) {
      await prisma.$executeRawUnsafe(
        `UPDATE license_purchases SET payment_id = $1 WHERE id = $2`,
        r.paymentId,
        lpId
      );
    }

    return NextResponse.json(
      {
        success: true,
        mode: 'DIRECT',
        paymentUrl: r.paymentUrl,
        purchaseId: lpId,
      },
      { headers: corsHeaders }
    );
  } catch (e: any) {
    console.error('[LICENSE_INIT_ERR]', e);
    return NextResponse.json(
      { success: false, error: e?.message || 'Ошибка' },
      { status: 500, headers: corsHeaders }
    );
  }
}
