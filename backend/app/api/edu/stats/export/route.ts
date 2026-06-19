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
    `SELECT * FROM edu_institutions WHERE admin_user_id = $1 LIMIT 1`,
    userId
  )) as any[];
  return r || null;
}

// GET /api/edu/stats/export?days=30
// Возвращает CSV (Excel открывает напрямую) — список прослушиваний с пользователем и треком.
export async function GET(request: NextRequest) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const auth = request.headers.get('Authorization');
  const url = new URL(request.url);
  const tokenFromUrl = url.searchParams.get('token');
  const token = auth?.startsWith('Bearer ') ? auth.substring(7) : tokenFromUrl;
  if (!token) {
    return NextResponse.json({ success: false, error: 'Требуется авторизация' }, { status: 401, headers: cors });
  }
  const session = await AuthService.validateSession(token);
  if (!session) {
    return NextResponse.json({ success: false, error: 'Сессия истекла' }, { status: 401, headers: cors });
  }
  const inst = await getMyAdminInstitution(session.userId);
  if (!inst) {
    return NextResponse.json({ success: false, error: 'Только администратор учреждения' }, { status: 403, headers: cors });
  }

  const days = Math.max(7, Math.min(365, parseInt(url.searchParams.get('days') || '30')));
  const since = new Date(Date.now() - days * 86_400_000);

  const memberIds = (await prisma.$queryRawUnsafe(
    `SELECT DISTINCT user_id FROM edu_members WHERE institution_id = $1 AND user_id IS NOT NULL`,
    inst.id
  )) as any[];
  const userIds = [inst.admin_user_id, ...memberIds.map(m => m.user_id)].filter(Boolean);

  if (userIds.length === 0) {
    const csv = '﻿' + 'Дата;Пользователь;Email;Трек;Исполнитель\n';
    return new NextResponse(csv, {
      status: 200,
      headers: { ...cors, 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="sonatum-edu-stats.csv"` },
    });
  }

  const rows = (await prisma.$queryRawUnsafe(
    `SELECT ta."createdAt" AS at, u.email, COALESCE(u."firstName", u.username, '') AS name,
            t.title, a.name AS artist_name
       FROM track_activity ta
       JOIN tracks t ON t.id = ta."trackId"
       LEFT JOIN artists a ON a.id = t."artistId"
       LEFT JOIN users u ON u.id = ta."userId"
      WHERE ta."userId" = ANY($1::text[]) AND ta."createdAt" >= $2
      ORDER BY ta."createdAt" DESC
      LIMIT 50000`,
    userIds, since
  )) as any[];

  const esc = (s: any) => {
    const v = (s == null ? '' : String(s)).replace(/"/g, '""');
    return /[;\n"]/.test(v) ? `"${v}"` : v;
  };
  const lines = ['Дата;Пользователь;Email;Трек;Исполнитель'];
  for (const r of rows) {
    lines.push([
      new Date(r.at).toLocaleString('ru-RU'),
      esc(r.name),
      esc(r.email),
      esc(r.title),
      esc(r.artist_name || ''),
    ].join(';'));
  }
  const csv = '﻿' + lines.join('\n');
  return new NextResponse(csv, {
    status: 200,
    headers: {
      ...cors,
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="sonatum-edu-stats-${days}d.csv"`,
    },
  });
}
