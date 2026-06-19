import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCorsHeaders } from '@/lib/cors';

export const dynamic = 'force-dynamic';

function gid(): string { return 'ps_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10); }

export async function OPTIONS(request: NextRequest) {
  return new Response(null, { status: 204, headers: getCorsHeaders(request.headers.get('origin') || undefined) });
}

/**
 * POST /api/cron/pool-block
 * Запускается 1 числа каждого месяца. Блокирует выплаты до 6 числа
 * (включая весь день 5-го), чтобы спокойно посчитать пул.
 */
export async function POST(request: NextRequest) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const secret = request.headers.get('x-cron-secret');
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ success: false, error: 'forbidden' }, { status: 403, headers: cors });
  }

  const now = new Date();
  // блокируем до 6 числа 00:00 текущего месяца
  const until = new Date(now.getFullYear(), now.getMonth(), 6, 0, 0, 0);

  await prisma.$executeRawUnsafe(
    `INSERT INTO payout_schedule (id, blocked_from, blocked_until, reason)
     VALUES ($1, now(), $2, 'Расчёт подписочного пула за прошлый месяц')`,
    gid(), until
  );

  return NextResponse.json({ success: true, blockedUntil: until }, { headers: cors });
}

export const GET = POST;
