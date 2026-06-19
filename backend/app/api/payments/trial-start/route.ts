import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AuthService } from '@/lib/auth';
import { getCorsHeaders } from '@/lib/cors';

export const dynamic = 'force-dynamic';

const TRIAL_DAYS = 7;

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request.headers.get('origin') || undefined),
  });
}

// POST /api/payments/trial-start
// Бесплатный 7-дневный пробный период Premium. Даётся один раз на пользователя.
// Без оплаты создаёт ACTIVE-подписку tier=PREMIUM на 7 дней с is_trial=true.
export async function POST(request: NextRequest) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) {
    return NextResponse.json({ success: false, error: 'Требуется авторизация' }, { status: 401, headers: cors });
  }
  const session = await AuthService.validateSession(auth.substring(7));
  if (!session) {
    return NextResponse.json({ success: false, error: 'Сессия истекла' }, { status: 401, headers: cors });
  }

  const userId = session.userId;

  // Проверим: пользователь уже использовал триал?
  const [usedRow] = (await prisma.$queryRawUnsafe(
    `SELECT 1 FROM subscriptions WHERE "userId" = $1 AND trial_used = true LIMIT 1`,
    userId
  )) as any[];
  if (usedRow) {
    return NextResponse.json(
      { success: false, error: 'Пробный период уже использован. Оформите Premium за 299 ₽/мес.', code: 'TRIAL_ALREADY_USED' },
      { status: 409, headers: cors }
    );
  }

  // У него уже есть активная платная подписка? — тогда триал не нужен
  const existing = await prisma.subscription.findUnique({ where: { userId } });
  if (existing && existing.status === 'ACTIVE' && existing.tier !== 'FREE'
      && (!existing.endDate || new Date(existing.endDate) > new Date())) {
    return NextResponse.json(
      { success: false, error: 'У вас уже активна Premium-подписка', code: 'ALREADY_ACTIVE' },
      { status: 409, headers: cors }
    );
  }

  const now = new Date();
  const endDate = new Date(now.getTime() + TRIAL_DAYS * 86_400_000);

  await prisma.subscription.upsert({
    where: { userId },
    create: {
      userId,
      tier: 'PREMIUM',
      status: 'ACTIVE',
      price: 0,
      startDate: now,
      endDate,
      autoRenew: false,
    },
    update: {
      tier: 'PREMIUM',
      status: 'ACTIVE',
      price: 0,
      startDate: now,
      endDate,
      autoRenew: false,
    },
  });

  // Помечаем триал как использованный (нельзя взять второй раз)
  await prisma.$executeRawUnsafe(
    `UPDATE subscriptions SET is_trial = true, trial_used = true WHERE "userId" = $1`,
    userId
  );

  return NextResponse.json({
    success: true,
    message: `Пробный период активирован на ${TRIAL_DAYS} дней. После окончания подписка не продлевается автоматически — её нужно оформить заново.`,
    endDate,
    daysTotal: TRIAL_DAYS,
  }, { headers: cors });
}

// GET /api/payments/trial-start — eligibility: можно ли запросить пробный
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

  const [usedRow] = (await prisma.$queryRawUnsafe(
    `SELECT 1 FROM subscriptions WHERE "userId" = $1 AND trial_used = true LIMIT 1`,
    session.userId
  )) as any[];

  const sub = await prisma.subscription.findUnique({ where: { userId: session.userId } });
  const hasActivePaid = !!sub && sub.status === 'ACTIVE' && sub.tier !== 'FREE'
    && (!sub.endDate || new Date(sub.endDate) > new Date());

  return NextResponse.json({
    success: true,
    data: {
      eligible: !usedRow && !hasActivePaid,
      trialAlreadyUsed: !!usedRow,
      hasActivePaid,
      trialDays: TRIAL_DAYS,
      currentSubscription: sub ? {
        tier: sub.tier,
        status: sub.status,
        endDate: sub.endDate,
        isTrial: !!(sub as any).is_trial,
      } : null,
    },
  }, { headers: cors });
}
