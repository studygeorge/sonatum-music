import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AuthService } from '@/lib/auth';
import { getCorsHeaders } from '@/lib/cors';

export const dynamic = 'force-dynamic';

function cuid() {
  return 'em_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
}

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request.headers.get('origin') || undefined),
  });
}

// Проверка прав админа учреждения
async function getMyInstitution(userId: string, allowedRoles: string[] = ['ADMIN']) {
  const [r] = (await prisma.$queryRawUnsafe(
    `SELECT id FROM edu_institutions WHERE admin_user_id = $1 AND status IN ('ACTIVE','APPROVED') LIMIT 1`,
    userId
  )) as any[];
  if (r) return { institutionId: r.id, myRole: 'ADMIN' };
  if (allowedRoles.includes('TEACHER') || allowedRoles.includes('STUDENT')) {
    const [m] = (await prisma.$queryRawUnsafe(
      `SELECT institution_id, role FROM edu_members WHERE user_id = $1 LIMIT 1`,
      userId
    )) as any[];
    if (m && allowedRoles.includes(m.role)) {
      return { institutionId: m.institution_id, myRole: m.role };
    }
  }
  return null;
}

// GET /api/edu/members — список участников моего учреждения
export async function GET(request: NextRequest) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) {
    return NextResponse.json(
      { success: false, error: 'Требуется авторизация' },
      { status: 401, headers: cors }
    );
  }
  const session = await AuthService.validateSession(auth.substring(7));
  if (!session) {
    return NextResponse.json(
      { success: false, error: 'Сессия истекла' },
      { status: 401, headers: cors }
    );
  }
  const ctx = await getMyInstitution(session.userId, ['ADMIN', 'TEACHER', 'STUDENT']);
  if (!ctx) {
    return NextResponse.json(
      { success: false, error: 'Вы не привязаны к учебному заведению' },
      { status: 403, headers: cors }
    );
  }
  const rows = (await prisma.$queryRawUnsafe(
    `SELECT em.id, em.email, em.full_name, em.role, em.user_id, em.joined_at, em.created_at,
            u.username, u.avatar
       FROM edu_members em
       LEFT JOIN users u ON u.id = em.user_id
      WHERE em.institution_id = $1
      ORDER BY em.role, em.created_at DESC`,
    ctx.institutionId
  )) as any[];
  return NextResponse.json(
    {
      success: true,
      myRole: ctx.myRole,
      data: rows.map((r) => ({
        id: r.id,
        email: r.email,
        fullName: r.full_name,
        role: r.role,
        userId: r.user_id,
        username: r.username,
        avatar: r.avatar,
        joinedAt: r.joined_at,
        createdAt: r.created_at,
      })),
    },
    { headers: cors }
  );
}

// POST /api/edu/members — пригласить (только админ)
// Body: { email, fullName?, role: 'TEACHER'|'STUDENT' }
export async function POST(request: NextRequest) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) {
    return NextResponse.json(
      { success: false, error: 'Требуется авторизация' },
      { status: 401, headers: cors }
    );
  }
  const session = await AuthService.validateSession(auth.substring(7));
  if (!session) {
    return NextResponse.json(
      { success: false, error: 'Сессия истекла' },
      { status: 401, headers: cors }
    );
  }
  const ctx = await getMyInstitution(session.userId, ['ADMIN']);
  if (!ctx) {
    return NextResponse.json(
      { success: false, error: 'Только администратор учреждения' },
      { status: 403, headers: cors }
    );
  }

  let body: any;
  try { body = await request.json(); } catch { body = {}; }
  const email = String(body.email || '').trim().toLowerCase();
  const role = body.role === 'TEACHER' ? 'TEACHER' : 'STUDENT';
  if (!email || !email.includes('@')) {
    return NextResponse.json(
      { success: false, error: 'Введите корректный email' },
      { status: 400, headers: cors }
    );
  }

  // Если такой пользователь уже есть на платформе — линкуем сразу
  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  const id = cuid();
  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO edu_members (id, institution_id, email, full_name, role, user_id, joined_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      id,
      ctx.institutionId,
      email,
      body.fullName || null,
      role,
      existingUser?.id || null,
      existingUser ? new Date() : null
    );
  } catch (e: any) {
    if (e?.message?.includes('duplicate') || e?.code === 'P2002') {
      return NextResponse.json(
        { success: false, error: 'Этот email уже добавлен' },
        { status: 409, headers: cors }
      );
    }
    throw e;
  }

  return NextResponse.json(
    {
      success: true,
      id,
      linked: !!existingUser,
      message: existingUser
        ? 'Пользователь добавлен в учреждение'
        : 'Приглашение отправлено. После регистрации пользователя по этому email он автоматически получит доступ.',
    },
    { headers: cors }
  );
}

// DELETE /api/edu/members?id=X
export async function DELETE(request: NextRequest) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) {
    return NextResponse.json(
      { success: false, error: 'Требуется авторизация' },
      { status: 401, headers: cors }
    );
  }
  const session = await AuthService.validateSession(auth.substring(7));
  if (!session) {
    return NextResponse.json(
      { success: false, error: 'Сессия истекла' },
      { status: 401, headers: cors }
    );
  }
  const ctx = await getMyInstitution(session.userId, ['ADMIN']);
  if (!ctx) {
    return NextResponse.json(
      { success: false, error: 'Только администратор учреждения' },
      { status: 403, headers: cors }
    );
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json(
      { success: false, error: 'Не указан id' },
      { status: 400, headers: cors }
    );
  }

  await prisma.$executeRawUnsafe(
    `DELETE FROM edu_members WHERE id = $1 AND institution_id = $2`,
    id,
    ctx.institutionId
  );

  return NextResponse.json({ success: true }, { headers: cors });
}
