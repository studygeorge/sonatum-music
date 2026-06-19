import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AuthService } from '@/lib/auth';
import { getCorsHeaders } from '@/lib/cors';
import { sendMail } from '@/lib/mailer';
import {
  createRegistry, submitRegistry, payRegistry, getRegistry, fiscalizeReceipts,
  newCorrelationId, TBANK_MOCK,
} from '@/lib/tbank-se';
import { saveReceiptFile } from '@/lib/receipts';

import { logError } from '@/lib/errors';
export const dynamic = 'force-dynamic';

const SITE_URL = process.env.SITE_URL || 'https://sonatum-music.ru';
const BILLING_EMAIL = process.env.SONATUM_BILLING_EMAIL || 'info@sonatum-music.ru';
const MIN_PAYOUT = 1000;
const TAX_RATE = 0.06; // НПД 6%

function pid(): string {
  return 'po_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}
function rid(): string {
  return 'pr_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request.headers.get('origin') || undefined),
  });
}

/**
 * GET /api/author/payout/withdraw — история выплат
 */
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

  const rows = (await prisma.$queryRawUnsafe(
    `SELECT p.id, p.gross, p.tax, p.net, p.tax_holding, p.status,
            p.receipt_url, p.receipt_file_path, p.error, p.admin_comment, p.triggered_by_admin,
            p.created_at, p.paid_at,
            r.tbank_registry_id, r.status AS registry_status
       FROM payouts p
       LEFT JOIN payout_registries r ON r.id = p.registry_id
      WHERE p.user_id = $1
      ORDER BY p.created_at DESC
      LIMIT 100`,
    session.userId
  )) as any[];

  return NextResponse.json({
    success: true,
    data: rows.map((r) => ({
      id: r.id,
      gross: Number(r.gross),
      tax: Number(r.tax),
      net: Number(r.net),
      taxHolding: r.tax_holding,
      status: r.status,
      // Локальная копия чека приоритетнее — она у нас навсегда
      receiptUrl: r.receipt_file_path || r.receipt_url,
      receiptOriginal: r.receipt_url,
      error: r.error,
      adminComment: r.admin_comment,
      isForced: !!r.triggered_by_admin,
      createdAt: r.created_at,
      paidAt: r.paid_at,
      registryId: r.tbank_registry_id ? Number(r.tbank_registry_id) : null,
      registryStatus: r.registry_status,
    })),
  }, { headers: cors });
}

/**
 * POST /api/author/payout/withdraw  { amount }
 *
 * Полный цикл по ТЗ:
 *  1. Проверки: ACTIVE, баланс >= MIN, выплаты не заблокированы (1-5 число)
 *  2. Создаём payout_registries + payouts
 *  3. T-Bank: create → submit → pay → wait EXECUTED → fiscalize → receipts
 *  4. Списываем с users.balance
 *  5. Письма автору + в финотдел
 *
 * В MOCK-режиме flow идёт целиком, статусы EXECUTED, ссылка на чек синтетическая.
 */
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

  const body = await request.json().catch(() => ({}));
  const amount = Math.floor(Number(body.amount) || 0);
  if (!amount || amount < MIN_PAYOUT) {
    return NextResponse.json(
      { success: false, error: `Минимальная сумма вывода — ${MIN_PAYOUT} ₽` },
      { status: 400, headers: cors }
    );
  }

  // Проверка глобальной блокировки (с 1 по 5 число месяца — расчёт пула)
  const blockedUntil = await getBlockedUntil();
  if (blockedUntil) {
    return NextResponse.json({
      success: false,
      error: `Выплаты временно заблокированы до ${blockedUntil.toLocaleDateString('ru-RU')} — идёт расчёт подписочного пула за прошлый месяц.`,
    }, { status: 423, headers: cors });
  }

  const [u] = (await prisma.$queryRawUnsafe(
    `SELECT id, email, "firstName", "lastName", balance,
            recipient_id, self_employed_status, tbank_card_holder,
            payout_method, payout_account_number, payout_full_name, tin
       FROM users WHERE id = $1`,
    session.userId
  )) as any[];

  if (!u) {
    return NextResponse.json({ success: false, error: 'Пользователь не найден' }, { status: 404, headers: cors });
  }
  if (u.self_employed_status !== 'ACTIVE') {
    return NextResponse.json({
      success: false,
      error: 'Для вывода средств подтвердите статус самозанятого. Откройте раздел «Выплаты».',
      code: 'NOT_ACTIVE',
    }, { status: 400, headers: cors });
  }
  if (!u.payout_account_number || !u.payout_full_name || !u.tin) {
    return NextResponse.json({
      success: false,
      error: 'Сначала заполните реквизиты в разделе «Выплаты».',
    }, { status: 400, headers: cors });
  }
  if (Number(u.balance) < amount) {
    return NextResponse.json({ success: false, error: 'Недостаточно средств на балансе' }, { status: 400, headers: cors });
  }

  // taxHolding только для держателей карты Т-Банка
  const taxHolding = !!u.tbank_card_holder;
  const tax = taxHolding ? Math.round(amount * TAX_RATE * 100) / 100 : 0;
  const net = Math.round((amount - tax) * 100) / 100;

  const [lastName, firstName, middleName] = String(u.payout_full_name).split(/\s+/);

  // Создаём наш реестр и payout
  const registryId = rid();
  const payoutId = pid();
  const corrId = newCorrelationId();

  await prisma.$transaction([
    prisma.$executeRawUnsafe(
      `INSERT INTO payout_registries (id, correlation_id, status, total_gross, total_net, total_tax, payment_count, created_by)
       VALUES ($1, $2, 'DRAFT', $3, $4, $5, 1, $6)`,
      registryId, corrId, amount, net, tax, session.userId
    ),
    prisma.$executeRawUnsafe(
      `INSERT INTO payouts (id, registry_id, user_id, gross, tax, net, tax_holding, income_type,
                            account_number, payment_purpose, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'FROM_LEGAL_ENTITY', $8, $9, 'PENDING')`,
      payoutId, registryId, session.userId, amount, tax, net, taxHolding,
      u.payout_account_number,
      'Выплата вознаграждения по лицензионному договору'
    ),
    // Списание с баланса сразу — чтобы не запрашивали повторно. При REJECTED вернём.
    prisma.user.update({
      where: { id: session.userId },
      data: { balance: { decrement: amount } },
    }),
  ]);

  // Запускаем flow в T-Bank (MOCK или реальный)
  try {
    // 1. Create
    const created = await createRegistry({
      correlationId: corrId,
      registryCreateType: 'IGNORE_ERRORS',
      payments: [{
        number: 1,
        accountNumber: u.payout_account_number,
        paymentPurpose: 'Выплата вознаграждения по лицензионному договору',
        selfEmployedInfo: { firstName, lastName, middleName, inn: u.tin },
        sum: amount,
        taxHolding,
        incomeType: 'FROM_LEGAL_ENTITY',
      }],
    });
    if (created.status !== 'CREATED' || !created.paymentRegistryId) {
      throw new Error(`T-Bank create: ${created.status}`);
    }
    const tbankRegistryId = created.paymentRegistryId;

    await prisma.$executeRawUnsafe(
      `UPDATE payout_registries SET tbank_registry_id = $1, status = 'CREATED' WHERE id = $2`,
      tbankRegistryId, registryId
    );

    // 2. Submit
    const submitted = await submitRegistry(tbankRegistryId, corrId);
    if (submitted.status !== 'ACCEPTED') throw new Error(`T-Bank submit: ${submitted.status}`);
    await prisma.$executeRawUnsafe(
      `UPDATE payout_registries SET status = 'ACCEPTED', submitted_at = now() WHERE id = $1`,
      registryId
    );

    // 3. Pay
    const paid = await payRegistry(tbankRegistryId, corrId);
    if (paid.status === 'ERROR' || paid.status === 'REJECTED') {
      throw new Error(`T-Bank pay: ${paid.status}`);
    }
    await prisma.$executeRawUnsafe(
      `UPDATE payout_registries SET status = $1, paid_at = now() WHERE id = $2`,
      paid.status, registryId
    );

    // 4. Если уже EXECUTED — фискализуем чеки. Иначе оставляем для cron-наблюдателя.
    let receiptUrl: string | null = null;
    let receiptLocal: string | null = null;
    if (paid.status === 'EXECUTED' || TBANK_MOCK) {
      const receipts = await fiscalizeReceipts(tbankRegistryId, corrId);
      if (receipts.status === 'FINISHED' && receipts.receipts?.[0]?.receiptUrl) {
        receiptUrl = u;
        // Скачиваем чек к нам в локальное хранилище (защита от протухания ссылки ФНС)
        try { receiptLocal = await saveReceiptFile(payoutId, session.userId, u); } catch {}
      }
      await prisma.$executeRawUnsafe(
        `UPDATE payouts SET status = 'EXECUTED', receipt_url = $1, receipt_file_path = $2, paid_at = now() WHERE id = $3`,
        receiptUrl, receiptLocal, payoutId
      );
      await prisma.$executeRawUnsafe(
        `UPDATE payout_registries SET status = 'EXECUTED', finalized_at = now() WHERE id = $1`,
        registryId
      );
    } else {
      // SENT / IN_PROGRESS — cron позже добьёт
      await prisma.$executeRawUnsafe(
        `UPDATE payouts SET status = 'IN_PROGRESS' WHERE id = $1`,
        payoutId
      );
    }

    // Письма
    const finalReceiptUrl = receiptLocal ? `${SITE_URL}${receiptLocal}` : receiptUrl;
    sendPayoutEmails({
      to: u.email, firstName: u.firstName, lastName: u.lastName,
      amount, tax, net, taxHolding,
      receiptUrl: finalReceiptUrl, payoutId, registryId: tbankRegistryId,
    }).catch((e) => console.error('[PAYOUT_MAIL]', e));

    return NextResponse.json({
      success: true,
      data: {
        payoutId,
        registryId,
        tbankRegistryId,
        amount, tax, net,
        taxHolding,
        status: paid.status,
        receiptUrl,
        mock: TBANK_MOCK,
        message: TBANK_MOCK
          ? 'Выплата проведена в MOCK-режиме (без реального перевода). Подключите токен T-Bank для боевого режима.'
          : `Выплата отправлена. Деньги поступят в течение 1–3 рабочих дней. Чек ${receiptUrl ? 'уже доступен' : 'будет сформирован после исполнения'}.`,
      },
    }, { headers: cors });

  } catch (e: any) {
    logError('payout.withdraw', e, { request, extra: { tag: 'PAYOUT_ERROR' } }).catch(()=>{}); console.error('[PAYOUT_ERROR]', e);
    // Откатываем баланс и метим записи
    await prisma.$transaction([
      prisma.user.update({ where: { id: session.userId }, data: { balance: { increment: amount } } }),
      prisma.$executeRawUnsafe(
        `UPDATE payouts SET status = 'ERROR', error = $1::jsonb WHERE id = $2`,
        JSON.stringify({ message: e?.message || String(e) }), payoutId
      ),
      prisma.$executeRawUnsafe(
        `UPDATE payout_registries SET status = 'ERROR', last_error = $1::jsonb WHERE id = $2`,
        JSON.stringify({ message: e?.message || String(e) }), registryId
      ),
    ]);
    return NextResponse.json({
      success: false,
      error: 'Не удалось провести выплату: ' + (e?.message || 'неизвестная ошибка') + '. Баланс возвращён.',
    }, { status: 502, headers: cors });
  }
}

// ─── helpers ────────────────────────────────────────────────────────────

async function getBlockedUntil(): Promise<Date | null> {
  const [row] = (await prisma.$queryRawUnsafe(
    `SELECT blocked_until FROM payout_schedule
      WHERE blocked_until > now() AND (blocked_from IS NULL OR blocked_from <= now())
      ORDER BY blocked_until DESC LIMIT 1`
  )) as any[];
  return row?.blocked_until ? new Date(row.blocked_until) : null;
}

async function sendPayoutEmails(args: {
  to: string; firstName?: string; lastName?: string;
  amount: number; tax: number; net: number; taxHolding: boolean;
  receiptUrl: string | null; payoutId: string; registryId: number;
}) {
  const { to, firstName, amount, tax, net, taxHolding, receiptUrl, payoutId, registryId } = args;
  if (!to) return;
  const greeting = firstName || 'друг';
  const taxLine = taxHolding
    ? `<div style="font-size:13px;color:#86868b;margin-top:6px;">Удержан НПД 6%: ${tax.toLocaleString('ru-RU')} ₽</div>`
    : `<div style="font-size:13px;color:#86868b;margin-top:6px;">Налог НПД 6% оплатите самостоятельно через «Мой налог».</div>`;

  await sendMail({
    to,
    subject: `Выплата отправлена · ${net.toLocaleString('ru-RU')} ₽ · Сонатум`,
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:560px;margin:0 auto;padding:32px;color:#1c1c1e;">
        <h1 style="font-size:22px;margin:0 0 16px;">Выплата отправлена</h1>
        <p style="font-size:15px;line-height:1.6;">Здравствуйте, ${greeting}!</p>
        <div style="background:#f4f4f7;border-radius:16px;padding:20px;margin:20px 0;">
          <div style="font-size:13px;color:#86868b;">К получению на карту</div>
          <div style="font-size:28px;font-weight:800;color:#1c1c1e;">${net.toLocaleString('ru-RU')} ₽</div>
          <div style="font-size:13px;color:#86868b;margin-top:6px;">из ${amount.toLocaleString('ru-RU')} ₽ вознаграждения</div>
          ${taxLine}
        </div>
        <p style="font-size:14px;line-height:1.6;">№ платежа: <code>${payoutId}</code> · реестр Т-Банка: <code>${registryId}</code></p>
        ${receiptUrl ? `<p style="font-size:14px;line-height:1.6;"><a href="${receiptUrl}" style="color:#1c1c1e;">Скачать чек ФНС (PDF)</a></p>` : `<p style="font-size:13px;color:#86868b;">Чек ФНС будет сформирован после исполнения платежа и придёт отдельным письмом.</p>`}
        <a href="${SITE_URL}/author/finance" style="display:inline-block;background:#1c1c1e;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:600;font-size:14px;margin-top:16px;">Открыть финансы</a>
      </div>
    `,
  });

  // Копия в финотдел
  await sendMail({
    to: BILLING_EMAIL,
    subject: `[Сонатум] Выплата ${amount.toLocaleString('ru-RU')} ₽ · ${to}`,
    html: `
      <h2>Выплата</h2>
      <p>№ платежа: ${payoutId}<br>
         Реестр Т-Банка: ${registryId}<br>
         Получатель: ${to}<br>
         Брутто: ${amount} ₽ · Налог: ${tax} ₽ · Нетто: ${net} ₽<br>
         taxHolding: ${taxHolding ? 'да' : 'нет'}</p>
    `,
  }).catch(() => {});
}
