import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AuthService } from '@/lib/auth';
import { getCorsHeaders } from '@/lib/cors';

async function getUserId(request: NextRequest): Promise<string | null> {
  const auth = request.headers.get('Authorization');
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

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const corsHeaders = getCorsHeaders(request.headers.get('origin') || undefined);
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Требуется авторизация' },
        { status: 401, headers: corsHeaders }
      );
    }

    const artist = await prisma.artist.findUnique({
      where: { slug: params.slug },
      select: { id: true, userId: true },
    });
    if (!artist) {
      return NextResponse.json(
        { success: false, error: 'Артист не найден' },
        { status: 404, headers: corsHeaders }
      );
    }
    if (artist.userId === userId) {
      return NextResponse.json(
        { success: false, error: 'Нельзя подписаться на самого себя' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Проверяем, не подписан ли уже (идемпотентность).
    const existing = await (prisma as any).artistFollow.findUnique({
      where: { userId_artistId: { userId, artistId: artist.id } },
    });

    if (!existing) {
      await prisma.$transaction([
        (prisma as any).artistFollow.create({
          data: { userId, artistId: artist.id },
        }),
        prisma.artist.update({
          where: { id: artist.id },
          data: { followers: { increment: 1 } },
        }),
      ]);
    }

    const updated = await prisma.artist.findUnique({
      where: { id: artist.id },
      select: { followers: true },
    });

    return NextResponse.json(
      { success: true, following: true, followers: updated?.followers || 0 },
      { headers: corsHeaders }
    );
  } catch (e) {
    console.error('[ARTIST_FOLLOW]', e);
    return NextResponse.json(
      { success: false, error: 'Ошибка сервера' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const corsHeaders = getCorsHeaders(request.headers.get('origin') || undefined);
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Требуется авторизация' },
        { status: 401, headers: corsHeaders }
      );
    }

    const artist = await prisma.artist.findUnique({
      where: { slug: params.slug },
      select: { id: true },
    });
    if (!artist) {
      return NextResponse.json(
        { success: false, error: 'Артист не найден' },
        { status: 404, headers: corsHeaders }
      );
    }

    const existing = await (prisma as any).artistFollow.findUnique({
      where: { userId_artistId: { userId, artistId: artist.id } },
    });

    if (existing) {
      await prisma.$transaction([
        (prisma as any).artistFollow.delete({
          where: { userId_artistId: { userId, artistId: artist.id } },
        }),
        prisma.artist.update({
          where: { id: artist.id },
          data: { followers: { decrement: 1 } },
        }),
      ]);
    }

    const updated = await prisma.artist.findUnique({
      where: { id: artist.id },
      select: { followers: true },
    });

    return NextResponse.json(
      { success: true, following: false, followers: Math.max(0, updated?.followers || 0) },
      { headers: corsHeaders }
    );
  } catch (e) {
    console.error('[ARTIST_UNFOLLOW]', e);
    return NextResponse.json(
      { success: false, error: 'Ошибка сервера' },
      { status: 500, headers: corsHeaders }
    );
  }
}
