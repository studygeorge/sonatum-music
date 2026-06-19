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

// Доли платформы из ТЗ:
//   - Premium-подписка слушателя: 30% платформа / 70% пул авторам
//   - Подписка ПРОФИ автора: 100% платформа
//   - Лицензии на треки: commission_pct из license_catalog (10% обычные, 20% B2B)
//   - Афиши: 100% платформа за публикацию (250 ₽)
//   - Донаты: 0% платформа (100% автору)
const SUB_PLATFORM_SHARE = 0.30;
const SUB_AUTHORS_POOL_SHARE = 0.70;

export async function GET(request: NextRequest) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) {
    return NextResponse.json({ success: false, error: 'Требуется авторизация' }, { status: 401, headers: cors });
  }
  const session = await AuthService.validateSession(auth.substring(7));
  if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN')) {
    return NextResponse.json({ success: false, error: 'Доступ только админу' }, { status: 403, headers: cors });
  }

  const { searchParams } = new URL(request.url);
  const period = searchParams.get('period') || '30d';
  const sinceDays = period === 'all' ? 36500 : period === '7d' ? 7 : period === '90d' ? 90 : 30;
  const sinceClause = `now() - interval '${sinceDays} days'`;

  // === SUMMARY ===
  const [s] = (await prisma.$queryRawUnsafe(
    `SELECT
       (SELECT COUNT(*) FROM users)::int AS users_total,
       (SELECT COUNT(*) FROM users WHERE role = 'ARTIST')::int AS artists_total,
       (SELECT COUNT(*) FROM subscriptions WHERE status = 'ACTIVE')::int AS active_subs,
       (SELECT COUNT(*) FROM author_subscriptions WHERE status = 'ACTIVE')::int AS active_profi,
       (SELECT COUNT(*) FROM tracks)::int AS tracks_total,
       (SELECT COUNT(*) FROM tracks WHERE status = 'PUBLISHED')::int AS tracks_published,

       -- Лицензии
       COALESCE((SELECT SUM(price)              FROM license_purchases WHERE status = 'PAID' AND paid_at > ${sinceClause}), 0)::numeric AS revenue_licenses,
       COALESCE((SELECT SUM(commission_amount)  FROM license_purchases WHERE status = 'PAID' AND paid_at > ${sinceClause}), 0)::numeric AS commission_licenses,
       COALESCE((SELECT SUM(artist_amount)      FROM license_purchases WHERE status = 'PAID' AND paid_at > ${sinceClause}), 0)::numeric AS payout_licenses,
       COALESCE((SELECT COUNT(*)                FROM license_purchases WHERE status = 'PAID' AND paid_at > ${sinceClause}), 0)::int    AS license_sales,
       COALESCE((SELECT COUNT(*)                FROM license_purchases WHERE status = 'AWAITING_MANAGER'), 0)::int                   AS b2b_pending,
       COALESCE((SELECT COUNT(*)                FROM license_purchases WHERE status = 'EXCLUSIVE_REQUESTED'), 0)::int                AS exclusive_pending,

       -- Premium-подписки слушателей
       COALESCE((SELECT SUM(price) FROM subscriptions WHERE status = 'ACTIVE' AND "startDate" > ${sinceClause}), 0)::numeric AS revenue_subs,

       -- ПРОФИ-подписки авторов
       COALESCE((SELECT SUM(price) FROM author_subscriptions WHERE status = 'ACTIVE' AND starts_at > ${sinceClause}), 0)::numeric AS revenue_profi,

       -- Донаты
       COALESCE((SELECT SUM(amount) FROM donations WHERE status = 'PAID' AND paid_at > ${sinceClause}), 0)::numeric AS revenue_donations,
       COALESCE((SELECT COUNT(*)    FROM donations WHERE status = 'PAID' AND paid_at > ${sinceClause}), 0)::int     AS donation_count,

       -- Афиши (платные публикации)
       COALESCE((SELECT SUM(publication_fee) FROM events WHERE paid_publication = true AND status = 'APPROVED' AND created_at > ${sinceClause}), 0)::numeric AS revenue_events,
       COALESCE((SELECT COUNT(*)             FROM events WHERE paid_publication = true AND status = 'APPROVED' AND created_at > ${sinceClause}), 0)::int     AS events_paid_count`
  )) as any[];

  const revenueLicenses    = Number(s?.revenue_licenses || 0);
  const commissionLicenses = Number(s?.commission_licenses || 0);
  const payoutLicenses     = Number(s?.payout_licenses || 0);
  const revenueSubs        = Number(s?.revenue_subs || 0);
  const revenueProfi       = Number(s?.revenue_profi || 0);
  const revenueDonations   = Number(s?.revenue_donations || 0);
  const revenueEvents      = Number(s?.revenue_events || 0);

  // Распределение Premium-подписок: 30% платформа, 70% пул авторам
  const platformFromSubs = revenueSubs * SUB_PLATFORM_SHARE;
  const authorsPoolFromSubs = revenueSubs * SUB_AUTHORS_POOL_SHARE;

  const totalPlatform =
    platformFromSubs +   // 30% Premium-подписок
    revenueProfi +       // 100% ПРОФИ автора
    commissionLicenses + // комиссия с лицензий
    revenueEvents;       // 100% за платные афиши

  const totalAuthorsAccrued =
    payoutLicenses +     // 90/80% от лицензий
    authorsPoolFromSubs +// 70% от Premium → пул авторам
    revenueDonations;    // 100% от донатов

  const totalRevenue =
    revenueLicenses + revenueSubs + revenueProfi + revenueDonations + revenueEvents;

  // === Разбивка по типам лицензий ===
  const byLicense = (await prisma.$queryRawUnsafe(
    `SELECT lc.code, lc.name, lc.short_name, lc.commission_pct,
            COUNT(lp.id)::int AS sales,
            COALESCE(SUM(lp.price), 0)::numeric AS revenue,
            COALESCE(SUM(lp.commission_amount), 0)::numeric AS commission,
            COALESCE(SUM(lp.artist_amount), 0)::numeric AS payout
       FROM license_catalog lc
       LEFT JOIN license_purchases lp ON lp.license_code = lc.code
            AND lp.status = 'PAID' AND lp.paid_at > ${sinceClause}
      GROUP BY lc.code, lc.name, lc.short_name, lc.commission_pct, lc.sort_order
      ORDER BY lc.sort_order`
  )) as any[];

  // === Топ-10 авторов по начислениям за период ===
  const topAuthors = (await prisma.$queryRawUnsafe(
    `SELECT a.id, a.name, a.slug,
            COALESCE(SUM(lp.artist_amount), 0)::numeric AS license_earnings,
            COALESCE((SELECT SUM(d.amount) FROM donations d WHERE d.recipient_artist_id = a.id AND d.status='PAID' AND d.paid_at > ${sinceClause}), 0)::numeric AS donation_earnings,
            COUNT(DISTINCT lp.id)::int AS license_sales
       FROM artists a
       LEFT JOIN tracks t ON t."artistId" = a.id
       LEFT JOIN license_purchases lp ON lp.track_id = t.id AND lp.status='PAID' AND lp.paid_at > ${sinceClause}
      GROUP BY a.id, a.name, a.slug
      HAVING COALESCE(SUM(lp.artist_amount), 0) > 0
         OR EXISTS (SELECT 1 FROM donations d WHERE d.recipient_artist_id = a.id AND d.status='PAID' AND d.paid_at > ${sinceClause})
      ORDER BY (
        COALESCE(SUM(lp.artist_amount), 0) +
        COALESCE((SELECT SUM(d.amount) FROM donations d WHERE d.recipient_artist_id = a.id AND d.status='PAID' AND d.paid_at > ${sinceClause}), 0)
      ) DESC
      LIMIT 10`
  )) as any[];

  // === Последние транзакции (5 источников) ===
  const transactions = (await prisma.$queryRawUnsafe(
    `(SELECT 'LICENSE' AS kind, lp.id, lp.price AS amount, lp.commission_amount AS commission,
             lp.status, lp.created_at, lp.paid_at,
             lp.license_code AS code, lc.short_name AS detail,
             lp.buyer_email AS buyer, lp.buyer_company AS company,
             t.title AS subject
        FROM license_purchases lp
        JOIN tracks t ON t.id = lp.track_id
        JOIN license_catalog lc ON lc.code = lp.license_code
       ORDER BY lp.created_at DESC LIMIT 20)
      UNION ALL
      (SELECT 'SUBSCRIPTION' AS kind, s.id, s.price AS amount,
              (s.price * 0.30) AS commission,
              s.status::text, s."createdAt" AS created_at, s."startDate" AS paid_at,
              s.tier::text AS code, 'Sonatum Premium' AS detail,
              u.email AS buyer, NULL AS company,
              u.email AS subject
        FROM subscriptions s
        JOIN users u ON u.id = s."userId"
        WHERE s.status = 'ACTIVE'
        ORDER BY s."createdAt" DESC LIMIT 10)
      UNION ALL
      (SELECT 'PROFI' AS kind, asub.id, asub.price AS amount,
              asub.price AS commission,
              asub.status::text, asub.created_at, asub.starts_at AS paid_at,
              'PROFI' AS code, 'Подписка ПРОФИ автора' AS detail,
              u.email AS buyer, NULL AS company,
              u.email AS subject
        FROM author_subscriptions asub
        JOIN users u ON u.id = asub.user_id
        WHERE asub.status = 'ACTIVE'
        ORDER BY asub.created_at DESC LIMIT 10)
      UNION ALL
      (SELECT 'EVENT' AS kind, e.id::text, e.publication_fee AS amount,
              e.publication_fee AS commission,
              e.status::text, e.created_at, e.created_at AS paid_at,
              'EVENT_PUBLICATION' AS code, 'Платная афиша' AS detail,
              u.email AS buyer, NULL AS company,
              e.title AS subject
        FROM events e
        JOIN users u ON u.id = e.author_id
        WHERE e.paid_publication = true
        ORDER BY e.created_at DESC LIMIT 10)
      UNION ALL
      (SELECT 'DONATION' AS kind, d.id, d.amount, 0 AS commission,
              d.status, d.created_at, d.paid_at,
              'DONATION' AS code, COALESCE(d.donor_nickname, 'Аноним') AS detail,
              COALESCE(d.donor_id, '—') AS buyer, NULL AS company,
              COALESCE(a.name, c.name, '—') AS subject
        FROM donations d
        LEFT JOIN artists a ON a.id = d.recipient_artist_id
        LEFT JOIN collectives c ON c.id = d.recipient_collective_id
        ORDER BY d.created_at DESC LIMIT 10)
      ORDER BY created_at DESC LIMIT 50`
  )) as any[];

  return NextResponse.json({
    success: true,
    data: {
      period,
      summary: {
        usersTotal: s?.users_total || 0,
        artistsTotal: s?.artists_total || 0,
        activeSubs: s?.active_subs || 0,
        activeProfi: s?.active_profi || 0,
        tracksTotal: s?.tracks_total || 0,
        tracksPublished: s?.tracks_published || 0,
        // Сводные итоги
        totalRevenue, totalPlatform, totalAuthorsAccrued,
        // Лицензии
        revenueLicenses, commissionLicenses, payoutLicenses, licenseSales: s?.license_sales || 0,
        b2bPending: s?.b2b_pending || 0, exclusivePending: s?.exclusive_pending || 0,
        // Premium-подписки слушателей
        revenueSubs, platformFromSubs, authorsPoolFromSubs,
        // ПРОФИ авторов
        revenueProfi,
        // Донаты
        revenueDonations, donationCount: s?.donation_count || 0,
        // Афиши
        revenueEvents, eventsPaidCount: s?.events_paid_count || 0,
      },
      byLicense: byLicense.map((r) => ({
        code: r.code, name: r.name, shortName: r.short_name,
        commissionPct: r.commission_pct, sales: r.sales,
        revenue: Number(r.revenue || 0),
        commission: Number(r.commission || 0),
        payout: Number(r.payout || 0),
      })),
      topAuthors: topAuthors.map((a) => ({
        id: a.id, name: a.name, slug: a.slug,
        licenseEarnings: Number(a.license_earnings || 0),
        donationEarnings: Number(a.donation_earnings || 0),
        total: Number(a.license_earnings || 0) + Number(a.donation_earnings || 0),
        licenseSales: a.license_sales,
      })),
      transactions: transactions.map((t) => ({
        kind: t.kind, id: t.id,
        amount: Number(t.amount || 0),
        commission: Number(t.commission || 0),
        status: t.status, code: t.code, detail: t.detail,
        buyer: t.buyer, company: t.company, subject: t.subject,
        createdAt: t.created_at, paidAt: t.paid_at,
      })),
    },
  }, { headers: cors });
}
