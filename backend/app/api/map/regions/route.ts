import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCorsHeaders } from '@/lib/cors';

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request.headers.get('origin') || undefined),
  });
}

export async function GET(request: NextRequest) {
  const origin = request.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin || undefined);

  try {
    const regions = await prisma.region.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        type: true,
        centerCoordinates: true,
        identityColor: true
      }
    });

    return NextResponse.json({ success: true, data: regions }, { headers: corsHeaders });
  } catch (error) {
    console.error('[REGIONS_GET_ERROR]', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка получения регионов' },
      { status: 500, headers: corsHeaders }
    );
  }
}
