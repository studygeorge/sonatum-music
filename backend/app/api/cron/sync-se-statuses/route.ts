import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCorsHeaders } from '@/lib/cors';
import { listRecipients, mapRecipientStatus, TBANK_MOCK } from '@/lib/tbank-se';

export const dynamic = 'force-dynamic';

export async function OPTIONS(request: NextRequest) {
  return new Response(null, { status: 204, headers: getCorsHeaders(request.headers.get('origin') || undefined) });
}

/**
 * POST /api/cron/sync-se-statuses
 * Каждые 15 минут: для всех пользователей в DRAFT (или давно не проверенных)
 * опрашиваем Т-Банк и обновляем self_employed_status.
 *
 * По док-у /recipients/list — не чаще 1 раза в 10 минут.
 */
export async function POST(request: NextRequest) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const secret = request.headers.get('x-cron-secret');
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ success: false, error: 'forbidden' }, { status: 403, headers: cors });
  }

  // Получатели в нефинальных статусах или давно не проверенные
  const users = (await prisma.$queryRawUnsafe(
    `SELECT id, recipient_id, self_employed_status
       FROM users
      WHERE recipient_id IS NOT NULL
        AND (self_employed_status IS NULL
             OR self_employed_status IN ('DRAFT','SUSPENDED','UNKNOWN')
             OR recipient_status_checked_at < now() - interval '6 hours')
      LIMIT 200`
  )) as any[];

  if (users.length === 0) {
    return NextResponse.json({ success: true, checked: 0, updated: 0, mock: TBANK_MOCK }, { headers: cors });
  }

  // Опрашиваем пачкой
  let updated = 0;
  let errors = 0;
  try {
    const res = await listRecipients(users.map((u) => u.recipient_id));
    const byId = new Map<string, any>();
    for (const r of (res?.recipients || [])) {
      if (r.recipientId) byId.set(String(r.recipientId), r);
    }

    for (const u of users) {
      const rec = byId.get(String(u.recipient_id));
      const newStatus = rec ? mapRecipientStatus(rec) : 'UNKNOWN';
      if (newStatus !== u.self_employed_status) {
        await prisma.$executeRawUnsafe(
          `UPDATE users SET self_employed_status = $1, recipient_status_checked_at = now() WHERE id = $2`,
          newStatus, u.id
        );
        updated++;
      } else {
        await prisma.$executeRawUnsafe(
          `UPDATE users SET recipient_status_checked_at = now() WHERE id = $1`,
          u.id
        );
      }
    }
  } catch (e: any) {
    errors++;
    console.error('[SYNC_SE]', e);
  }

  return NextResponse.json({
    success: true, checked: users.length, updated, errors, mock: TBANK_MOCK,
  }, { headers: cors });
}

export const GET = POST;
