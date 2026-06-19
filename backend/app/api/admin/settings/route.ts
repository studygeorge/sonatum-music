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

// Описание ключей настроек для UI
const SETTING_DESCRIPTIONS: Record<string, { label: string; type: 'number' | 'string'; hint?: string; unit?: string }> = {
  event_publication_fee: {
    label: 'Стоимость публикации афиши (₽)',
    type: 'number',
    unit: '₽',
    hint: 'Для авторов без подписки ПРОФИ. По умолчанию 250 ₽.',
  },
  premium_monthly_price: {
    label: 'Premium-подписка слушателя · месяц (₽)',
    type: 'number',
    unit: '₽',
    hint: 'По умолчанию 299 ₽/мес.',
  },
  premium_yearly_price: {
    label: 'Premium-подписка слушателя · год (₽)',
    type: 'number',
    unit: '₽',
    hint: 'По умолчанию 2 490 ₽/год.',
  },
  student_monthly_price: {
    label: 'Студенческий тариф · месяц (₽)',
    type: 'number',
    unit: '₽',
    hint: 'По умолчанию 149 ₽/мес.',
  },
  profi_monthly_price: {
    label: 'ПРОФИ-подписка автора · месяц (₽)',
    type: 'number',
    unit: '₽',
    hint: 'По умолчанию 299 ₽/мес.',
  },
  trial_days: {
    label: 'Длительность пробного периода (дней)',
    type: 'number',
    unit: 'дней',
    hint: 'По умолчанию 7 дней.',
  },
  default_track_price: {
    label: 'Цена трека по умолчанию (₽)',
    type: 'number',
    unit: '₽',
    hint: 'Подставляется в форму загрузки трека. По умолчанию 99 ₽.',
  },
  license_commission_pct: {
    label: 'Комиссия с продажи лицензий (%)',
    type: 'number',
    unit: '%',
    hint: 'По умолчанию 10%. Для B2B-лицензий — 20%.',
  },
  premium_platform_share_pct: {
    label: 'Доля платформы от Premium-подписок (%)',
    type: 'number',
    unit: '%',
    hint: 'По умолчанию 30%. Остальные 70% — в пул авторам.',
  },
};

async function requireAdmin(request: NextRequest) {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const session = await AuthService.validateSession(auth.substring(7));
  if (!session) return null;
  if (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN') return null;
  return session;
}

// GET /api/admin/settings — все настройки + их метаданные
export async function GET(request: NextRequest) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const session = await requireAdmin(request);
  if (!session) {
    return NextResponse.json({ success: false, error: 'Доступ только админу' }, { status: 403, headers: cors });
  }

  const rows = (await prisma.$queryRawUnsafe(
    `SELECT key, value, description, updated_at FROM platform_settings ORDER BY key`
  )) as any[];

  const map = new Map(rows.map((r) => [r.key, r]));

  // Возвращаем все известные ключи (включая ещё не созданные — с дефолтами)
  const settings = Object.entries(SETTING_DESCRIPTIONS).map(([key, meta]) => {
    const row = map.get(key);
    return {
      key,
      label: meta.label,
      type: meta.type,
      unit: meta.unit,
      hint: meta.hint,
      value: row?.value || null,
      updatedAt: row?.updated_at || null,
      description: row?.description || meta.hint,
    };
  });

  // Плюс «прочие» настройки, которые не описаны в коде (на всякий случай)
  const knownKeys = new Set(Object.keys(SETTING_DESCRIPTIONS));
  rows
    .filter((r) => !knownKeys.has(r.key))
    .forEach((r) => {
      settings.push({
        key: r.key,
        label: r.key,
        type: 'string',
        unit: undefined,
        hint: undefined,
        value: r.value,
        updatedAt: r.updated_at,
        description: r.description,
      });
    });

  return NextResponse.json({ success: true, data: settings }, { headers: cors });
}

// PATCH /api/admin/settings — обновить значение настройки
// Body: { key, value, description? }
export async function PATCH(request: NextRequest) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const session = await requireAdmin(request);
  if (!session) {
    return NextResponse.json({ success: false, error: 'Доступ только админу' }, { status: 403, headers: cors });
  }

  let body: any;
  try { body = await request.json(); } catch { body = {}; }
  const key = String(body.key || '').trim();
  const value = body.value == null ? '' : String(body.value).trim();
  if (!key) {
    return NextResponse.json({ success: false, error: 'Не указан ключ' }, { status: 400, headers: cors });
  }

  // Валидация типа
  const meta = SETTING_DESCRIPTIONS[key];
  if (meta?.type === 'number' && value !== '' && isNaN(Number(value))) {
    return NextResponse.json({ success: false, error: 'Значение должно быть числом' }, { status: 400, headers: cors });
  }

  await prisma.$executeRawUnsafe(
    `INSERT INTO platform_settings (key, value, description, updated_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (key) DO UPDATE SET value = $2, description = COALESCE(EXCLUDED.description, platform_settings.description), updated_at = now()`,
    key, value, body.description || meta?.hint || null
  );

  return NextResponse.json({ success: true, message: 'Сохранено' }, { headers: cors });
}
