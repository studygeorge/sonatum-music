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

async function deleteHandler(request: NextRequest, user: AuthUser, { params }: { params: { id: string } }) {
  const corsHeaders = getCorsHeaders(request.headers.get('origin') || undefined);
  try {
    const { id } = params;

    const comment = await prisma.comment.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });
    if (!comment) {
      return NextResponse.json({ success: false, error: 'Комментарий не найден' }, { status: 404, headers: corsHeaders });
    }

    const isOwner = comment.userId === user.id.toString();
    const isAdmin = (user as any).role === 'ADMIN' || (user as any).isAdmin === true;
    if (!isOwner && !isAdmin) {
      return NextResponse.json({ success: false, error: 'Можно удалять только свои комментарии' }, { status: 403, headers: corsHeaders });
    }

    // Каскад БД сам удалит ответы (CommentReplies), лайки (CommentLike) и жалобы (Report) — все onDelete: Cascade.
    await prisma.comment.delete({ where: { id } });

    return NextResponse.json({ success: true }, { headers: corsHeaders });
  } catch (error) {
    console.error('[COMMENT_DELETE_ERROR]', error);
    return NextResponse.json({ success: false, error: 'Ошибка удаления комментария' }, { status: 500, headers: corsHeaders });
  }
}

export const DELETE = requireAuth(deleteHandler);
