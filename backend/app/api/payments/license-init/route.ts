import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AuthService } from '@/lib/auth';
import { getCorsHeaders } from '@/lib/cors';
import { init as tinkoffInit } from '@/lib/tinkoff';
import { sendMail } from '@/lib/mailer';

import { logError } from '@/lib/errors';
export const dynamic = 'force-dynamic';

const SITE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://sonatum-music.ru';

const PROJECT_TYPE_LABEL: Record<string, string> = {
  AD: 'Рекламный ролик',
  FILM: 'Фильм',
  SERIES: 'Сериал',
  GAME: 'Видеоигра',
  PODCAST: 'Подкаст',
  EVENT: 'Корпоративное мероприятие',
  PRESENTATION: 'Презентация',
  OTHER: 'Другое',
};

const BUDGET_LABEL: Record<string, string> = {
  UNDER_10K: 'До 10 000 ₽',
  '10_30K': '10 000 — 30 000 ₽',
  '30_70K': '30 000 — 70 000 ₽',
  OVER_70K: 'Свыше 70 000 ₽',
};

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

    const { trackId, licenseCode, buyerEmail, buyerName, buyerCompany, projectDescription, projectType, budget, buyerPhone } = body;
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
        price, commission_pct, commission_amount, artist_amount, status, project_description,
        project_type, budget)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
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
      projectDescription || null,
      projectType && PROJECT_TYPE_LABEL[projectType] ? projectType : null,
      budget && BUDGET_LABEL[budget] ? budget : null
    );

    // Email-уведомления для AWAITING_MANAGER / EXCLUSIVE_REQUESTED
    if (requiresManager || isExclusive) {
      const managerTo = process.env.SONATUM_B2B_EMAIL || process.env.SONATUM_BILLING_EMAIL || 'b2b@sonatum-music.ru';
      const projectTypeLabel = projectType ? PROJECT_TYPE_LABEL[projectType] || projectType : '—';
      const budgetLabel = budget ? BUDGET_LABEL[budget] || budget : '—';
      const trackInfo = `«${track.title}»${track.artist?.name ? ' — ' + track.artist.name : ''}`;
      // 1) Менеджеру
      sendMail({
        to: managerTo,
        subject: isExclusive
          ? `[Сонатум · Эксклюзив] Запрос исключительной лицензии — ${trackInfo}`
          : `[Сонатум · B2B] ${lic.short_name || lic.name} — ${trackInfo}`,
        html: `
          <h2>${isExclusive ? 'Запрос исключительной лицензии' : 'Новая B2B-заявка'}</h2>
          <p><b>ID заявки:</b> ${lpId}</p>
          <p><b>Трек:</b> ${trackInfo}</p>
          <p><b>Тип лицензии:</b> ${lic.name}<br>
             <b>Тип проекта:</b> ${projectTypeLabel}<br>
             <b>Бюджет:</b> ${budgetLabel}</p>
          <p><b>Контактное лицо:</b> ${buyerName || '—'}<br>
             <b>Компания:</b> ${buyerCompany || '—'}<br>
             <b>Email:</b> <a href="mailto:${actualEmail}">${actualEmail}</a><br>
             <b>Телефон:</b> ${buyerPhone || '—'}</p>
          ${projectDescription ? `<p><b>Описание проекта:</b><br>${String(projectDescription).replace(/\n/g, '<br>')}</p>` : ''}
          ${isExclusive ? '<p><em>Платформа не участвует в сделке — только передаёт ваш запрос автору. Свяжите автора и покупателя.</em></p>' : ''}
          <hr>
          <p style="color:#888;font-size:12px">Открыть заявку: <a href="${SITE_URL}/admin/inquiries">/admin/inquiries</a></p>
        `,
      }).catch(() => {});

      // 2) Подтверждение клиенту
      sendMail({
        to: actualEmail,
        subject: isExclusive
          ? 'Сонатум: ваш запрос на исключительные права принят'
          : `Сонатум: ваша заявка на лицензию принята`,
        html: `
          <h2>Заявка принята в работу</h2>
          <p>Здравствуйте${buyerName ? ', ' + buyerName : ''}!</p>
          <p>Мы получили вашу заявку на ${isExclusive ? 'исключительные права на трек' : 'лицензирование трека'} <b>${trackInfo}</b>.</p>
          ${isExclusive
            ? '<p>«Сонатум» не продаёт исключительные права. Мы передаём ваш запрос автору. Если он согласится — он свяжется с вами напрямую.</p>'
            : `<p>Менеджер свяжется с вами в течение 1 рабочего дня по адресу <b>${actualEmail}</b> для уточнения деталей: территории, срока использования, типа медиа.</p>
               <p>После согласования вы получите индивидуальный лицензионный договор, счёт на оплату и (после оплаты) файл с треком в высоком качестве с подписанным договором.</p>`}
          <p>ID вашей заявки: <code>${lpId}</code></p>
          <hr>
          <p style="color:#888;font-size:12px">Это автоматическое уведомление с платформы «Сонатум».</p>
        `,
      }).catch(() => {});
    }

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
      notificationUrl: `${SITE_URL}/api/payments/tinkoff/notify`,
      receipt: {
        items: [{
          name: description.substring(0, 128),
          priceKopecks: amountKopecks,
          quantity: 1,
        }],
        taxation: 'usn_income',
      },
    });

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
    logError('payments.license-init', e, { request, extra: { tag: 'LICENSE_INIT_ERR' } }).catch(()=>{}); console.error('[LICENSE_INIT_ERR]', e);
    return NextResponse.json(
      { success: false, error: e?.message || 'Ошибка' },
      { status: 500, headers: corsHeaders }
    );
  }
}
