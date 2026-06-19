import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AuthService } from '@/lib/auth';
import { getCorsHeaders } from '@/lib/cors';

export const dynamic = 'force-dynamic';

function cuid() {
  return 'sp_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
}

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request.headers.get('origin') || undefined),
  });
}

async function getSession(request: NextRequest) {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return AuthService.validateSession(auth.substring(7));
}

// GET /api/users/me/saved-playlists — мои сохранённые чужие плейлисты
export async function GET(request: NextRequest) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ success: false, error: 'Требуется авторизация' }, { status: 401, headers: cors });
  }

  const rows = (await prisma.$queryRawUnsafe(
    `SELECT sp.id, sp.saved_at,
            p.id AS playlist_id, p.title, p.slug, p.cover, p.description,
            p."trackCount", p.duration,
            u.id AS owner_id, u.username AS owner_username, u.avatar AS owner_avatar
       FROM saved_playlists sp
       JOIN playlists p ON p.id = sp.playlist_id
       JOIN users u ON u.id = p."userId"
      WHERE sp.user_id = $1 AND p."isPublic" = true
      ORDER BY sp.saved_at DESC`,
    session.userId
  )) as any[];

  return NextResponse.json(
    {
      success: true,
      data: rows.map((r) => ({
        id: r.id,
        savedAt: r.saved_at,
        playlist: {
          id: r.playlist_id,
          title: r.title,
          slug: r.slug,
          cover: r.cover,
          description: r.description,
          trackCount: r.trackCount,
          duration: r.duration,
          owner: {
            id: r.owner_id,
            username: r.owner_username,
            avatar: r.owner_avatar,
          },
        },
      })),
    },
    { headers: cors }
  );
}

// POST /api/users/me/saved-playlists  { playlistId }
export async function POST(request: NextRequest) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ success: false, error: 'Требуется авторизация' }, { status: 401, headers: cors });
  }

  const body = await request.json().catch(() => ({}));
  const playlistId = String(body.playlistId || '');
  if (!playlistId) {
    return NextResponse.json({ success: false, error: 'playlistId обязателен' }, { status: 400, headers: cors });
  }

  // Проверяем, что плейлист публичный и не наш
  const pl = await prisma.playlist.findUnique({
    where: { id: playlistId },
    select: { id: true, userId: true, isPublic: true },
  });
  if (!pl) {
    return NextResponse.json({ success: false, error: 'Плейлист не найден' }, { status: 404, headers: cors });
  }
  if (pl.userId === session.userId) {
    return NextResponse.json({ success: false, error: 'Это ваш собственный плейлист' }, { status: 400, headers: cors });
  }
  if (!pl.isPublic) {
    return NextResponse.json({ success: false, error: 'Плейлист скрыт' }, { status: 403, headers: cors });
  }

  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO saved_playlists (id, user_id, playlist_id) VALUES ($1, $2, $3)`,
      cuid(), session.userId, playlistId
    );
  } catch (e: any) {
    if (e?.message?.includes('duplicate') || e?.code === 'P2002') {
      return NextResponse.json({ success: false, error: 'Уже сохранён' }, { status: 409, headers: cors });
    }
    throw e;
  }

  return NextResponse.json({ success: true, message: 'Плейлист сохранён' }, { headers: cors });
}

// DELETE /api/users/me/saved-playlists?playlistId=X
export async function DELETE(request: NextRequest) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ success: false, error: 'Требуется авторизация' }, { status: 401, headers: cors });
  }

  const { searchParams } = new URL(request.url);
  const playlistId = searchParams.get('playlistId');
  if (!playlistId) {
    return NextResponse.json({ success: false, error: 'playlistId обязателен' }, { status: 400, headers: cors });
  }

  await prisma.$executeRawUnsafe(
    `DELETE FROM saved_playlists WHERE user_id = $1 AND playlist_id = $2`,
    session.userId, playlistId
  );

  return NextResponse.json({ success: true }, { headers: cors });
}
