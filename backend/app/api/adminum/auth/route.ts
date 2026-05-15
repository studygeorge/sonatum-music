import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { AuthService } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
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

  const code = request.nextUrl.searchParams.get('code');
  if (!code) {
    return NextResponse.json({ success: false, error: 'No code provided' }, { status: 400, headers: corsHeaders });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const allowedAdminId = process.env.ALLOWED_ADMIN_TG_ID;

  if (!botToken || !allowedAdminId) {
    return NextResponse.json({ success: false, error: 'Server configuration error' }, { status: 500, headers: corsHeaders });
  }

  try {
    // Получаем последние 50 обновлений от бота
    const response = await fetch(`https://api.telegram.org/bot${botToken}/getUpdates?offset=-50&limit=50`);
    const data = await response.json();

    if (!data.ok || !data.result) {
      return NextResponse.json({ success: false, error: 'Failed to fetch from Telegram' }, { headers: corsHeaders });
    }

    // Ищем сообщение от администратора с нужным кодом
    const match = data.result.find((update: any) => {
      const msg = update.message;
      if (!msg || !msg.text) return false;
      return msg.from.id.toString() === allowedAdminId && msg.text.trim() === `/auth ${code}`;
    });

    if (match) {
      const msg = match.message;
      const id = msg.from.id;
      const username = msg.from.username;
      const first_name = msg.from.first_name;

      // Авторизуем пользователя
      let user = await prisma.user.findFirst({
        where: { email: `${id}@telegram.local` }
      });

      if (!user) {
        user = await prisma.user.create({
          data: {
            email: `${id}@telegram.local`,
            username: username || `tg_${id}`,
            firstName: first_name || 'Admin',
            lastName: '',
            passwordHash: 'TG_SSO',
            role: 'SUPER_ADMIN',
            status: 'ACTIVE'
          }
        });
      } else if (user.role !== 'SUPER_ADMIN') {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { role: 'SUPER_ADMIN' }
        });
      }

      const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip');
      const userAgent = request.headers.get('user-agent');

      const token = await AuthService.createSession(
        user.id,
        ipAddress || undefined,
        userAgent || undefined
      );

      return NextResponse.json({
        success: true,
        data: {
          token,
          user: {
            id: user.id,
            username: user.username,
            firstName: user.firstName,
            role: user.role
          }
        }
      }, { headers: corsHeaders });
    }

    return NextResponse.json({ success: false, pending: true }, { headers: corsHeaders });
  } catch (error) {
    console.error('[TG_POLL_ERROR]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500, headers: corsHeaders });
  }
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin || undefined);

  try {
    const body = await request.json();
    const { id, first_name, last_name, username, photo_url, auth_date, hash } = body;

    if (!id || !hash || !auth_date) {
      return NextResponse.json({ success: false, error: 'Missing required parameters' }, { status: 400, headers: corsHeaders });
    }

    // Проверка актуальности (устаревание 24ч)
    const currentTimestamp = Math.floor(Date.now() / 1000);
    if (currentTimestamp - Number(auth_date) > 86400) {
      return NextResponse.json({ success: false, error: 'Auth data is outdated' }, { status: 400, headers: corsHeaders });
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const allowedAdminId = process.env.ALLOWED_ADMIN_TG_ID;

    if (!botToken || !allowedAdminId) {
      console.error('[TG_AUTH] Missing TELEGRAM_BOT_TOKEN or ALLOWED_ADMIN_TG_ID config');
      return NextResponse.json({ success: false, error: 'Server configuration error' }, { status: 500, headers: corsHeaders });
    }

    if (id.toString() !== allowedAdminId) {
      console.warn(`[TG_AUTH] Unauthorized access attempt by TG ID: ${id}`);
      return NextResponse.json({ success: false, error: 'Access denied. You are not the authorized admin.' }, { status: 403, headers: corsHeaders });
    }

    // Проверка подписи (hash) от Telegram
    // По правилам нужно взять все поля кроме hash, отсортировать по ключу, слить через \n
    const dataCheckString = Object.keys(body)
      .filter((key) => key !== 'hash')
      .map((key) => `${key}=${body[key]}`)
      .sort()
      .join('\n');

    const secretKey = crypto.createHash('sha256').update(botToken).digest();
    const hmac = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    if (hmac !== hash) {
      return NextResponse.json({ success: false, error: 'Data is NOT from Telegram' }, { status: 403, headers: corsHeaders });
    }

    // Если все ок - создаем или находим Админа в базе
    let user = await prisma.user.findFirst({
      where: { email: `${id}@telegram.local` }
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: `${id}@telegram.local`,
          username: username || `tg_${id}`,
          firstName: first_name || 'Admin',
          lastName: last_name || '',
          avatar: photo_url,
          passwordHash: 'TG_SSO', // Пароль не нужен
          role: 'SUPER_ADMIN',
          status: 'ACTIVE'
        }
      });
    } else if (user.role !== 'SUPER_ADMIN') {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { role: 'SUPER_ADMIN' }
      });
    }

    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip');
    const userAgent = request.headers.get('user-agent');

    const token = await AuthService.createSession(
      user.id,
      ipAddress || undefined,
      userAgent || undefined
    );

    return NextResponse.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          firstName: user.firstName,
          avatar: user.avatar,
          role: user.role
        }
      }
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('[TG_AUTH_ERROR]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500, headers: corsHeaders });
  }
}
