import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/middleware';
import { prisma } from '@/lib/prisma';

// Отклонить трек
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return withRole(request, ['ADMIN', 'SUPER_ADMIN'], async (req, session) => {
    try {
      const body = await request.json();
      const { reason } = body;

      if (!reason) {
        return NextResponse.json(
          { success: false, error: 'Rejection reason is required' },
          { status: 400 }
        );
      }

      const track = await prisma.track.findUnique({
        where: { id: params.id }
      });

      if (!track) {
        return NextResponse.json(
          { success: false, error: 'Track not found' },
          { status: 404 }
        );
      }

      const updated = await prisma.track.update({
        where: { id: params.id },
        data: {
          status: 'REJECTED'
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
        message: 'Track rejected'
      });

    } catch (error) {
      console.error('Reject track error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to reject track' },
        { status: 500 }
      );
    }
  });
}
