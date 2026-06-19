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

    // Базовые фильтры для всех (универсальные, по ТЗ)
    filters.push(
      {
        id: 'price',
        name: 'Цена',
        type: 'range',
        options: ['free', 'paid'],
      },
      {
        id: 'difficulty',
        name: 'Сложность исполнения',
        type: 'select',
        options: [
          { value: 'BEGINNER', label: 'Начинающий' },
          { value: 'INTERMEDIATE', label: 'Средний' },
          { value: 'ADVANCED', label: 'Продвинутый' },
        ],
      },
      {
        id: 'tempo',
        name: 'Темп',
        type: 'select',
        options: [
          { value: 'SLOW', label: 'Медленный' },
          { value: 'MEDIUM', label: 'Средний' },
          { value: 'FAST', label: 'Быстрый' },
        ],
      },
      {
        id: 'mood',
        name: 'Настроение',
        type: 'select',
        options: [
          'Торжественное', 'Лирическое', 'Драматическое', 'Радостное',
          'Меланхоличное', 'Эпическое', 'Светлое', 'Молитвенное',
          'Энергичное', 'Романтическое',
        ],
      },
      {
        id: 'instruments',
        name: 'Инструменты',
        type: 'multiselect',
        options: [
          'Скрипка', 'Альт', 'Виолончель', 'Контрабас', 'Гитара', 'Арфа',
          'Фортепиано', 'Рояль', 'Орган', 'Клавесин', 'Синтезатор',
          'Флейта', 'Гобой', 'Кларнет', 'Фагот', 'Саксофон',
          'Труба', 'Валторна', 'Тромбон', 'Туба',
          'Барабаны', 'Литавры', 'Ксилофон', 'Вибрафон', 'Маримба',
          'Балалайка', 'Домра', 'Гусли', 'Баян', 'Аккордеон', 'Гармонь',
          'Жалейка', 'Свирель',
          'Сопрано', 'Меццо-сопрано', 'Тенор', 'Бас', 'Хор',
        ],
      },
      {
        id: 'bpm',
        name: 'BPM (темп в ударах/мин)',
        type: 'range',
        min: 40,
        max: 240,
      },
      {
        id: 'year',
        name: 'Год выпуска',
        type: 'range',
        min: 1500,
        max: new Date().getFullYear(),
      },
      {
        id: 'has',
        name: 'Дополнительно',
        type: 'checkbox-group',
        options: [
          { value: 'hasSheets', label: 'С нотами' },
          { value: 'hasLyrics', label: 'С текстом' },
          { value: 'hasMinus', label: 'С минусовкой' },
        ],
      }
    );

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
