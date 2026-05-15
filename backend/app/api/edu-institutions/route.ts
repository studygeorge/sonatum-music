import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AuthService } from '@/lib/auth';
import { getCorsHeaders } from '@/lib/cors';

export const dynamic = 'force-dynamic';

function cuid() {
  return 'edu_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
}

const BASE_FEE = 25000;
const TEACHER_FEE_OVER_10 = 1500;
const STUDENT_FEE_OVER_100 = 100;
const SHEETS_PREMIUM = 10000;

function calculateFee(teacherCount: number, studentCount: number, withSheets: boolean): number {
  let total = BASE_FEE;
  if (teacherCount > 10) total += (teacherCount - 10) * TEACHER_FEE_OVER_10;
  if (studentCount > 100) total += Math.floor((studentCount - 100) / 100) * STUDENT_FEE_OVER_100 * 100;
  if (withSheets) total += SHEETS_PREMIUM;
  return total;
}

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request.headers.get('origin') || undefined),
  });
}

// GET /api/edu-institutions?admin=1&status=PENDING — все для админа
// POST /api/edu-institutions — отправить заявку (публичная)
export async function GET(request: NextRequest) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const { searchParams } = new URL(request.url);
  if (searchParams.get('admin') === '1') {
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
    const status = searchParams.get('status');
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT * FROM edu_institutions
       ${status ? 'WHERE status = $1' : ''}
       ORDER BY created_at DESC LIMIT 100`,
      ...(status ? [status] : [])
    )) as any[];
    return NextResponse.json(
      {
        success: true,
        data: rows.map((r) => ({
          id: r.id,
          fullName: r.full_name,
          shortName: r.short_name,
          inn: r.inn,
          legalAddress: r.legal_address,
          contactName: r.contact_name,
          contactRole: r.contact_role,
          contactEmail: r.contact_email,
          contactPhone: r.contact_phone,
          status: r.status,
          teacherCount: r.teacher_count,
          studentCount: r.student_count,
          withSheets: r.with_sheets,
          annualFee: r.annual_fee ? Number(r.annual_fee) : null,
          paidAt: r.paid_at,
          expiresAt: r.expires_at,
          createdAt: r.created_at,
        })),
      },
      { headers: cors }
    );
  }
  return NextResponse.json(
    { success: false, error: 'Параметр admin=1 обязателен' },
    { status: 400, headers: cors }
  );
}

export async function POST(request: NextRequest) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  let body: any;
  try { body = await request.json(); } catch { body = {}; }

  if (!body.fullName?.trim() || !body.contactName?.trim() || !body.contactEmail?.trim()) {
    return NextResponse.json(
      { success: false, error: 'Заполните название, контактное лицо и email' },
      { status: 400, headers: cors }
    );
  }

  const teacherCount = Math.max(0, Math.floor(Number(body.teacherCount) || 0));
  const studentCount = Math.max(0, Math.floor(Number(body.studentCount) || 0));
  const withSheets = !!body.withSheets;
  const annualFee = calculateFee(teacherCount, studentCount, withSheets);

  const id = cuid();
  await prisma.$executeRawUnsafe(
    `INSERT INTO edu_institutions
     (id, full_name, short_name, inn, legal_address, contact_name, contact_role,
      contact_email, contact_phone, status, teacher_count, student_count, with_sheets, annual_fee)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'PENDING', $10, $11, $12, $13)`,
    id,
    body.fullName.trim(),
    body.shortName?.trim() || null,
    body.inn?.replace(/\D/g, '') || null,
    body.legalAddress || null,
    body.contactName.trim(),
    body.contactRole || null,
    body.contactEmail.trim(),
    body.contactPhone || null,
    teacherCount,
    studentCount,
    withSheets,
    annualFee
  );

  return NextResponse.json(
    {
      success: true,
      id,
      annualFee,
      message: `Заявка принята. Предварительная стоимость: ${annualFee.toLocaleString('ru-RU')} ₽/год. Менеджер свяжется с вами в течение 1 рабочего дня для уточнения и подписания договора.`,
    },
    { headers: cors }
  );
}
