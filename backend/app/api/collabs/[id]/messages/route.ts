import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AuthService } from '@/lib/auth';
import { getCorsHeaders } from '@/lib/cors';

export const dynamic = 'force-dynamic';

function cuid() {
  return 'msg_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
}

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request.headers.get('origin') || undefined),
  });
}

// POST /api/collabs/[id]/messages — отправить отклик автору заявки
// Body: { body }
export async function POST(
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
  if (!session) {
    return NextResponse.json(
      { success: false, error: 'Сессия истекла' },
      { status: 401, headers: cors }
    );
  }

  let body: any;
  try { body = await request.json(); } catch { body = {}; }
  if (!body.body?.trim()) {
    return NextResponse.json(
      { success: false, error: 'Введите сообщение' },
      { status: 400, headers: cors }
    );
  }

  const [r] = (await prisma.$queryRawUnsafe(
    `SELECT author_id, status FROM collab_requests WHERE id = $1`,
    params.id
  )) as any[];
  if (!r) {
    return NextResponse.json(
      { success: false, error: 'Заявка не найдена' },
      { status: 404, headers: cors }
    );
  }
  if (r.author_id === session.userId) {
    return NextResponse.json(
      { success: false, error: 'Нельзя писать на свою заявку' },
      { status: 400, headers: cors }
    );
  }
  if (r.status !== 'ACTIVE') {
    return NextResponse.json(
      { success: false, error: 'Заявка не активна' },
      { status: 400, headers: cors }
    );
  }

  const msgId = cuid();
  await prisma.$executeRawUnsafe(
    `INSERT INTO collab_messages (id, request_id, from_user_id, to_user_id, body, is_read)
     VALUES ($1, $2, $3, $4, $5, false)`,
    msgId,
    params.id,
    session.userId,
    r.author_id,
    body.body.trim()
  );

  return NextResponse.json({ success: true, id: msgId }, { headers: cors });
}

// GET /api/collabs/[id]/messages — получить все сообщения по заявке (для участников)
export async function GET(
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
  if (!session) {
    return NextResponse.json(
      { success: false, error: 'Сессия истекла' },
      { status: 401, headers: cors }
    );
  }

  const rows = (await prisma.$queryRawUnsafe(
    `SELECT m.*, u.email AS from_email, u.username AS from_username
       FROM collab_messages m
       JOIN users u ON u.id = m.from_user_id
      WHERE m.request_id = $1 AND (m.from_user_id = $2 OR m.to_user_id = $2)
      ORDER BY m.created_at ASC`,
    params.id,
    session.userId
  )) as any[];

  // Помечаем входящие как прочитанные
  await prisma.$executeRawUnsafe(
    `UPDATE collab_messages SET is_read = true WHERE request_id = $1 AND to_user_id = $2 AND is_read = false`,
    params.id,
    session.userId
  );

  return NextResponse.json(
    {
      success: true,
      data: rows.map((m) => ({
        id: m.id,
        fromUserId: m.from_user_id,
        toUserId: m.to_user_id,
        fromEmail: m.from_email,
        fromUsername: m.from_username,
        body: m.body,
        isRead: m.is_read,
        createdAt: m.created_at,
      })),
    },
    { headers: cors }
  );
}
