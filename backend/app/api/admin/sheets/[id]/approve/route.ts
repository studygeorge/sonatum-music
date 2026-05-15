import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/middleware';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  return withRole(request, ['ADMIN', 'SUPER_ADMIN'], async () => {
    try {
      const sheet = await prisma.sheetMusic.update({
        where: { id: params.id },
        data: { verifyStatus: 'APPROVED' }
      });
      return NextResponse.json({ success: true, data: sheet });
    } catch (error) {
      console.error('[ADMIN SHEETS API] Error approving sheet:', error);
      return NextResponse.json({ success: false, error: 'Failed to approve sheet' }, { status: 500 });
    }
  });
}
