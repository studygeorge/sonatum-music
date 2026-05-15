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

async function getHandler(request: NextRequest, user: AuthUser, context: { params: { id: string } }) {
  const origin = request.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin || undefined);

  try {
    const { id } = context.params;
    
    // Получение собственных аннотаций и расшаренных
    const annotations = await prisma.annotation.findMany({
      where: {
        sheetMusicId: id,
        OR: [
          { userId: user.id.toString() },
          { isShared: true } // Для прототипа возвращаем все расшаренные
        ]
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, username: true, avatar: true } }
      }
    });

    return NextResponse.json({ success: true, data: annotations }, { headers: corsHeaders });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Ошибка сервера' }, { status: 500, headers: corsHeaders });
  }
}

async function postHandler(request: NextRequest, user: AuthUser, context: { params: { id: string } }) {
  const origin = request.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin || undefined);

  try {
    const { id } = context.params;
    const body = await request.json();
    const { pageNumber, positionX, positionY, content, color, isShared } = body;

    const annotation = await prisma.annotation.create({
      data: {
        userId: user.id.toString(),
        sheetMusicId: id,
        pageNumber,
        positionX,
        positionY,
        content,
        color: color || '#ffff00',
        isShared: isShared || false
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, username: true, avatar: true } }
      }
    });

    return NextResponse.json({ success: true, data: annotation }, { headers: corsHeaders });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Ошибка создания аннотации' }, { status: 500, headers: corsHeaders });
  }
}

export const GET = requireAuth(getHandler);
export const POST = requireAuth(postHandler);
