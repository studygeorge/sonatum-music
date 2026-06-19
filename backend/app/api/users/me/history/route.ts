import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AuthService } from '@/lib/auth';
import { getCorsHeaders } from '@/lib/cors';

export const dynamic = 'force-dynamic';

function cuid() {
  return 'lh_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
}

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request.headers.get('origin') || undefined),
  });
}

// GET /api/users/me/history?limit=100
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

  const { searchParams } = new URL(request.url);
  const limit = Math.min(500, parseInt(searchParams.get('limit') || '100'));

  const rows = (await prisma.$queryRawUnsafe(
    `SELECT lh.id, lh.played_at, lh.duration_sec,
            t.id AS track_id, t.title, t.slug, t.cover, t.duration, t."audioUrl",
            a.id AS artist_id, a.name AS artist_name, a.slug AS artist_slug
       FROM listen_history lh
       JOIN tracks t ON t.id = lh.track_id
       LEFT JOIN artists a ON a.id = t."artistId"
      WHERE lh.user_id = $1
      ORDER BY lh.played_at DESC
      LIMIT ${limit}`,
    session.userId
  )) as any[];

  return NextResponse.json(
    {
      success: true,
      data: rows.map((r) => ({
        id: r.id,
        playedAt: r.played_at,
        durationSec: r.duration_sec,
        track: {
          id: r.track_id,
          title: r.title,
          slug: r.slug,
          cover: r.cover,
          duration: r.duration,
          audioUrl: r.audioUrl,
          artist: r.artist_id ? { id: r.artist_id, name: r.artist_name, slug: r.artist_slug } : null,
        },
      })),
    },
    { headers: cors }
  );
}

// POST /api/users/me/history  body: { trackId, durationSec? }
export async function POST(request: NextRequest) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) {
    return NextResponse.json({ success: false, error: 'Требуется авторизация' }, { status: 401, headers: cors });
  }
  const session = await AuthService.validateSession(auth.substring(7));
  if (!session) {
    return NextResponse.json({ success: false, error: 'Сессия истекла' }, { status: 401, headers: cors });
  }
  const body = await request.json().catch(() => ({}));
  const trackId = String(body.trackId || '');
  if (!trackId) {
    return NextResponse.json({ success: false, error: 'trackId обязателен' }, { status: 400, headers: cors });
  }

  // Защита от спама: если последняя запись по этому треку — < 30 сек назад, не дублируем
  const [recent] = (await prisma.$queryRawUnsafe(
    `SELECT id FROM listen_history
      WHERE user_id = $1 AND track_id = $2 AND played_at > now() - interval '30 seconds'
      LIMIT 1`,
    session.userId, trackId
  )) as any[];
  if (recent) {
    return NextResponse.json({ success: true, deduped: true }, { headers: cors });
  }

  await prisma.$executeRawUnsafe(
    `INSERT INTO listen_history (id, user_id, track_id, duration_sec) VALUES ($1, $2, $3, $4)`,
    cuid(), session.userId, trackId, body.durationSec ? Number(body.durationSec) : null
  );

  return NextResponse.json({ success: true }, { headers: cors });
}

// DELETE /api/users/me/history — очистить всю историю текущего пользователя
export async function DELETE(request: NextRequest) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) {
    return NextResponse.json({ success: false, error: 'Требуется авторизация' }, { status: 401, headers: cors });
  }
  const session = await AuthService.validateSession(auth.substring(7));
  if (!session) {
    return NextResponse.json({ success: false, error: 'Сессия истекла' }, { status: 401, headers: cors });
  }

  const count = await prisma.$executeRawUnsafe(
    `DELETE FROM listen_history WHERE user_id = $1`,
    session.userId
  );

  return NextResponse.json({ success: true, deleted: count }, { headers: cors });
}
