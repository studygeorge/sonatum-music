import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AuthService } from '@/lib/auth';
import { getCorsHeaders } from '@/lib/cors';

export const dynamic = 'force-dynamic';

export async function OPTIONS(request: NextRequest) {
  return new Response(null, { status: 204, headers: getCorsHeaders(request.headers.get('origin') || undefined) });
}

async function requireAdmin(request: NextRequest) {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const s = await AuthService.validateSession(auth.substring(7));
  if (!s || (s.role !== 'ADMIN' && s.role !== 'SUPER_ADMIN')) return null;
  return s;
}

/**
 * GET /api/admin/finance/dashboard?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Финансовый дашборд по ТЗ:
 *  - Общая выручка от пользователей
 *  - Доход платформы (комиссии с лицензий + 30% от подписок)
 *  - Общий пул авторов (70% от подписок)
 *  - Начислено авторам (брутто): лицензии + пул + ручные B2B
 *  - Выплачено (брутто)
 *  - Доступно к выплате (баланс всех авторов)
 */
export async function GET(request: NextRequest) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const s = await requireAdmin(request);
  if (!s) return NextResponse.json({ success: false, error: 'forbidden' }, { status: 403, headers: cors });

  const url = new URL(request.url);
  const from = url.searchParams.get('from') || new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const to   = url.searchParams.get('to')   || new Date().toISOString().slice(0, 10);

  // Лицензии PAID
  const [lic] = (await prisma.$queryRawUnsafe(
    `SELECT COALESCE(SUM(price), 0)::numeric AS revenue,
            COALESCE(SUM(commission_amount), 0)::numeric AS platform,
            COALESCE(SUM(artist_amount), 0)::numeric AS authors,
            COUNT(*)::int AS count
       FROM license_purchases
      WHERE status = 'PAID' AND paid_at::date BETWEEN $1::date AND $2::date`,
    from, to
  )) as any[];

  // Подписки PAID
  const [sub] = (await prisma.$queryRawUnsafe(
    `SELECT COALESCE(SUM(price), 0)::numeric AS revenue, COUNT(*)::int AS count
       FROM subscriptions
      WHERE status IN ('ACTIVE','EXPIRED','CANCELED')
        AND "startDate"::date BETWEEN $1::date AND $2::date`,
    from, to
  )) as any[];
  const subRevenue = Number(sub?.revenue || 0);
  const subAuthorPool = Math.round(subRevenue * 0.7 * 100) / 100;
  const subPlatform = Math.round(subRevenue * 0.3 * 100) / 100;

  // Донаты PAID
  const [don] = (await prisma.$queryRawUnsafe(
    `SELECT COALESCE(SUM(amount), 0)::numeric AS revenue,
            COALESCE(SUM(commission_amount), 0)::numeric AS platform,
            COALESCE(SUM(recipient_amount), 0)::numeric AS authors,
            COUNT(*)::int AS count
       FROM donations
      WHERE status = 'PAID' AND paid_at::date BETWEEN $1::date AND $2::date`,
    from, to
  )) as any[];

  // Ручные B2B
  const [mp] = (await prisma.$queryRawUnsafe(
    `SELECT COALESCE(SUM(gross), 0)::numeric AS authors,
            COALESCE(SUM(source_amount), 0)::numeric AS revenue,
            COUNT(*)::int AS count
       FROM manual_payouts
      WHERE status = 'ACTIVE' AND created_at::date BETWEEN $1::date AND $2::date`,
    from, to
  )) as any[];

  // Подписочный пул — фактически распределённые суммы за периоды попадающие в диапазон
  const [pool] = (await prisma.$queryRawUnsafe(
    `SELECT COALESCE(SUM(amount_gross), 0)::numeric AS amount
       FROM subscription_pool_payouts spp
       JOIN subscription_pool_runs r ON r.id = spp.run_id
      WHERE r.completed_at::date BETWEEN $1::date AND $2::date`,
    from, to
  )) as any[];

  // Выплачено EXECUTED
  const [paid] = (await prisma.$queryRawUnsafe(
    `SELECT COALESCE(SUM(gross), 0)::numeric AS gross,
            COALESCE(SUM(net), 0)::numeric AS net,
            COALESCE(SUM(tax), 0)::numeric AS tax,
            COUNT(*)::int AS count
       FROM payouts
      WHERE status = 'EXECUTED' AND paid_at::date BETWEEN $1::date AND $2::date`,
    from, to
  )) as any[];

  // Текущий совокупный баланс всех авторов
  const [bal] = (await prisma.$queryRawUnsafe(
    `SELECT COALESCE(SUM(balance), 0)::numeric AS total FROM users WHERE role = 'ARTIST'`
  )) as any[];

  // Помесячная сводка для графика (за последние 12 месяцев)
  const monthly = (await prisma.$queryRawUnsafe(
    `WITH months AS (
       SELECT generate_series(date_trunc('month', now() - interval '11 months'),
                              date_trunc('month', now()),
                              interval '1 month')::date AS m
     )
     SELECT
       to_char(m.m, 'YYYY-MM') AS month,
       COALESCE(lic_rev, 0)::numeric AS license_revenue,
       COALESCE(sub_rev, 0)::numeric AS subscription_revenue,
       COALESCE(don_rev, 0)::numeric AS donation_revenue
     FROM months m
     LEFT JOIN (
       SELECT date_trunc('month', paid_at)::date AS m, SUM(price)::numeric AS lic_rev
       FROM license_purchases WHERE status='PAID' GROUP BY 1
     ) l ON l.m = m.m
     LEFT JOIN (
       SELECT date_trunc('month', "startDate")::date AS m, SUM(price)::numeric AS sub_rev
       FROM subscriptions WHERE status IN ('ACTIVE','EXPIRED','CANCELED') GROUP BY 1
     ) s ON s.m = m.m
     LEFT JOIN (
       SELECT date_trunc('month', paid_at)::date AS m, SUM(amount)::numeric AS don_rev
       FROM donations WHERE status='PAID' GROUP BY 1
     ) d ON d.m = m.m
     ORDER BY m.m`
  )) as any[];

  const totalRevenue = Number(lic?.revenue || 0) + subRevenue + Number(don?.revenue || 0);
  const totalPlatform = Number(lic?.platform || 0) + subPlatform + Number(don?.platform || 0);
  const totalAuthors = Number(lic?.authors || 0) + Number(don?.authors || 0) + Number(pool?.amount || 0) + Number(mp?.authors || 0);

  return NextResponse.json({
    success: true,
    data: {
      period: { from, to },
      revenue: {
        total: totalRevenue,
        licenses: Number(lic?.revenue || 0),
        subscriptions: subRevenue,
        donations: Number(don?.revenue || 0),
      },
      platform: {
        total: totalPlatform,
        licenses: Number(lic?.platform || 0),
        subscriptions30pct: subPlatform,
        donations: Number(don?.platform || 0),
      },
      authorsAccrued: {
        total: totalAuthors,
        licenses: Number(lic?.authors || 0),
        subscriptionPool70pct: Number(pool?.amount || 0),
        donations: Number(don?.authors || 0),
        manualB2b: Number(mp?.authors || 0),
      },
      payouts: {
        executedGross: Number(paid?.gross || 0),
        executedNet: Number(paid?.net || 0),
        taxHeld: Number(paid?.tax || 0),
        count: Number(paid?.count || 0),
      },
      currentBalances: Number(bal?.total || 0),
      counts: {
        licenses: Number(lic?.count || 0),
        subscriptions: Number(sub?.count || 0),
        donations: Number(don?.count || 0),
        manualB2b: Number(mp?.count || 0),
      },
      monthly: monthly.map((m: any) => ({
        month: m.month,
        license: Number(m.license_revenue),
        subscription: Number(m.subscription_revenue),
        donation: Number(m.donation_revenue),
      })),
    },
  }, { headers: cors });
}
