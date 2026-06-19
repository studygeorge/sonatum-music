import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AuthService } from '@/lib/auth';
import { getCorsHeaders } from '@/lib/cors';
import { sendMail } from '@/lib/mailer';
import {
  createRegistry, submitRegistry, payRegistry, fiscalizeReceipts,
  newCorrelationId, TBANK_MOCK,
} from '@/lib/tbank-se';
import { saveReceiptFile } from '@/lib/receipts';

import { logError } from '@/lib/errors';
export const dynamic = 'force-dynamic';

const SITE_URL = process.env.SITE_URL || 'https://sonatum-music.ru';
const BILLING_EMAIL = process.env.SONATUM_BILLING_EMAIL || 'info@sonatum-music.ru';
const TAX_RATE = 0.06;

function pid(): string { return 'po_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10); }
function rid(): string { return 'pr_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10); }

export async function OPTIONS(request: NextRequest) {
  return new Response(null, { status: 204, headers: getCorsHeaders(request.headers.get('origin') || undefined) });
}

/**
 * POST /api/admin/force-payout
 * Body: { authorId, amount, comment }
 *
 * Принудительная выплата автору админом (вне штатного flow).
 * Те же проверки что у автора (ACTIVE, реквизиты), но без минимума и без блокировки cron.
 * Обязательный комментарий и логирование.
 */
export async function POST(request: NextRequest) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) {
    return NextResponse.json({ success: false, error: 'forbidden' }, { status: 401, headers: cors });
  }
  const admin = await AuthService.validateSession(auth.substring(7));
  if (!admin || (admin.role !== 'ADMIN' && admin.role !== 'SUPER_ADMIN')) {
    return NextResponse.json({ success: false, error: 'forbidden' }, { status: 403, headers: cors });
  }

  const body = await request.json().catch(() => ({}));
  const authorId = String(body.authorId || '');
  const amount = Math.floor(Number(body.amount) || 0);
  const comment = String(body.comment || '').slice(0, 1000);

  if (!authorId || !amount || amount <= 0 || !comment.trim()) {
    return NextResponse.json({
      success: false,
      error: 'Заполните автора, сумму и обязательный комментарий',
    }, { status: 400, headers: cors });
  }

  const [u] = (await prisma.$queryRawUnsafe(
    `SELECT id, email, "firstName", "lastName", balance,
            self_employed_status, tbank_card_holder,
            payout_account_number, payout_full_name, tin
       FROM users WHERE id = $1`,
    authorId
  )) as any[];

  if (!u) return NextResponse.json({ success: false, error: 'Автор не найден' }, { status: 404, headers: cors });
  if (u.self_employed_status !== 'ACTIVE') {
    return NextResponse.json({ success: false, error: 'Статус самозанятого должен быть ACTIVE' }, { status: 400, headers: cors });
  }
  if (!u.payout_account_number || !u.payout_full_name || !u.tin) {
    return NextResponse.json({ success: false, error: 'У автора не заполнены реквизиты' }, { status: 400, headers: cors });
  }
  if (Number(u.balance) < amount) {
    return NextResponse.json({ success: false, error: 'Недостаточно средств на балансе автора' }, { status: 400, headers: cors });
  }

  const taxHolding = !!u.tbank_card_holder;
  const tax = taxHolding ? Math.round(amount * TAX_RATE * 100) / 100 : 0;
  const net = Math.round((amount - tax) * 100) / 100;

  const [lastName, firstName, middleName] = String(u.payout_full_name).split(/\s+/);
  const registryId = rid();
  const payoutId = pid();
  const corrId = newCorrelationId();

  await prisma.$transaction([
    prisma.$executeRawUnsafe(
      `INSERT INTO payout_registries (id, correlation_id, status, total_gross, total_net, total_tax, payment_count, created_by, comment)
       VALUES ($1, $2, 'DRAFT', $3, $4, $5, 1, $6, $7)`,
      registryId, corrId, amount, net, tax, admin.userId, `[FORCE] ${comment}`
    ),
    prisma.$executeRawUnsafe(
      `INSERT INTO payouts (id, registry_id, user_id, gross, tax, net, tax_holding, income_type,
                            account_number, payment_purpose, status, triggered_by_admin, admin_comment)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'FROM_LEGAL_ENTITY', $8, $9, 'PENDING', $10, $11)`,
      payoutId, registryId, authorId, amount, tax, net, taxHolding,
      u.payout_account_number, 'Выплата вознаграждения (принудительная)',
      admin.userId, comment
    ),
    prisma.user.update({ where: { id: authorId }, data: { balance: { decrement: amount } } }),
  ]);

  try {
    const created = await createRegistry({
      correlationId: corrId,
      registryCreateType: 'IGNORE_ERRORS',
      payments: [{
        number: 1,
        accountNumber: u.payout_account_number,
        paymentPurpose: 'Выплата вознаграждения по лицензионному договору',
        selfEmployedInfo: { firstName, lastName, middleName, inn: u.tin },
        sum: amount, taxHolding, incomeType: 'FROM_LEGAL_ENTITY',
      }],
    });
    if (created.status !== 'CREATED' || !created.paymentRegistryId) throw new Error(`create: ${created.status}`);
    const tbankRegistryId = created.paymentRegistryId;
    await prisma.$executeRawUnsafe(
      `UPDATE payout_registries SET tbank_registry_id = $1, status = 'CREATED' WHERE id = $2`,
      tbankRegistryId, registryId
    );

    const submitted = await submitRegistry(tbankRegistryId, corrId);
    if (submitted.status !== 'ACCEPTED') throw new Error(`submit: ${submitted.status}`);
    await prisma.$executeRawUnsafe(
      `UPDATE payout_registries SET status = 'ACCEPTED', submitted_at = now() WHERE id = $1`,
      registryId
    );

    const paid = await payRegistry(tbankRegistryId, corrId);
    await prisma.$executeRawUnsafe(
      `UPDATE payout_registries SET status = $1, paid_at = now() WHERE id = $2`,
      paid.status, registryId
    );

    let receiptUrl: string | null = null;
    let receiptLocal: string | null = null;
    if (paid.status === 'EXECUTED' || TBANK_MOCK) {
      const receipts = await fiscalizeReceipts(tbankRegistryId, corrId);
      if (receipts.receipts?.[0]?.receiptUrl) {
        const u = String(receipts.receipts[0].receiptUrl);
        receiptUrl = u;
        try { receiptLocal = await saveReceiptFile(payoutId, authorId, u); } catch {}
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
      await prisma.$executeRawUnsafe(`UPDATE payouts SET status = 'IN_PROGRESS' WHERE id = $1`, payoutId);
    }

    // Письма
    if (u.email) {
      sendMail({
        to: u.email,
        subject: `Выплата отправлена · ${net.toLocaleString('ru-RU')} ₽ · Сонатум`,
        html: `
          <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:560px;margin:0 auto;padding:32px;color:#1c1c1e;">
            <h1 style="font-size:22px;margin:0 0 16px;">Выплата отправлена</h1>
            <p style="font-size:15px;line-height:1.6;">Здравствуйте, ${u.firstName || 'друг'}!</p>
            <p style="font-size:15px;line-height:1.6;">Администратор инициировал выплату вознаграждения.</p>
            <div style="background:#f4f4f7;border-radius:16px;padding:20px;margin:20px 0;">
              <div style="font-size:13px;color:#86868b;">К получению на карту</div>
              <div style="font-size:26px;font-weight:800;">${net.toLocaleString('ru-RU')} ₽</div>
              ${taxHolding ? `<div style="font-size:13px;color:#86868b;margin-top:6px;">из ${amount.toLocaleString('ru-RU')} ₽ (НПД 6% удержан Т-Банком: ${tax.toLocaleString('ru-RU')} ₽)</div>` : `<div style="font-size:13px;color:#86868b;margin-top:6px;">Налог НПД 6% оплатите самостоятельно через «Мой налог».</div>`}
              <div style="font-size:12px;color:#86868b;margin-top:8px;">№ платежа: ${payoutId}</div>
            </div>
            ${receiptUrl ? `<p><a href="${receiptUrl}" style="color:#1c1c1e;">Скачать чек ФНС</a></p>` : ''}
            <a href="${SITE_URL}/author/finance" style="display:inline-block;background:#1c1c1e;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:600;font-size:14px;">Открыть финансы</a>
          </div>
        `,
      }).catch(() => {});
    }

    sendMail({
      to: BILLING_EMAIL,
      subject: `[Сонатум · FORCE] Принудительная выплата ${amount} ₽ → ${u.email}`,
      html: `<p><b>Админ:</b> ${admin.userId}<br><b>Автор:</b> ${u.email}<br><b>Сумма:</b> ${amount} ₽<br><b>Комментарий:</b> ${comment}<br><b>Реестр Т-Банка:</b> ${tbankRegistryId}</p>`,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      data: { payoutId, registryId, tbankRegistryId, amount, tax, net, status: paid.status, receiptUrl, mock: TBANK_MOCK },
    }, { headers: cors });

  } catch (e: any) {
    logError('admin.force-payout', e, { request, extra: { tag: 'FORCE_PAYOUT' } }).catch(()=>{}); console.error('[FORCE_PAYOUT]', e);
    await prisma.$transaction([
      prisma.user.update({ where: { id: authorId }, data: { balance: { increment: amount } } }),
      prisma.$executeRawUnsafe(
        `UPDATE payouts SET status = 'ERROR', error = $1::jsonb WHERE id = $2`,
        JSON.stringify({ message: e?.message || String(e) }), payoutId
      ),
      prisma.$executeRawUnsafe(
        `UPDATE payout_registries SET status = 'ERROR', last_error = $1::jsonb WHERE id = $2`,
        JSON.stringify({ message: e?.message || String(e) }), registryId
      ),
    ]);
    return NextResponse.json({ success: false, error: 'Ошибка: ' + (e?.message || 'неизвестная') }, { status: 502, headers: cors });
  }
}
