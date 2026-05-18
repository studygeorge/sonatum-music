import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// Получить трек по slug
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const track = await prisma.track.findFirst({
      where: {
        OR: [
          { id: params.id },
          { slug: params.id }
        ]
      },
      include: {
        artist: {
          select: {
            id: true,
            name: true,
            slug: true,
            avatar: true,
            verified: true,
            region: true,
            followers: true
          }
        },
        album: {
          select: {
            id: true,
            title: true,
            slug: true,
            cover: true,
            releaseDate: true
          }
        },
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
        tags: {
          include: {
            tag: {
              select: {
                name: true,
                slug: true
              }
            }
          }
        },
        sheetMusic: true
      }
    });

    if (!track) {
      return NextResponse.json(
        { success: false, error: 'Track not found' },
        { status: 404 }
      );
    }

    if (track.status !== 'PUBLISHED') {
      const token = request.headers.get('authorization')?.replace('Bearer ', '');
      
      if (token) {
        const { AuthService } = await import('@/lib/auth');
        const session = await AuthService.validateSession(token);
        
        const artist = await prisma.artist.findUnique({
          where: { userId: session?.userId }
        });

        if (artist?.id !== track.artistId && session?.role !== 'ADMIN' && session?.role !== 'SUPER_ADMIN') {
          return NextResponse.json(
            { success: false, error: 'Track not available' },
            { status: 403 }
          );
        }
      } else {
        return NextResponse.json(
          { success: false, error: 'Track not available' },
          { status: 403 }
        );
      }
    }

    // Раньше тут увеличивали playCount на каждом GET — просмотр страницы
    // не равен реальному прослушиванию. Инкремент перенесён на момент
    // реального проигрывания (player → POST /api/tracks/[id]/activity или
    // существующий /api/likes-event), здесь только читаем.

    const similarTracks = await prisma.track.findMany({
      where: {
        AND: [
          { id: { not: track.id } },
          { status: 'PUBLISHED' },
          {
            OR: [
              { artistId: track.artistId },
              {
                genres: {
                  some: {
                    genreId: {
                      in: track.genres.map(tg => tg.genreId)
                    }
                  }
                }
              }
            ]
          }
        ]
      },
      take: 6,
      include: {
        artist: {
          select: {
            name: true,
            slug: true,
            avatar: true
          }
        }
      },
      orderBy: { playCount: 'desc' }
    });

    return NextResponse.json({
      success: true,
      data: {
        track,
        similarTracks
      }
    });

  } catch (error) {
    console.error('Get track error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch track' },
      { status: 500 }
    );
  }
}
