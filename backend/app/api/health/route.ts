import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { TBANK_MOCK } from '@/lib/tbank-se';

export const dynamic = 'force-dynamic';

const startedAt = Date.now();

/**
 * GET /api/health
 * Health-check для мониторинга. Возвращает 200 если БД доступна,
 * 503 если упала.
 */
export async function GET(_request: NextRequest) {
  const t0 = Date.now();
  let dbOk = false;
  let dbLatencyMs = -1;
  let dbStats: any = null;

  try {
    const r0 = Date.now();
    const [check] = (await prisma.$queryRawUnsafe(`SELECT 1 AS ok`)) as any[];
    dbLatencyMs = Date.now() - r0;
    dbOk = check?.ok === 1;

    if (dbOk) {
      const [stats] = (await prisma.$queryRawUnsafe(
        `SELECT
           (SELECT COUNT(*) FROM users)::int AS users,
           (SELECT COUNT(*) FROM tracks WHERE status = 'PUBLISHED')::int AS published_tracks,
           (SELECT COUNT(*) FROM sessions WHERE "expiresAt" > now())::int AS active_sessions`
      )) as any[];
      dbStats = stats;
    }
  } catch (e: any) {
    dbOk = false;
    dbLatencyMs = Date.now() - t0;
  }

  const uptimeMs = Date.now() - startedAt;
  const memMB = Math.round(process.memoryUsage().rss / 1024 / 1024);

  const body = {
    ok: dbOk,
    uptimeSec: Math.floor(uptimeMs / 1000),
    db: { ok: dbOk, latencyMs: dbLatencyMs, ...dbStats },
    tbankSe: { mock: TBANK_MOCK },
    process: { memoryMB: memMB, nodeVersion: process.version, env: process.env.NODE_ENV },
    checkedAt: new Date().toISOString(),
  };

  return NextResponse.json(body, { status: dbOk ? 200 : 503 });
}
