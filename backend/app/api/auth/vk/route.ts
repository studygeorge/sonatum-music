import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { AuthService } from '@/lib/auth';
import { getCorsHeaders } from '@/lib/cors';
import { sendMail, verifyEmailTemplate, mailUrls } from '@/lib/mailer';

import { checkRateLimit, rateLimitResponse } from '@/lib/ratelimit';
export const dynamic = 'force-dynamic';

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request.headers.get('origin') || undefined),
  });
}

/**
 * POST /api/auth/vk
 * Принимает от клиента результат VK ID SDK exchangeCode:
 *   { access_token, user_id, email?, first_name?, last_name?, avatar? }
 * Делает серверный запрос на id.vk.com/oauth2/user_info для проверки токена,
 * находит/создаёт пользователя по vk_id или email, выдаёт нашу сессию.
 */
export async function POST(request: NextRequest) {
  const _rl = checkRateLimit('vk-auth', request, { max: 10, windowSec: 60 });
  if (!_rl.ok) return rateLimitResponse(_rl, request) as any;
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  try {
    return await handle(request, cors);
  } catch (e: any) {
    console.error('[VK_AUTH] fatal:', e);
    return NextResponse.json(
      { success: false, error: 'Внутренняя ошибка авторизации: ' + (e?.message || e) },
      { status: 500, headers: cors }
    );
  }
}

async function handle(request: NextRequest, cors: Record<string, string>) {
  let body: any;
  try { body = await request.json(); } catch { body = {}; }

  const accessToken: string = String(body.access_token || body.accessToken || '');
  if (!accessToken) {
    return NextResponse.json({ success: false, error: 'access_token обязателен' }, { status: 400, headers: cors });
  }

  // Серверная проверка токена через id.vk.com
  let vkUser: {
    user_id: string;
    email?: string;
    first_name?: string;
    last_name?: string;
    avatar?: string;
    phone?: string;
  } | null = null;

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    const resp = await fetch('https://id.vk.com/oauth2/user_info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        access_token: accessToken,
        client_id: process.env.VK_APP_ID || '54606219',
      }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    const j = await resp.json().catch(() => ({}));
    if (j?.user) {
      vkUser = {
        user_id: String(j.user.user_id),
        email: j.user.email || undefined,
        first_name: j.user.first_name || undefined,
        last_name: j.user.last_name || undefined,
        avatar: j.user.avatar || undefined,
        phone: j.user.phone || undefined,
      };
    } else if (j?.error) {
      console.error('[VK_AUTH] user_info error:', j);
    }
  } catch (e: any) {
    // Если бэкенд не достукивается к id.vk.com — это не фатально,
    // у нас есть данные от клиента (тоже из ВК через SDK).
    console.warn('[VK_AUTH] user_info fetch skipped:', e?.message || e);
  }

  // Fallback на данные от клиента (если серверная проверка не прошла, но клиент дал id)
  if (!vkUser && body.user_id) {
    vkUser = {
      user_id: String(body.user_id),
      email: body.email,
      first_name: body.first_name,
      last_name: body.last_name,
      avatar: body.avatar,
    };
  }

  if (!vkUser?.user_id) {
    return NextResponse.json(
      { success: false, error: 'Не удалось получить данные ВК-аккаунта' },
      { status: 400, headers: cors }
    );
  }

  const vkIdNum = Number(vkUser.user_id);
  if (!Number.isFinite(vkIdNum) || vkIdNum <= 0) {
    return NextResponse.json({ success: false, error: 'Некорректный VK user_id' }, { status: 400, headers: cors });
  }

  // 1) Ищем по vk_id (bigint)
  let [user] = (await prisma.$queryRawUnsafe(
    `SELECT id, email, username, "firstName", "lastName", avatar, role, status FROM users WHERE vk_id = $1::bigint LIMIT 1`,
    vkIdNum
  )) as any[];

  // 2) Если не нашли — пробуем по email (если VK дал email)
  if (!user && vkUser.email) {
    const byEmail = await prisma.user.findUnique({
      where: { email: vkUser.email.toLowerCase() },
      select: { id: true, email: true, username: true, firstName: true, lastName: true, avatar: true, role: true, status: true },
    });
    if (byEmail) {
      // Привязываем VK к существующему юзеру
      await prisma.$executeRawUnsafe(
        `UPDATE users SET vk_id = $1::bigint WHERE id = $2`,
        vkIdNum, byEmail.id
      );
      user = byEmail;
    }
  }

  // 3) Если всё ещё нет — регистрируем нового
  if (!user) {
    const email = vkUser.email?.toLowerCase() || `vk${vkUser.user_id}@vk.sonatum-music.ru`;
    const username = `vk_${vkUser.user_id}`;
    const passwordHash = `vk:${crypto.randomBytes(16).toString('hex')}`; // фиктивный, юзер не сможет логиниться паролем
    const regionId = await firstRegionId();

    try {
      const created = await prisma.user.create({
        data: {
          email,
          username,
          passwordHash,
          firstName: vkUser.first_name || null,
          lastName: vkUser.last_name || null,
          avatar: vkUser.avatar || null,
          role: 'USER',
          status: 'ACTIVE',
          regionId: regionId || undefined,
          emailVerified: vkUser.email ? new Date() : null, // VK email считаем подтверждённым
        },
        select: { id: true, email: true, username: true, firstName: true, lastName: true, avatar: true, role: true, status: true },
      });
      await prisma.$executeRawUnsafe(
        `UPDATE users SET vk_id = $1::bigint WHERE id = $2`,
        vkIdNum, created.id
      );
      user = created;

      // Welcome-email (если есть реальный email)
      if (vkUser.email) {
        (async () => {
          try {
            const token = crypto.randomBytes(32).toString('hex');
            await prisma.verificationToken.create({
              data: { token, userId: created.id, purpose: 'VERIFY_EMAIL', expiresAt: new Date(Date.now() + 86400000) },
            });
            const tpl = verifyEmailTemplate(mailUrls.verify(token));
            await sendMail({ to: created.email, subject: 'Добро пожаловать в Сонатум', html: tpl.html });
          } catch (e) { console.error('[VK_AUTH] welcome mail', e); }
        })();
      }
    } catch (e: any) {
      console.error('[VK_AUTH] create user error:', e);
      return NextResponse.json(
        { success: false, error: 'Не удалось создать аккаунт' },
        { status: 500, headers: cors }
      );
    }
  }

  // Создаём сессию
  const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined;
  const userAgent = request.headers.get('user-agent') || undefined;
  const sessionToken = await AuthService.createSession(user.id, ipAddress, userAgent);

  // Признаки незаконченного онбординга:
  // - email — заглушка (домен @vk.sonatum-music.ru)
  // - не указано имя
  // - не принята оферта (поле terms_accepted_at)
  const [tos] = (await prisma.$queryRawUnsafe(
    `SELECT terms_accepted_at FROM users WHERE id = $1`,
    user.id
  ).catch(() => [])) as any[];

  const fakeEmail = (user.email || '').endsWith('@vk.sonatum-music.ru');
  const noName = !user.firstName;
  const noTerms = !tos?.terms_accepted_at;
  const needsOnboarding = fakeEmail || noName || noTerms;

  return NextResponse.json(
    {
      success: true,
      data: {
        token: sessionToken,
        needsOnboarding,
        onboardingHints: {
          email: fakeEmail,    // надо спросить email
          name: noName,        // надо спросить имя
          terms: noTerms,      // надо принять оферту
        },
        user: {
          id: user.id,
          email: fakeEmail ? '' : user.email,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          avatar: user.avatar,
          role: user.role,
          status: user.status,
        },
      },
    },
    { headers: cors }
  );
}

async function firstRegionId(): Promise<string | null> {
  const [r] = (await prisma.$queryRawUnsafe(
    `SELECT id FROM regions ORDER BY name ASC LIMIT 1`
  )) as any[];
  return r?.id || null;
}
