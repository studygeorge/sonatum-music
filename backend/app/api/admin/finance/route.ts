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
    return NextResponse.json(
      { success: false, error: 'Требуется авторизация' },
      { status: 401, headers: cors }
    );
  }
  const session = await AuthService.validateSession(auth.substring(7));
  if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN')) {
    return NextResponse.json(
      { success: false, error: 'Доступ только админу' },
      { status: 403, headers: cors }
    );
  }

  const { searchParams } = new URL(request.url);
  const period = searchParams.get('period') || '30d';
  const sinceDays = period === 'all' ? 36500 : period === '7d' ? 7 : period === '90d' ? 90 : 30;

  const sinceClause = `now() - interval '${sinceDays} days'`;

  // Сводка
  const [summary] = (await prisma.$queryRawUnsafe(
    `SELECT
       (SELECT COUNT(*) FROM users)::int AS users_total,
       (SELECT COUNT(*) FROM users WHERE role = 'ARTIST')::int AS artists_total,
       (SELECT COUNT(*) FROM subscriptions WHERE status = 'ACTIVE')::int AS active_subs,
       (SELECT COUNT(*) FROM tracks)::int AS tracks_total,
       (SELECT COUNT(*) FROM tracks WHERE status = 'PUBLISHED')::int AS tracks_published,
       COALESCE((SELECT SUM(price) FROM license_purchases WHERE status = 'PAID' AND paid_at > ${sinceClause}), 0)::numeric AS revenue_licenses,
       COALESCE((SELECT SUM(commission_amount) FROM license_purchases WHERE status = 'PAID' AND paid_at > ${sinceClause}), 0)::numeric AS commission_licenses,
       COALESCE((SELECT SUM(artist_amount) FROM license_purchases WHERE status = 'PAID' AND paid_at > ${sinceClause}), 0)::numeric AS payout_licenses,
       COALESCE((SELECT SUM(price) FROM subscriptions WHERE status = 'ACTIVE' AND start_date > ${sinceClause}), 0)::numeric AS revenue_subs,
       COALESCE((SELECT SUM(amount) FROM donations WHERE status = 'PAID' AND paid_at > ${sinceClause}), 0)::numeric AS revenue_donations,
       COALESCE((SELECT COUNT(*) FROM license_purchases WHERE status = 'PAID' AND paid_at > ${sinceClause}), 0)::int AS license_sales,
       COALESCE((SELECT COUNT(*) FROM license_purchases WHERE status = 'AWAITING_MANAGER'), 0)::int AS b2b_pending,
       COALESCE((SELECT COUNT(*) FROM license_purchases WHERE status = 'EXCLUSIVE_REQUESTED'), 0)::int AS exclusive_pending`
  )) as any[];

  // Разбивка по типам лицензий
  const byLicense = (await prisma.$queryRawUnsafe(
    `SELECT lc.code, lc.name, lc.short_name, lc.commission_pct,
            COUNT(lp.id)::int AS sales,
            COALESCE(SUM(lp.price), 0)::numeric AS revenue,
            COALESCE(SUM(lp.commission_amount), 0)::numeric AS commission
       FROM license_catalog lc
       LEFT JOIN license_purchases lp ON lp.license_code = lc.code
            AND lp.status = 'PAID' AND lp.paid_at > ${sinceClause}
      GROUP BY lc.code, lc.name, lc.short_name, lc.commission_pct, lc.sort_order
      ORDER BY lc.sort_order`
  )) as any[];

  // Последние транзакции (mixed: licenses, subs, donations) — последние 30
  const transactions = (await prisma.$queryRawUnsafe(
    `(SELECT 'LICENSE' AS kind, lp.id, lp.price AS amount, lp.commission_amount AS commission,
             lp.status, lp.created_at, lp.paid_at,
             lp.license_code AS code, lc.short_name AS detail,
             lp.buyer_email AS buyer, lp.buyer_company AS company,
             t.title AS subject
        FROM license_purchases lp
        JOIN tracks t ON t.id = lp.track_id
        JOIN license_catalog lc ON lc.code = lp.license_code
       ORDER BY lp.created_at DESC LIMIT 30)
      UNION ALL
      (SELECT 'SUBSCRIPTION' AS kind, s.id, s.price AS amount,
              (s.price * 0.30) AS commission,
              s.status::text AS status, s.created_at, s.start_date AS paid_at,
              s.tier::text AS code, 'Sonatum Premium' AS detail,
              u.email AS buyer, NULL AS company,
              u.email AS subject
        FROM subscriptions s
        JOIN users u ON u.id = s.user_id
        WHERE s.status = 'ACTIVE'
        ORDER BY s.created_at DESC LIMIT 15)
      UNION ALL
      (SELECT 'DONATION' AS kind, d.id, d.amount, 0 AS commission,
              d.status, d.created_at, d.paid_at,
              'DONATION' AS code, COALESCE(d.donor_nickname, 'Аноним') AS detail,
              COALESCE(d.donor_id, '—') AS buyer, NULL AS company,
              COALESCE(a.name, c.name, '—') AS subject
        FROM donations d
        LEFT JOIN artists a ON a.id = d.recipient_artist_id
        LEFT JOIN collectives c ON c.id = d.recipient_collective_id
        ORDER BY d.created_at DESC LIMIT 15)
      ORDER BY created_at DESC LIMIT 50`
  )) as any[];

  return NextResponse.json(
    {
      success: true,
      data: {
        period,
        summary: {
          usersTotal: summary?.users_total || 0,
          artistsTotal: summary?.artists_total || 0,
          activeSubs: summary?.active_subs || 0,
          tracksTotal: summary?.tracks_total || 0,
          tracksPublished: summary?.tracks_published || 0,
          revenueLicenses: Number(summary?.revenue_licenses || 0),
          commissionLicenses: Number(summary?.commission_licenses || 0),
          payoutLicenses: Number(summary?.payout_licenses || 0),
          revenueSubscriptions: Number(summary?.revenue_subs || 0),
          revenueDonations: Number(summary?.revenue_donations || 0),
          licenseSales: summary?.license_sales || 0,
          b2bPending: summary?.b2b_pending || 0,
          exclusivePending: summary?.exclusive_pending || 0,
        },
        byLicense: byLicense.map((r) => ({
          code: r.code,
          name: r.name,
          shortName: r.short_name,
          commissionPct: r.commission_pct,
          sales: r.sales,
          revenue: Number(r.revenue || 0),
          commission: Number(r.commission || 0),
        })),
        transactions: transactions.map((t) => ({
          kind: t.kind,
          id: t.id,
          amount: Number(t.amount || 0),
          commission: Number(t.commission || 0),
          status: t.status,
          code: t.code,
          detail: t.detail,
          buyer: t.buyer,
          company: t.company,
          subject: t.subject,
          createdAt: t.created_at,
          paidAt: t.paid_at,
        })),
      },
    },
    { headers: cors }
  );
}
