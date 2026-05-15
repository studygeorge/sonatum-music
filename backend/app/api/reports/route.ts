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

async function postHandler(request: NextRequest, user: AuthUser) {
  const origin = request.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin || undefined);

  try {
    const body = await request.json();
    const { targetType, targetId, reason, details } = body;

    if (!targetType || !targetId || !reason) {
      return NextResponse.json({ success: false, error: 'Не все поля заполнены' }, { status: 400, headers: corsHeaders });
    }

    const report = await prisma.report.create({
      data: {
        reporterId: user.id.toString(),
        targetType,
        targetId,
        reason,
        details
      }
    });

    return NextResponse.json({ success: true, data: report }, { headers: corsHeaders });
  } catch (error) {
    console.error('[REPORT_POST_ERROR]', error);
    return NextResponse.json({ success: false, error: 'Ошибка отправки жалобы' }, { status: 500, headers: corsHeaders });
  }
}

export const POST = requireAuth(postHandler);
