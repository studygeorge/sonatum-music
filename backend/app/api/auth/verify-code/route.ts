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

// POST /api/auth/verify-code  { email?, code }
// Подтверждает email по 6-значному коду.
// Email можно не указывать — возьмём из сессии, если есть Bearer.
export async function POST(request: NextRequest) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const body = await request.json().catch(() => ({}));
  const code = String(body.code || '').trim();
  let email = String(body.email || '').trim().toLowerCase();

  if (!code || !/^\d{6}$/.test(code)) {
    return NextResponse.json({ success: false, error: 'Введите 6-значный код' }, { status: 400, headers: cors });
  }

  // Если email не передан — пробуем из сессии
  if (!email) {
    const auth = request.headers.get('Authorization');
    if (auth?.startsWith('Bearer ')) {
      const session = await AuthService.validateSession(auth.substring(7));
      if (session) {
        const u = await prisma.user.findUnique({ where: { id: session.userId }, select: { email: true } });
        email = u?.email || '';
      }
    }
  }

  if (!email) {
    return NextResponse.json({ success: false, error: 'Не указан email' }, { status: 400, headers: cors });
  }

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, emailVerified: true } });
  if (!user) {
    return NextResponse.json({ success: false, error: 'Пользователь не найден' }, { status: 404, headers: cors });
  }
  if (user.emailVerified) {
    return NextResponse.json({ success: true, alreadyVerified: true }, { headers: cors });
  }

  // Ищем активный токен по userId + code
  const [token] = (await prisma.$queryRawUnsafe(
    `SELECT id, "expiresAt", "usedAt"
       FROM verification_tokens
      WHERE "userId" = $1 AND code = $2 AND purpose = 'VERIFY_EMAIL'
      ORDER BY "createdAt" DESC
      LIMIT 1`,
    user.id, code
  )) as any[];

  if (!token) {
    return NextResponse.json({ success: false, error: 'Неверный код' }, { status: 400, headers: cors });
  }
  if (token.usedAt) {
    return NextResponse.json({ success: false, error: 'Код уже использован' }, { status: 400, headers: cors });
  }
  if (new Date(token.expiresAt).getTime() < Date.now()) {
    return NextResponse.json({ success: false, error: 'Код истёк. Запросите новый.' }, { status: 400, headers: cors });
  }

  // Помечаем токен и активируем email
  await prisma.$executeRawUnsafe(
    `UPDATE verification_tokens SET "usedAt" = now() WHERE id = $1`,
    token.id
  );
  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerified: new Date() },
  });

  return NextResponse.json({ success: true, message: 'Email подтверждён' }, { headers: cors });
}
