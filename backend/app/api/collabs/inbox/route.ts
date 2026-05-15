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

// GET /api/collabs/inbox — все входящие сообщения и неотвеченные диалоги
export async function GET(request: NextRequest) {
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

  const rows = (await prisma.$queryRawUnsafe(
    `SELECT DISTINCT ON (m.request_id, m.from_user_id)
            m.id, m.request_id, m.from_user_id, m.to_user_id, m.body, m.is_read, m.created_at,
            cr.looking_for, cr.purpose, cr.genre,
            u.email AS from_email,
            COALESCE(a.name, c.name, u.username, u.email) AS from_name,
            a.avatar AS from_avatar, a.slug AS from_artist_slug, c.slug AS from_collective_slug
       FROM collab_messages m
       JOIN collab_requests cr ON cr.id = m.request_id
       JOIN users u ON u.id = m.from_user_id
       LEFT JOIN artists a ON a."userId" = u.id
       LEFT JOIN collectives c ON c."leaderId" = u.id
      WHERE m.to_user_id = $1
      ORDER BY m.request_id, m.from_user_id, m.created_at DESC`,
    session.userId
  )) as any[];

  return NextResponse.json(
    {
      success: true,
      data: rows.map((m) => ({
        id: m.id,
        requestId: m.request_id,
        fromUserId: m.from_user_id,
        fromName: m.from_name,
        fromAvatar: m.from_avatar,
        fromArtistSlug: m.from_artist_slug,
        fromCollectiveSlug: m.from_collective_slug,
        body: m.body,
        isRead: m.is_read,
        createdAt: m.created_at,
        lookingFor: m.looking_for,
        purpose: m.purpose,
        genre: m.genre,
      })),
    },
    { headers: cors }
  );
}
