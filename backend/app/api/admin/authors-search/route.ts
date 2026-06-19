import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AuthService } from '@/lib/auth';
import { getCorsHeaders } from '@/lib/cors';

export const dynamic = 'force-dynamic';

export async function OPTIONS(request: NextRequest) {
  return new Response(null, { status: 204, headers: getCorsHeaders(request.headers.get('origin') || undefined) });
}

// GET /api/admin/authors-search?q=ivan
export async function GET(request: NextRequest) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) {
    return NextResponse.json({ success: false, error: 'forbidden' }, { status: 401, headers: cors });
  }
  const session = await AuthService.validateSession(auth.substring(7));
  if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN')) {
    return NextResponse.json({ success: false, error: 'forbidden' }, { status: 403, headers: cors });
  }

  const url = new URL(request.url);
  const q = (url.searchParams.get('q') || '').trim().toLowerCase();

  const rows = (await prisma.$queryRawUnsafe(
    `SELECT u.id, u.email, u."firstName", u."lastName", u.balance,
            a.name AS artist_name, a.slug AS artist_slug, a.avatar AS artist_avatar
       FROM users u
       LEFT JOIN artists a ON a."userId" = u.id
      WHERE u.role = 'ARTIST'
        ${q ? `AND (LOWER(u.email) LIKE $1 OR LOWER(COALESCE(u."firstName",'') || ' ' || COALESCE(u."lastName",'')) LIKE $1 OR LOWER(COALESCE(a.name,'')) LIKE $1)` : ''}
      ORDER BY u."createdAt" DESC
      LIMIT 20`,
    ...(q ? [`%${q}%`] : [])
  )) as any[];

  return NextResponse.json({
    success: true,
    data: rows.map((r) => ({
      id: r.id,
      email: r.email,
      name: [r.firstName, r.lastName].filter(Boolean).join(' '),
      artistName: r.artist_name,
      artistAvatar: r.artist_avatar,
      balance: Number(r.balance || 0),
    })),
  }, { headers: cors });
}
