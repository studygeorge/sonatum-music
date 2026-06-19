import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { getCorsHeaders } from '@/lib/cors';
import { mapRecipientStatus } from '@/lib/tbank-se';

export const dynamic = 'force-dynamic';

/**
 * POST /api/payments/tbank-se/webhook
 * Принимает уведомления от T-Bank о смене статуса самозанятого
 * (DRAFT → ACTIVE / SUSPENDED / REJECTED).
 *
 * Проверка подписи через TBANK_SE_WEBHOOK_SECRET (HMAC SHA256).
 * Тело — JSON вида:
 *   { recipientId: '1234', selfEmployedStatus: 'ACTIVE', status: 'ACTIVE', ... }
 *
 * Подпись передаётся в заголовке `X-T-Bank-Signature` (или похожем — уточнить
 * при подключении). До подтверждения от Т-Банка endpoint работает в режиме
 * «доверять всему» — только логирует.
 */
export async function POST(request: NextRequest) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);

  const rawBody = await request.text();
  let body: any;
  try { body = JSON.parse(rawBody); } catch { body = {}; }

  // Лог получения
  await prisma.$executeRawUnsafe(
    `INSERT INTO tbank_api_log (id, correlation_id, method, endpoint, request_body, status_code, is_mock, duration_ms)
     VALUES ($1, $2, 'POST', '/webhook/self-employed', $3::jsonb, 200, false, 0)`,
    'tlog_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    body?.correlationId || null,
    rawBody.slice(0, 8000)
  ).catch(() => {});

  // Проверка подписи (если задан секрет)
  const secret = process.env.TBANK_SE_WEBHOOK_SECRET;
  if (secret) {
    const provided = request.headers.get('x-t-bank-signature')
                  || request.headers.get('x-signature')
                  || '';
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    if (provided !== expected) {
      console.warn('[SE_WEBHOOK] signature mismatch');
      return NextResponse.json({ ok: false, error: 'bad signature' }, { status: 401, headers: cors });
    }
  }

  // Обработка
  const recipientId = String(body?.recipientId || body?.recipient_id || '');
  if (!recipientId) {
    return NextResponse.json({ ok: false, error: 'no recipientId' }, { status: 400, headers: cors });
  }

  const status = mapRecipientStatus(body);
  try {
    await prisma.$executeRawUnsafe(
      `UPDATE users SET self_employed_status = $1, recipient_status_checked_at = now() WHERE recipient_id = $2`,
      status, recipientId
    );
  } catch (e) {
    console.error('[SE_WEBHOOK] update failed:', e);
  }

  return NextResponse.json({ ok: true }, { headers: cors });
}

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request.headers.get('origin') || undefined),
  });
}
