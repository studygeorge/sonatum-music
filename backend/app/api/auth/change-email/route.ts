import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { AuthService } from '@/lib/auth';
import { PasswordService } from '@/lib/password';
import { getCorsHeaders } from '@/lib/cors';
import { sendMail, verifyEmailTemplate, mailUrls } from '@/lib/mailer';

import { checkEmailPolicy } from '@/lib/email-policy';
export const dynamic = 'force-dynamic';

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request.headers.get('origin') || undefined),
  });
}

// POST /api/auth/change-email { newEmail, password }
// Меняем email и отправляем письмо подтверждения на новый адрес
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
  const newEmail = String(body.newEmail || '').trim().toLowerCase();
  const password = String(body.password || '');

  if (!newEmail || !newEmail.includes('@')) {
    return NextResponse.json({ success: false, error: 'Введите корректный email' }, { status: 400, headers: cors });
  }
  const pol = checkEmailPolicy(newEmail);
  if (!pol.ok) {
    return NextResponse.json({ success: false, error: pol.error }, { status: 400, headers: cors });
  }
  if (!password) {
    return NextResponse.json({ success: false, error: 'Введите текущий пароль' }, { status: 400, headers: cors });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, passwordHash: true },
  });
  if (!user) {
    return NextResponse.json({ success: false, error: 'Пользователь не найден' }, { status: 404, headers: cors });
  }

  if (user.email === newEmail) {
    return NextResponse.json({ success: false, error: 'Новый email совпадает с текущим' }, { status: 400, headers: cors });
  }

  const ok = await PasswordService.verify(password, user.passwordHash);
  if (!ok) {
    return NextResponse.json({ success: false, error: 'Неверный пароль' }, { status: 400, headers: cors });
  }

  // Проверяем что email не занят
  const exists = await prisma.user.findUnique({ where: { email: newEmail }, select: { id: true } });
  if (exists) {
    return NextResponse.json({ success: false, error: 'Этот email уже используется' }, { status: 409, headers: cors });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { email: newEmail, emailVerified: null },
  });

  // Отправляем письмо для подтверждения нового адреса
  try {
    const verifyToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await prisma.verificationToken.create({
      data: { token: verifyToken, userId: user.id, purpose: 'VERIFY_EMAIL', expiresAt },
    });
    const tpl = verifyEmailTemplate(mailUrls.verify(verifyToken));
    await sendMail({ to: newEmail, subject: tpl.subject, html: tpl.html });
  } catch (e) {
    console.error('[CHANGE_EMAIL] не удалось отправить письмо:', e);
  }

  return NextResponse.json(
    { success: true, message: 'Email изменён. Письмо с подтверждением отправлено на новый адрес.' },
    { headers: cors }
  );
}
