import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, AuthUser } from '@/lib/auth';
import { getCorsHeaders } from '@/lib/cors';

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request.headers.get('origin') || undefined),
  });
}

async function deleteHandler(request: NextRequest, user: AuthUser, context: { params: { id: string, annotationId: string } }) {
  const origin = request.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin || undefined);

  try {
    const { annotationId } = context.params;

    const annotation = await prisma.annotation.findUnique({
      where: { id: annotationId }
    });

    if (!annotation) {
      return NextResponse.json({ success: false, error: 'Аннотация не найдена' }, { status: 404, headers: corsHeaders });
    }

    if (annotation.userId !== user.id.toString() && user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ success: false, error: 'Нет прав для удаления' }, { status: 403, headers: corsHeaders });
    }

    await prisma.annotation.delete({
      where: { id: annotationId }
    });

    return NextResponse.json({ success: true }, { headers: corsHeaders });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Ошибка при удалении' }, { status: 500, headers: corsHeaders });
  }
}

export const DELETE = requireAuth(deleteHandler);
