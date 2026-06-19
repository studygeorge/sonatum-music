import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { PasswordService } from '@/lib/password';
import { AuthService } from '@/lib/auth';
import { getCorsHeaders } from '@/lib/cors';
import { sendMail, verifyEmailTemplate, mailUrls } from '@/lib/mailer';

import { checkRateLimit, rateLimitResponse } from '@/lib/ratelimit';
import { checkEmailPolicy } from '@/lib/email-policy';
export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request.headers.get('origin') || undefined),
  });
}

export async function POST(request: NextRequest) {
  const _rl = checkRateLimit('register', request, { max: 5, windowSec: 60 });
  if (!_rl.ok) return rateLimitResponse(_rl, request) as any;
  const origin = request.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin || undefined);

  try {
    const body = await request.json();
    const { email, password, username, firstName, lastName, role, artistData, regionId, agreedTerms } = body;

    console.log('[REGISTER] Попытка регистрации:', email);

    // Валидация
    if (!email || !password) {
      console.log('[REGISTER] Ошибка: отсутствует email или пароль');
      return NextResponse.json(
        { success: false, error: 'Email и пароль обязательны' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Политика email-доменов (Gmail закрыт — плохая доставляемость)
    const _emailPolicy = checkEmailPolicy(String(email));
    if (!_emailPolicy.ok) {
      return NextResponse.json(
        { success: false, error: _emailPolicy.error },
        { status: 400, headers: corsHeaders }
      );
    }

    // ОБЯЗАТЕЛЬНОЕ согласие с офертой и политикой (152-ФЗ, ТЗ)
    if (!agreedTerms) {
      return NextResponse.json(
        { success: false, error: 'Необходимо принять условия оферты и политики конфиденциальности' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Регион — обязательно для USER/ARTIST по ТЗ
    if (!regionId) {
      return NextResponse.json(
        { success: false, error: 'Выберите регион РФ' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Проверим существование региона
    const regionExists = await prisma.region.findUnique({ where: { id: regionId }, select: { id: true } });
    if (!regionExists) {
      return NextResponse.json(
        { success: false, error: 'Указанный регион не найден в справочнике' },
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
      status: 'ACTIVE',
      regionId,  // регион РФ — теперь обязательное поле
    };
    
    // Если это артист/автор
    if (userRole === 'ARTIST' && artistData) {
      // Маппинг с фронтовых значений на enum БД
      const AUTHOR_TYPE_MAP: Record<string, 'COMPOSER' | 'PERFORMER' | 'BOTH'> = {
        AUTHOR: 'COMPOSER',
        COMPOSER: 'COMPOSER',
        PERFORMER: 'PERFORMER',
        BOTH: 'BOTH',
      };
      const mappedAuthorType = AUTHOR_TYPE_MAP[String(artistData.authorType || 'BOTH').toUpperCase()] || 'BOTH';

      createData.artistProfile = {
        create: {
          name: artistData.name || firstName + ' ' + lastName,
          slug: artistData.slug || (username || email.split('@')[0]) + '-' + Date.now().toString().slice(-4),
          authorType: mappedAuthorType,
        }
      };
      
      // Если это коллектив — создаём связанный Collective с типом роли
      if (artistData.isCollective) {
        createData.collective = {
          create: {
            name: artistData.name,
            slug: artistData.slug || (username || email.split('@')[0]) + '-coll-' + Date.now().toString().slice(-4),
            // role_type сохраним через raw SQL после создания, т.к. этого поля нет в схеме Prisma
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

    // Отправляем письмо подтверждения email с 6-значным кодом + ссылкой
    (async () => {
      try {
        const verifyToken = crypto.randomBytes(32).toString('hex');
        const code = String(crypto.randomInt(100000, 999999));
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await prisma.$executeRawUnsafe(
          `INSERT INTO verification_tokens (id, token, "userId", purpose, "expiresAt", code)
           VALUES ($1, $2, $3, 'VERIFY_EMAIL', $4, $5)`,
          'vt_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10),
          verifyToken, user.id, expiresAt, code
        );
        const verifyUrl = mailUrls.verify(verifyToken);
        await sendMail({
          to: user.email,
          subject: 'Подтверждение регистрации в Сонатум',
          html: `
            <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#1d1d1f;">
              <div style="font-weight:700;font-size:20px;margin-bottom:24px;">Сонатум</div>
              <h1 style="font-size:24px;margin:0 0 16px;">Добро пожаловать!</h1>
              <p style="font-size:15px;line-height:1.6;">Спасибо за регистрацию. Чтобы подтвердить email, введите код:</p>
              <div style="background:#f4f4f7;border-radius:16px;padding:20px;margin:20px 0;text-align:center;">
                <div style="font-size:36px;font-weight:800;letter-spacing:6px;color:#1d4cb8;font-family:monospace;">
                  ${code}
                </div>
                <div style="font-size:12px;color:#86868b;margin-top:8px;">Код действителен 24 часа</div>
              </div>
              <p style="font-size:14px;line-height:1.6;">Или просто нажмите на ссылку:</p>
              <p style="margin:16px 0;">
                <a href="${verifyUrl}" style="display:inline-block;background:#1d1d1f;color:#fff;padding:12px 28px;border-radius:999px;text-decoration:none;font-weight:600;font-size:14px;">
                  Подтвердить email
                </a>
              </p>
              <hr style="border:none;border-top:1px solid #e5e5e7;margin:32px 0 16px;" />
              <p style="font-size:12px;color:#86868b;line-height:1.5;">
                Если письмо пришло по ошибке — проигнорируйте его.<br>
                © ${new Date().getFullYear()} ООО «СОНАТУМ»
              </p>
            </div>
          `,
        });
        console.log('[REGISTER] Welcome/verify письмо отправлено →', user.email, 'код:', code);
      } catch (e) {
        console.error('[REGISTER] Ошибка отправки welcome письма:', e);
      }
    })();

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

  } catch (error: any) {
    console.error('[REGISTER] Ошибка регистрации:', error);

    // Понятные сообщения вместо generic 500
    const msg = String(error?.message || '');
    const code = error?.code;

    // Уникальный индекс — кто-то уже занял email / username / slug
    if (code === 'P2002') {
      const target: string[] = error?.meta?.target || [];
      let what = 'email или имя пользователя';
      if (target.includes('email')) what = 'email';
      else if (target.includes('username')) what = 'имя пользователя';
      else if (target.includes('slug')) what = 'сценическое имя (slug занят, попробуйте другое)';
      return NextResponse.json(
        { success: false, error: `Этот ${what} уже занят. Попробуйте другой.` },
        { status: 409, headers: corsHeaders }
      );
    }

    // Невалидный enum в данных
    if (error?.name === 'PrismaClientValidationError') {
      // Часто причина — неправильное значение enum (authorType и т.п.)
      const m = msg.match(/Invalid value.*?for type ['"]?(\w+)['"]?/i) || msg.match(/Argument `(\w+)`: Invalid/);
      const field = m?.[1] ? ` в поле «${m[1]}»` : '';
      return NextResponse.json(
        { success: false, error: `Некорректные данные${field}. Проверьте правильность заполнения.` },
        { status: 400, headers: corsHeaders }
      );
    }

    // FK / другие известные prisma-коды
    if (code === 'P2003') {
      return NextResponse.json(
        { success: false, error: 'Связь данных нарушена (FK). Попробуйте позже.' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Дефолт — отдаём сообщение, но без чувствительных деталей в проде
    const safeMsg = process.env.NODE_ENV === 'production'
      ? 'Ошибка при регистрации. Проверьте поля и попробуйте снова.'
      : `Ошибка: ${msg.slice(0, 300)}`;
    return NextResponse.json(
      { success: false, error: safeMsg },
      { status: 500, headers: corsHeaders }
    );
  }
}
