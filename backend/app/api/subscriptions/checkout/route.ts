import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthUser } from '@/lib/auth';
import { getCorsHeaders } from '@/lib/cors';

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request.headers.get('origin') || undefined),
  });
}

async function postHandler(request: NextRequest, user: AuthUser) {
  const origin = request.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin || undefined);

  try {
    const body = await request.json();
    const { planId, paymentMethodId } = body;

    if (!planId) {
      return NextResponse.json(
        { success: false, error: 'Требуется выбрать тариф' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Mock payment gateway url
    const checkoutUrl = `https://checkout.sonatum.ru/pay/${planId}_${user.id}_${Date.now()}`;

    return NextResponse.json({ 
      success: true, 
      data: { checkoutUrl, message: 'Ожидается оплата' } 
    }, { headers: corsHeaders });
  } catch (error) {
    console.error('[CHECKOUT_ERROR]', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка инициализации оплаты' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export const POST = requireAuth(postHandler);
