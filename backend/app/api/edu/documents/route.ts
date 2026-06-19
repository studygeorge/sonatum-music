import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AuthService } from '@/lib/auth';
import { getCorsHeaders } from '@/lib/cors';
import { ensureDocument } from '@/lib/edu-docs';
import { sendMail } from '@/lib/mailer';

export const dynamic = 'force-dynamic';

function cuid() {
  return 'edr_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
}

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request.headers.get('origin') || undefined),
  });
}

async function getMyAdminInstitution(userId: string) {
  const [r] = (await prisma.$queryRawUnsafe(
    `SELECT * FROM edu_institutions WHERE admin_user_id = $1 AND status IN ('ACTIVE','APPROVED') LIMIT 1`,
    userId
  )) as any[];
  return r || null;
}

const KIND_TITLE: Record<string, string> = {
  CONTRACT: 'Лицензионный договор',
  INVOICE: 'Счёт на оплату',
  ACT: 'Акт оказанных услуг',
};

const KIND_DESC: Record<string, string> = {
  CONTRACT: 'Договор простой неисключительной лицензии на использование контента «Сонатум».',
  INVOICE: 'Счёт на оплату годовой лицензии для безналичной оплаты с расчётного счёта.',
  ACT: 'Подтверждение факта оказания услуг по предоставлению доступа за оплаченный период.',
};

const KIND_URL: Record<string, string> = {
  CONTRACT: '/api/edu/documents/contract.pdf',
  INVOICE: '/api/edu/documents/invoice.pdf',
  ACT: '/api/edu/documents/act.pdf',
};

// GET /api/edu/documents — список основных документов (с реальными номерами) + история запросов
export async function GET(request: NextRequest) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) {
    return NextResponse.json({ success: false, error: 'Требуется авторизация' }, { status: 401, headers: cors });
  }
  const session = await AuthService.validateSession(auth.substring(7));
  if (!session) {
    return NextResponse.json({ success: false, error: 'Сессия истекла' }, { status: 401, headers: cors });
  }
  const inst = await getMyAdminInstitution(session.userId);
  if (!inst) {
    return NextResponse.json({ success: false, error: 'Только администратор учреждения' }, { status: 403, headers: cors });
  }

  const year = (inst.paid_at ? new Date(inst.paid_at) : new Date()).getFullYear();
  const amountKopecks = inst.annual_fee ? Math.round(Number(inst.annual_fee) * 100) : null;
  const periodFrom = inst.paid_at ? new Date(inst.paid_at) : null;
  const periodTo = inst.expires_at ? new Date(inst.expires_at) : null;

  // Выпускаем (или получаем существующие) три документа
  const kinds = ['CONTRACT', 'INVOICE', 'ACT'] as const;
  const issued = await Promise.all(kinds.map(k => ensureDocument({
    institutionId: inst.id,
    kind: k,
    year,
    amountKopecks,
    periodFrom,
    periodTo,
  })));

  const baseDocs = kinds.map((k, i) => ({
    kind: k,
    title: KIND_TITLE[k],
    description: KIND_DESC[k],
    number: issued[i].number,
    issuedAt: issued[i].issuedAt,
    downloadUrl: KIND_URL[k],
  }));

  const requests = (await prisma.$queryRawUnsafe(
    `SELECT id, period_from, period_to, contact_email, comment, status, created_at, fulfilled_at
       FROM edu_document_requests WHERE institution_id = $1
      ORDER BY created_at DESC LIMIT 50`,
    inst.id
  )) as any[];

  return NextResponse.json({
    success: true,
    data: {
      documents: baseDocs,
      requests: requests.map(r => ({
        id: r.id,
        periodFrom: r.period_from,
        periodTo: r.period_to,
        contactEmail: r.contact_email,
        comment: r.comment,
        status: r.status,
        createdAt: r.created_at,
        fulfilledAt: r.fulfilled_at,
      })),
    },
  }, { headers: cors });
}

// POST /api/edu/documents — запрос закрывающих документов за период
export async function POST(request: NextRequest) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) {
    return NextResponse.json({ success: false, error: 'Требуется авторизация' }, { status: 401, headers: cors });
  }
  const session = await AuthService.validateSession(auth.substring(7));
  if (!session) {
    return NextResponse.json({ success: false, error: 'Сессия истекла' }, { status: 401, headers: cors });
  }
  const inst = await getMyAdminInstitution(session.userId);
  if (!inst) {
    return NextResponse.json({ success: false, error: 'Только администратор учреждения' }, { status: 403, headers: cors });
  }

  let body: any;
  try { body = await request.json(); } catch { body = {}; }
  const periodFrom = body.periodFrom ? new Date(body.periodFrom) : null;
  const periodTo = body.periodTo ? new Date(body.periodTo) : null;
  const contactEmail = String(body.contactEmail || inst.contact_email || '').trim();
  const comment = body.comment ? String(body.comment).trim().slice(0, 1000) : null;

  if (!periodFrom || !periodTo || isNaN(periodFrom.getTime()) || isNaN(periodTo.getTime())) {
    return NextResponse.json({ success: false, error: 'Укажите корректный период' }, { status: 400, headers: cors });
  }
  if (periodFrom > periodTo) {
    return NextResponse.json({ success: false, error: 'Начало периода позже конца' }, { status: 400, headers: cors });
  }
  if (!contactEmail || !contactEmail.includes('@')) {
    return NextResponse.json({ success: false, error: 'Укажите email для отправки' }, { status: 400, headers: cors });
  }

  const id = cuid();
  await prisma.$executeRawUnsafe(
    `INSERT INTO edu_document_requests (id, institution_id, requested_by_user_id, period_from, period_to, contact_email, comment, status)
     VALUES ($1, $2, $3, $4::date, $5::date, $6, $7, 'PENDING')`,
    id, inst.id, session.userId,
    periodFrom.toISOString().slice(0, 10),
    periodTo.toISOString().slice(0, 10),
    contactEmail, comment
  );

  // === Уведомления по email ===
  const periodStr = `${periodFrom.toLocaleDateString('ru-RU')} — ${periodTo.toLocaleDateString('ru-RU')}`;
  const billingTo = process.env.SONATUM_BILLING_EMAIL || 'billing@sonatum-music.ru';

  // 1) Бухгалтерии Сонатума
  await sendMail({
    to: billingTo,
    subject: `[Сонатум · EDU] Запрос закрывающих: ${inst.short_name || inst.full_name}`,
    html: `
      <h2>Новый запрос закрывающих документов</h2>
      <p><b>Учреждение:</b> ${inst.full_name || '—'}<br>
         <b>ИНН:</b> ${inst.inn || '—'}<br>
         <b>Контакт:</b> ${inst.contact_name || '—'} (${inst.contact_email || '—'}, ${inst.contact_phone || '—'})</p>
      <p><b>Период:</b> ${periodStr}<br>
         <b>Email для отправки:</b> ${contactEmail}</p>
      ${comment ? `<p><b>Комментарий:</b><br>${comment.replace(/\n/g, '<br>')}</p>` : ''}
      <p><b>ID запроса:</b> ${id}</p>
      <hr>
      <p style="color:#888;font-size:12px">Сформировано автоматически из кабинета /edu/documents.</p>
    `,
  }).catch(() => {});

  // 2) Подтверждение учреждению
  await sendMail({
    to: contactEmail,
    subject: `Сонатум: запрос закрывающих принят (${periodStr})`,
    html: `
      <h2>Запрос принят в работу</h2>
      <p>${inst.contact_name ? 'Здравствуйте, ' + inst.contact_name + '!' : 'Здравствуйте!'}</p>
      <p>Мы получили ваш запрос на пакет закрывающих документов для <b>${inst.full_name || 'учреждения'}</b> за период <b>${periodStr}</b>.</p>
      <p>Подготовленный пакет (счёт, акт, при необходимости договор) будет отправлен на <b>${contactEmail}</b> в течение 3 рабочих дней.</p>
      ${comment ? `<p>Ваш комментарий: «${comment}»</p>` : ''}
      <p>ID запроса: <code>${id}</code></p>
      <hr>
      <p style="color:#888;font-size:12px">Это автоматическое уведомление с платформы «Сонатум». При вопросах напишите на ${billingTo}.</p>
    `,
  }).catch(() => {});

  return NextResponse.json({
    success: true,
    message: 'Запрос принят. Документы будут отправлены на указанный email в течение 3 рабочих дней. Подтверждение отправлено вам на почту.',
    id,
  }, { headers: cors });
}
