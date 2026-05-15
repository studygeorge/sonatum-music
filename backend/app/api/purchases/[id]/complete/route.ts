import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware';
import { prisma } from '@/lib/prisma';

// Завершить покупку (webhook от платежной системы)
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return withAuth(request, async (req, session) => {
    try {
      const purchase = await prisma.purchase.findUnique({
        where: { id: params.id },
        include: { track: true }
      });

      if (!purchase) {
        return NextResponse.json(
          { success: false, error: 'Purchase not found' },
          { status: 404 }
        );
      }

      if (purchase.userId !== session.userId && session.role !== 'ADMIN') {
        return NextResponse.json(
          { success: false, error: 'Forbidden' },
          { status: 403 }
        );
      }

      const body = await request.json();
      const { paymentId, paymentMethod } = body;

      const downloadUrl = `/api/downloads/${purchase.trackId}?token=${purchase.id}`;

      const updated = await prisma.$transaction([
        prisma.purchase.update({
          where: { id: params.id },
          data: {
            status: 'COMPLETED',
            paymentId,
            paymentMethod,
            completedAt: new Date(),
            downloadUrl
          }
        }),
        prisma.track.update({
          where: { id: purchase.trackId },
          data: {
            purchaseCount: { increment: 1 }
          }
        })
      ]);

      return NextResponse.json({
        success: true,
        data: updated[0]
      });

    } catch (error) {
      console.error('Complete purchase error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to complete purchase' },
        { status: 500 }
      );
    }
  });
}
