import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// Получить покупки пользователя
export async function GET(request: NextRequest) {
  return withAuth(request, async (req, session) => {
    try {
      const { searchParams } = new URL(request.url);
      const status = searchParams.get('status');

      const where: any = { userId: session.userId };
      if (status) {
        where.status = status;
      }

      const purchases = await prisma.purchase.findMany({
        where,
        include: {
          track: {
            include: {
              artist: {
                select: {
                  name: true,
                  slug: true
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      return NextResponse.json({
        success: true,
        data: purchases
      });

    } catch (error) {
      console.error('Get purchases error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch purchases' },
        { status: 500 }
      );
    }
  });
}

// Создать покупку
export async function POST(request: NextRequest) {
  return withAuth(request, async (req, session) => {
    try {
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

      if (!track.isForSale || !track.price) {
        return NextResponse.json(
          { success: false, error: 'Track is not for sale' },
          { status: 400 }
        );
      }

      const existingPurchase = await prisma.purchase.findFirst({
        where: {
          userId: session.userId,
          trackId,
          status: 'COMPLETED'
        }
      });

      if (existingPurchase) {
        return NextResponse.json(
          { success: false, error: 'Already purchased' },
          { status: 409 }
        );
      }

      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 12);

      const purchase = await prisma.purchase.create({
        data: {
          userId: session.userId,
          trackId,
          price: track.price,
          currency: 'RUB',
          status: 'PENDING',
          maxDownloads: 5,
          expiresAt
        },
        include: {
          track: {
            include: {
              artist: {
                select: {
                  name: true
                }
              }
            }
          }
        }
      });

      return NextResponse.json({
        success: true,
        data: purchase
      }, { status: 201 });

    } catch (error) {
      console.error('Create purchase error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to create purchase' },
        { status: 500 }
      );
    }
  });
}
