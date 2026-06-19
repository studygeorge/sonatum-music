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

// GET /api/map/regions
// Считает артистов и треки по регионам через два пути:
//  1) users.regionId (FK)
//  2) artists.region / artists.city (текст) — match по name региона ILIKE
export async function GET(request: NextRequest) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const rows = (await prisma.$queryRawUnsafe(
    `WITH artist_region AS (
       SELECT a.id, a."userId",
              COALESCE(u."regionId",
                       (SELECT r.id FROM regions r
                         WHERE r.name ILIKE '%' || a.region || '%'
                            OR r.name ILIKE '%' || a.city   || '%'
                         LIMIT 1)
              ) AS resolved_region_id
         FROM artists a
         JOIN users u ON u.id = a."userId"
     )
     SELECT
        r.id, r.name, r.slug, r.type, r."centerCoordinates",
        COUNT(DISTINCT ar.id)::int AS artists_count,
        COUNT(DISTINCT t.id)::int  AS tracks_count
       FROM regions r
       LEFT JOIN artist_region ar ON ar.resolved_region_id = r.id
       LEFT JOIN tracks t ON t."artistId" = ar.id AND t.status = 'PUBLISHED'
      GROUP BY r.id, r.name, r.slug, r.type, r."centerCoordinates"
      ORDER BY artists_count DESC, r.name ASC`
  )) as any[];

  return NextResponse.json(
    {
      success: true,
      data: rows.map((r) => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        type: r.type,
        coords: r.centerCoordinates as [number, number] | null,
        artistsCount: r.artists_count,
        tracksCount: r.tracks_count,
      })),
    },
    { headers: { ...cors, 'Cache-Control': 's-maxage=300, stale-while-revalidate=600' } }
  );
}
