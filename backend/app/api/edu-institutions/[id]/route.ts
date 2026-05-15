import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AuthService } from '@/lib/auth';
import { PasswordService } from '@/lib/password';
import { getCorsHeaders } from '@/lib/cors';

export const dynamic = 'force-dynamic';

function genPwd(len = 12) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let s = '';
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request.headers.get('origin') || undefined),
  });
}

// PATCH /api/edu-institutions/[id]
// Body: { action: 'APPROVE' | 'REJECT' | 'MARK_PAID' | 'EXPIRE', months?: 12 }
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) {
    return NextResponse.json(
      { success: false, error: 'Требуется авторизация' },
      { status: 401, headers: cors }
    );
  }
  const session = await AuthService.validateSession(auth.substring(7));
  if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN')) {
    return NextResponse.json(
      { success: false, error: 'Только админ' },
      { status: 403, headers: cors }
    );
  }

  let body: any;
  try { body = await request.json(); } catch { body = {}; }

  const action = body.action;
  if (action === 'APPROVE') {
    // Получим email контакта и создадим/привяжем пользователя-админа
    const [inst] = (await prisma.$queryRawUnsafe(
      `SELECT contact_email, full_name, contact_name, admin_user_id FROM edu_institutions WHERE id = $1`,
      params.id
    )) as any[];

    let adminUserId: string | null = inst?.admin_user_id || null;
    let tempPassword: string | null = null;
    if (inst?.contact_email && !adminUserId) {
      const email = String(inst.contact_email).toLowerCase().trim();
      const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      if (existing) {
        adminUserId = existing.id;
      } else {
        tempPassword = genPwd();
        const hash = await PasswordService.hash(tempPassword);
        const created = await prisma.user.create({
          data: {
            email,
            passwordHash: hash,
            firstName: inst.contact_name || null,
            role: 'USER',
          },
          select: { id: true },
        });
        adminUserId = created.id;
      }
    }

    await prisma.$executeRawUnsafe(
      `UPDATE edu_institutions
         SET status = 'APPROVED', admin_user_id = $1, updated_at = now()
       WHERE id = $2`,
      adminUserId,
      params.id
    );

    return NextResponse.json(
      {
        success: true,
        adminUserId,
        tempPassword,
        message: tempPassword
          ? `Заявка одобрена. Создан аккаунт администратора. Сообщите контактному лицу логин и временный пароль:\nЛогин: ${inst.contact_email}\nПароль: ${tempPassword}`
          : 'Заявка одобрена. Контактному лицу нужно войти под существующим аккаунтом.',
      },
      { headers: cors }
    );
  } else if (action === 'REJECT') {
    await prisma.$executeRawUnsafe(
      `UPDATE edu_institutions SET status = 'REJECTED', updated_at = now() WHERE id = $1`,
      params.id
    );
  } else if (action === 'MARK_PAID') {
    const months = Math.max(1, Math.min(36, Number(body.months) || 12));
    const expires = new Date();
    expires.setMonth(expires.getMonth() + months);
    await prisma.$executeRawUnsafe(
      `UPDATE edu_institutions
         SET status = 'ACTIVE', paid_at = now(), expires_at = $1, updated_at = now()
       WHERE id = $2`,
      expires,
      params.id
    );
  } else if (action === 'EXPIRE') {
    await prisma.$executeRawUnsafe(
      `UPDATE edu_institutions SET status = 'EXPIRED', updated_at = now() WHERE id = $1`,
      params.id
    );
  } else {
    return NextResponse.json(
      { success: false, error: 'Неизвестное действие' },
      { status: 400, headers: cors }
    );
  }

  return NextResponse.json({ success: true }, { headers: cors });
}
