import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AuthService } from '@/lib/auth';
import { getCorsHeaders } from '@/lib/cors';
import { init as tinkoffInit } from '@/lib/tinkoff';

const PRICES: Record<string, { kopecks: number; tier: 'PREMIUM'; description: string }> = {
  PREMIUM: { kopecks: 29900, tier: 'PREMIUM', description: 'Sonatum Premium · подписка на 1 месяц' },};

const SITE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://sonatum-music.ru';

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request.headers.get('origin') || undefined),
  });
}

export async function POST(request: NextRequest) {
  const corsHeaders = getCorsHeaders(request.headers.get('origin') || undefined);
  try {
    const auth = request.headers.get('Authorization');
    if (!auth?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Требуется авторизация' }, { status: 401, headers: corsHeaders });
    }
    const session = await AuthService.validateSession(auth.substring(7));
    if (!session) {
      return NextResponse.json({ success: false, error: 'Сессия' }, { status: 401, headers: corsHeaders });
    }
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, email: true },
    });
    if (!user) {
      return NextResponse.json({ success: false, error: 'Пользователь' }, { status: 404, headers: corsHeaders });
    }

    const body = await request.json().catch(() => ({}));
    const tier = String(body?.tier || '').toUpperCase();
    const plan = PRICES[tier];
    if (!plan) {
      return NextResponse.json({ success: false, error: 'Неизвестный тариф' }, { status: 400, headers: corsHeaders });
    }

    // Запрет на покупку, если уже есть активная подписка (PREMIUM/STUDENT)
    const existing = await prisma.subscription.findUnique({ where: { userId: user.id } });
    if (existing && existing.tier !== "FREE" && existing.status === "ACTIVE" &&
        (!existing.endDate || new Date(existing.endDate) > new Date())) {
      return NextResponse.json({
        success: false,
        error: "У вас уже есть активная подписка. Оформить новую можно после её окончания.",
      }, { status: 409, headers: corsHeaders });
    }

    // upsert pending Subscription
    const sub = await prisma.subscription.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        tier: plan.tier,
        status: 'PENDING' as any,
        price: plan.kopecks / 100,
        startDate: new Date(),
      },
      update: {
        tier: plan.tier,
        status: 'PENDING' as any,
        price: plan.kopecks / 100,
      },
    });

    const orderId = `sub_${sub.id}_${Date.now()}`;

    const r = await tinkoffInit({
      orderId,
      amountKopecks: plan.kopecks,
      description: plan.description,
      email: user.email,
      receipt: {
        items: [{
          name: plan.description,
          priceKopecks: plan.kopecks,
          quantity: 1,
        }],
        taxation: "usn_income",
      },
      successUrl: `${SITE_URL}/profile?payment=success`,
      failUrl: `${SITE_URL}/profile?payment=fail`,
      notificationUrl: `${SITE_URL}/api/payments/tinkoff/notify`,
    });

    if (!r.ok || !r.paymentUrl) {
      return NextResponse.json(
        { success: false, error: r.error || 'Ошибка инициализации платежа' },
        { status: 502, headers: corsHeaders }
      );
    }

    // Логируем намерение оплаты (Transaction PURCHASE с отрицательной суммой = расход)
    await prisma.transaction.create({
      data: {
        userId: user.id,
        amount: plan.kopecks / 100,
        type: 'PURCHASE' as any,
        description: `${plan.description} · pending Tinkoff PaymentId=${r.paymentId} OrderId=${orderId}`,
      },
    });

    return NextResponse.json(
      {
        success: true,
        paymentUrl: r.paymentUrl,
        paymentId: r.paymentId,
        orderId,
      },
      { headers: corsHeaders }
    );
  } catch (e) {
    console.error('[PAYMENT_INIT]', e);
    return NextResponse.json({ success: false, error: 'Ошибка сервера' }, { status: 500, headers: corsHeaders });
  }
}
