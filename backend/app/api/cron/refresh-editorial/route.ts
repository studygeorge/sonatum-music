import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/cron/refresh-editorial
 * Auth: header `X-Cron-Secret: <secret>` matching env CRON_SECRET.
 *
 * Regenerates a fixed set of editorial playlists from the current catalog.
 * No LLM calls — purely SQL ranking + tag matching.
 *
 * Each generated playlist has slug prefix `auto-` so we can wipe and rebuild
 * idempotently without touching hand-curated EDITORIAL playlists.
 */

type RecipeBuilder = () => Promise<{
  slug: string;
  title: string;
  description: string;
  trackIds: string[];
}>;

async function ensureSystemEditor(): Promise<string> {
  const existing = await prisma.user.findFirst({
    where: { email: "editor@sonatum.music" },
    select: { id: true },
  });
  if (existing) return existing.id;
  const fallback = await prisma.user.findFirst({
    where: { role: { in: ["ADMIN", "SUPER_ADMIN"] } },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  if (!fallback) throw new Error("Нет ни одного админа для editorial-плейлистов");
  return fallback.id;
}

async function topByPlayCount(take = 12) {
  const tracks = await prisma.track.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { playCount: "desc" },
    take,
    select: { id: true },
  });
  return tracks.map((t) => t.id);
}

async function freshReleases(days = 30, take = 12) {
  const since = new Date(Date.now() - days * 86_400_000);
  const tracks = await prisma.track.findMany({
    where: { status: "PUBLISHED", createdAt: { gte: since } },
    orderBy: [{ likeCount: "desc" }, { createdAt: "desc" }],
    take,
    select: { id: true },
  });
  return tracks.map((t) => t.id);
}

async function byMetadataTag(field: string, value: string, take = 12) {
  // Postgres JSONB ?| / ->> matching via raw query keeps it simple.
  const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM tracks
       WHERE status = 'PUBLISHED'
         AND metadata IS NOT NULL
         AND metadata->>'${field}' ILIKE $1
       ORDER BY "playCount" DESC
       LIMIT ${take}`,
    `%${value}%`
  );
  return rows.map((r) => r.id);
}

async function byConfession(name: string, take = 12) {
  const tracks = await prisma.track.findMany({
    where: { status: "PUBLISHED", confession: { contains: name, mode: "insensitive" } },
    orderBy: { playCount: "desc" },
    take,
    select: { id: true },
  });
  return tracks.map((t) => t.id);
}

const RECIPES: RecipeBuilder[] = [
  async () => ({
    slug: "auto-top-week",
    title: "Лучшее на Сонатум",
    description: "Самые прослушиваемые треки платформы прямо сейчас.",
    trackIds: await topByPlayCount(12),
  }),
  async () => ({
    slug: "auto-fresh",
    title: "Свежие релизы",
    description: "Новые загрузки артистов за последние 30 дней.",
    trackIds: await freshReleases(30, 12),
  }),
  async () => ({
    slug: "auto-orthodox",
    title: "Свет православия",
    description: "Знаменный распев, духовные концерты и церковное пение.",
    trackIds: await byConfession("Православие", 12),
  }),
  async () => ({
    slug: "auto-znamenny",
    title: "Знаменное пение",
    description: "Древнерусский знаменный распев — корни русской духовной музыки.",
    trackIds: await byMetadataTag("subcategory", "Знамен", 12),
  }),
  async () => ({
    slug: "auto-bells",
    title: "Колокольные звоны",
    description: "Подборка колокольных звонов России.",
    trackIds: await byMetadataTag("subcategory", "Колокол", 12),
  }),
  async () => ({
    slug: "auto-chamber",
    title: "Камерная музыка",
    description: "Сольные и ансамблевые произведения.",
    trackIds: await byMetadataTag("subcategory", "Камерн", 12),
  }),
];

async function upsertPlaylist(
  editorId: string,
  slug: string,
  title: string,
  description: string,
  trackIds: string[]
) {
  if (trackIds.length === 0) {
    // Тихо чистим, если рецепт пустой (нет данных) — чтобы не висел пустой блок.
    await prisma.playlist.deleteMany({ where: { slug } });
    return { slug, count: 0, action: "removed-empty" as const };
  }

  const existing = await prisma.playlist.findUnique({ where: { slug } });
  if (existing) {
    await prisma.playlistTrack.deleteMany({ where: { playlistId: existing.id } });
    await prisma.playlist.update({
      where: { id: existing.id },
      data: {
        title,
        description,
        type: "EDITORIAL",
        isPublic: true,
        trackCount: trackIds.length,
      },
    });
    await prisma.playlistTrack.createMany({
      data: trackIds.map((trackId, i) => ({
        playlistId: existing.id,
        trackId,
        position: i,
      })),
    });
    return { slug, count: trackIds.length, action: "updated" as const };
  }

  const created = await prisma.playlist.create({
    data: {
      slug,
      title,
      description,
      type: "EDITORIAL",
      isPublic: true,
      userId: editorId,
      trackCount: trackIds.length,
    },
  });
  await prisma.playlistTrack.createMany({
    data: trackIds.map((trackId, i) => ({
      playlistId: created.id,
      trackId,
      position: i,
    })),
  });
  return { slug, count: trackIds.length, action: "created" as const };
}

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const provided = request.headers.get("x-cron-secret");
  if (!secret || provided !== secret) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  try {
    const editorId = await ensureSystemEditor();
    const results = [];
    for (const recipe of RECIPES) {
      const { slug, title, description, trackIds } = await recipe();
      const r = await upsertPlaylist(editorId, slug, title, description, trackIds);
      results.push(r);
    }
    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    console.error("[REFRESH_EDITORIAL_ERROR]", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Ошибка сервера" },
      { status: 500 }
    );
  }
}
