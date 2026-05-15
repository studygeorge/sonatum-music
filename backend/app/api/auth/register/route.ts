import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { PasswordService } from '@/lib/password';
import { AuthService } from '@/lib/auth';
import { getCorsHeaders } from '@/lib/cors';

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request.headers.get('origin') || undefined),
  });
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin || undefined);

  try {
    const body = await request.json();
    const { email, password, username, firstName, lastName, role, artistData } = body;

    console.log('[REGISTER] Попытка регистрации:', email);

    // Валидация
    if (!email || !password) {
      console.log('[REGISTER] Ошибка: отсутствует email или пароль');
      return NextResponse.json(
        { success: false, error: 'Email и пароль обязательны' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Проверка существования пользователя
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          { username: username || undefined }
        ]
      }
    });

    if (existingUser) {
      console.log('[REGISTER] Ошибка: пользователь уже существует');
      return NextResponse.json(
        { success: false, error: 'Пользователь с таким email или username уже существует' },
        { status: 409, headers: corsHeaders }
      );
    }

    // Хэшируем пароль
    const passwordHash = await PasswordService.hash(password);

    // Создаём пользователя (с транзакцией, если нужен профиль артиста)
    const userRole = role || 'USER';
    
    // Подготовка данных для создания
    const createData: any = {
      email,
      username: username || null,
      firstName: firstName || null,
      lastName: lastName || null,
      passwordHash,
      role: userRole,
      status: 'ACTIVE'
    };
    
    // Если это артист/автор
    if (userRole === 'ARTIST' && artistData) {
      createData.artistProfile = {
        create: {
          name: artistData.name || firstName + ' ' + lastName,
          slug: artistData.slug || (username || email.split('@')[0]) + '-' + Date.now().toString().slice(-4),
          authorType: artistData.authorType || 'BOTH'
        }
      };
      
      // Если это коллектив
      if (artistData.isCollective) {
        createData.collective = {
          create: {
            name: artistData.name,
            slug: artistData.slug || (username || email.split('@')[0]) + '-coll-' + Date.now().toString().slice(-4),
          }
        };
      }
    }

    const user = await prisma.user.create({
      data: createData,
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        avatar: true,
        role: true,
        status: true,
        createdAt: true
      }
    });

    console.log('[REGISTER] Пользователь создан:', user.id);

    // Получаем IP и User-Agent
    const ipAddress = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip');
    const userAgent = request.headers.get('user-agent');

    // Создаём сессию
    const token = await AuthService.createSession(
      user.id,
      ipAddress || undefined,
      userAgent || undefined
    );

    console.log('[REGISTER] Сессия создана, токен:', token.substring(0, 10) + '...');

    // ИСПРАВЛЕНИЕ: возвращаем данные в правильной структуре
    return NextResponse.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          avatar: user.avatar,
          role: user.role,
          status: user.status
        }
      }
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('[REGISTER] Ошибка регистрации:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка при регистрации. Попробуйте снова.' },
      { status: 500, headers: corsHeaders }
    );
  }
}
