import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AuthService } from '@/lib/auth';
import { PasswordService } from '@/lib/password';
import { getCorsHeaders } from '@/lib/cors';
import { generateSecret, generateURI, verifySync } from 'otplib';
import { randomBytes } from 'crypto';

export const dynamic = 'force-dynamic';

// Сервис-имя для приложений-аутентификаторов
const ISSUER = 'Сонатум';

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request.headers.get('origin') || undefined),
  });
}

async function getSession(request: NextRequest) {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return AuthService.validateSession(auth.substring(7));
}

function makeBackupCodes(count = 8): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    // 8-символьные коды формата XXXX-XXXX
    const c = randomBytes(4).toString('hex').toUpperCase();
    codes.push(`${c.slice(0, 4)}-${c.slice(4, 8)}`);
  }
  return codes;
}

// POST /api/auth/2fa/setup — сгенерировать секрет и backup-коды (без активации)
export async function POST(request: NextRequest) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ success: false, error: 'Не авторизован' }, { status: 401, headers: cors });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true },
  });
  if (!user) return NextResponse.json({ success: false, error: 'Пользователь не найден' }, { status: 404, headers: cors });

  // Уже включён? — отказ
  const [extra] = (await prisma.$queryRawUnsafe(
    `SELECT totp_enabled FROM users WHERE id = $1`, session.userId
  )) as any[];
  if (extra?.totp_enabled) {
    return NextResponse.json({ success: false, error: '2FA уже включена. Сначала отключите, чтобы перенастроить.' }, { status: 409, headers: cors });
  }

  const secret = generateSecret(); // base32
  const otpauthUrl = generateURI({
    secret,
    label: user.email,
    issuer: ISSUER,
    strategy: 'totp',
  });
  const backupCodes = makeBackupCodes();

  // Сохраняем секрет, но НЕ помечаем как enabled — нужна подтверждение через verify-setup
  await prisma.$executeRawUnsafe(
    `UPDATE users SET totp_secret = $1, totp_backup_codes = $2::jsonb, "updatedAt" = now() WHERE id = $3`,
    secret,
    JSON.stringify(backupCodes.map((c) => ({ code: c, used: false }))),
    session.userId
  );

  return NextResponse.json({
    success: true,
    data: {
      secret,           // показывается под QR для ручного ввода
      otpauthUrl,       // фронт построит QR-код
      backupCodes,      // 8 одноразовых кодов восстановления — показать пользователю один раз
      issuer: ISSUER,
      account: user.email,
    },
  }, { headers: cors });
}

// GET /api/auth/2fa/setup — текущий статус 2FA
export async function GET(request: NextRequest) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const session = await getSession(request);
  if (!session) return NextResponse.json({ success: false, error: 'Не авторизован' }, { status: 401, headers: cors });

  const [extra] = (await prisma.$queryRawUnsafe(
    `SELECT totp_enabled, totp_backup_codes FROM users WHERE id = $1`, session.userId
  )) as any[];

  const backupCodes = Array.isArray(extra?.totp_backup_codes) ? extra.totp_backup_codes : [];
  const backupCodesRemaining = backupCodes.filter((c: any) => !c.used).length;

  return NextResponse.json({
    success: true,
    data: {
      enabled: !!extra?.totp_enabled,
      backupCodesRemaining,
    },
  }, { headers: cors });
}

// DELETE /api/auth/2fa/setup — отключить 2FA (требует пароль + код)
// Body: { password, code? }
export async function DELETE(request: NextRequest) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const session = await getSession(request);
  if (!session) return NextResponse.json({ success: false, error: 'Не авторизован' }, { status: 401, headers: cors });

  let body: any;
  try { body = await request.json(); } catch { body = {}; }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { passwordHash: true },
  });
  if (!user?.passwordHash) {
    return NextResponse.json({ success: false, error: 'Пользователь не найден' }, { status: 404, headers: cors });
  }

  const passwordOk = await PasswordService.verify(String(body.password || ''), user.passwordHash);
  if (!passwordOk) {
    return NextResponse.json({ success: false, error: 'Неверный пароль' }, { status: 403, headers: cors });
  }

  const [extra] = (await prisma.$queryRawUnsafe(
    `SELECT totp_secret, totp_enabled FROM users WHERE id = $1`, session.userId
  )) as any[];
  if (extra?.totp_enabled && extra?.totp_secret && body.code) {
    const codeOk = verifySync({ token: String(body.code), secret: extra.totp_secret, strategy: 'totp' }).valid;
    if (!codeOk) {
      return NextResponse.json({ success: false, error: 'Неверный код' }, { status: 403, headers: cors });
    }
  }

  await prisma.$executeRawUnsafe(
    `UPDATE users SET totp_secret = NULL, totp_enabled = false, totp_backup_codes = NULL, "updatedAt" = now() WHERE id = $1`,
    session.userId
  );

  return NextResponse.json({ success: true, message: 'Двухфакторная аутентификация отключена' }, { headers: cors });
}
