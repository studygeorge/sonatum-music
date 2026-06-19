import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCorsHeaders } from '@/lib/cors';

export const dynamic = 'force-dynamic';

// POST /api/cron/expire-collabs
// Помечает заявки коллабораций со срокам actibe_until < сегодня → ARCHIVED.
// Защита: проверка X-Cron-Secret из ENV (CRON_SECRET).
export async function POST(request: NextRequest) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const secret = request.headers.get('x-cron-secret');
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ success: false, error: 'Доступ запрещён' }, { status: 403, headers: cors });
  }

  const result = await prisma.$executeRawUnsafe(
    `UPDATE collab_requests
        SET status = 'ARCHIVED'
      WHERE status = 'ACTIVE'
        AND active_until < current_date`
  );

  // Также истекшие student_verifications переводим в EXPIRED
  await prisma.$executeRawUnsafe(
    `UPDATE student_verifications
        SET status = 'EXPIRED'
      WHERE status = 'APPROVED'
        AND expires_at < now()`
  ).catch(() => {});

  // И истекшие подписки тоже
  await prisma.$executeRawUnsafe(
    `UPDATE subscriptions SET status = 'EXPIRED'
      WHERE status = 'ACTIVE' AND "endDate" IS NOT NULL AND "endDate" < now()`
  ).catch(() => {});

  return NextResponse.json({ success: true, archivedCollabs: result }, { headers: cors });
}

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request.headers.get('origin') || undefined),
  });
}

// GET — то же без авторизации, удобно для cron-job.org
export const GET = POST;
