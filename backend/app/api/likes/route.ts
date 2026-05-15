import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AuthService } from '@/lib/auth';
import { getCorsHeaders } from '@/lib/cors';

const TRACK_SELECT = {
  id: true,
  title: true,
  slug: true,
  duration: true,
  audioUrl: true,
  cover: true,
  playCount: true,
  likeCount: true,
  artist: { select: { id: true, name: true, slug: true, avatar: true } },
} as const;

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request.headers.get('origin') || undefined),
  });
}

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
      { success: false, error: 'Сессия' },
      { status: 401, headers: cors }
    );
  }
  const rows = await prisma.likedTrack.findMany({
    where: { userId: session.userId },
    orderBy: { likedAt: 'desc' },
    take: 200,
    include: { track: { select: TRACK_SELECT } },
  });
  return NextResponse.json(
    { success: true, data: rows.map(r => r.track) },
    { headers: cors }
  );
}
