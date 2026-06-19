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

// GET /api/tracks/search?q=...&limit=20
// Поиск опубликованных треков по названию/артисту. Используется в UI для
// выбора первого трека при создании плейлиста.
export async function GET(request: NextRequest) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim();
  const limit = Math.max(1, Math.min(50, parseInt(searchParams.get('limit') || '20')));

  const rows = q
    ? (await prisma.$queryRawUnsafe(
        `SELECT t.id, t.title, t.slug, t.cover, t."audioUrl", t.duration,
                a.id AS artist_id, a.name AS artist_name, a.slug AS artist_slug
           FROM tracks t
           LEFT JOIN artists a ON a.id = t."artistId"
          WHERE t.status = 'PUBLISHED'
            AND t."audioUrl" IS NOT NULL AND t."audioUrl" <> ''
            AND (t.title ILIKE $1 OR a.name ILIKE $1)
          ORDER BY t."playCount" DESC NULLS LAST, t."createdAt" DESC
          LIMIT ${limit}`,
        `%${q}%`
      )) as any[]
    : (await prisma.$queryRawUnsafe(
        `SELECT t.id, t.title, t.slug, t.cover, t."audioUrl", t.duration,
                a.id AS artist_id, a.name AS artist_name, a.slug AS artist_slug
           FROM tracks t
           LEFT JOIN artists a ON a.id = t."artistId"
          WHERE t.status = 'PUBLISHED'
            AND t."audioUrl" IS NOT NULL AND t."audioUrl" <> ''
          ORDER BY t."playCount" DESC NULLS LAST, t."createdAt" DESC
          LIMIT ${limit}`
      )) as any[];

  return NextResponse.json(
    {
      success: true,
      data: rows.map((r) => ({
        id: r.id,
        title: r.title,
        slug: r.slug,
        cover: r.cover,
        audioUrl: r.audioUrl,
        duration: r.duration,
        artist: r.artist_id ? { id: r.artist_id, name: r.artist_name, slug: r.artist_slug } : null,
      })),
    },
    { headers: cors }
  );
}
