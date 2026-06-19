import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCorsHeaders } from '@/lib/cors';
import { getRegistry, fiscalizeReceipts, TBANK_MOCK } from '@/lib/tbank-se';
import { saveReceiptFile } from '@/lib/receipts';

export const dynamic = 'force-dynamic';

export async function OPTIONS(request: NextRequest) {
  return new Response(null, { status: 204, headers: getCorsHeaders(request.headers.get('origin') || undefined) });
}

/**
 * POST /api/cron/sync-registries
 * Догоняем статусы реестров, по которым ещё нет окончательного исхода.
 * Запускается каждые 15 минут.
 *
 * Стратегия:
 *  1. Берём все payout_registries в нефинальных статусах
 *     (CREATED/ACCEPTED/SENT/IN_PROGRESS) и которые проверяли больше 5 мин назад
 *  2. Для каждого вызываем getRegistry(tbankRegistryId)
 *  3. Если статус стал EXECUTED → fiscalize, сохраняем чеки, обновляем payouts
 *  4. Если PART_EXEC/REJECTED → метим, для ERROR-платежей возвращаем баланс
 */
export async function POST(request: NextRequest) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const secret = request.headers.get('x-cron-secret');
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ success: false, error: 'forbidden' }, { status: 403, headers: cors });
  }

  const candidates = (await prisma.$queryRawUnsafe(
    `SELECT id, tbank_registry_id, status, correlation_id
       FROM payout_registries
      WHERE status NOT IN ('EXECUTED','PART_EXEC','REJECTED','CANCELLED','ERROR','DRAFT','DELETED')
        AND tbank_registry_id IS NOT NULL
        AND (last_status_check IS NULL OR last_status_check < now() - interval '5 minutes')
      ORDER BY created_at ASC
      LIMIT 50`
  )) as any[];

  let updated = 0;
  let finalized = 0;
  let errors = 0;

  for (const r of candidates) {
    try {
      const got: any = await getRegistry(Number(r.tbank_registry_id));
      const newStatus = String(got?.status || '');

      await prisma.$executeRawUnsafe(
        `UPDATE payout_registries SET last_status_check = now()${newStatus ? ', status = $1' : ''} WHERE id = $2`,
        ...(newStatus ? [newStatus, r.id] : [r.id])
      );

      if (newStatus === 'EXECUTED' || newStatus === 'PART_EXEC') {
        // Финализируем — фискализация и чеки
        const fis = await fiscalizeReceipts(Number(r.tbank_registry_id), r.correlation_id);
        const receiptByNumber = new Map<number, string>();
        for (const rc of (fis.receipts || [])) {
          if (rc.number != null && rc.receiptUrl) receiptByNumber.set(Number(rc.number), String(rc.receiptUrl));
        }

        // Все payouts реестра
        const payouts = (await prisma.$queryRawUnsafe(
          `SELECT id, user_id, gross FROM payouts WHERE registry_id = $1 ORDER BY created_at ASC`,
          r.id
        )) as any[];

        for (let i = 0; i < payouts.length; i++) {
          const p = payouts[i];
          const url = receiptByNumber.get(i + 1) || null;
          // Скачиваем чек к нам
          let local: string | null = null;
          if (url) {
            try { local = await saveReceiptFile(p.id, p.user_id, url); } catch (e) { console.error('[saveReceipt]', e); }
          }
          await prisma.$executeRawUnsafe(
            `UPDATE payouts SET status = 'EXECUTED', receipt_url = COALESCE($1, receipt_url),
                                 receipt_file_path = COALESCE($2, receipt_file_path),
                                 paid_at = COALESCE(paid_at, now())
              WHERE id = $3`,
            url, local, p.id
          );
        }

        await prisma.$executeRawUnsafe(
          `UPDATE payout_registries SET status = $1, finalized_at = now() WHERE id = $2`,
          newStatus, r.id
        );
        finalized++;
      } else if (newStatus === 'REJECTED' || newStatus === 'CANCELLED') {
        // Откатываем балансы
        const payouts = (await prisma.$queryRawUnsafe(
          `SELECT id, user_id, gross, status FROM payouts WHERE registry_id = $1`,
          r.id
        )) as any[];
        for (const p of payouts) {
          if (p.status === 'PENDING' || p.status === 'IN_PROGRESS') {
            await prisma.$transaction([
              prisma.$executeRawUnsafe(`UPDATE payouts SET status = 'REJECTED' WHERE id = $1`, p.id),
              prisma.user.update({ where: { id: p.user_id }, data: { balance: { increment: Number(p.gross) } } }),
            ]);
          }
        }
        await prisma.$executeRawUnsafe(
          `UPDATE payout_registries SET status = $1, finalized_at = now() WHERE id = $2`,
          newStatus, r.id
        );
        finalized++;
      }
      updated++;
    } catch (e: any) {
      errors++;
      await prisma.$executeRawUnsafe(
        `UPDATE payout_registries SET last_status_check = now(), last_error = $1::jsonb WHERE id = $2`,
        JSON.stringify({ message: e?.message || String(e) }), r.id
      ).catch(() => {});
    }
  }

  return NextResponse.json({
    success: true,
    candidates: candidates.length, updated, finalized, errors, mock: TBANK_MOCK,
  }, { headers: cors });
}

export const GET = POST;
