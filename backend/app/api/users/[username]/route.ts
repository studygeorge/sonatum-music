import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCorsHeaders } from '@/lib/cors';

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request.headers.get('origin') || undefined),
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: { username: string } }
) {
  const origin = request.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin || undefined);

  try {
    const { username } = params;

    const user = await prisma.user.findFirst({
      where: { 
        OR: [
          { username },
          { id: username }
        ],
        status: 'ACTIVE'
      },
      select: {
        id: true,
        username: true,
        nickname: true,
        firstName: true,
        lastName: true,
        avatar: true,
        bio: true,
        privacySettings: true,
        createdAt: true,
        // Связи, которые будут отфильтрованы на основе privacySettings
        playlists: {
          where: { isPublic: true },
          select: { id: true, title: true, cover: true, trackCount: true, slug: true }
        },
        favoriteGenres: true,
        favoriteEras: true,
        favoriteComposers: true
      }
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Пользователь не найден' },
        { status: 404, headers: corsHeaders }
      );
    }

    // Применение настроек приватности
    const privacy = (user.privacySettings as any) || {};
    
    // Если профиль полностью скрыт
    if (privacy.isProfilePublic === false) {
      return NextResponse.json(
        { 
          success: true, 
          data: {
            id: user.id,
            username: user.username,
            avatar: user.avatar,
            isPrivate: true
          } 
        }, 
        { headers: corsHeaders }
      );
    }

    // Фильтрация данных на основе настроек
    const publicProfile: any = {
      id: user.id,
      username: user.username,
      nickname: user.nickname,
      firstName: user.firstName,
      lastName: user.lastName,
      avatar: user.avatar,
      bio: user.bio,
      createdAt: user.createdAt,
    };

    if (privacy.showPublicPlaylists !== false) {
      publicProfile.playlists = user.playlists;
    }

    if (privacy.showFavoriteGenres !== false) {
      publicProfile.favoriteGenres = user.favoriteGenres;
      publicProfile.favoriteEras = user.favoriteEras;
      publicProfile.favoriteComposers = user.favoriteComposers;
    }

    return NextResponse.json({ success: true, data: publicProfile }, { headers: corsHeaders });
  } catch (error) {
    console.error('[PUBLIC_PROFILE]', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка сервера' },
      { status: 500, headers: corsHeaders }
    );
  }
}
