import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/middleware';
import { prisma } from '@/lib/prisma';

// Одобрить трек
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return withRole(request, ['ADMIN', 'SUPER_ADMIN'], async (req, session) => {
    try {
      const track = await prisma.track.findUnique({
        where: { id: params.id }
      });

      if (!track) {
        return NextResponse.json(
          { success: false, error: 'Track not found' },
          { status: 404 }
        );
      }

      if (track.status !== 'PENDING') {
        return NextResponse.json(
          { success: false, error: 'Track is not pending approval' },
          { status: 400 }
        );
      }

      const updated = await prisma.track.update({
        where: { id: params.id },
        data: {
          status: 'PUBLISHED',
          publishedAt: new Date()
        },
        include: {
          artist: {
            select: {
              name: true,
              user: {
                select: {
                  email: true
                }
              }
            }
          }
        }
      });

      return NextResponse.json({
        success: true,
        data: updated,
        message: 'Track approved and published'
      });

    } catch (error) {
      console.error('Approve track error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to approve track' },
        { status: 500 }
      );
    }
  });
}
