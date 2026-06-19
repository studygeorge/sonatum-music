import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AuthService } from '@/lib/auth';
import { getCorsHeaders } from '@/lib/cors';
import { addRecipientByRequisites, listRecipients, mapRecipientStatus, TBANK_MOCK } from '@/lib/tbank-se';

export const dynamic = 'force-dynamic';

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request.headers.get('origin') || undefined),
  });
}

async function requireArtist(request: NextRequest) {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const s = await AuthService.validateSession(auth.substring(7));
  if (!s) return null;
  if (s.role !== 'ARTIST' && s.role !== 'ADMIN' && s.role !== 'SUPER_ADMIN') return null;
  return s;
}

/**
 * GET /api/author/payout/self-employed
 * Текущее состояние подключения самозанятого: статус, способ, реквизиты.
 */
export async function GET(request: NextRequest) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const s = await requireArtist(request);
  if (!s) return NextResponse.json({ success: false, error: 'Доступ запрещён' }, { status: 403, headers: cors });

  const [u] = (await prisma.$queryRawUnsafe(
    `SELECT id, "firstName", "lastName", email, balance,
            recipient_id, self_employed_status, recipient_status_checked_at,
            tbank_card_holder, payout_method, payout_account_number, payout_full_name,
            payout_bik,
            tin, sbp_phone
       FROM users WHERE id = $1`,
    s.userId
  )) as any[];

  return NextResponse.json({
    success: true,
    data: {
      user: {
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        balance: Number(u.balance || 0),
      },
      selfEmployed: {
        status: u.self_employed_status || 'NOT_REGISTERED',
        recipientId: u.recipient_id,
        lastCheckedAt: u.recipient_status_checked_at,
        method: u.payout_method,                                  // TBANK_CARD_NEW / TBANK_CARD_EXISTING / OTHER_BANK
        cardHolder: !!u.tbank_card_holder,
        accountNumber: u.payout_account_number ? maskAccount(u.payout_account_number) : null,
        bik: u.payout_bik,
        fullName: u.payout_full_name,
        inn: u.tin,
      },
      tbankMock: TBANK_MOCK,
    },
  }, { headers: cors });
}

/**
 * POST /api/author/payout/self-employed
 * Подключение выплат — пользователь выбрал способ и ввёл реквизиты.
 * Body: {
 *   method: 'TBANK_CARD_NEW'|'TBANK_CARD_EXISTING'|'OTHER_BANK',
 *   fullName: 'Иванов Иван Иванович',
 *   inn: '123456789012',
 *   accountNumber: '40817810...'
 * }
 *
 * Логика:
 *  - сохраняем реквизиты в users
 *  - TBANK_CARD_* → tbank_card_holder=true (taxHolding можно использовать)
 *  - OTHER_BANK   → tbank_card_holder=false (банк не удержит НПД, автор сам)
 *  - вызываем addRecipientByRequisites → recipient_id, статус DRAFT/CREATED
 */
export async function POST(request: NextRequest) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const s = await requireArtist(request);
  if (!s) return NextResponse.json({ success: false, error: 'Доступ запрещён' }, { status: 403, headers: cors });

  const body = await request.json().catch(() => ({}));
  const method = String(body.method || '');
  const fullName = String(body.fullName || '').trim();
  const inn = String(body.inn || '').replace(/\D/g, '');
  const accountNumber = String(body.accountNumber || '').replace(/\s/g, '');
  const bik = String(body.bik || '').replace(/\D/g, '');

  if (!['TBANK_CARD_NEW', 'TBANK_CARD_EXISTING', 'OTHER_BANK'].includes(method)) {
    return NextResponse.json({ success: false, error: 'Выберите способ выплаты' }, { status: 400, headers: cors });
  }
  if (!fullName.match(/^[А-ЯЁ][а-яёА-ЯЁ\- ]+\s[А-ЯЁ][а-яёА-ЯЁ\-]+(\s[А-ЯЁ][а-яёА-ЯЁ\-]+)?$/)) {
    return NextResponse.json({ success: false, error: 'Введите ФИО как в паспорте' }, { status: 400, headers: cors });
  }
  if (!/^\d{12}$/.test(inn)) {
    return NextResponse.json({ success: false, error: 'ИНН — 12 цифр' }, { status: 400, headers: cors });
  }
  if (!/^\d{20}$|^\d{16,19}$/.test(accountNumber)) {
    return NextResponse.json({ success: false, error: 'Номер счёта (20 цифр) или карты (16-19 цифр)' }, { status: 400, headers: cors });
  }
  if (!/^\d{9}$/.test(bik)) {
    return NextResponse.json({ success: false, error: 'БИК банка — 9 цифр' }, { status: 400, headers: cors });
  }

  const [lastName, firstName, middleName] = (() => {
    const parts = fullName.split(/\s+/);
    return [parts[0] || '', parts[1] || '', parts[2] || undefined];
  })();

  const cardHolder = method !== 'OTHER_BANK';

  // Сохраняем в БД
  await prisma.$executeRawUnsafe(
    `UPDATE users SET
        payout_method = $1,
        payout_full_name = $2,
        tin = $3,
        payout_account_number = $4,
        payout_bik = $5,
        tbank_card_holder = $6,
        self_employed_status = 'DRAFT'
      WHERE id = $7`,
    method, fullName, inn, accountNumber, bik, cardHolder, s.userId
  );

  // Регистрируем в T-Bank (через helper — MOCK или реальный)
  let recipientId: string | undefined;
  let status = 'DRAFT';
  let warning: string | undefined;
  try {
    const res = await addRecipientByRequisites({
      firstName, lastName, middleName, inn, accountNumber, bik,
    });
    recipientId = res.recipientId;
    if (res.status === 'CREATED') status = 'DRAFT';      // создано, ждёт подтверждения автора
    if (res.status === 'ERROR')   status = 'REJECTED';
    if (recipientId) {
      await prisma.$executeRawUnsafe(
        `UPDATE users SET recipient_id = $1, self_employed_status = $2 WHERE id = $3`,
        recipientId, status, s.userId
      );
    }
  } catch (e: any) {
    console.error('[SE_REGISTER]', e);
    warning = 'T-Bank временно недоступен — заявка сохранена, синхронизируем позже';
  }

  return NextResponse.json({
    success: true,
    data: {
      status,
      recipientId,
      method,
      cardHolder,
      mock: TBANK_MOCK,
      nextStep: cardHolder
        ? 'Откройте «Мой налог» → раздел «Партнёры» (доступ к данным). Там появится запрос от Т-Банка — одобрите его. Это разрешение нужно для получения вашего статуса самозанятого из ФНС. Если вы ещё не зарегистрированы в «Мой налог», сделайте это сначала.'
        : 'Дождитесь подтверждения статуса. Налог НПД 6% вам нужно будет платить самостоятельно через «Мой налог».',
      warning,
    },
  }, { headers: cors });
}

/**
 * PATCH /api/author/payout/self-employed
 * Принудительная синхронизация статуса (вызывает /recipients/list).
 * Используется автором кнопкой «Проверить статус» или cron-задачей.
 */
export async function PATCH(request: NextRequest) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const s = await requireArtist(request);
  if (!s) return NextResponse.json({ success: false, error: 'Доступ запрещён' }, { status: 403, headers: cors });

  const [u] = (await prisma.$queryRawUnsafe(
    `SELECT recipient_id FROM users WHERE id = $1`,
    s.userId
  )) as any[];
  if (!u?.recipient_id) {
    return NextResponse.json({ success: false, error: 'Сначала подключите выплаты' }, { status: 400, headers: cors });
  }

  try {
    const list = await listRecipients([u.recipient_id]);
    const rec = (list?.recipients || []).find((r: any) => r.recipientId === u.recipient_id);
    const status = rec ? mapRecipientStatus(rec) : 'UNKNOWN';
    await prisma.$executeRawUnsafe(
      `UPDATE users SET self_employed_status = $1, recipient_status_checked_at = now() WHERE id = $2`,
      status, s.userId
    );
    return NextResponse.json({ success: true, data: { status, mock: TBANK_MOCK } }, { headers: cors });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Ошибка проверки статуса' }, { status: 502, headers: cors });
  }
}

function maskAccount(acc: string): string {
  if (acc.length <= 4) return acc;
  return `••• ${acc.slice(-4)}`;
}
