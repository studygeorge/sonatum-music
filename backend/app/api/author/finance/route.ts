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

  // === Разделение Авторские / Исполнительские по ТЗ ===
  // Для COMPOSER → продажа оригиналов = авторские; продажа каверов = исполнительские
  // Для PERFORMER → всё идёт в исполнительские
  // Для BOTH → продажа оригиналов = и авторские, и исполнительские (две колонки)
  const splitRows = (await prisma.$queryRawUnsafe(
    `SELECT
        COALESCE(t.content_type, 'ORIGINAL') AS ctype,
        COUNT(*)::int AS sales,
        SUM(lp.artist_amount)::numeric AS earned
       FROM license_purchases lp
       JOIN tracks t ON t.id = lp.track_id
       JOIN artists a ON a.id = t."artistId"
      WHERE a."userId" = $1 AND lp.status = 'PAID'
        AND lp.paid_at > now() - interval '30 days'
      GROUP BY ctype`,
    user.id
  )) as any[];

  const earnedByType = new Map<string, { sales: number; earned: number }>();
  for (const r of splitRows) {
    earnedByType.set(String(r.ctype || 'ORIGINAL'), { sales: r.sales, earned: Number(r.earned || 0) });
  }
  const originalSales = earnedByType.get('ORIGINAL')?.sales || 0;
  const originalEarn = earnedByType.get('ORIGINAL')?.earned || 0;
  const coverSales = earnedByType.get('COVER')?.sales || 0;
  const coverEarn = earnedByType.get('COVER')?.earned || 0;

  const authorType = (user.artistProfile as any)?.authorType || 'BOTH';

  // Разрезаем суммы по ТЗ
  let composerEarnings = 0; // авторские
  let performerEarnings = 0; // исполнительские
  if (authorType === 'COMPOSER') {
    composerEarnings = originalEarn;
    performerEarnings = coverEarn; // если каверы есть — это исполнение
  } else if (authorType === 'PERFORMER') {
    performerEarnings = originalEarn + coverEarn;
  } else {
    // BOTH — для оригиналов 100% — это и авторское, и исполнительское (видим как две колонки одного и того же поступления)
    composerEarnings = originalEarn;
    performerEarnings = originalEarn + coverEarn;
  }

  return NextResponse.json(
    {
      success: true,
      data: {
        balance,
        availableForWithdrawal: extras?.payout_enabled ? balance : 0,
        accountKind: extras?.account_kind || 'SOLO',
        authorType,
        totals: {
          totalLicenseEarned: Number(totals?.total_license_earned || 0),
          totalDonations: Number(totals?.total_donations || 0),
          totalLicenseCount: Number(totals?.total_license_count || 0),
        },
        // Разделение Авторские / Исполнительские (ТЗ)
        split: {
          composer: {
            originalSales,
            originalEarn,
            total: composerEarnings,
          },
          performer: {
            coverSales,
            coverEarn,
            originalSales: authorType === 'BOTH' || authorType === 'PERFORMER' ? originalSales : 0,
            originalEarn: authorType === 'BOTH' || authorType === 'PERFORMER' ? originalEarn : 0,
            total: performerEarnings,
          },
          donations: Number(totals?.total_donations || 0),
          // Примечание: для BOTH суммы по «оригиналам» дублируются в composer и performer — это аналитика, не двойная выплата
          note: authorType === 'BOTH'
            ? 'Для полнотворческого проекта продажа оригинала отображается одновременно как авторская и исполнительская часть. Деньги поступают одной суммой на ваш баланс — разделение нужно только для аналитики.'
            : null,
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
