import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCorsHeaders } from "@/lib/cors";

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
};

// Алиасы для случаев, где geojson и БД называют регион по-разному
// настолько, что подстрочный поиск не помогает.
const ALIASES: Record<string, string> = {
  "чувашия": "Чувашская Республика",
  "чувашская республика": "Чувашская Республика",
  "удмуртия": "Удмуртская Республика",
  "чечня": "Чеченская Республика",
};

// Нормализация: длинное тире/дефис в один символ, схлопываем пробелы, lower-case.
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[—–]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request.headers.get("origin") || undefined),
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const corsHeaders = {
    ...CACHE_HEADERS,
    ...getCorsHeaders(request.headers.get("origin") || undefined),
  };
  try {
    const raw = decodeURIComponent(params.slug).trim();
    const norm = normalize(raw);

    const include = {
      artists: {
        select: { id: true, name: true, slug: true, avatar: true, authorType: true },
        take: 30,
        orderBy: { followers: "desc" as const },
      },
    };

    // 1. Точное совпадение по slug или name.
    let region = await prisma.region.findFirst({
      where: { OR: [{ slug: raw }, { name: raw }] },
      include,
    });

    // 2. Алиас — для корней слов, которые отличаются ("Чувашия" ↔ "Чувашская").
    if (!region && ALIASES[norm]) {
      region = await prisma.region.findFirst({
        where: { name: ALIASES[norm] },
        include,
      });
    }

    // 3. Нормализованный поиск с подменой тире/дефиса (covers "Северная Осетия - Алания"
    // vs "Северная Осетия — Алания") и подстрочный fuzzy.
    if (!region) {
      const candidates = await prisma.region.findMany({
        select: { id: true, name: true, slug: true },
      });
      const found = candidates.find(c => {
        const cn = normalize(c.name);
        const cs = c.slug.toLowerCase();
        return (
          cn === norm ||
          cs === norm.replace(/\s+/g, "-") ||
          cn.includes(norm) ||
          norm.includes(cn)
        );
      });
      if (found) {
        region = await prisma.region.findUnique({
          where: { id: found.id },
          include,
        });
      }
    }

    if (!region) {
      return NextResponse.json(
        { success: false, error: "Регион не найден" },
        { status: 404, headers: corsHeaders }
      );
    }
    // === Авто-подтяжка авторов и треков по ТЗ ===
    // «Если у автора нет треков или регион не указан — он не отображается»
    const artistIds = ((region as any).artists || []).map((a: any) => a.id);
    let artistsWithTracks: any[] = [];
    if (artistIds.length > 0) {
      const counts = await prisma.track.groupBy({
        by: ['artistId'],
        where: { artistId: { in: artistIds }, status: 'PUBLISHED' },
        _count: { _all: true },
      });
      const countMap = new Map(counts.map((c) => [c.artistId, c._count._all]));
      artistsWithTracks = ((region as any).artists as any[])
        .filter((a) => (countMap.get(a.id) || 0) > 0)
        .map((a) => ({ ...a, trackCount: countMap.get(a.id) || 0 }));
    }

    // Топ треков региона — самые слушаемые
    const topTracks = await prisma.track.findMany({
      where: {
        status: 'PUBLISHED',
        audioUrl: { not: '' },
        artist: { regionId: (region as any).id },
      },
      orderBy: { playCount: 'desc' },
      take: 12,
      select: {
        id: true, title: true, slug: true, cover: true, duration: true, playCount: true,
        artist: { select: { id: true, name: true, slug: true, avatar: true } },
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          ...region,
          artists: artistsWithTracks,
          topTracks,
          totalArtists: artistsWithTracks.length,
          totalTracks: topTracks.length,
        },
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error("[REGION_GET_ERROR]", error);
    return NextResponse.json(
      { success: false, error: "Ошибка получения региона" },
      { status: 500, headers: corsHeaders }
    );
  }
}
