import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AuthService } from '@/lib/auth';
import { getCorsHeaders } from '@/lib/cors';

export const dynamic = 'force-dynamic';

const DEFAULTS = {
  newReleases: true,    // Новые релизы любимых авторов
  recommendations: true, // Персональные рекомендации
  replies: true,         // Ответы на мои комментарии
  events: true,          // Афиша — события рядом
  marketing: false,      // Маркетинговые рассылки и спецпредложения
};

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request.headers.get('origin') || undefined),
  });
}

async function getSession(request: NextRequest) {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return AuthService.validateSession(auth.substring(7));
}

// GET /api/users/me/notifications — текущие настройки
export async function GET(request: NextRequest) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const session = await getSession(request);
  if (!session) return NextResponse.json({ success: false, error: 'Не авторизован' }, { status: 401, headers: cors });

  const [row] = (await prisma.$queryRawUnsafe(
    `SELECT notification_settings FROM users WHERE id = $1`,
    session.userId
  )) as any[];

  const current = (row?.notification_settings && typeof row.notification_settings === 'object')
    ? row.notification_settings
    : {};

  return NextResponse.json({
    success: true,
    data: { ...DEFAULTS, ...current },
  }, { headers: cors });
}

// PATCH /api/users/me/notifications — обновить
// Body: { newReleases?, recommendations?, replies?, events?, marketing? }
export async function PATCH(request: NextRequest) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const session = await getSession(request);
  if (!session) return NextResponse.json({ success: false, error: 'Не авторизован' }, { status: 401, headers: cors });

  let body: any;
  try { body = await request.json(); } catch { body = {}; }

  // Принимаем только известные поля
  const [row] = (await prisma.$queryRawUnsafe(
    `SELECT notification_settings FROM users WHERE id = $1`,
    session.userId
  )) as any[];
  const current = (row?.notification_settings && typeof row.notification_settings === 'object')
    ? row.notification_settings
    : { ...DEFAULTS };

  const next: any = { ...current };
  for (const key of Object.keys(DEFAULTS)) {
    if (body[key] !== undefined) next[key] = !!body[key];
  }

  await prisma.$executeRawUnsafe(
    `UPDATE users SET notification_settings = $1::jsonb, "updatedAt" = now() WHERE id = $2`,
    JSON.stringify(next),
    session.userId
  );

  return NextResponse.json({
    success: true,
    data: { ...DEFAULTS, ...next },
    message: 'Настройки уведомлений сохранены',
  }, { headers: cors });
}
