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
  isFree: true,
  isForSale: true,
  price: true,
  artist: {
    select: { id: true, name: true, slug: true, avatar: true },
  },
} as const;

const PLAYLIST_SELECT = {
  id: true,
  title: true,
  description: true,
  cover: true,
  slug: true,
} as const;

const CACHE_HEADERS = {
  'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
};

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request.headers.get('origin') || undefined),
  });
}

export async function GET(request: NextRequest) {
  const origin = request.headers.get('origin');
  const corsHeaders = {
    ...CACHE_HEADERS,
    ...getCorsHeaders(origin || undefined),
  };

  try {
    const authHeader = request.headers.get('Authorization');
    let userId: string | null = null;

    if (authHeader?.startsWith('Bearer ')) {
      const session = await AuthService.validateSession(authHeader.substring(7));
      if (session) userId = session.userId;
    }

    const recentSince = new Date(Date.now() - 14 * 86_400_000);
    const fallbackSince = new Date(Date.now() - 90 * 86_400_000);
    const discoveriesSince = new Date(Date.now() - 30 * 86_400_000);

    // Все 7 запросов параллельно вместо последовательно (~5x ускорение API).
    const [
      historyActivities,
      newReleases,
      chart,
      editorialPlaylists,
      recommendations,
      radarFresh,
      discoveriesRaw,
    ] = await Promise.all([
      userId
        ? prisma.trackActivity.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 10,
            select: {
              trackId: true,
              track: { select: TRACK_SELECT },
            },
          })
        : Promise.resolve([] as Array<{ trackId: string; track: any }>),
      prisma.track.findMany({
        where: { status: 'PUBLISHED' },
        orderBy: [{ releaseDate: 'desc' }, { createdAt: 'desc' }],
        take: 10,
        select: TRACK_SELECT,
      }),
      prisma.track.findMany({
        where: { status: 'PUBLISHED' },
        orderBy: { playCount: 'desc' },
        take: 10,
        select: TRACK_SELECT,
      }),
      prisma.playlist.findMany({
        where: { type: 'EDITORIAL', isPublic: true },
        orderBy: { updatedAt: 'desc' },
        take: 6,
        select: PLAYLIST_SELECT,
      }),
      prisma.track.findMany({
        where: { status: 'PUBLISHED' },
        orderBy: { likeCount: 'desc' },
        take: 10,
        select: TRACK_SELECT,
      }),
      prisma.track.findMany({
        where: { status: 'PUBLISHED', createdAt: { gte: recentSince } },
        orderBy: [{ likeCount: 'desc' }, { playCount: 'desc' }],
        take: 12,
        select: TRACK_SELECT,
      }),
      // Один SQL вместо findMany со всеми треками каждого артиста.
      prisma.$queryRaw<
        Array<{
          id: string;
          name: string;
          slug: string;
          avatar: string | null;
          region: string | null;
          verified: boolean;
          trackCount: bigint;
          score: bigint;
        }>
      >`
        SELECT a.id, a.name, a.slug, a.avatar, a.region, a.verified,
               COUNT(t.id)::bigint AS "trackCount",
               COALESCE(SUM(t."playCount") + SUM(t."likeCount") * 5, 0)::bigint AS score
        FROM artists a
        LEFT JOIN tracks t ON t."artistId" = a.id AND t.status = 'PUBLISHED'
        WHERE EXISTS (
          SELECT 1 FROM tracks t2
          WHERE t2."artistId" = a.id
            AND t2.status = 'PUBLISHED'
            AND t2."createdAt" >= ${discoveriesSince}
        )
        GROUP BY a.id
        ORDER BY score DESC
        LIMIT 10
      `,
    ]);

    let radar = radarFresh;
    if (radar.length === 0) {
      radar = await prisma.track.findMany({
        where: { status: 'PUBLISHED', createdAt: { gte: fallbackSince } },
        orderBy: [{ likeCount: 'desc' }, { createdAt: 'desc' }],
        take: 12,
        select: TRACK_SELECT,
      });
    }

    const seen = new Set<string>();
    const history = historyActivities
      .filter((a) =>
        seen.has(a.trackId) ? false : (seen.add(a.trackId), true)
      )
      .map((a) => a.track);

    const discoveries = discoveriesRaw.map((d) => ({
      id: d.id,
      name: d.name,
      slug: d.slug,
      avatar: d.avatar,
      region: d.region,
      verified: d.verified,
      trackCount: Number(d.trackCount),
    }));

    return NextResponse.json(
      {
        success: true,
        data: {
          personalMix: recommendations,
          history,
          newReleases,
          chart,
          editorial: editorialPlaylists,
          radar,
          discoveries,
        },
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('[HOME_FEED]', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка сервера' },
      { status: 500, headers: corsHeaders }
    );
  }
}
