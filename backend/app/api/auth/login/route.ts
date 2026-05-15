import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { PasswordService } from '@/lib/password';
import { AuthService } from '@/lib/auth';
import { getCorsHeaders } from '@/lib/cors';

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin');
  const headers = getCorsHeaders(origin || undefined);
  return new Response(null, { status: 204, headers });
}

export async function POST(request: NextRequest) {
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
