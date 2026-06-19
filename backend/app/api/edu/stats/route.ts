import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AuthService } from '@/lib/auth';
import { getCorsHeaders } from '@/lib/cors';

export const dynamic = 'force-dynamic';

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request.headers.get('origin') || undefined),
  });
}

async function getMyAdminInstitution(userId: string) {
  const [r] = (await prisma.$queryRawUnsafe(
    `SELECT * FROM edu_institutions WHERE admin_user_id = $1 AND status IN ('ACTIVE','APPROVED') LIMIT 1`,
    userId
  )) as any[];
  return r || null;
}

// GET /api/edu/stats?days=30
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
  const inst = await getMyAdminInstitution(session.userId);
  if (!inst) {
    return NextResponse.json({ success: false, error: 'Только администратор учреждения' }, { status: 403, headers: cors });
  }

  const url = new URL(request.url);
  const days = Math.max(7, Math.min(365, parseInt(url.searchParams.get('days') || '30')));
  const since = new Date(Date.now() - days * 86_400_000);

  // ID пользователей учреждения (admin + все members)
  const memberIds = (await prisma.$queryRawUnsafe(
    `SELECT DISTINCT user_id FROM edu_members WHERE institution_id = $1 AND user_id IS NOT NULL`,
    inst.id
  )) as any[];
  const userIds = [inst.admin_user_id, ...memberIds.map(m => m.user_id)].filter(Boolean);

  if (userIds.length === 0) {
    return NextResponse.json({
      success: true,
      data: {
        days,
        totalPlays: 0,
        uniqueListeners: 0,
        topTracks: [],
        byWeekday: [0, 0, 0, 0, 0, 0, 0],
        byDay: [],
      },
    }, { headers: cors });
  }

  // Прослушивания за период
  const totalRow = (await prisma.$queryRawUnsafe(
    `SELECT COUNT(*)::int AS total,
            COUNT(DISTINCT "userId")::int AS uniq
       FROM track_activity
      WHERE "userId" = ANY($1::text[])
        AND "createdAt" >= $2`,
    userIds, since
  )) as any[];

  // ТОП-10 треков
  const topTracks = (await prisma.$queryRawUnsafe(
    `SELECT t.id, t.title, t.slug, t.cover, a.name AS artist_name, a.slug AS artist_slug,
            COUNT(*)::int AS plays
       FROM track_activity ta
       JOIN tracks t ON t.id = ta."trackId"
       LEFT JOIN artists a ON a.id = t."artistId"
      WHERE ta."userId" = ANY($1::text[])
        AND ta."createdAt" >= $2
      GROUP BY t.id, a.id
      ORDER BY plays DESC
      LIMIT 10`,
    userIds, since
  )) as any[];

  // По дням недели (0=Пн, 6=Вс — Postgres EXTRACT(dow) даёт 0=Вс..6=Сб, переведём)
  const weekdayRows = (await prisma.$queryRawUnsafe(
    `SELECT EXTRACT(ISODOW FROM "createdAt")::int AS dow, COUNT(*)::int AS c
       FROM track_activity
      WHERE "userId" = ANY($1::text[])
        AND "createdAt" >= $2
      GROUP BY dow ORDER BY dow`,
    userIds, since
  )) as any[];
  const byWeekday = [0, 0, 0, 0, 0, 0, 0];
  for (const r of weekdayRows) byWeekday[r.dow - 1] = r.c;

  // По дням (для линейной диаграммы)
  const byDay = (await prisma.$queryRawUnsafe(
    `SELECT to_char(date_trunc('day', "createdAt"), 'YYYY-MM-DD') AS day, COUNT(*)::int AS c
       FROM track_activity
      WHERE "userId" = ANY($1::text[])
        AND "createdAt" >= $2
      GROUP BY day ORDER BY day`,
    userIds, since
  )) as any[];

  return NextResponse.json({
    success: true,
    data: {
      days,
      totalPlays: totalRow[0]?.total || 0,
      uniqueListeners: totalRow[0]?.uniq || 0,
      topTracks: topTracks.map(t => ({
        id: t.id,
        title: t.title,
        slug: t.slug,
        cover: t.cover,
        artist: { name: t.artist_name, slug: t.artist_slug },
        plays: t.plays,
      })),
      byWeekday,
      byDay,
    },
  }, { headers: cors });
}
