import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware';
import { prisma } from '@/lib/prisma';

// Поставить лайк
export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  return withAuth(request, async (req, session) => {
    try {
      const track = await prisma.track.findUnique({
        where: { slug: params.slug }
      });

      if (!track) {
        return NextResponse.json(
          { success: false, error: 'Track not found' },
          { status: 404 }
        );
      }

      const existingLike = await prisma.likedTrack.findUnique({
        where: {
          userId_trackId: {
            userId: session.userId,
            trackId: track.id
          }
        }
      });

      if (existingLike) {
        return NextResponse.json(
          { success: false, error: 'Already liked' },
          { status: 409 }
        );
      }

      await prisma.$transaction([
        prisma.likedTrack.create({
          data: {
            userId: session.userId,
            trackId: track.id
          }
        }),
        prisma.track.update({
          where: { id: track.id },
          data: {
            likeCount: { increment: 1 }
          }
        })
      ]);

      return NextResponse.json({
        success: true,
        message: 'Track liked'
      });

    } catch (error) {
      console.error('Like track error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to like track' },
        { status: 500 }
      );
    }
  });
}

// Убрать лайк
export async function DELETE(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  return withAuth(request, async (req, session) => {
    try {
      const track = await prisma.track.findUnique({
        where: { slug: params.slug }
      });

      if (!track) {
        return NextResponse.json(
          { success: false, error: 'Track not found' },
          { status: 404 }
        );
      }

      const like = await prisma.likedTrack.findUnique({
        where: {
          userId_trackId: {
            userId: session.userId,
            trackId: track.id
          }
        }
      });

      if (!like) {
        return NextResponse.json(
          { success: false, error: 'Not liked' },
          { status: 404 }
        );
      }

      await prisma.$transaction([
        prisma.likedTrack.delete({
          where: {
            userId_trackId: {
              userId: session.userId,
              trackId: track.id
            }
          }
        }),
        prisma.track.update({
          where: { id: track.id },
          data: {
            likeCount: { decrement: 1 }
          }
        })
      ]);

      return NextResponse.json({
        success: true,
        message: 'Like removed'
      });

    } catch (error) {
      console.error('Unlike track error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to unlike track' },
        { status: 500 }
      );
    }
  });
}
