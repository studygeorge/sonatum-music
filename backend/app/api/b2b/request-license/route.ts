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
    const { trackId, companyName, email, phone, message } = body;

    const b2bRequest = await prisma.b2BRequest.create({
      data: {
        requesterId: user.id.toString(),
        trackId,
        companyName,
        email,
        phone,
        message,
        requestType: 'LICENSE'
      }
    });

    return NextResponse.json({ success: true, data: b2bRequest }, { headers: corsHeaders });
  } catch (error) {
    console.error('[B2B_LICENSE_ERROR]', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка создания заявки на лицензию' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export const POST = requireAuth(postHandler);
