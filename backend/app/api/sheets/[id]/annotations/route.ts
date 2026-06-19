import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, AuthUser } from '@/lib/auth';
import { getCorsHeaders } from '@/lib/cors';

export const dynamic = 'force-dynamic';

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request.headers.get('origin') || undefined),
  });
}

// Помощник: определить EDU-контекст пользователя (если он привязан к учреждению)
async function getEduContext(userId: string): Promise<{ institutionId: string; role: 'ADMIN' | 'TEACHER' | 'STUDENT' } | null> {
  // Админ учреждения?
  const [asAdmin] = (await prisma.$queryRawUnsafe(
    `SELECT id FROM edu_institutions WHERE admin_user_id = $1 AND status IN ('ACTIVE','APPROVED') LIMIT 1`,
    userId
  )) as any[];
  if (asAdmin) return { institutionId: asAdmin.id, role: 'ADMIN' };

  // Член учреждения?
  const [asMember] = (await prisma.$queryRawUnsafe(
    `SELECT institution_id, role FROM edu_members WHERE user_id = $1 LIMIT 1`,
    userId
  )) as any[];
  if (asMember && (asMember.role === 'TEACHER' || asMember.role === 'STUDENT')) {
    return { institutionId: asMember.institution_id, role: asMember.role };
  }
  return null;
}

async function getHandler(request: NextRequest, user: AuthUser, context: { params: { id: string } }) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const userId = user.id.toString();
  const sheetId = context.params.id;

  const edu = await getEduContext(userId);

  // SQL: фильтр зависит от того, является ли пользователь EDU-членом
  const rows = (await prisma.$queryRawUnsafe(
    `SELECT a."id", a."pageNumber", a."positionX", a."positionY", a."content", a."color",
            a."isShared", a."sharedGroupId", a."userId", a."createdAt", a."updatedAt",
            a.edu_institution_id,
            u."firstName", u."lastName", u.username, u.avatar
       FROM annotations a
       LEFT JOIN users u ON u.id = a."userId"
      WHERE a."sheetMusicId" = $1
        AND (
          a."userId" = $2
          OR (a."isShared" = true AND a.edu_institution_id IS NULL)
          ${edu ? `OR (a."isShared" = true AND a.edu_institution_id = '${edu.institutionId.replace(/'/g, "''")}')` : ''}
        )
      ORDER BY a."createdAt" ASC`,
    sheetId, userId
  )) as any[];

  return NextResponse.json({
    success: true,
    data: rows.map((r) => ({
      id: r.id,
      pageNumber: r.pageNumber,
      positionX: Number(r.positionX),
      positionY: Number(r.positionY),
      content: r.content,
      color: r.color,
      isShared: r.isShared,
      sharedGroupId: r.sharedGroupId,
      eduInstitutionId: r.edu_institution_id,
      userId: r.userId,
      isOwn: r.userId === userId,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      user: {
        id: r.userId,
        firstName: r.firstName,
        lastName: r.lastName,
        username: r.username,
        avatar: r.avatar,
      },
    })),
    eduContext: edu,
  }, { headers: cors });
}

async function postHandler(request: NextRequest, user: AuthUser, context: { params: { id: string } }) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const userId = user.id.toString();
  const sheetId = context.params.id;

  let body: any;
  try { body = await request.json(); } catch { body = {}; }
  const { pageNumber, positionX, positionY, content, color, isShared } = body;

  if (!content || !String(content).trim()) {
    return NextResponse.json({ success: false, error: 'Текст аннотации обязателен' }, { status: 400, headers: cors });
  }

  // Если автор хочет «расшарить» — определим его EDU-контекст:
  //   - Преподаватель/Админ EDU → аннотация привязывается к их учреждению, видна только членам учреждения
  //   - Студент EDU → расшаривать нельзя (только смотреть)
  //   - Не-EDU → расшарить можно, видна всем (для обычных публичных нот)
  let eduInstitutionId: string | null = null;
  let shouldShare = !!isShared;
  if (shouldShare) {
    const edu = await getEduContext(userId);
    if (edu) {
      if (edu.role === 'STUDENT') {
        return NextResponse.json(
          { success: false, error: 'Студенты не могут открывать общий доступ к своим аннотациям' },
          { status: 403, headers: cors }
        );
      }
      eduInstitutionId = edu.institutionId;
    }
  }

  const ann = await prisma.annotation.create({
    data: {
      userId,
      sheetMusicId: sheetId,
      pageNumber: pageNumber || 1,
      positionX: positionX != null ? Number(positionX) : 0,
      positionY: positionY != null ? Number(positionY) : 0,
      content: String(content).trim(),
      color: color || '#ffff00',
      isShared: shouldShare,
    },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, username: true, avatar: true } },
    },
  });

  // Привязка к учреждению (raw, т.к. колонка не в Prisma-схеме)
  if (eduInstitutionId) {
    await prisma.$executeRawUnsafe(
      `UPDATE annotations SET edu_institution_id = $1 WHERE id = $2`,
      eduInstitutionId, ann.id
    );
  }

  return NextResponse.json({
    success: true,
    data: {
      ...ann,
      eduInstitutionId,
      isOwn: true,
    },
  }, { headers: cors });
}

export const GET = requireAuth(getHandler);
export const POST = requireAuth(postHandler);
