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

  const artist = await prisma.artist.findUnique({
    where: { userId: session.userId },
    select: { id: true, slug: true },
  });

  if (!artist) {
    return NextResponse.json(
      { success: true, data: [] },
      { headers: cors }
    );
  }

  const tracks = await prisma.track.findMany({
    where: { artistId: artist.id },
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: {
      id: true,
      title: true,
      slug: true,
      cover: true,
      duration: true,
      audioUrl: true,
      price: true,
      isForSale: true,
      isFree: true,
      playCount: true,
      likeCount: true,
      purchaseCount: true,
      status: true,
      createdAt: true,
      releaseDate: true,
      metadata: true,
    },
  });

  // Достаём pending-флаг из metadata в плоский ответ
  const enriched = tracks.map((t) => {
    const meta = (t.metadata as any) || {};
    const { metadata, ...rest } = t as any;
    return {
      ...rest,
      hasPendingChanges: !!meta.hasPendingChanges,
      pendingSubmittedAt: meta.pendingSubmittedAt || null,
    };
  });

  return NextResponse.json(
    { success: true, data: enriched, artistSlug: artist.slug },
    { headers: cors }
  );
}
