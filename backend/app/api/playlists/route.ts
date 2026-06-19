import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware';
import { prisma } from '@/lib/prisma';
import { getSubLevel, FREE_LIMITS } from '@/lib/subscription';

export const dynamic = 'force-dynamic';

// Получить плейлисты пользователя
export async function GET(request: NextRequest) {
  return withAuth(request, async (req, session) => {
    try {
      const { searchParams } = new URL(request.url);
      const userId = searchParams.get('userId') || session.userId;
      const publicParam = searchParams.get('public'); // 'true' | 'false' | null

      const where: any = { userId };

      if (userId !== session.userId) {
        // Чужие плейлисты — только публичные
        where.isPublic = true;
      } else if (publicParam === 'true') {
        where.isPublic = true;
      } else if (publicParam === 'false') {
        where.isPublic = false;
      }
      // Иначе — без фильтра, возвращаем все плейлисты владельца

      const playlists = await prisma.playlist.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              avatar: true
            }
          },
          tracks: {
            take: 4,
            orderBy: { position: 'asc' },
            include: {
              track: {
                select: {
                  id: true,
                  title: true,
                  cover: true,
                  artist: {
                    select: {
                      name: true
                    }
                  }
                }
              }
            }
          }
        },
        orderBy: { updatedAt: 'desc' }
      });

      return NextResponse.json({
        success: true,
        data: playlists
      });

    } catch (error) {
      console.error('Get playlists error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch playlists' },
        { status: 500 }
      );
    }
  });
}

// Создать плейлист
export async function POST(request: NextRequest) {
  return withAuth(request, async (req, session) => {
    try {
      const body = await request.json();
      const { title, description, cover, isPublic } = body;

      if (!title) {
        return NextResponse.json(
          { success: false, error: 'Title is required' },
          { status: 400 }
        );
      }

      // Free-лимит: максимум 5 плейлистов (по ТЗ)
      const sub = await getSubLevel(session.userId);
      if (!sub.isPremium) {
        const count = await prisma.playlist.count({ where: { userId: session.userId } });
        if (count >= FREE_LIMITS.MAX_PLAYLISTS) {
          return NextResponse.json(
            {
              success: false,
              error: `Лимит бесплатного тарифа: до ${FREE_LIMITS.MAX_PLAYLISTS} плейлистов. Оформите Premium для безлимита.`,
              code: 'PLAYLIST_LIMIT_REACHED',
            },
            { status: 403 }
          );
        }
      }

      const slug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`;

      const playlist = await prisma.playlist.create({
        data: {
          title,
          slug,
          description,
          cover,
          isPublic: isPublic !== false,
          userId: session.userId
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              avatar: true
            }
          }
        }
      });

      return NextResponse.json({
        success: true,
        data: playlist
      }, { status: 201 });

    } catch (error) {
      console.error('Create playlist error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to create playlist' },
        { status: 500 }
      );
    }
  });
}
