import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AuthService } from '@/lib/auth';
import { getCorsHeaders } from '@/lib/cors';

export const dynamic = 'force-dynamic';

function cuid() {
  return 'ub_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
}

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request.headers.get('origin') || undefined),
  });
}

// GET /api/users/me/blocks — список заблокированных
export async function GET(request: NextRequest) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return NextResponse.json({ success: false, error: 'Не авторизован' }, { status: 401, headers: cors });
  const session = await AuthService.validateSession(auth.substring(7));
  if (!session) return NextResponse.json({ success: false, error: 'Сессия истекла' }, { status: 401, headers: cors });

  const rows = (await prisma.$queryRawUnsafe(
    `SELECT ub.id, ub.blocked_id, ub.created_at,
            u.email, u.username, u."firstName", u."lastName", u.avatar
       FROM user_blocks ub
       JOIN users u ON u.id = ub.blocked_id
      WHERE ub.blocker_id = $1
      ORDER BY ub.created_at DESC`,
    session.userId
  )) as any[];

  return NextResponse.json({
    success: true,
    data: rows.map((r) => ({
      id: r.id,
      userId: r.blocked_id,
      email: r.email,
      username: r.username,
      name: [r.firstName, r.lastName].filter(Boolean).join(' ') || r.username,
      avatar: r.avatar,
      blockedAt: r.created_at,
    })),
  }, { headers: cors });
}

// POST /api/users/me/blocks — заблокировать (body: { userId })
export async function POST(request: NextRequest) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return NextResponse.json({ success: false, error: 'Не авторизован' }, { status: 401, headers: cors });
  const session = await AuthService.validateSession(auth.substring(7));
  if (!session) return NextResponse.json({ success: false, error: 'Сессия истекла' }, { status: 401, headers: cors });

  const body = await request.json().catch(() => ({}));
  const targetId = String(body?.userId || '');
  if (!targetId) return NextResponse.json({ success: false, error: 'Не указан userId' }, { status: 400, headers: cors });
  if (targetId === session.userId) return NextResponse.json({ success: false, error: 'Нельзя заблокировать себя' }, { status: 400, headers: cors });

  const id = cuid();
  await prisma.$executeRawUnsafe(
    `INSERT INTO user_blocks (id, blocker_id, blocked_id) VALUES ($1, $2, $3) ON CONFLICT (blocker_id, blocked_id) DO NOTHING`,
    id, session.userId, targetId
  );

  return NextResponse.json({ success: true, message: 'Пользователь добавлен в чёрный список. Вы больше не увидите его сообщений и заявок.' }, { headers: cors });
}

// DELETE /api/users/me/blocks?userId=X — разблокировать
export async function DELETE(request: NextRequest) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return NextResponse.json({ success: false, error: 'Не авторизован' }, { status: 401, headers: cors });
  const session = await AuthService.validateSession(auth.substring(7));
  if (!session) return NextResponse.json({ success: false, error: 'Сессия истекла' }, { status: 401, headers: cors });

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  if (!userId) return NextResponse.json({ success: false, error: 'Не указан userId' }, { status: 400, headers: cors });

  await prisma.$executeRawUnsafe(
    `DELETE FROM user_blocks WHERE blocker_id = $1 AND blocked_id = $2`,
    session.userId, userId
  );
  return NextResponse.json({ success: true }, { headers: cors });
}
