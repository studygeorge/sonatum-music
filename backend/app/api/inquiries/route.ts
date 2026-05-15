import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AuthService } from '@/lib/auth';
import { getCorsHeaders } from '@/lib/cors';

const ALLOWED_TYPES = new Set(['B2B', 'ARTIST', 'COPYRIGHT', 'OTHER']);

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request.headers.get('origin') || undefined),
  });
}

// POST — публичный приём заявок
export async function POST(request: NextRequest) {
  const corsHeaders = getCorsHeaders(request.headers.get('origin') || undefined);
  try {
    const body = await request.json().catch(() => ({}));
    const type = String(body?.type || 'OTHER').toUpperCase();
    if (!ALLOWED_TYPES.has(type)) {
      return NextResponse.json(
        { success: false, error: 'Неизвестный тип заявки' },
        { status: 400, headers: corsHeaders }
      );
    }

    const payload = body?.payload || {};
    if (!payload || typeof payload !== 'object' || Object.keys(payload).length === 0) {
      return NextResponse.json(
        { success: false, error: 'Пустая заявка' },
        { status: 400, headers: corsHeaders }
      );
    }

    const email =
      payload.email || payload.contact || payload.contactEmail || null;

    const id = 'inq_' + Math.random().toString(36).slice(2, 14) + Date.now().toString(36);

    await prisma.$executeRawUnsafe(
      `INSERT INTO inquiries (id, type, email, payload, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4::jsonb, now(), now())`,
      id,
      type,
      email,
      JSON.stringify(payload)
    );

    // SMTP в проекте заблокирован → пока только лог; админ видит в /admin/inquiries.
    console.log('[INQUIRY]', { id, type, email, target: 'info@sonatum-music.ru' });

    return NextResponse.json(
      { success: true, id },
      { headers: corsHeaders }
    );
  } catch (e) {
    console.error('[INQUIRY_POST]', e);
    return NextResponse.json(
      { success: false, error: 'Ошибка сервера' },
      { status: 500, headers: corsHeaders }
    );
  }
}

// GET — только для админов
export async function GET(request: NextRequest) {
  const corsHeaders = getCorsHeaders(request.headers.get('origin') || undefined);
  try {
    const auth = request.headers.get('Authorization');
    if (!auth?.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Требуется авторизация' },
        { status: 401, headers: corsHeaders }
      );
    }
    const session = await AuthService.validateSession(auth.substring(7));
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Сессия недействительна' },
        { status: 401, headers: corsHeaders }
      );
    }
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { role: true },
    });
    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json(
        { success: false, error: 'Нет доступа' },
        { status: 403, headers: corsHeaders }
      );
    }

    const url = new URL(request.url);
    const typeFilter = url.searchParams.get('type');
    const statusFilter = url.searchParams.get('status');

    const conds: string[] = [];
    const params: any[] = [];
    let i = 1;
    if (typeFilter) {
      conds.push(`type = $${i++}`);
      params.push(typeFilter);
    }
    if (statusFilter) {
      conds.push(`status = $${i++}`);
      params.push(statusFilter);
    }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const sql = `SELECT id, type, email, payload, status, "createdAt"
                 FROM inquiries ${where}
                 ORDER BY "createdAt" DESC LIMIT 200`;

    const rows = await prisma.$queryRawUnsafe<any[]>(sql, ...params);
    return NextResponse.json({ success: true, data: rows }, { headers: corsHeaders });
  } catch (e) {
    console.error('[INQUIRY_GET]', e);
    return NextResponse.json(
      { success: false, error: 'Ошибка сервера' },
      { status: 500, headers: corsHeaders }
    );
  }
}

// PATCH — admin меняет статус (NEW → IN_PROGRESS → DONE)
export async function PATCH(request: NextRequest) {
  const corsHeaders = getCorsHeaders(request.headers.get('origin') || undefined);
  try {
    const auth = request.headers.get('Authorization');
    if (!auth?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Требуется авторизация' }, { status: 401, headers: corsHeaders });
    }
    const session = await AuthService.validateSession(auth.substring(7));
    if (!session) return NextResponse.json({ success: false, error: 'Сессия' }, { status: 401, headers: corsHeaders });
    const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { role: true } });
    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ success: false, error: 'Нет доступа' }, { status: 403, headers: corsHeaders });
    }

    const body = await request.json().catch(() => ({}));
    const id = String(body?.id || '');
    const status = String(body?.status || '');
    if (!id || !['NEW', 'IN_PROGRESS', 'DONE', 'SPAM'].includes(status)) {
      return NextResponse.json({ success: false, error: 'Неверные параметры' }, { status: 400, headers: corsHeaders });
    }

    await prisma.$executeRawUnsafe(
      `UPDATE inquiries SET status=$1, "updatedAt"=now() WHERE id=$2`,
      status,
      id
    );
    return NextResponse.json({ success: true }, { headers: corsHeaders });
  } catch (e) {
    console.error('[INQUIRY_PATCH]', e);
    return NextResponse.json({ success: false, error: 'Ошибка сервера' }, { status: 500, headers: corsHeaders });
  }
}
