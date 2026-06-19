import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCorsHeaders } from '@/lib/cors';

export const dynamic = 'force-dynamic';

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request.headers.get('origin') || undefined),
  });
}

// GET /api/regions/[slug] — детали региона: артисты + треки
export async function GET(request: NextRequest, context: { params: { slug: string } }) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const slug = context.params.slug;

  const [region] = (await prisma.$queryRawUnsafe(
    `SELECT id, name, slug, type, "centerCoordinates", "historicalData"
       FROM regions WHERE slug = $1 OR id = $1 LIMIT 1`,
    slug
  )) as any[];
  if (!region) {
    return NextResponse.json({ success: false, error: 'Регион не найден' }, { status: 404, headers: cors });
  }

  const artists = (await prisma.$queryRawUnsafe(
    `SELECT DISTINCT a.id, a.name, a.slug, a.avatar, a.verified, a.followers
       FROM artists a
       JOIN users u ON u.id = a."userId"
      WHERE u."regionId" = $1
      ORDER BY a.followers DESC NULLS LAST, a.name ASC
      LIMIT 60`,
    region.id
  )) as any[];

  const tracks = (await prisma.$queryRawUnsafe(
    `SELECT t.id, t.title, t.slug, t.cover, t."audioUrl", t.duration,
            a.name AS artist_name, a.slug AS artist_slug
       FROM tracks t
       JOIN artists a ON a.id = t."artistId"
       JOIN users u ON u.id = a."userId"
      WHERE u."regionId" = $1 AND t.status = 'PUBLISHED'
      ORDER BY t."createdAt" DESC
      LIMIT 60`,
    region.id
  )) as any[];

  return NextResponse.json(
    {
      success: true,
      data: {
        region: {
          id: region.id,
          name: region.name,
          slug: region.slug,
          type: region.type,
          coords: region.centerCoordinates,
          historical: region.historicalData,
        },
        artists,
        tracks: tracks.map((t) => ({
          id: t.id,
          title: t.title,
          slug: t.slug,
          cover: t.cover,
          audioUrl: t.audioUrl,
          duration: t.duration,
          artist: { name: t.artist_name, slug: t.artist_slug },
        })),
      },
    },
    { headers: cors }
  );
}
