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

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const [r] = (await prisma.$queryRawUnsafe(
    `SELECT cr.*, COALESCE(a.name, c.name, u.username) AS author_name,
            a.slug AS artist_slug, c.slug AS collective_slug, a.avatar AS author_avatar
       FROM collab_requests cr
       JOIN users u ON u.id = cr.author_id
       LEFT JOIN artists a ON a."userId" = u.id
       LEFT JOIN collectives c ON c."leaderId" = u.id
      WHERE cr.id = $1
      LIMIT 1`,
    params.id
  )) as any[];

  if (!r) {
    return NextResponse.json(
      { success: false, error: 'Не найдено' },
      { status: 404, headers: cors }
    );
  }
  // Инкремент просмотров (если не владелец)
  const auth = request.headers.get('Authorization');
  if (auth?.startsWith('Bearer ')) {
    const s = await AuthService.validateSession(auth.substring(7));
    if (s && s.userId !== r.author_id) {
      await prisma.$executeRawUnsafe(
        `UPDATE collab_requests SET views_count = views_count + 1 WHERE id = $1`,
        params.id
      );
    }
  }

  return NextResponse.json(
    {
      success: true,
      data: {
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
      },
    },
    { headers: cors }
  );
}

// PATCH /api/collabs/[id] — обновить или закрыть
// Body: { status?, ...fields }
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
  const [r] = (await prisma.$queryRawUnsafe(
    `SELECT author_id FROM collab_requests WHERE id = $1`,
    params.id
  )) as any[];
  if (!r) {
    return NextResponse.json(
      { success: false, error: 'Не найдено' },
      { status: 404, headers: cors }
    );
  }
  if (r.author_id !== session.userId && session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN') {
    return NextResponse.json(
      { success: false, error: 'Нет прав' },
      { status: 403, headers: cors }
    );
  }

  let body: any;
  try { body = await request.json(); } catch { body = {}; }

  await prisma.$executeRawUnsafe(
    `UPDATE collab_requests SET
       status = COALESCE($1, status),
       looking_for = COALESCE($2, looking_for),
       purpose = COALESCE($3, purpose),
       genre = COALESCE($4, genre),
       description = COALESCE($5, description),
       candidate_wishes = COALESCE($6, candidate_wishes),
       budget_kind = COALESCE($7, budget_kind),
       active_until = COALESCE($8::date, active_until),
       city = COALESCE($9, city),
       updated_at = now()
     WHERE id = $10`,
    body.status || null,
    body.lookingFor || null,
    body.purpose || null,
    body.genre || null,
    body.description || null,
    body.candidateWishes || null,
    body.budgetKind || null,
    body.activeUntil || null,
    body.city || null,
    params.id
  );

  return NextResponse.json({ success: true }, { headers: cors });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
      { success: false, error: 'Сессия' },
      { status: 401, headers: cors }
    );
  }
  const [r] = (await prisma.$queryRawUnsafe(
    `SELECT author_id FROM collab_requests WHERE id = $1`,
    params.id
  )) as any[];
  if (!r) {
    return NextResponse.json(
      { success: false, error: 'Не найдено' },
      { status: 404, headers: cors }
    );
  }
  if (r.author_id !== session.userId && session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN') {
    return NextResponse.json(
      { success: false, error: 'Нет прав' },
      { status: 403, headers: cors }
    );
  }
  await prisma.$executeRawUnsafe(`DELETE FROM collab_requests WHERE id = $1`, params.id);
  return NextResponse.json({ success: true }, { headers: cors });
}
