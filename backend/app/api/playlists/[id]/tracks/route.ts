import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware';
import { prisma } from '@/lib/prisma';

// Добавить трек в плейлист
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return withAuth(request, async (req, session) => {
    try {
      const playlist = await prisma.playlist.findUnique({
        where: { id: params.id },
        include: {
          tracks: {
            orderBy: { position: 'desc' },
            take: 1
          }
        }
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
      const { trackId } = body;

      if (!trackId) {
        return NextResponse.json(
          { success: false, error: 'Track ID is required' },
          { status: 400 }
        );
      }

      const track = await prisma.track.findUnique({
        where: { id: trackId }
      });

      if (!track) {
        return NextResponse.json(
          { success: false, error: 'Track not found' },
          { status: 404 }
        );
      }

      const existingTrack = await prisma.playlistTrack.findUnique({
        where: {
          playlistId_trackId: {
            playlistId: params.id,
            trackId
          }
        }
      });

      if (existingTrack) {
        return NextResponse.json(
          { success: false, error: 'Track already in playlist' },
          { status: 409 }
        );
      }

      const maxPosition = playlist.tracks[0]?.position || 0;

      await prisma.$transaction([
        prisma.playlistTrack.create({
          data: {
            playlistId: params.id,
            trackId,
            position: maxPosition + 1
          }
        }),
        prisma.playlist.update({
          where: { id: params.id },
          data: {
            trackCount: { increment: 1 },
            duration: { increment: track.duration }
          }
        })
      ]);

      return NextResponse.json({
        success: true,
        message: 'Track added to playlist'
      });

    } catch (error) {
      console.error('Add track to playlist error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to add track' },
        { status: 500 }
      );
    }
  });
}

// Удалить трек из плейлиста
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return withAuth(request, async (req, session) => {
    try {
      const { searchParams } = new URL(request.url);
      const trackId = searchParams.get('trackId');

      if (!trackId) {
        return NextResponse.json(
          { success: false, error: 'Track ID is required' },
          { status: 400 }
        );
      }

      const playlist = await prisma.playlist.findUnique({
        where: { id: params.id }
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

      const playlistTrack = await prisma.playlistTrack.findUnique({
        where: {
          playlistId_trackId: {
            playlistId: params.id,
            trackId
          }
        },
        include: {
          track: {
            select: { duration: true }
          }
        }
      });

      if (!playlistTrack) {
        return NextResponse.json(
          { success: false, error: 'Track not in playlist' },
          { status: 404 }
        );
      }

      await prisma.$transaction([
        prisma.playlistTrack.delete({
          where: {
            playlistId_trackId: {
              playlistId: params.id,
              trackId
            }
          }
        }),
        prisma.playlist.update({
          where: { id: params.id },
          data: {
            trackCount: { decrement: 1 },
            duration: { decrement: playlistTrack.track.duration }
          }
        })
      ]);

      return NextResponse.json({
        success: true,
        message: 'Track removed from playlist'
      });

    } catch (error) {
      console.error('Remove track from playlist error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to remove track' },
        { status: 500 }
      );
    }
  });
}
