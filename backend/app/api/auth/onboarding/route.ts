import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { AuthService } from '@/lib/auth';
import { getCorsHeaders } from '@/lib/cors';
import { sendMail } from '@/lib/mailer';

import { checkEmailPolicy } from '@/lib/email-policy';
export const dynamic = 'force-dynamic';

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request.headers.get('origin') || undefined),
  });
}

/**
 * POST /api/auth/onboarding
 * Body:
 *   email?, firstName?, lastName?,
 *   regionId?, agreedTerms: true,
 *   role: 'USER' | 'ARTIST',
 *   agreedLicense?: boolean,                // обязательно для ARTIST
 *   artistData?: { name, authorType, isCollective }
 */
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
  const newEmail = String(body.email || '').trim().toLowerCase();
  const firstName = body.firstName ? String(body.firstName).trim().slice(0, 60) : null;
  const lastName  = body.lastName  ? String(body.lastName).trim().slice(0, 60)  : null;
  const regionId  = body.regionId ? String(body.regionId) : null;
  const agreedTerms = body.agreedTerms === true;
  const role = body.role === 'ARTIST' ? 'ARTIST' : 'USER';
  const agreedLicense = body.agreedLicense === true;
  const artistData = body.artistData || null;

  if (!agreedTerms) {
    return NextResponse.json({ success: false, error: 'Необходимо принять оферту' }, { status: 400, headers: cors });
  }
  if (role === 'ARTIST' && !agreedLicense) {
    return NextResponse.json({ success: false, error: 'Необходимо принять лицензионный договор' }, { status: 400, headers: cors });
  }

  const me = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, firstName: true, role: true, regionId: true, artistProfile: { select: { id: true } } },
  });
  if (!me) {
    return NextResponse.json({ success: false, error: 'Пользователь не найден' }, { status: 404, headers: cors });
  }

  const fakeEmail = (me.email || '').endsWith('@vk.sonatum-music.ru');

  // Если email сейчас фиктивный — требуем реальный
  let finalEmail = me.email;
  let emailChanged = false;
  if (fakeEmail) {
    if (!newEmail || !newEmail.includes('@')) {
      return NextResponse.json({ success: false, error: 'Введите корректный email' }, { status: 400, headers: cors });
    }
    const pol = checkEmailPolicy(newEmail);
    if (!pol.ok) {
      return NextResponse.json({ success: false, error: pol.error }, { status: 400, headers: cors });
    }
    const exists = await prisma.user.findUnique({ where: { email: newEmail }, select: { id: true } });
    if (exists && exists.id !== me.id) {
      return NextResponse.json({ success: false, error: 'Этот email уже используется' }, { status: 409, headers: cors });
    }
    finalEmail = newEmail;
    emailChanged = true;
  }

  if (!me.firstName && !firstName) {
    return NextResponse.json({ success: false, error: 'Введите ваше имя' }, { status: 400, headers: cors });
  }
  if (!me.regionId && !regionId) {
    return NextResponse.json({ success: false, error: 'Выберите регион' }, { status: 400, headers: cors });
  }
  if (role === 'ARTIST' && !artistData?.name) {
    return NextResponse.json({ success: false, error: 'Укажите название артиста / коллектива' }, { status: 400, headers: cors });
  }

  // Обновляем профиль. Email при VK-онбординге считаем подтверждённым —
  // юзер уже авторизован через ВК (доверенный провайдер), повторное
  // подтверждение лишний шаг.
  await prisma.user.update({
    where: { id: me.id },
    data: {
      email: finalEmail,
      firstName: firstName || me.firstName,
      lastName:  lastName  || undefined,
      regionId:  regionId  || me.regionId,
      role: role as any,
      emailVerified: emailChanged ? new Date() : undefined,
    },
  });

  await prisma.$executeRawUnsafe(
    `UPDATE users SET terms_accepted_at = now() WHERE id = $1`,
    me.id
  );

  // Если выбран ARTIST и профиля ещё нет — создаём
  if (role === 'ARTIST' && !me.artistProfile && artistData) {
    const AUTHOR_TYPE_MAP: Record<string, 'COMPOSER' | 'PERFORMER' | 'BOTH'> = {
      AUTHOR: 'COMPOSER', COMPOSER: 'COMPOSER', PERFORMER: 'PERFORMER', BOTH: 'BOTH',
    };
    const authorType = AUTHOR_TYPE_MAP[String(artistData.authorType || 'BOTH').toUpperCase()] || 'BOTH';
    const username = (await prisma.user.findUnique({ where: { id: me.id }, select: { username: true } }))?.username || me.id;
    const slug = `${String(artistData.name).toLowerCase().replace(/[^a-z0-9а-яё]+/gi, '-').replace(/^-|-$/g, '')}-${Date.now().toString().slice(-4)}`;
    try {
      await prisma.artist.create({
        data: {
          userId: me.id,
          name: String(artistData.name).slice(0, 120),
          slug,
          authorType: authorType as any,
        },
      });
      if (artistData.isCollective) {
        await prisma.collective.create({
          data: {
            leaderId: me.id,
            name: String(artistData.name).slice(0, 120),
            slug: `${slug}-coll`,
          },
        }).catch(() => null);
      }
    } catch (e) {
      console.error('[ONBOARDING] artist create error:', e);
    }
  }

  // Welcome-email (без обязательного подтверждения)
  if (emailChanged) {
    try {
      await sendMail({
        to: finalEmail,
        subject: 'Добро пожаловать в Сонатум',
        html: `
          <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#1d1d1f;">
            <div style="font-weight:700;font-size:20px;margin-bottom:24px;">Сонатум</div>
            <h1 style="font-size:22px;margin:0 0 16px;">Добро пожаловать!</h1>
            <p style="font-size:15px;line-height:1.6;">
              Спасибо за регистрацию через ВКонтакте. Ваш аккаунт активен — можно слушать музыку, оформлять подписки и подписываться на авторов.
            </p>
          </div>`,
      });
    } catch (e) { console.error('[ONBOARDING] welcome mail', e); }
  }

  return NextResponse.json({ success: true, role }, { headers: cors });
}
