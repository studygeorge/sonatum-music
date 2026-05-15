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

async function putHandler(request: NextRequest, user: AuthUser) {
  const origin = request.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin || undefined);

  try {
    const body = await request.json();
    const { privacySettings } = body;

    if (!privacySettings) {
      return NextResponse.json(
        { success: false, error: 'Данные privacySettings обязательны' },
        { status: 400, headers: corsHeaders }
      );
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id.toString() },
      data: { privacySettings },
      select: {
        id: true,
        privacySettings: true
      }
    });

    return NextResponse.json({ success: true, data: updatedUser }, { headers: corsHeaders });
  } catch (error) {
    console.error('[PRIVACY_UPDATE]', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка при обновлении настроек приватности' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export const PUT = requireAuth(putHandler);
