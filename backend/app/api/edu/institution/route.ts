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

async function getMyAdminInstitution(userId: string) {
  const [r] = (await prisma.$queryRawUnsafe(
    `SELECT * FROM edu_institutions WHERE admin_user_id = $1 AND status IN ('ACTIVE','APPROVED') LIMIT 1`,
    userId
  )) as any[];
  return r || null;
}

// GET /api/edu/institution — полные реквизиты (только админ)
export async function GET(request: NextRequest) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) {
    return NextResponse.json({ success: false, error: 'Требуется авторизация' }, { status: 401, headers: cors });
  }
  const session = await AuthService.validateSession(auth.substring(7));
  if (!session) {
    return NextResponse.json({ success: false, error: 'Сессия истекла' }, { status: 401, headers: cors });
  }
  const inst = await getMyAdminInstitution(session.userId);
  if (!inst) {
    return NextResponse.json({ success: false, error: 'Только администратор учреждения' }, { status: 403, headers: cors });
  }
  return NextResponse.json({
    success: true,
    data: {
      id: inst.id,
      fullName: inst.full_name,
      shortName: inst.short_name,
      inn: inst.inn,
      legalAddress: inst.legal_address,
      contactName: inst.contact_name,
      contactRole: inst.contact_role,
      contactEmail: inst.contact_email,
      contactPhone: inst.contact_phone,
      status: inst.status,
      teacherCount: inst.teacher_count,
      studentCount: inst.student_count,
      withSheets: inst.with_sheets,
      annualFee: inst.annual_fee ? Number(inst.annual_fee) : null,
      paidAt: inst.paid_at,
      expiresAt: inst.expires_at,
    },
  }, { headers: cors });
}

// PATCH /api/edu/institution — обновить реквизиты
export async function PATCH(request: NextRequest) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) {
    return NextResponse.json({ success: false, error: 'Требуется авторизация' }, { status: 401, headers: cors });
  }
  const session = await AuthService.validateSession(auth.substring(7));
  if (!session) {
    return NextResponse.json({ success: false, error: 'Сессия истекла' }, { status: 401, headers: cors });
  }
  const inst = await getMyAdminInstitution(session.userId);
  if (!inst) {
    return NextResponse.json({ success: false, error: 'Только администратор учреждения' }, { status: 403, headers: cors });
  }

  let body: any;
  try { body = await request.json(); } catch { body = {}; }

  const allowed: Record<string, string> = {
    fullName: 'full_name',
    shortName: 'short_name',
    inn: 'inn',
    legalAddress: 'legal_address',
    contactName: 'contact_name',
    contactRole: 'contact_role',
    contactEmail: 'contact_email',
    contactPhone: 'contact_phone',
  };

  const updates: Array<{ col: string; val: any }> = [];
  for (const [camel, snake] of Object.entries(allowed)) {
    if (body[camel] !== undefined) {
      const val = body[camel] === '' ? null : String(body[camel]).trim();
      updates.push({ col: snake, val });
    }
  }

  if (updates.length === 0) {
    return NextResponse.json({ success: false, error: 'Нет полей для обновления' }, { status: 400, headers: cors });
  }

  // ИНН — 10 или 12 цифр (если задан)
  const innUpdate = updates.find(u => u.col === 'inn');
  if (innUpdate && innUpdate.val && !/^\d{10}(\d{2})?$/.test(innUpdate.val)) {
    return NextResponse.json({ success: false, error: 'ИНН должен быть 10 или 12 цифр' }, { status: 400, headers: cors });
  }

  const setParts = updates.map((u, i) => `${u.col} = $${i + 1}`);
  const values = updates.map(u => u.val);
  await prisma.$executeRawUnsafe(
    `UPDATE edu_institutions SET ${setParts.join(', ')}, updated_at = now() WHERE id = $${updates.length + 1}`,
    ...values,
    inst.id
  );

  return NextResponse.json({ success: true, message: 'Реквизиты сохранены' }, { headers: cors });
}
