import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AuthService } from '@/lib/auth';
import { getCorsHeaders } from '@/lib/cors';

export const dynamic = 'force-dynamic';

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request.headers.get('origin') || undefined),
  });
}

type Member = {
  id: string;
  name: string;
  nickname?: string | null;
  role?: string | null;       // напр. "вокал", "гитара", "автор песен"
  status?: 'LEADER' | 'PARTICIPANT' | 'SOLOIST' | null;
  email?: string | null;
  userId?: string | null;
  addedAt?: string;
};

async function getCtx(request: NextRequest) {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const session = await AuthService.validateSession(auth.substring(7));
  if (!session) return null;
  const col = await prisma.collective.findUnique({ where: { leaderId: session.userId } });
  if (!col) return null;
  return { userId: session.userId, collective: col };
}

function getMembers(col: any): Member[] {
  return Array.isArray(col.members) ? col.members : [];
}

async function saveMembers(collectiveId: string, members: Member[]) {
  await prisma.collective.update({
    where: { id: collectiveId },
    data: { members: members as any },
  });
}

function mid() {
  return 'mem_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// GET /api/author/collective/members
export async function GET(request: NextRequest) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const ctx = await getCtx(request);
  if (!ctx) return NextResponse.json({ success: false, error: 'Доступ запрещён' }, { status: 403, headers: cors });
  return NextResponse.json({ success: true, data: getMembers(ctx.collective) }, { headers: cors });
}

// POST /api/author/collective/members
// Body: { name, nickname?, role?, status?, email? }
// Если есть email и пользователь с таким email зарегистрирован — линкуем по userId.
export async function POST(request: NextRequest) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const ctx = await getCtx(request);
  if (!ctx) return NextResponse.json({ success: false, error: 'Доступ запрещён' }, { status: 403, headers: cors });

  let body: any;
  try { body = await request.json(); } catch { body = {}; }
  const name = String(body.name || '').trim();
  if (!name) return NextResponse.json({ success: false, error: 'Укажите имя участника' }, { status: 400, headers: cors });

  const email = body.email ? String(body.email).trim().toLowerCase() : null;
  let linkedUserId: string | null = null;
  if (email) {
    const u = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (u) linkedUserId = u.id;
  }

  const member: Member = {
    id: mid(),
    name,
    nickname: body.nickname ? String(body.nickname).trim() : null,
    role: body.role ? String(body.role).trim() : null,
    status: ['LEADER', 'PARTICIPANT', 'SOLOIST'].includes(String(body.status))
      ? body.status
      : 'PARTICIPANT',
    email,
    userId: linkedUserId,
    addedAt: new Date().toISOString(),
  };

  const members = getMembers(ctx.collective);
  // Дубликат по email или (nickname + name)?
  if (email && members.some((m) => m.email?.toLowerCase() === email)) {
    return NextResponse.json({ success: false, error: 'Участник с этим email уже добавлен' }, { status: 409, headers: cors });
  }
  members.push(member);
  await saveMembers(ctx.collective.id, members);

  return NextResponse.json({
    success: true,
    data: member,
    linked: !!linkedUserId,
    message: linkedUserId
      ? 'Участник добавлен и связан с зарегистрированным пользователем'
      : email
        ? 'Участник добавлен. При регистрации по этому email он автоматически свяжется с коллективом.'
        : 'Участник добавлен',
  }, { headers: cors });
}

// PATCH /api/author/collective/members
// Body: { id, name?, nickname?, role?, status? }
export async function PATCH(request: NextRequest) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const ctx = await getCtx(request);
  if (!ctx) return NextResponse.json({ success: false, error: 'Доступ запрещён' }, { status: 403, headers: cors });

  let body: any;
  try { body = await request.json(); } catch { body = {}; }
  const id = String(body.id || '');
  if (!id) return NextResponse.json({ success: false, error: 'Не указан id' }, { status: 400, headers: cors });

  const members = getMembers(ctx.collective);
  const idx = members.findIndex((m) => m.id === id);
  if (idx < 0) return NextResponse.json({ success: false, error: 'Участник не найден' }, { status: 404, headers: cors });

  if (body.name !== undefined) members[idx].name = String(body.name).trim();
  if (body.nickname !== undefined) members[idx].nickname = body.nickname ? String(body.nickname).trim() : null;
  if (body.role !== undefined) members[idx].role = body.role ? String(body.role).trim() : null;
  if (body.status !== undefined && ['LEADER', 'PARTICIPANT', 'SOLOIST'].includes(String(body.status))) {
    members[idx].status = body.status;
  }

  await saveMembers(ctx.collective.id, members);
  return NextResponse.json({ success: true, data: members[idx] }, { headers: cors });
}

// DELETE /api/author/collective/members?id=X
export async function DELETE(request: NextRequest) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const ctx = await getCtx(request);
  if (!ctx) return NextResponse.json({ success: false, error: 'Доступ запрещён' }, { status: 403, headers: cors });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ success: false, error: 'Не указан id' }, { status: 400, headers: cors });

  const members = getMembers(ctx.collective).filter((m) => m.id !== id);
  await saveMembers(ctx.collective.id, members);
  return NextResponse.json({ success: true }, { headers: cors });
}
