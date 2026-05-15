import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/middleware';

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(request, async (req, session) => {
    try {
      const user = await prisma.user.findUnique({ where: { id: session.userId } });
      if (!user || !['ADMIN', 'MODERATOR'].includes(user.role)) {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
      }

      const body = await req.json();
      const { status } = body; // 'APPROVED' | 'REJECTED' | 'PENDING'

      if (!['APPROVED', 'REJECTED', 'PENDING'].includes(status)) {
        return NextResponse.json({ success: false, error: 'Invalid status' }, { status: 400 });
      }

      const updated = await prisma.sheetMusic.update({
        where: { id: params.id },
        data: { verifyStatus: status as any }
      });

      return NextResponse.json({ success: true, data: updated });
    } catch (error) {
      console.error('[ADMIN_SHEETS_VERIFY_PUT]', error);
      return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
  });
}
