import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// Получить всех артистов
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const region = searchParams.get('region');
    const verified = searchParams.get('verified');
    const sortBy = searchParams.get('sortBy') || 'followers';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '24');
    const skip = (page - 1) * limit;

    console.log('[API ARTISTS] Request params:', { search, region, verified, sortBy, page, limit });

    const where: any = {};

    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    if (region) {
      where.region = region;
    }

    if (verified === 'true') {
      where.verified = true;
    }

    // Определяем сортировку
    let orderBy: any = {};
    switch (sortBy) {
      case 'followers':
        orderBy = { followers: 'desc' };
        break;
      case 'name':
        orderBy = { name: 'asc' };
        break;
      default:
        orderBy = { followers: 'desc' };
    }

    const [artists, total] = await Promise.all([
      prisma.artist.findMany({
        where,
        skip,
        take: limit,
        include: {
          genres: {
            include: {
              genre: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  color: true,
                  icon: true
                }
              }
            }
          },
          _count: {
            select: {
              tracks: true,
              albums: true
            }
          }
        },
        orderBy
      }),
      prisma.artist.count({ where })
    ]);

    console.log('[API ARTISTS] Found:', artists.length, 'artists');

    // Трансформируем данные: преобразуем genres из связи в массив
    const transformedArtists = artists.map(artist => ({
      ...artist,
      genres: artist.genres.map(ag => ag.genre) // Извлекаем genre из ArtistGenre
    }));

    return NextResponse.json({
      success: true,
      data: {
        artists: transformedArtists,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('[API ARTISTS] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch artists' },
      { status: 500 }
    );
  }
}
