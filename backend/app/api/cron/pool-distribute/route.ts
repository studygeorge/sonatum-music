import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCorsHeaders } from '@/lib/cors';

export const dynamic = 'force-dynamic';

const AUTHOR_SHARE = 0.7;
const PLATFORM_SHARE = 0.3;

function rid(): string { return 'spr_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10); }
function ppid(): string { return 'spp_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
function tamid(): string { return 'tam_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

export async function OPTIONS(request: NextRequest) {
  return new Response(null, { status: 204, headers: getCorsHeaders(request.headers.get('origin') || undefined) });
}

/**
 * POST /api/cron/pool-distribute
 * Запускается до 5 числа. Считает пул за прошлый месяц и распределяет
 * между авторами пропорционально их активности (плеи + просмотры нот).
 *
 * Идемпотентность: subscription_pool_runs.period_month UNIQUE.
 */
export async function POST(request: NextRequest) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const secret = request.headers.get('x-cron-secret');
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ success: false, error: 'forbidden' }, { status: 403, headers: cors });
  }

  const now = new Date();
  // Прошлый месяц
  const periodMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const periodMonthStr = periodMonth.toISOString().slice(0, 10);
  const periodEnd = new Date(now.getFullYear(), now.getMonth(), 1); // первое число текущего

  // Защита от повторного запуска
  const [existing] = (await prisma.$queryRawUnsafe(
    `SELECT id, status FROM subscription_pool_runs WHERE period_month = $1::date`,
    periodMonthStr
  )) as any[];
  if (existing && existing.status === 'COMPLETED') {
    return NextResponse.json({ success: true, alreadyDone: true, runId: existing.id }, { headers: cors });
  }

  // 1. Считаем пул = sum(Premium PAID subscriptions × 0.7)
  // Считаем выручку от подписок начатых / продлённых за месяц
  const [poolRow] = (await prisma.$queryRawUnsafe(
    `SELECT COALESCE(SUM(price), 0)::numeric AS total
       FROM subscriptions
      WHERE status IN ('ACTIVE','EXPIRED','CANCELED')
        AND tier IN ('PREMIUM','STUDENT')
        AND "startDate" >= $1::timestamp
        AND "startDate" < $2::timestamp`,
    periodMonth, periodEnd
  )) as any[];
  const totalRevenue = Number(poolRow?.total || 0);
  const totalPool = Math.round(totalRevenue * AUTHOR_SHARE * 100) / 100;
  const platformShare = Math.round(totalRevenue * PLATFORM_SHARE * 100) / 100;

  // 2. Агрегируем активность из listen_history + sheet_views_history → track_activity_monthly
  // listen_history связан с tracks, нужно понять автора каждого трека
  const plays = (await prisma.$queryRawUnsafe(
    `SELECT a."userId" AS user_id, COUNT(*)::bigint AS cnt
       FROM listen_history lh
       JOIN tracks t ON t.id = lh.track_id
       JOIN artists a ON a.id = t."artistId"
      WHERE lh.played_at >= $1 AND lh.played_at < $2
      GROUP BY a."userId"`,
    periodMonth, periodEnd
  )) as any[];

  const views = (await prisma.$queryRawUnsafe(
    `SELECT a."userId" AS user_id, COUNT(*)::bigint AS cnt
       FROM sheet_views_history svh
       JOIN sheet_music sm ON sm.id = svh.sheet_id
       JOIN tracks t ON t.id = sm."trackId"
       JOIN artists a ON a.id = t."artistId"
      WHERE svh.viewed_at >= $1 AND svh.viewed_at < $2
      GROUP BY a."userId"`,
    periodMonth, periodEnd
  ).catch(() => [])) as any[];

  // Объединяем
  const activity = new Map<string, { plays: number; views: number }>();
  for (const p of plays) {
    activity.set(p.user_id, { plays: Number(p.cnt), views: 0 });
  }
  for (const v of views) {
    const cur = activity.get(v.user_id) || { plays: 0, views: 0 };
    cur.views = Number(v.cnt);
    activity.set(v.user_id, cur);
  }

  let totalActivity = 0;
  for (const a of activity.values()) totalActivity += a.plays + a.views;

  // 3. Создаём run-запись
  const runId = existing?.id || rid();
  if (!existing) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO subscription_pool_runs (id, period_month, total_pool_gross, platform_share, total_activity, author_count, status, started_at)
       VALUES ($1, $2::date, $3, $4, $5, $6, 'RUNNING', now())`,
      runId, periodMonthStr, totalPool, platformShare, totalActivity, activity.size
    );
  } else {
    await prisma.$executeRawUnsafe(
      `UPDATE subscription_pool_runs SET status = 'RUNNING', started_at = now(),
              total_pool_gross = $1, platform_share = $2, total_activity = $3, author_count = $4
        WHERE id = $5`,
      totalPool, platformShare, totalActivity, activity.size, runId
    );
  }

  // 4. Сохраняем активность в track_activity_monthly и начисляем доли
  const log: any[] = [];

  if (totalActivity === 0 || totalPool === 0) {
    await prisma.$executeRawUnsafe(
      `UPDATE subscription_pool_runs SET status = 'COMPLETED', completed_at = now(), log = $1::jsonb WHERE id = $2`,
      JSON.stringify({ reason: 'no activity or no pool', totalRevenue, totalActivity }), runId
    );
    return NextResponse.json({ success: true, runId, totalPool, totalActivity, distributed: 0, mock: false }, { headers: cors });
  }

  for (const [userId, a] of activity.entries()) {
    const score = a.plays + a.views;
    const sharePct = score / totalActivity;
    const amountGross = Math.round(totalPool * sharePct * 100) / 100;
    if (amountGross <= 0) continue;

    await prisma.$transaction([
      prisma.$executeRawUnsafe(
        `INSERT INTO track_activity_monthly (id, user_id, period_month, plays, sheet_views, total_score)
         VALUES ($1, $2, $3::date, $4, $5, $6)
         ON CONFLICT (user_id, period_month) DO UPDATE
           SET plays = EXCLUDED.plays, sheet_views = EXCLUDED.sheet_views, total_score = EXCLUDED.total_score`,
        tamid(), userId, periodMonthStr, a.plays, a.views, score
      ),
      prisma.$executeRawUnsafe(
        `INSERT INTO subscription_pool_payouts (id, run_id, user_id, activity, share_pct, amount_gross)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        ppid(), runId, userId, score, sharePct * 100, amountGross
      ),
      prisma.user.update({
        where: { id: userId },
        data: { balance: { increment: amountGross } },
      }),
    ]);

    log.push({ userId, score, sharePct, amountGross });
  }

  await prisma.$executeRawUnsafe(
    `UPDATE subscription_pool_runs SET status = 'COMPLETED', completed_at = now(), log = $1::jsonb WHERE id = $2`,
    JSON.stringify({ entries: log.length, totalRevenue }), runId
  );

  return NextResponse.json({
    success: true,
    runId,
    period: periodMonthStr,
    totalRevenue,
    totalPool,
    platformShare,
    totalActivity,
    authorCount: activity.size,
    distributed: log.length,
  }, { headers: cors });
}

export const GET = POST;
