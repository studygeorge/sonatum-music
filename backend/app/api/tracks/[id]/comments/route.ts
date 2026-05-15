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

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const origin = request.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin || undefined);

  try {
    const { id } = params;
    const { searchParams } = new URL(request.url);
    const sort = searchParams.get('sort') || 'new'; // 'new' | 'popular'
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = 20;
    const skip = (page - 1) * limit;

    const orderBy = sort === 'popular'
      ? { likesCount: 'desc' as const }
      : { createdAt: 'desc' as const };

    const [comments, total] = await Promise.all([
      prisma.comment.findMany({
        where: { trackId: id, parentId: null },
        include: {
          user: { select: { id: true, username: true, nickname: true, avatar: true, firstName: true, lastName: true } },
          replies: {
            include: {
              user: { select: { id: true, username: true, nickname: true, avatar: true, firstName: true, lastName: true } },
              replies: {
                include: {
                  user: { select: { id: true, username: true, nickname: true, avatar: true, firstName: true, lastName: true } },
                },
                orderBy: { createdAt: 'asc' },
                take: 20,
              },
            },
            orderBy: { createdAt: 'asc' },
            take: 20,
          },
          _count: { select: { likes: true } },
        },
        orderBy,
        skip,
        take: limit,
      }),
      prisma.comment.count({ where: { trackId: id, parentId: null } }),
    ]);

    return NextResponse.json({
      success: true,
      data: comments,
      pagination: { page, limit, total, hasMore: skip + limit < total },
    }, { headers: corsHeaders });
  } catch (error) {
    console.error('[COMMENTS_GET_ERROR]', error);
    return NextResponse.json({ success: false, error: 'Ошибка получения комментариев' }, { status: 500, headers: corsHeaders });
  }
}

async function postHandler(request: NextRequest, user: AuthUser, { params }: { params: { id: string } }) {
  const origin = request.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin || undefined);

  const sub = await prisma.subscription.findUnique({
    where: { userId: user.id.toString() }
  });
  const isPremium = sub?.tier === 'PREMIUM' || sub?.tier === 'STUDENT';

  if (!isPremium) {
    return NextResponse.json({ success: false, error: 'Комментирование доступно только с подпиской Premium' }, { status: 403, headers: corsHeaders });
  }

  try {
    const { id } = params;
    const body = await request.json();
    const { content, parentId } = body;

    if (!content?.trim()) {
      return NextResponse.json({ success: false, error: 'Текст комментария обязателен' }, { status: 400, headers: corsHeaders });
    }

    const comment = await prisma.comment.create({
      data: {
        userId: user.id.toString(),
        trackId: id,
        content: content.trim(),
        parentId: parentId || null,
      },
      include: {
        user: { select: { id: true, username: true, nickname: true, avatar: true, firstName: true, lastName: true } },
        replies: { include: { user: { select: { id: true, username: true, nickname: true, avatar: true, firstName: true, lastName: true } } } },
        _count: { select: { likes: true } },
      },
    });

    return NextResponse.json({ success: true, data: comment }, { headers: corsHeaders });
  } catch (error) {
    console.error('[COMMENT_POST_ERROR]', error);
    return NextResponse.json({ success: false, error: 'Ошибка создания комментария' }, { status: 500, headers: corsHeaders });
  }
}

export const POST = requireAuth(postHandler);
