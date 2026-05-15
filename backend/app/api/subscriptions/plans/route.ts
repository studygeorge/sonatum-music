import { NextRequest, NextResponse } from 'next/server';
import { getCorsHeaders } from '@/lib/cors';

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request.headers.get('origin') || undefined),
  });
}

export async function GET(request: NextRequest) {
  const origin = request.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin || undefined);

  const plans = [
    {
      id: 'free',
      name: 'Freemium',
      price: 0,
      tier: 'FREE',
      features: ['Доступ к базовому каталогу', 'Ограниченное скачивание', 'Стандартное качество звука']
    },
    {
      id: 'premium',
      name: 'Premium',
      price: 299,
      tier: 'PREMIUM',
      features: ['Доступ к тексту и нотам', 'Отсутствие рекламы', 'Скачивание в высоком качестве (320 kbps / FLAC)', 'Возможность комментировать']
    },
    {
      id: 'student',
      name: 'Студенческий',
      price: 149,
      tier: 'STUDENT',
      features: ['Все возможности Premium', 'Скидка 50%']
    }
  ];

  return NextResponse.json({ success: true, data: plans }, { headers: corsHeaders });
}
