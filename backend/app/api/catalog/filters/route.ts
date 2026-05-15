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
  const { searchParams } = new URL(request.url);
  const genreSlug = searchParams.get('genre');

  try {
    let filters: any = [];

    // Базовые фильтры для всех
    filters.push({
      id: 'price',
      name: 'Цена',
      type: 'range',
      options: ['free', 'paid']
    });

    // Динамические фильтры на основе жанра
    if (genreSlug === 'duhovnaya') {
      filters.push(
        {
          id: 'confession',
          name: 'Конфессия',
          type: 'select',
          options: ['Православие', 'Католичество', 'Протестантизм', 'Иудаизм', 'Ислам', 'Буддизм']
        },
        {
          id: 'language',
          name: 'Язык исполнения',
          type: 'select',
          options: ['Церковнославянский', 'Русский', 'Греческий', 'Латынь', 'Иврит', 'Арабский']
        },
        {
          id: 'era',
          name: 'Эпоха',
          type: 'select',
          options: ['Древнерусская', 'XVIII век', 'Золотой век', 'Серебряный век', 'Советский период', 'Современность']
        }
      );
    } else if (genreSlug === 'narodnaya') {
      filters.push(
        {
          id: 'cycle',
          name: 'Цикл года',
          type: 'select',
          options: ['Зимние', 'Весенние', 'Летние', 'Осенние']
        },
        {
          id: 'ritual',
          name: 'Семейные обряды',
          type: 'select',
          options: ['Свадебные', 'Родинные', 'Причитания']
        }
      );
    }

    return NextResponse.json({ success: true, data: filters }, { headers: corsHeaders });
  } catch (error) {
    console.error('Catalog Filters Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch catalog filters' },
      { status: 500, headers: corsHeaders }
    );
  }
}
