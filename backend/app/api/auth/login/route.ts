import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { PasswordService } from '@/lib/password';
import { AuthService } from '@/lib/auth';
import { getCorsHeaders } from '@/lib/cors';

import { checkRateLimit, rateLimitResponse } from '@/lib/ratelimit';
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin');
  const headers = getCorsHeaders(origin || undefined);
  return new Response(null, { status: 204, headers });
}

export async function POST(request: NextRequest) {
  const _rl = checkRateLimit('login', request, { max: 5, windowSec: 60 });
  if (!_rl.ok) return rateLimitResponse(_rl, request) as any;
  const origin = request.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin || undefined);

  try {
    const { email, password } = await request.json();

    console.log('[LOGIN] Попытка входа:', email);

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email и пароль обязательны' },
        { status: 400, headers: corsHeaders }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        artistProfile: {
          select: {
            id: true,
            name: true,
            slug: true,
            avatar: true,
            verified: true,
          },
        },
      },
    });

    console.log('[LOGIN] Пользователь найден:', user ? `ID: ${user.id}, Email: ${user.email}` : 'НЕТ');

    if (!user || !user.passwordHash) {
      return NextResponse.json(
        { error: 'Неверный email или пароль' },
        { status: 401, headers: corsHeaders }
      );
    }

    const isValidPassword = await PasswordService.verify(password, user.passwordHash);

    console.log('[LOGIN] Пароль верный:', isValidPassword);

    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Неверный email или пароль' },
        { status: 401, headers: corsHeaders }
      );
    }

    if (user.status !== 'ACTIVE') {
      console.log('[LOGIN] Аккаунт не активен:', user.status);
      return NextResponse.json(
        { error: 'Аккаунт заблокирован или не активирован' },
        { status: 403, headers: corsHeaders }
      );
    }

    // === 2FA проверка ===
    const [twoFA] = (await prisma.$queryRawUnsafe(
      `SELECT totp_enabled, totp_secret, totp_backup_codes FROM users WHERE id = $1`,
      user.id
    )) as any[];

    if (twoFA?.totp_enabled && twoFA?.totp_secret) {
      const code = String((await request.clone().json().catch(() => ({})))?.code || '').replace(/\s+/g, '');
      if (!code) {
        return NextResponse.json(
          { success: false, error: 'Требуется код двухфакторной аутентификации', requires2FA: true },
          { status: 401, headers: corsHeaders }
        );
      }

      // Сначала пробуем как TOTP (6 цифр)
      let codeValid = false;
      if (/^\d{6}$/.test(code)) {
        const otplib = await import('otplib');
        codeValid = otplib.verifySync({ token: code, secret: twoFA.totp_secret, strategy: 'totp' }).valid;
      }

      // Если не TOTP — пробуем как backup-код (XXXX-XXXX)
      if (!codeValid && /^[A-F0-9]{4}-[A-F0-9]{4}$/i.test(code)) {
        const codes = Array.isArray(twoFA.totp_backup_codes) ? twoFA.totp_backup_codes : [];
        const codeUp = code.toUpperCase();
        const idx = codes.findIndex((c: any) => c.code === codeUp && !c.used);
        if (idx >= 0) {
          codes[idx].used = true;
          codes[idx].usedAt = new Date().toISOString();
          await prisma.$executeRawUnsafe(
            `UPDATE users SET totp_backup_codes = $1::jsonb WHERE id = $2`,
            JSON.stringify(codes), user.id
          );
          codeValid = true;
        }
      }

      if (!codeValid) {
        return NextResponse.json(
          { success: false, error: 'Неверный код двухфакторной аутентификации', requires2FA: true },
          { status: 403, headers: corsHeaders }
        );
      }
    }

    const ipAddress = request.headers.get('x-forwarded-for') ||
                      request.headers.get('x-real-ip') ||
                      'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    console.log('[LOGIN] Создание сессии для userId:', user.id);

    let token: string;
    try {
      token = await AuthService.createSession(user.id, ipAddress, userAgent);
      console.log('[LOGIN] Сессия создана успешно, token:', token.substring(0, 10) + '...');
    } catch (sessionError) {
      console.error('[LOGIN] Ошибка создания сессии:', sessionError);
      return NextResponse.json(
        { error: 'Ошибка создания сессии' },
        { status: 500, headers: corsHeaders }
      );
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const { passwordHash: _, ...userWithoutPassword } = user;

    console.log('[LOGIN] Успешный вход:', user.email);

    return NextResponse.json(
      {
        token,
        user: userWithoutPassword,
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('[LOGIN] Критическая ошибка:', error);
    return NextResponse.json(
      { error: 'Ошибка сервера' },
      { status: 500, headers: corsHeaders }
    );
  }
}
