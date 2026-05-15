import { NextResponse, NextRequest } from 'next/server';
import { AuthService } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getCorsHeaders } from '@/lib/cors';

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request.headers.get('origin') || undefined),
  });
}

export async function GET(request: NextRequest, context: { params: { id: string } }) {
  const origin = request.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin || undefined);

  try {
    const { id } = context.params;

    // Доступ к нотам только для Premium-подписчиков
    const auth = request.headers.get("Authorization");
    let isPremium = false;
    if (auth?.startsWith("Bearer ")) {
      const session = await AuthService.validateSession(auth.substring(7));
      if (session) {
        const sub = await prisma.subscription.findUnique({ where: { userId: session.userId } });
        isPremium = !!sub
          && sub.tier !== "FREE"
          && sub.status === "ACTIVE"
          && (!sub.endDate || new Date(sub.endDate) > new Date());
      }
    }
    if (!isPremium) {
      return NextResponse.json(
        { success: false, error: "PREMIUM_REQUIRED" },
        { status: 403, headers: corsHeaders }
      );
    }


    const sheet = await prisma.sheetMusic.findUnique({
      where: { id },
      include: {
        composer: { select: { name: true, slug: true, avatar: true } },
        uploader: { select: { id: true, username: true, firstName: true, lastName: true, avatar: true } },
        track: { select: { slug: true } }
      }
    });

    if (!sheet) {
      return NextResponse.json(
        { success: false, error: 'Ноты не найдены' },
        { status: 404, headers: corsHeaders }
      );
    }

    return NextResponse.json({ success: true, data: sheet }, { headers: corsHeaders });
  } catch (error) {
    console.error('[SHEETS_GET_ID]', error);
    return NextResponse.json(
      { success: false, error: 'Внутренняя ошибка сервера' },
      { status: 500, headers: corsHeaders }
    );
  }
}
