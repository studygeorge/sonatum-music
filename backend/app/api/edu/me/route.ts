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

// GET /api/edu/me — текущий пользователь в учебном заведении
//  - если он admin_user_id какого-то edu_institutions → возвращает институт
//  - иначе ищет в edu_members
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

  // Сначала как админ
  const [asAdmin] = (await prisma.$queryRawUnsafe(
    `SELECT * FROM edu_institutions WHERE admin_user_id = $1 AND status IN ('ACTIVE','APPROVED') LIMIT 1`,
    session.userId
  )) as any[];

  if (asAdmin) {
    const memberCount = (await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE role = 'TEACHER')::int AS teachers,
              COUNT(*) FILTER (WHERE role = 'STUDENT')::int AS students
         FROM edu_members WHERE institution_id = $1`,
      asAdmin.id
    )) as any[];

    return NextResponse.json(
      {
        success: true,
        myRole: 'ADMIN',
        institution: {
          id: asAdmin.id,
          fullName: asAdmin.full_name,
          shortName: asAdmin.short_name,
          inn: asAdmin.inn,
          status: asAdmin.status,
          teacherCount: asAdmin.teacher_count,
          studentCount: asAdmin.student_count,
          withSheets: asAdmin.with_sheets,
          annualFee: asAdmin.annual_fee ? Number(asAdmin.annual_fee) : null,
          paidAt: asAdmin.paid_at,
          expiresAt: asAdmin.expires_at,
        },
        stats: {
          totalMembers: memberCount[0]?.total || 0,
          teachers: memberCount[0]?.teachers || 0,
          students: memberCount[0]?.students || 0,
        },
      },
      { headers: cors }
    );
  }

  // Как член (по user_id или по email)
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { email: true },
  });
  const [asMember] = (await prisma.$queryRawUnsafe(
    `SELECT em.*, ei.full_name, ei.short_name, ei.status AS inst_status, ei.expires_at
       FROM edu_members em
       JOIN edu_institutions ei ON ei.id = em.institution_id
      WHERE em.user_id = $1 OR em.email = $2
      LIMIT 1`,
    session.userId,
    user?.email || ''
  )) as any[];

  if (asMember) {
    // Если найден по email, но user_id NULL — линкуем
    if (!asMember.user_id) {
      await prisma.$executeRawUnsafe(
        `UPDATE edu_members SET user_id = $1, joined_at = COALESCE(joined_at, now()) WHERE id = $2`,
        session.userId,
        asMember.id
      );
    }
    return NextResponse.json(
      {
        success: true,
        myRole: asMember.role,
        institution: {
          id: asMember.institution_id,
          fullName: asMember.full_name,
          shortName: asMember.short_name,
          status: asMember.inst_status,
          expiresAt: asMember.expires_at,
        },
      },
      { headers: cors }
    );
  }

  return NextResponse.json(
    { success: true, myRole: null, institution: null },
    { headers: cors }
  );
}
