import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AuthService } from '@/lib/auth';
import { getCorsHeaders } from '@/lib/cors';
import { verifySync } from 'otplib';

export const dynamic = 'force-dynamic';

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request.headers.get('origin') || undefined),
  });
}

// POST /api/auth/2fa/verify-setup
// Body: { code } — 6-значный TOTP из приложения. Подтверждает настройку и активирует 2FA.
export async function POST(request: NextRequest) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) {
    return NextResponse.json({ success: false, error: 'Не авторизован' }, { status: 401, headers: cors });
  }
  const session = await AuthService.validateSession(auth.substring(7));
  if (!session) {
    return NextResponse.json({ success: false, error: 'Сессия истекла' }, { status: 401, headers: cors });
  }

  let body: any;
  try { body = await request.json(); } catch { body = {}; }
  const code = String(body.code || '').replace(/\s+/g, '');
  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json({ success: false, error: 'Код должен быть 6 цифр' }, { status: 400, headers: cors });
  }

  const [extra] = (await prisma.$queryRawUnsafe(
    `SELECT totp_secret, totp_enabled FROM users WHERE id = $1`, session.userId
  )) as any[];
  if (!extra?.totp_secret) {
    return NextResponse.json({ success: false, error: 'Сначала вызовите /setup для получения секрета' }, { status: 400, headers: cors });
  }
  if (extra.totp_enabled) {
    return NextResponse.json({ success: false, error: '2FA уже активна' }, { status: 409, headers: cors });
  }

  const ok = verifySync({ token: code, secret: extra.totp_secret, strategy: 'totp' }).valid;
  if (!ok) {
    return NextResponse.json({ success: false, error: 'Неверный код. Проверьте, что часы на устройстве синхронизированы.' }, { status: 403, headers: cors });
  }

  await prisma.$executeRawUnsafe(
    `UPDATE users SET totp_enabled = true, "updatedAt" = now() WHERE id = $1`,
    session.userId
  );

  return NextResponse.json({
    success: true,
    message: 'Двухфакторная аутентификация активирована. При входе будем запрашивать код.',
  }, { headers: cors });
}
