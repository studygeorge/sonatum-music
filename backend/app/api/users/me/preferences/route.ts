import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, AuthUser } from '@/lib/auth';
import { getCorsHeaders } from '@/lib/cors';

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request.headers.get('origin') || undefined),
  });
}

async function putHandler(request: NextRequest, user: AuthUser) {
  const origin = request.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin || undefined);

  try {
    const body = await request.json();
    const { favoriteGenres, favoriteEras, favoriteComposers, nickname, bio, avatar, firstName, lastName } = body;

    const updatedUser = await prisma.user.update({
      where: { id: user.id.toString() },
      data: {
        favoriteGenres: favoriteGenres !== undefined ? favoriteGenres : undefined,
        favoriteEras: favoriteEras !== undefined ? favoriteEras : undefined,
        favoriteComposers: favoriteComposers !== undefined ? favoriteComposers : undefined,
        nickname: nickname !== undefined ? nickname : undefined,
        bio: bio !== undefined ? bio : undefined,
        avatar: avatar !== undefined ? (avatar || null) : undefined,
        firstName: firstName !== undefined ? (firstName || null) : undefined,
        lastName: lastName !== undefined ? (lastName || null) : undefined,
      },
      select: {
        id: true,
        favoriteGenres: true,
        favoriteEras: true,
        favoriteComposers: true,
        nickname: true,
        bio: true,
        avatar: true,
        firstName: true,
        lastName: true,
      }
    });

    return NextResponse.json({ success: true, data: updatedUser }, { headers: corsHeaders });
  } catch (error) {
    console.error('[PREFERENCES_UPDATE]', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка при обновлении предпочтений' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export const PUT = requireAuth(putHandler);
