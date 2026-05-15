import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AuthService } from '@/lib/auth';
import { getCorsHeaders } from '@/lib/cors';

export const dynamic = 'force-dynamic';

function cuid() {
  return 'col_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
}

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request.headers.get('origin') || undefined),
  });
}

// GET /api/collabs — лента активных заявок (с фильтрами)
// GET /api/collabs?mine=1 — мои заявки
// Filters: lookingFor, budget, city, genre, status
export async function GET(request: NextRequest) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const { searchParams } = new URL(request.url);
  const mine = searchParams.get('mine') === '1';
  const lookingFor = searchParams.get('lookingFor');
  const budget = searchParams.get('budget');
  const city = searchParams.get('city');
  const genre = searchParams.get('genre');
  const status = searchParams.get('status') || 'ACTIVE';
  const limit = Math.min(100, parseInt(searchParams.get('limit') || '50'));

  let userId: string | null = null;
  if (mine) {
    const auth = request.headers.get('Authorization');
    if (!auth?.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Требуется авторизация' },
        { status: 401, headers: cors }
      );
    }
    const session = await AuthService.validateSession(auth.substring(7));
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Сессия истекла' },
        { status: 401, headers: cors }
      );
    }
    userId = session.userId;
  }

  const conds: string[] = [];
  const args: any[] = [];
  if (mine) {
    args.push(userId);
    conds.push(`cr.author_id = $${args.length}`);
  } else {
    conds.push(`cr.status = 'ACTIVE'`);
    conds.push(`cr.active_until > current_date`);
  }
  if (status && mine) {
    args.push(status);
    conds.push(`cr.status = $${args.length}`);
  }
  if (lookingFor) {
    args.push(lookingFor);
    conds.push(`cr.looking_for = $${args.length}`);
  }
  if (budget) {
    args.push(budget);
    conds.push(`cr.budget_kind = $${args.length}`);
  }
  if (city) {
    args.push(`%${city}%`);
    conds.push(`cr.city ILIKE $${args.length}`);
  }
  if (genre) {
    args.push(`%${genre}%`);
    conds.push(`cr.genre ILIKE $${args.length}`);
  }

  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const rows = (await prisma.$queryRawUnsafe(
    `SELECT cr.*, COALESCE(a.name, c.name, u.username, u.email) AS author_name,
            a.slug AS artist_slug, c.slug AS collective_slug, a.avatar AS author_avatar
       FROM collab_requests cr
       JOIN users u ON u.id = cr.author_id
       LEFT JOIN artists a ON a."userId" = u.id
       LEFT JOIN collectives c ON c."leaderId" = u.id
      ${where}
      ORDER BY cr.created_at DESC
      LIMIT ${limit}`,
    ...args
  )) as any[];

  return NextResponse.json(
    {
      success: true,
      data: rows.map((r) => ({
        id: r.id,
        authorId: r.author_id,
        authorName: r.author_name,
        authorAvatar: r.author_avatar,
        artistSlug: r.artist_slug,
        collectiveSlug: r.collective_slug,
        lookingFor: r.looking_for,
        purpose: r.purpose,
        genre: r.genre,
        description: r.description,
        candidateWishes: r.candidate_wishes,
        budgetKind: r.budget_kind,
        activeUntil: r.active_until,
        status: r.status,
        viewsCount: r.views_count,
        city: r.city,
        createdAt: r.created_at,
      })),
    },
    { headers: cors }
  );
}

// POST /api/collabs — создать заявку
export async function POST(request: NextRequest) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) {
    return NextResponse.json(
      { success: false, error: 'Требуется авторизация' },
      { status: 401, headers: cors }
    );
  }
  const session = await AuthService.validateSession(auth.substring(7));
  if (!session) {
    return NextResponse.json(
      { success: false, error: 'Сессия истекла' },
      { status: 401, headers: cors }
    );
  }
  if (session.role !== 'ARTIST' && session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN') {
    return NextResponse.json(
      { success: false, error: 'Заявки создают только авторы' },
      { status: 403, headers: cors }
    );
  }

  let body: any;
  try { body = await request.json(); } catch { body = {}; }

  const required = ['lookingFor', 'purpose', 'genre', 'description', 'budgetKind', 'activeUntil'];
  for (const k of required) {
    if (!body[k] || (typeof body[k] === 'string' && !body[k].trim())) {
      return NextResponse.json(
        { success: false, error: `Заполните поле: ${k}` },
        { status: 400, headers: cors }
      );
    }
  }

  const id = cuid();
  await prisma.$executeRawUnsafe(
    `INSERT INTO collab_requests
     (id, author_id, looking_for, purpose, genre, description, candidate_wishes, budget_kind, active_until, status, city)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::date, 'ACTIVE', $10)`,
    id,
    session.userId,
    body.lookingFor,
    body.purpose,
    body.genre.trim(),
    body.description.trim(),
    body.candidateWishes || null,
    body.budgetKind,
    body.activeUntil,
    body.city || null
  );

  return NextResponse.json({ success: true, id }, { headers: cors });
}
