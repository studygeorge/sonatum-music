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
    return NextResponse.json({ success: false, error: 'Требуется авторизация' }, { status: 401, headers: cors });
  }
  const session = await AuthService.validateSession(auth.substring(7));
  if (!session) {
    return NextResponse.json({ success: false, error: 'Сессия истекла' }, { status: 401, headers: cors });
  }

  const artist = await prisma.artist.findUnique({
    where: { userId: session.userId },
    select: { id: true },
  });
  if (!artist) {
    return NextResponse.json({ success: true, data: { hasArtist: false } }, { headers: cors });
  }

  // 30 дней назад
  const [totals] = (await prisma.$queryRawUnsafe(
    `SELECT
       COALESCE((SELECT SUM("playCount") FROM tracks WHERE "artistId" = $1), 0)::bigint AS total_plays,
       COALESCE((SELECT COUNT(*) FROM "artist_follows" WHERE "artistId" = $1), 0)::int AS followers_total,
       COALESCE((SELECT COUNT(*) FROM tracks WHERE "artistId" = $1 AND status = 'PUBLISHED'), 0)::int AS tracks_published,
       COALESCE((SELECT SUM("purchaseCount") FROM tracks WHERE "artistId" = $1), 0)::bigint AS total_sales`,
    artist.id
  )) as any[];

  const topTracks = (await prisma.$queryRawUnsafe(
    `SELECT id, title, slug, "playCount", "likeCount", "purchaseCount", cover
       FROM tracks WHERE "artistId" = $1 AND status = 'PUBLISHED'
       ORDER BY "playCount" DESC NULLS LAST LIMIT 5`,
    artist.id
  )) as any[];

  // География слушателей (если есть таблица track_activity)
  const geography = (await prisma.$queryRawUnsafe(
    `SELECT COALESCE(r.name, u.region_id, 'Другие') AS region, COUNT(*)::int AS plays
       FROM track_activity ta
       JOIN tracks t ON t.id = ta."trackId"
       JOIN users u ON u.id = ta."userId"
       LEFT JOIN regions r ON r.id = u.region_id
      WHERE t."artistId" = $1 AND ta."createdAt" > now() - interval '30 days'
      GROUP BY r.name, u.region_id
      ORDER BY plays DESC
      LIMIT 6`,
    artist.id
  ).catch(() => [])) as any[];

  return NextResponse.json(
    {
      success: true,
      data: {
        hasArtist: true,
        totals: {
          totalPlays: Number(totals?.total_plays || 0),
          followersTotal: Number(totals?.followers_total || 0),
          tracksPublished: Number(totals?.tracks_published || 0),
          totalSales: Number(totals?.total_sales || 0),
        },
        topTracks: topTracks.map((t) => ({
          id: t.id,
          title: t.title,
          slug: t.slug,
          cover: t.cover,
          playCount: Number(t.playCount || 0),
          likeCount: Number(t.likeCount || 0),
          purchaseCount: Number(t.purchaseCount || 0),
        })),
        geography: geography.map((g) => ({
          region: g.region,
          plays: Number(g.plays || 0),
        })),
      },
    },
    { headers: cors }
  );
}
