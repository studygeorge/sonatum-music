import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AuthService } from '@/lib/auth';
import { getCorsHeaders } from '@/lib/cors';

export const dynamic = 'force-dynamic';

export async function OPTIONS(request: NextRequest) {
  return new Response(null, { status: 204, headers: getCorsHeaders(request.headers.get('origin') || undefined) });
}

async function requireAdmin(request: NextRequest) {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const s = await AuthService.validateSession(auth.substring(7));
  if (!s || (s.role !== 'ADMIN' && s.role !== 'SUPER_ADMIN')) return null;
  return s;
}

// GET /api/admin/errors?level=&q=&limit=100
export async function GET(request: NextRequest) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const s = await requireAdmin(request);
  if (!s) return NextResponse.json({ success: false, error: 'forbidden' }, { status: 403, headers: cors });

  const url = new URL(request.url);
  const level = url.searchParams.get('level') || '';
  const q = (url.searchParams.get('q') || '').trim();
  const limit = Math.min(500, parseInt(url.searchParams.get('limit') || '100'));

  const conds: string[] = [];
  const args: any[] = [];
  if (level) { args.push(level); conds.push(`level = $${args.length}`); }
  if (q)     { args.push(`%${q}%`); conds.push(`(message ILIKE $${args.length} OR url ILIKE $${args.length} OR context::text ILIKE $${args.length})`); }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

  const rows = (await prisma.$queryRawUnsafe(
    `SELECT id, level, message, stack, url, method, user_id, context, created_at
       FROM error_log
       ${where}
      ORDER BY created_at DESC
      LIMIT ${limit}`,
    ...args
  )) as any[];

  // Сводка
  const summary = (await prisma.$queryRawUnsafe(
    `SELECT level, COUNT(*)::int AS cnt FROM error_log GROUP BY level`
  )) as any[];

  return NextResponse.json({
    success: true,
    data: rows.map((r) => ({
      id: r.id, level: r.level, message: r.message, stack: r.stack,
      url: r.url, method: r.method, userId: r.user_id, context: r.context,
      createdAt: r.created_at,
    })),
    summary: summary.reduce((a: any, r: any) => { a[r.level] = Number(r.cnt); return a; }, {}),
  }, { headers: cors });
}

// DELETE /api/admin/errors?days=7 — чистка старых
export async function DELETE(request: NextRequest) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const s = await requireAdmin(request);
  if (!s) return NextResponse.json({ success: false, error: 'forbidden' }, { status: 403, headers: cors });

  const url = new URL(request.url);
  const days = Math.max(1, parseInt(url.searchParams.get('days') || '30'));
  const r = await prisma.$executeRawUnsafe(
    `DELETE FROM error_log WHERE created_at < now() - ($1 || ' days')::interval`,
    String(days)
  );
  return NextResponse.json({ success: true, deleted: r }, { headers: cors });
}
