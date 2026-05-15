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

async function postHandler(request: NextRequest, user: AuthUser, { params }: { params: { id: string } }) {
  const origin = request.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin || undefined);

  try {
    const { id: commentId } = params;

    // Проверяем, существует ли лайк
    const existingLike = await prisma.commentLike.findUnique({
      where: {
        userId_commentId: {
          userId: user.id.toString(),
          commentId
        }
      }
    });

    if (existingLike) {
      // Удаляем лайк
      await prisma.$transaction([
        prisma.commentLike.delete({
          where: { userId_commentId: { userId: user.id.toString(), commentId } }
        }),
        prisma.comment.update({
          where: { id: commentId },
          data: { likesCount: { decrement: 1 } }
        })
      ]);
      return NextResponse.json({ success: true, data: { liked: false } }, { headers: corsHeaders });
    } else {
      // Ставим лайк
      await prisma.$transaction([
        prisma.commentLike.create({
          data: { userId: user.id.toString(), commentId }
        }),
        prisma.comment.update({
          where: { id: commentId },
          data: { likesCount: { increment: 1 } }
        })
      ]);
      return NextResponse.json({ success: true, data: { liked: true } }, { headers: corsHeaders });
    }

  } catch (error) {
    console.error('[COMMENT_LIKE_ERROR]', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка при оценке комментария' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export const POST = requireAuth(postHandler);
