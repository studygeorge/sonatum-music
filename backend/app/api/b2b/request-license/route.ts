import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AuthService } from '@/lib/auth';
import { getCorsHeaders } from '@/lib/cors';
import { sendMail } from '@/lib/mailer';

export const dynamic = 'force-dynamic';

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request.headers.get('origin') || undefined),
  });
}

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

// POST /api/b2b/request-license
// Внешние клиенты тоже могут отправить (auth не обязателен).
// Body: { trackId?, projectType, budget, message, contactName, companyName, email, phone? }
export async function POST(request: NextRequest) {
  const corsHeaders = getCorsHeaders(request.headers.get('origin') || undefined);

  try {
    const body = await request.json().catch(() => ({}));
    const {
      trackId,
      projectType,
      budget,
      message,
      contactName,
      companyName,
      email,
      phone,
    } = body || {};

    // === Валидация ===
    if (!email || !String(email).includes('@')) {
      return NextResponse.json({ success: false, error: 'Укажите корректный email' }, { status: 400, headers: corsHeaders });
    }
    if (!contactName || !String(contactName).trim()) {
      return NextResponse.json({ success: false, error: 'Укажите ваше имя' }, { status: 400, headers: corsHeaders });
    }
    if (!projectType || !PROJECT_TYPE_LABEL[projectType]) {
      return NextResponse.json({ success: false, error: 'Выберите тип проекта' }, { status: 400, headers: corsHeaders });
    }
    if (!budget || !BUDGET_LABEL[budget]) {
      return NextResponse.json({ success: false, error: 'Выберите бюджет' }, { status: 400, headers: corsHeaders });
    }
    const cleanMessage = message ? String(message).trim().slice(0, 2000) : null;

    // Если авторизован — привяжем requester
    let requesterId: string | null = null;
    const auth = request.headers.get('Authorization');
    if (auth?.startsWith('Bearer ')) {
      const session = await AuthService.validateSession(auth.substring(7));
      if (session) requesterId = session.userId;
    }

    // Найдём трек (если указан)
    let trackInfo: { id: string; title: string; artistName: string | null } | null = null;
    if (trackId) {
      const t = await prisma.track.findUnique({
        where: { id: trackId },
        select: { id: true, title: true, artist: { select: { name: true } } },
      });
      if (t) trackInfo = { id: t.id, title: t.title, artistName: t.artist?.name || null };
    }

    // Создаём заявку
    const req = await prisma.b2BRequest.create({
      data: {
        requesterId,
        trackId: trackInfo?.id || null,
        companyName: companyName || null,
        email,
        phone: phone || null,
        message: cleanMessage,
        requestType: 'LICENSE',
        status: 'PENDING',
      },
      select: { id: true },
    });

    // Записываем доп.поля через raw SQL (новые колонки)
    await prisma.$executeRawUnsafe(
      `UPDATE b2b_requests SET project_type = $1, budget = $2, contact_name = $3 WHERE id = $4`,
      projectType, budget, String(contactName).trim(), req.id
    );

    // === Email-уведомления ===
    const managerTo = process.env.SONATUM_B2B_EMAIL || process.env.SONATUM_BILLING_EMAIL || 'b2b@sonatum-music.ru';

    // 1) Менеджеру Сонатума
    await sendMail({
      to: managerTo,
      subject: `[Сонатум · B2B] Заявка на лицензию: ${PROJECT_TYPE_LABEL[projectType]}${trackInfo ? ' — ' + trackInfo.title : ''}`,
      html: `
        <h2>Новая заявка на B2B-лицензию</h2>
        <p><b>ID заявки:</b> ${req.id}</p>
        ${trackInfo ? `<p><b>Трек:</b> ${trackInfo.title}${trackInfo.artistName ? ' — ' + trackInfo.artistName : ''}<br><b>ID трека:</b> ${trackInfo.id}</p>` : '<p><i>Заявка без привязки к конкретному треку.</i></p>'}
        <hr>
        <p><b>Тип проекта:</b> ${PROJECT_TYPE_LABEL[projectType]}<br>
           <b>Бюджет:</b> ${BUDGET_LABEL[budget]}</p>
        <p><b>Контактное лицо:</b> ${contactName}<br>
           <b>Компания:</b> ${companyName || '—'}<br>
           <b>Email:</b> <a href="mailto:${email}">${email}</a><br>
           <b>Телефон:</b> ${phone || '—'}</p>
        ${cleanMessage ? `<p><b>Описание проекта:</b><br>${cleanMessage.replace(/\n/g, '<br>')}</p>` : ''}
        <hr>
        <p>Свяжитесь с клиентом, уточните детали (территория, срок, медиа), подготовьте индивидуальный договор и счёт.</p>
        <p style="color:#888;font-size:12px">Открыть заявку в админке: <a href="${process.env.NEXT_PUBLIC_API_URL || 'https://sonatum-music.ru'}/admin/inquiries">/admin/inquiries</a></p>
      `,
    }).catch(() => {});

    // 2) Подтверждение клиенту
    await sendMail({
      to: email,
      subject: `Сонатум: ваша заявка на лицензию принята`,
      html: `
        <h2>Заявка принята в работу</h2>
        <p>Здравствуйте, ${contactName}!</p>
        <p>Мы получили вашу заявку на лицензирование${trackInfo ? ` трека «<b>${trackInfo.title}</b>»${trackInfo.artistName ? ' — ' + trackInfo.artistName : ''}` : ''} для проекта типа <b>${PROJECT_TYPE_LABEL[projectType]}</b>.</p>
        <p>Менеджер свяжется с вами в течение 1–2 рабочих дней по адресу <b>${email}</b>${phone ? ` или по телефону <b>${phone}</b>` : ''} для уточнения деталей: территории, срока использования, типа медиа.</p>
        <p>После согласования вы получите:</p>
        <ul>
          <li>Индивидуальный лицензионный договор</li>
          <li>Счёт на оплату</li>
          <li>После оплаты — файл с треком в высоком качестве и подписанный договор (PDF)</li>
        </ul>
        <p>ID вашей заявки: <code>${req.id}</code></p>
        <hr>
        <p style="color:#888;font-size:12px">Это автоматическое уведомление. При вопросах напишите на ${managerTo}.</p>
      `,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      id: req.id,
      message: 'Заявка принята. Менеджер свяжется с вами в течение 1–2 рабочих дней.',
    }, { headers: corsHeaders });
  } catch (error) {
    console.error('[B2B_LICENSE_ERROR]', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка создания заявки на лицензию' },
      { status: 500, headers: corsHeaders }
    );
  }
}
