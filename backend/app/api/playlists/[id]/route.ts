import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware';
import { prisma } from '@/lib/prisma';

// Получить плейлист по ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Ищем по id или slug — фронт может передать любое
    const playlist = await prisma.playlist.findFirst({
      where: { OR: [{ id: params.id }, { slug: params.id }] },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatar: true
          }
        },
        tracks: {
          orderBy: { position: 'asc' },
          include: {
            track: {
              include: {
                artist: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                    avatar: true,
                    verified: true
                  }
                },
                album: {
                  select: {
                    id: true,
                    title: true,
                    cover: true
                  }
                },
                genres: {
                  include: {
                    genre: {
                      select: {
                        name: true,
                        color: true
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!playlist) {
      return NextResponse.json(
        { success: false, error: 'Playlist not found' },
        { status: 404 }
      );
    }

    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    let isOwner = false;

    if (token) {
      const { AuthService } = await import('@/lib/auth');
      const session = await AuthService.validateSession(token);
      isOwner = session?.userId === playlist.userId;
    }

    if (!playlist.isPublic && !isOwner) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: playlist
    });

  } catch (error) {
    console.error('Get playlist error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch playlist' },
      { status: 500 }
    );
  }
}

// Обновить плейлист
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return withAuth(request, async (req, session) => {
    try {
      const playlist = await prisma.playlist.findFirst({
        where: { OR: [{ id: params.id }, { slug: params.id }] }
      });

      if (!playlist) {
        return NextResponse.json(
          { success: false, error: 'Playlist not found' },
          { status: 404 }
        );
      }

      if (playlist.userId !== session.userId) {
        return NextResponse.json(
          { success: false, error: 'Forbidden' },
          { status: 403 }
        );
      }

      const body = await request.json();
      const { title, description, cover, isPublic } = body;

      const updated = await prisma.playlist.update({
        where: { id: playlist.id },
        data: {
          title,
          description,
          cover,
          isPublic
        }
      });

      return NextResponse.json({
        success: true,
        data: updated
      });

    } catch (error) {
      console.error('Update playlist error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to update playlist' },
        { status: 500 }
      );
    }
  });
}

// Удалить плейлист
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return withAuth(request, async (req, session) => {
    try {
      const playlist = await prisma.playlist.findFirst({
        where: { OR: [{ id: params.id }, { slug: params.id }] }
      });

      if (!playlist) {
        return NextResponse.json(
          { success: false, error: 'Playlist not found' },
          { status: 404 }
        );
      }

      if (playlist.userId !== session.userId) {
        return NextResponse.json(
          { success: false, error: 'Forbidden' },
          { status: 403 }
        );
      }

      await prisma.playlist.delete({
        where: { id: playlist.id }
      });

      return NextResponse.json({
        success: true,
        message: 'Playlist deleted'
      });

    } catch (error) {
      console.error('Delete playlist error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to delete playlist' },
        { status: 500 }
      );
    }
  });
}
