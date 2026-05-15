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
  if (!session) {
    return NextResponse.json(
      { success: false, error: 'Сессия истекла' },
      { status: 401, headers: cors }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: { artistProfile: true, collective: true },
  });
  if (!user) {
    return NextResponse.json(
      { success: false, error: 'Пользователь не найден' },
      { status: 404, headers: cors }
    );
  }

  const balance = Number(user.balance) || 0;

  // Доходы по типам лицензий за последние 30 дней
  const breakdown = (await prisma.$queryRawUnsafe(
    `SELECT lp.license_code,
            lc.short_name AS license_name,
            COUNT(*)::int AS sales,
            SUM(lp.artist_amount)::numeric AS earned
       FROM license_purchases lp
       JOIN tracks t ON t.id = lp.track_id
       JOIN artists a ON a.id = t."artistId"
       JOIN license_catalog lc ON lc.code = lp.license_code
      WHERE a."userId" = $1 AND lp.status = 'PAID'
        AND lp.paid_at > now() - interval '30 days'
      GROUP BY lp.license_code, lc.short_name
      ORDER BY earned DESC NULLS LAST`,
    user.id
  )) as any[];

  // Общая статистика
  const [totals] = (await prisma.$queryRawUnsafe(
    `SELECT
       COALESCE((SELECT SUM(artist_amount) FROM license_purchases lp
                   JOIN tracks t ON t.id = lp.track_id
                   JOIN artists a ON a.id = t."artistId"
                  WHERE a."userId" = $1 AND lp.status = 'PAID'), 0)::numeric AS total_license_earned,
       COALESCE((SELECT SUM(amount) FROM donations d
                   LEFT JOIN artists a ON a.id = d.recipient_artist_id
                   LEFT JOIN collectives c ON c.id = d.recipient_collective_id
                  WHERE d.status = 'PAID' AND (a."userId" = $1 OR c."leaderId" = $1)), 0)::numeric AS total_donations,
       COALESCE((SELECT COUNT(*) FROM license_purchases lp
                   JOIN tracks t ON t.id = lp.track_id
                   JOIN artists a ON a.id = t."artistId"
                  WHERE a."userId" = $1 AND lp.status = 'PAID'), 0)::int AS total_license_count`,
    user.id
  )) as any[];

  // Последние транзакции
  const recentLicenses = (await prisma.$queryRawUnsafe(
    `SELECT lp.id, lp.price, lp.artist_amount, lp.commission_pct, lp.license_code,
            lc.short_name AS license_name,
            t.title AS track_title, t.slug AS track_slug,
            lp.paid_at, lp.created_at, lp.status, lp.buyer_company
       FROM license_purchases lp
       JOIN tracks t ON t.id = lp.track_id
       JOIN artists a ON a.id = t."artistId"
       JOIN license_catalog lc ON lc.code = lp.license_code
      WHERE a."userId" = $1
      ORDER BY lp.created_at DESC
      LIMIT 30`,
    user.id
  )) as any[];

  const recentDonations = (await prisma.$queryRawUnsafe(
    `SELECT d.id, d.amount, d.donor_nickname, d.message, d.status, d.paid_at, d.created_at
       FROM donations d
       LEFT JOIN artists a ON a.id = d.recipient_artist_id
       LEFT JOIN collectives c ON c.id = d.recipient_collective_id
      WHERE (a."userId" = $1 OR c."leaderId" = $1)
      ORDER BY d.created_at DESC
      LIMIT 20`,
    user.id
  )) as any[];

  // Расширенные поля пользователя
  const [extras] = (await prisma.$queryRawUnsafe(
    `SELECT account_kind, tin, sbp_phone, payout_enabled, self_employed_verified_at FROM users WHERE id = $1`,
    user.id
  )) as any[];

  return NextResponse.json(
    {
      success: true,
      data: {
        balance,
        availableForWithdrawal: extras?.payout_enabled ? balance : 0,
        totals: {
          totalLicenseEarned: Number(totals?.total_license_earned || 0),
          totalDonations: Number(totals?.total_donations || 0),
          totalLicenseCount: Number(totals?.total_license_count || 0),
        },
        breakdown: breakdown.map((b) => ({
          licenseCode: b.license_code,
          licenseName: b.license_name,
          sales: b.sales,
          earned: Number(b.earned || 0),
        })),
        recentLicenses: recentLicenses.map((r) => ({
          id: r.id,
          price: Number(r.price),
          artistAmount: Number(r.artist_amount),
          commissionPct: r.commission_pct,
          licenseCode: r.license_code,
          licenseName: r.license_name,
          trackTitle: r.track_title,
          trackSlug: r.track_slug,
          status: r.status,
          buyerCompany: r.buyer_company,
          paidAt: r.paid_at,
          createdAt: r.created_at,
        })),
        recentDonations: recentDonations.map((r) => ({
          id: r.id,
          amount: Number(r.amount),
          donorNickname: r.donor_nickname,
          message: r.message,
          status: r.status,
          paidAt: r.paid_at,
          createdAt: r.created_at,
        })),
        payout: {
          enabled: !!extras?.payout_enabled,
          tin: extras?.tin || null,
          sbpPhone: extras?.sbp_phone || null,
          selfEmployedVerifiedAt: extras?.self_employed_verified_at || null,
        },
      },
    },
    { headers: cors }
  );
}
