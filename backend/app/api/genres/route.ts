import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCorsHeaders } from '@/lib/cors';

export const dynamic = 'force-dynamic';

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin');
  const headers = getCorsHeaders(origin || undefined);
  return new Response(null, { status: 204, headers });
}

export async function GET(request: NextRequest) {
  const origin = request.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin || undefined);

  try {
    const genres = await prisma.genre.findMany({
      include: {
        _count: {
          select: {
            tracks: true,
            artists: true
          }
        },
        subgenres: {
          select: {
            id: true,
            name: true,
            slug: true,
            icon: true,
            color: true
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    });

    return NextResponse.json(
      {
        success: true,
        data: genres
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('Genres API Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch genres' },
      { status: 500, headers: corsHeaders }
    );
  }
}
