import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AuthService } from '@/lib/auth';
import { PasswordService } from '@/lib/password';
import { getCorsHeaders } from '@/lib/cors';

export const dynamic = 'force-dynamic';

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request.headers.get('origin') || undefined),
  });
}

// POST /api/auth/change-password { currentPassword, newPassword }
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

  const body = await request.json().catch(() => ({}));
  const currentPassword = String(body.currentPassword || '');
  const newPassword = String(body.newPassword || '');

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ success: false, error: 'Заполните оба поля' }, { status: 400, headers: cors });
  }
  if (newPassword.length < 8) {
    return NextResponse.json({ success: false, error: 'Новый пароль — не менее 8 символов' }, { status: 400, headers: cors });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, passwordHash: true },
  });
  if (!user) {
    return NextResponse.json({ success: false, error: 'Пользователь не найден' }, { status: 404, headers: cors });
  }

  const ok = await PasswordService.verify(currentPassword, user.passwordHash);
  if (!ok) {
    return NextResponse.json({ success: false, error: 'Текущий пароль неверен' }, { status: 400, headers: cors });
  }

  const hashed = await PasswordService.hash(newPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: hashed },
  });

  // Инвалидируем все остальные сессии этого пользователя, кроме текущей
  try {
    await prisma.$executeRawUnsafe(
      `UPDATE sessions SET "expiresAt" = now() WHERE "userId" = $1 AND token <> $2`,
      user.id, auth.substring(7)
    );
  } catch {}

  return NextResponse.json({ success: true, message: 'Пароль изменён' }, { headers: cors });
}
