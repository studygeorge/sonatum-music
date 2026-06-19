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

async function deleteHandler(
  request: NextRequest,
  user: AuthUser,
  context: { params: { id: string; annotationId: string } }
) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const { annotationId } = context.params;

  const annotation = await prisma.annotation.findUnique({ where: { id: annotationId } });
  if (!annotation) {
    return NextResponse.json({ success: false, error: 'Аннотация не найдена' }, { status: 404, headers: cors });
  }

  if (annotation.userId !== user.id.toString() && user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN') {
    return NextResponse.json({ success: false, error: 'Нет прав для удаления' }, { status: 403, headers: cors });
  }

  await prisma.annotation.delete({ where: { id: annotationId } });
  return NextResponse.json({ success: true }, { headers: cors });
}

async function patchHandler(
  request: NextRequest,
  user: AuthUser,
  context: { params: { id: string; annotationId: string } }
) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const { annotationId } = context.params;

  const annotation = await prisma.annotation.findUnique({ where: { id: annotationId } });
  if (!annotation) {
    return NextResponse.json({ success: false, error: 'Аннотация не найдена' }, { status: 404, headers: cors });
  }
  if (annotation.userId !== user.id.toString()) {
    return NextResponse.json({ success: false, error: 'Только автор может редактировать аннотацию' }, { status: 403, headers: cors });
  }

  let body: any;
  try { body = await request.json(); } catch { body = {}; }

  const data: any = {};
  if (body.content !== undefined) data.content = String(body.content).trim().slice(0, 2000);
  if (body.color !== undefined) data.color = String(body.color).slice(0, 32);
  if (body.positionX !== undefined) data.positionX = Number(body.positionX);
  if (body.positionY !== undefined) data.positionY = Number(body.positionY);
  if (body.pageNumber !== undefined) data.pageNumber = Math.max(1, parseInt(String(body.pageNumber)) || 1);
  if (body.isShared !== undefined) data.isShared = !!body.isShared;

  // Если поменялся isShared — пересчитаем eduInstitutionId
  if (body.isShared !== undefined) {
    if (!body.isShared) {
      // unshare → убираем привязку к EDU
      await prisma.$executeRawUnsafe(`UPDATE annotations SET edu_institution_id = NULL WHERE id = $1`, annotationId);
    } else {
      // share → если автор в EDU, привязываем к его институту
      const [asAdmin] = (await prisma.$queryRawUnsafe(
        `SELECT id FROM edu_institutions WHERE admin_user_id = $1 AND status IN ('ACTIVE','APPROVED') LIMIT 1`,
        user.id.toString()
      )) as any[];
      let eduId = asAdmin?.id || null;
      if (!eduId) {
        const [m] = (await prisma.$queryRawUnsafe(
          `SELECT institution_id, role FROM edu_members WHERE user_id = $1 LIMIT 1`,
          user.id.toString()
        )) as any[];
        if (m && (m.role === 'TEACHER' || m.role === 'ADMIN')) eduId = m.institution_id;
        if (m?.role === 'STUDENT') {
          return NextResponse.json(
            { success: false, error: 'Студенты не могут открывать общий доступ к аннотациям' },
            { status: 403, headers: cors }
          );
        }
      }
      await prisma.$executeRawUnsafe(`UPDATE annotations SET edu_institution_id = $1 WHERE id = $2`, eduId, annotationId);
    }
  }

  if (Object.keys(data).length > 0) {
    await prisma.annotation.update({ where: { id: annotationId }, data });
  }

  return NextResponse.json({ success: true }, { headers: cors });
}

export const DELETE = requireAuth(deleteHandler);
export const PATCH = requireAuth(patchHandler);
