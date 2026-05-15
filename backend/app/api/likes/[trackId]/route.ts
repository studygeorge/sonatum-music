import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AuthService } from '@/lib/auth';
import { getCorsHeaders } from '@/lib/cors';

async function userId(req: NextRequest): Promise<string | null> {
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const session = await AuthService.validateSession(auth.substring(7));
  return session?.userId || null;
}

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request.headers.get('origin') || undefined),
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: { trackId: string } }
) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const uid = await userId(request);
  if (!uid)
    return NextResponse.json({ success: true, liked: false }, { headers: cors });
  const row = await prisma.likedTrack.findUnique({
    where: { userId_trackId: { userId: uid, trackId: params.trackId } },
  });
  return NextResponse.json({ success: true, liked: !!row }, { headers: cors });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { trackId: string } }
) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const uid = await userId(request);
  if (!uid)
    return NextResponse.json(
      { success: false, error: 'Требуется авторизация' },
      { status: 401, headers: cors }
    );

  const exists = await prisma.likedTrack.findUnique({
    where: { userId_trackId: { userId: uid, trackId: params.trackId } },
  });
  if (!exists) {
    await prisma.$transaction([
      prisma.likedTrack.create({
        data: { userId: uid, trackId: params.trackId },
      }),
      prisma.track.update({
        where: { id: params.trackId },
        data: { likeCount: { increment: 1 } },
      }),
    ]);
  }
  return NextResponse.json({ success: true, liked: true }, { headers: cors });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { trackId: string } }
) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const uid = await userId(request);
  if (!uid)
    return NextResponse.json(
      { success: false, error: 'Требуется авторизация' },
      { status: 401, headers: cors }
    );

  const exists = await prisma.likedTrack.findUnique({
    where: { userId_trackId: { userId: uid, trackId: params.trackId } },
  });
  if (exists) {
    await prisma.$transaction([
      prisma.likedTrack.delete({
        where: { userId_trackId: { userId: uid, trackId: params.trackId } },
      }),
      prisma.track.update({
        where: { id: params.trackId },
        data: { likeCount: { decrement: 1 } },
      }),
    ]);
  }
  return NextResponse.json({ success: true, liked: false }, { headers: cors });
}
