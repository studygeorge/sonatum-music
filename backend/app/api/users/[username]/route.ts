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

    // === Топ-5 треков пользователя за последний месяц (из ТЗ) ===
    if (privacy.showTopTracks !== false) {
      const topTracks = (await prisma.$queryRawUnsafe(
        `SELECT t.id, t.title, t.slug, t.cover, COUNT(*)::int AS plays,
                a.name AS artist_name, a.slug AS artist_slug
           FROM track_activity ta
           JOIN tracks t ON t.id = ta."trackId"
           LEFT JOIN artists a ON a.id = t."artistId"
          WHERE ta."userId" = $1 AND ta."createdAt" > now() - interval '30 days'
            AND t.status = 'PUBLISHED'
          GROUP BY t.id, a.name, a.slug
          ORDER BY plays DESC LIMIT 5`,
        user.id
      ).catch(() => [])) as any[];
      publicProfile.topTracks = topTracks.map((t: any) => ({
        id: t.id, title: t.title, slug: t.slug, cover: t.cover,
        plays: Number(t.plays || 0),
        artist: { name: t.artist_name, slug: t.artist_slug },
      }));
    }

    // === Виджет «Сейчас нравится» — последний лайкнутый трек за 7 дней (из ТЗ) ===
    if (privacy.showCurrentlyLiking !== false) {
      const recentLike = await prisma.likedTrack.findFirst({
        where: { userId: user.id, likedAt: { gte: new Date(Date.now() - 7 * 86_400_000) } },
        orderBy: { likedAt: 'desc' },
        include: {
          track: {
            select: {
              id: true, title: true, slug: true, cover: true,
              artist: { select: { name: true, slug: true } },
            },
          },
        },
      }).catch(() => null);
      if (recentLike?.track) {
        publicProfile.currentlyLiking = {
          id: recentLike.track.id,
          title: recentLike.track.title,
          slug: recentLike.track.slug,
          cover: recentLike.track.cover,
          artist: recentLike.track.artist,
          likedAt: recentLike.likedAt,
        };
      }
    }

    // === Подписки на авторов (опционально) ===
    if (privacy.showFollowing !== false) {
      const followingCount = await (prisma as any).artistFollow
        .count({ where: { userId: user.id } })
        .catch(() => 0);
      publicProfile.followingCount = followingCount;
    }

    // Премиум-статус (для иконки)
    const sub = await prisma.subscription.findUnique({ where: { userId: user.id } });
    publicProfile.isPremium = !!sub && sub.status === 'ACTIVE'
      && (sub.tier === 'PREMIUM' || sub.tier === 'STUDENT')
      && (!sub.endDate || new Date(sub.endDate) > new Date());

    return NextResponse.json({ success: true, data: publicProfile }, { headers: corsHeaders });
  } catch (error) {
    console.error('[PUBLIC_PROFILE]', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка сервера' },
      { status: 500, headers: corsHeaders }
    );
  }
}
