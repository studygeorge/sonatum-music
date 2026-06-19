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

// GET /api/author/payout/eligibility
// Возвращает статус выполнения 3 условий из ТЗ для подключения выплат:
//   1) Возраст аккаунта ≥ 3 месяцев
//   2) Не менее 3 опубликованных треков
//   3) Верификация самозанятого (по факту наличия ИНН в профиле)
export async function GET(request: NextRequest) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) {
    return NextResponse.json({ success: false, error: 'Требуется авторизация' }, { status: 401, headers: cors });
  }
  const session = await AuthService.validateSession(auth.substring(7));
  if (!session) {
    return NextResponse.json({ success: false, error: 'Сессия истекла' }, { status: 401, headers: cors });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, createdAt: true, role: true },
  });
  if (!user) {
    return NextResponse.json({ success: false, error: 'Пользователь не найден' }, { status: 404, headers: cors });
  }

  // Прочие поля из raw (tin, payout_enabled, self_employed_verified_at — не в Prisma-схеме)
  const [extra] = (await prisma.$queryRawUnsafe(
    `SELECT tin, sbp_phone, payout_enabled, self_employed_verified_at FROM users WHERE id = $1`,
    session.userId
  )) as any[];

  const ageMs = Date.now() - new Date(user.createdAt).getTime();
  const MIN_AGE_MS = 90 * 86_400_000;
  const accountOldEnough = ageMs >= MIN_AGE_MS;
  const accountAgeDays = Math.floor(ageMs / 86_400_000);
  const daysLeftForAge = accountOldEnough ? 0 : Math.ceil((MIN_AGE_MS - ageMs) / 86_400_000);

  // Подсчёт опубликованных треков
  let publishedTracks = 0;
  let hasArtist = false;
  if (user.role === 'ARTIST' || user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') {
    const artist = await prisma.artist.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });
    if (artist) {
      hasArtist = true;
      publishedTracks = await prisma.track.count({
        where: { artistId: artist.id, status: 'PUBLISHED' },
      });
    }
  }
  const tracksOk = publishedTracks >= 3;
  const tracksLeft = Math.max(0, 3 - publishedTracks);

  const selfEmployedVerified = !!extra?.self_employed_verified_at;
  const payoutEnabled = !!extra?.payout_enabled;

  const allConditionsMet = accountOldEnough && tracksOk && (user.role !== 'ARTIST' || true);
  const canSetupPayout = (user.role === 'ARTIST' && accountOldEnough && tracksOk)
    || user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';

  return NextResponse.json({
    success: true,
    data: {
      hasArtist,
      payoutEnabled,
      selfEmployedVerified,
      tin: extra?.tin || null,
      sbpPhone: extra?.sbp_phone || null,
      conditions: {
        accountAge: {
          ok: accountOldEnough,
          accountAgeDays,
          daysLeft: daysLeftForAge,
          required: 'не менее 3 месяцев',
        },
        tracks: {
          ok: tracksOk,
          publishedTracks,
          tracksLeft,
          required: 'не менее 3 опубликованных треков',
        },
        selfEmployed: {
          ok: selfEmployedVerified,
          required: 'подтверждён статус самозанятого',
          hint: 'Подтверждается автоматически после указания ИНН и проверки в НПД (или через Госуслуги)',
        },
      },
      canSetupPayout,
      allConditionsMet,
    },
  }, { headers: cors });
}
