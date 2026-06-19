import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AuthService } from '@/lib/auth';
import { getCorsHeaders } from '@/lib/cors';

export const dynamic = 'force-dynamic';

async function isAdmin(token: string) {
  const session = await AuthService.validateSession(token);
  if (!session) return null;
  const u = await prisma.user.findUnique({ where: { id: session.userId }, select: { role: true, id: true } });
  if (!u || (u.role !== 'ADMIN' && u.role !== 'SUPER_ADMIN')) return null;
  return { userId: u.id, role: u.role };
}

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request.headers.get('origin') || undefined),
  });
}

// GET /api/admin/b2b-requests?status=PENDING|IN_PROGRESS|RESOLVED|REJECTED&type=LICENSE|ACADEMIC|OTHER
export async function GET(request: NextRequest) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return NextResponse.json({ success: false, error: 'Требуется авторизация' }, { status: 401, headers: cors });
  const me = await isAdmin(auth.substring(7));
  if (!me) return NextResponse.json({ success: false, error: 'Нет доступа' }, { status: 403, headers: cors });

  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const type = url.searchParams.get('type');

  const conds: string[] = [];
  const params: any[] = [];
  let i = 1;
  if (status) { conds.push(`r.status = $${i++}`); params.push(status); }
  if (type) { conds.push(`r."requestType" = $${i++}`); params.push(type); }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT r.id, r."requestType" AS type, r.status, r."companyName" AS company_name,
            r.contact_name, r.email, r.phone, r.project_type, r.budget, r.message,
            r."trackId" AS track_id, t.title AS track_title, t.slug AS track_slug,
            a.name AS artist_name, a.slug AS artist_slug,
            r."createdAt" AS created_at, r."updatedAt" AS updated_at
       FROM b2b_requests r
       LEFT JOIN tracks t ON t.id = r."trackId"
       LEFT JOIN artists a ON a.id = t."artistId"
       ${where}
       ORDER BY r."createdAt" DESC LIMIT 200`,
    ...params
  );

  return NextResponse.json({
    success: true,
    data: rows.map((r) => ({
      id: r.id,
      type: r.type,
      status: r.status,
      companyName: r.company_name,
      contactName: r.contact_name,
      email: r.email,
      phone: r.phone,
      projectType: r.project_type,
      budget: r.budget,
      message: r.message,
      track: r.track_id ? { id: r.track_id, title: r.track_title, slug: r.track_slug, artistName: r.artist_name, artistSlug: r.artist_slug } : null,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    })),
  }, { headers: cors });
}

// PATCH /api/admin/b2b-requests — { id, status }
export async function PATCH(request: NextRequest) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return NextResponse.json({ success: false, error: 'Требуется авторизация' }, { status: 401, headers: cors });
  const me = await isAdmin(auth.substring(7));
  if (!me) return NextResponse.json({ success: false, error: 'Нет доступа' }, { status: 403, headers: cors });

  const body = await request.json().catch(() => ({}));
  const id = String(body?.id || '');
  const status = String(body?.status || '');
  if (!id || !['PENDING', 'IN_PROGRESS', 'APPROVED', 'REJECTED'].includes(status)) {
    return NextResponse.json({ success: false, error: 'Неверные параметры' }, { status: 400, headers: cors });
  }
  await prisma.b2BRequest.update({ where: { id }, data: { status: status as any } });
  return NextResponse.json({ success: true }, { headers: cors });
}
