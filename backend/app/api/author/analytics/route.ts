import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AuthService } from '@/lib/auth';
import { getCorsHeaders } from '@/lib/cors';

export const dynamic = 'force-dynamic';

export async function OPTIONS(request: NextRequest) {
  return new Response(null, { status: 204, headers: getCorsHeaders(request.headers.get('origin') || undefined) });
}

/**
 * GET /api/author/analytics
 * Аналитика для автора:
 *  - KPI: плеи / просмотры нот / уникальные слушатели / новые подписчики / продажи / доход — за 30 дней + сравнение
 *  - Помесячно (12 мес): плеи, доход
 *  - Топ-5 треков по плеям и по доходу
 *  - География (топ-10 регионов слушателей)
 */
export async function GET(request: NextRequest) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) {
    return NextResponse.json({ success: false, error: 'auth' }, { status: 401, headers: cors });
  }
  const s = await AuthService.validateSession(auth.substring(7));
  if (!s) return NextResponse.json({ success: false, error: 'auth' }, { status: 401, headers: cors });
  if (s.role !== 'ARTIST' && s.role !== 'ADMIN' && s.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ success: false, error: 'forbidden' }, { status: 403, headers: cors });
  }

  const artist = await prisma.artist.findUnique({
    where: { userId: s.userId },
    select: { id: true, name: true, followers: true },
  });
  if (!artist) {
    return NextResponse.json({ success: false, error: 'Профиль артиста не найден' }, { status: 404, headers: cors });
  }
  const artistId = artist.id;

  // ── KPI за 30 дней + прошлые 30 для сравнения ─────────────────────
  const [kpi] = (await prisma.$queryRawUnsafe(
    `WITH p30 AS (
       SELECT
         (SELECT COUNT(*) FROM listen_history lh JOIN tracks t ON t.id = lh.track_id WHERE t."artistId" = $1 AND lh.played_at >= now() - interval '30 days')::int AS plays,
         (SELECT COUNT(DISTINCT lh.user_id) FROM listen_history lh JOIN tracks t ON t.id = lh.track_id WHERE t."artistId" = $1 AND lh.played_at >= now() - interval '30 days')::int AS listeners,
         (SELECT COUNT(*) FROM artist_follows WHERE "artistId" = $1 AND "createdAt" >= now() - interval '30 days')::int AS new_followers,
         (SELECT COUNT(*) FROM license_purchases lp JOIN tracks t ON t.id = lp.track_id WHERE t."artistId" = $1 AND lp.status = 'PAID' AND lp.paid_at >= now() - interval '30 days')::int AS sales,
         (SELECT COALESCE(SUM(lp.artist_amount),0)::numeric FROM license_purchases lp JOIN tracks t ON t.id = lp.track_id WHERE t."artistId" = $1 AND lp.status = 'PAID' AND lp.paid_at >= now() - interval '30 days') AS revenue
     ),
     p60 AS (
       SELECT
         (SELECT COUNT(*) FROM listen_history lh JOIN tracks t ON t.id = lh.track_id WHERE t."artistId" = $1 AND lh.played_at >= now() - interval '60 days' AND lh.played_at < now() - interval '30 days')::int AS plays,
         (SELECT COUNT(DISTINCT lh.user_id) FROM listen_history lh JOIN tracks t ON t.id = lh.track_id WHERE t."artistId" = $1 AND lh.played_at >= now() - interval '60 days' AND lh.played_at < now() - interval '30 days')::int AS listeners,
         (SELECT COUNT(*) FROM artist_follows WHERE "artistId" = $1 AND "createdAt" >= now() - interval '60 days' AND "createdAt" < now() - interval '30 days')::int AS new_followers,
         (SELECT COUNT(*) FROM license_purchases lp JOIN tracks t ON t.id = lp.track_id WHERE t."artistId" = $1 AND lp.status = 'PAID' AND lp.paid_at >= now() - interval '60 days' AND lp.paid_at < now() - interval '30 days')::int AS sales,
         (SELECT COALESCE(SUM(lp.artist_amount),0)::numeric FROM license_purchases lp JOIN tracks t ON t.id = lp.track_id WHERE t."artistId" = $1 AND lp.status = 'PAID' AND lp.paid_at >= now() - interval '60 days' AND lp.paid_at < now() - interval '30 days') AS revenue
     )
     SELECT p30.plays, p30.listeners, p30.new_followers, p30.sales, p30.revenue,
            p60.plays AS prev_plays, p60.listeners AS prev_listeners, p60.new_followers AS prev_new_followers,
            p60.sales AS prev_sales, p60.revenue AS prev_revenue
       FROM p30, p60`,
    artistId
  )) as any[];

  // ── Помесячно 12 месяцев ──────────────────────────────────────────
  const monthly = (await prisma.$queryRawUnsafe(
    `WITH months AS (
       SELECT generate_series(date_trunc('month', now() - interval '11 months'),
                              date_trunc('month', now()),
                              interval '1 month')::date AS m
     )
     SELECT
       to_char(m.m, 'YYYY-MM') AS month,
       COALESCE(plays, 0)::int AS plays,
       COALESCE(revenue, 0)::numeric AS revenue
     FROM months m
     LEFT JOIN (
       SELECT date_trunc('month', lh.played_at)::date AS m, COUNT(*) AS plays
         FROM listen_history lh JOIN tracks t ON t.id = lh.track_id
        WHERE t."artistId" = $1
        GROUP BY 1
     ) pl ON pl.m = m.m
     LEFT JOIN (
       SELECT date_trunc('month', lp.paid_at)::date AS m, SUM(lp.artist_amount) AS revenue
         FROM license_purchases lp JOIN tracks t ON t.id = lp.track_id
        WHERE t."artistId" = $1 AND lp.status = 'PAID'
        GROUP BY 1
     ) rv ON rv.m = m.m
     ORDER BY m.m`,
    artistId
  )) as any[];

  // ── Топ-5 треков по плеям ─────────────────────────────────────────
  const topPlays = (await prisma.$queryRawUnsafe(
    `SELECT t.id, t.title, t.slug, t.cover, COUNT(lh.id)::int AS plays
       FROM tracks t
       LEFT JOIN listen_history lh ON lh.track_id = t.id AND lh.played_at >= now() - interval '30 days'
      WHERE t."artistId" = $1
      GROUP BY t.id, t.title, t.slug, t.cover
      ORDER BY plays DESC NULLS LAST
      LIMIT 5`,
    artistId
  )) as any[];

  // ── Топ-5 треков по доходу ───────────────────────────────────────
  const topRevenue = (await prisma.$queryRawUnsafe(
    `SELECT t.id, t.title, t.slug, t.cover,
            COALESCE(SUM(lp.artist_amount), 0)::numeric AS revenue,
            COUNT(lp.id)::int AS sales
       FROM tracks t
       LEFT JOIN license_purchases lp ON lp.track_id = t.id AND lp.status = 'PAID' AND lp.paid_at >= now() - interval '30 days'
      WHERE t."artistId" = $1
      GROUP BY t.id, t.title, t.slug, t.cover
      ORDER BY revenue DESC NULLS LAST
      LIMIT 5`,
    artistId
  )) as any[];

  // ── География (топ-10 регионов слушателей за 30 дней) ─────────────
  const geo = (await prisma.$queryRawUnsafe(
    `SELECT r.name, r.slug, COUNT(DISTINCT lh.user_id)::int AS listeners,
            COUNT(lh.id)::int AS plays
       FROM listen_history lh
       JOIN tracks t ON t.id = lh.track_id
       JOIN users u ON u.id = lh.user_id
       JOIN regions r ON r.id = u."regionId"
      WHERE t."artistId" = $1
        AND lh.played_at >= now() - interval '30 days'
      GROUP BY r.name, r.slug
      ORDER BY listeners DESC
      LIMIT 10`,
    artistId
  )) as any[];

  return NextResponse.json({
    success: true,
    data: {
      artist: { id: artist.id, name: artist.name, followers: artist.followers },
      kpi: {
        plays:         { now: kpi.plays,         prev: kpi.prev_plays },
        listeners:     { now: kpi.listeners,     prev: kpi.prev_listeners },
        newFollowers:  { now: kpi.new_followers, prev: kpi.prev_new_followers },
        sales:         { now: kpi.sales,         prev: kpi.prev_sales },
        revenue:       { now: Number(kpi.revenue), prev: Number(kpi.prev_revenue) },
      },
      monthly: monthly.map((m: any) => ({
        month: m.month, plays: Number(m.plays), revenue: Number(m.revenue),
      })),
      topPlays: topPlays.map((t: any) => ({
        id: t.id, title: t.title, slug: t.slug, cover: t.cover, plays: Number(t.plays),
      })),
      topRevenue: topRevenue.map((t: any) => ({
        id: t.id, title: t.title, slug: t.slug, cover: t.cover,
        revenue: Number(t.revenue), sales: Number(t.sales),
      })),
      geo: geo.map((g: any) => ({
        name: g.name, slug: g.slug, listeners: Number(g.listeners), plays: Number(g.plays),
      })),
    },
  }, { headers: cors });
}
