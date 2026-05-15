import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/middleware';
import { prisma } from '@/lib/prisma';
import { deletePdfFile } from '@/lib/fileUpload';

export const dynamic = 'force-dynamic';

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  return withRole(request, ['ADMIN', 'SUPER_ADMIN'], async () => {
    try {
      const body = await request.json();
      const updatedSheet = await prisma.sheetMusic.update({
        where: { id: params.id },
        data: body
      });
      return NextResponse.json({ success: true, data: updatedSheet });
    } catch (error) {
      console.error('[ADMIN SHEETS API] Error updating sheet:', error);
      return NextResponse.json({ success: false, error: 'Failed to update sheet' }, { status: 500 });
    }
  });
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  return withRole(request, ['ADMIN', 'SUPER_ADMIN'], async () => {
    try {
      const sheet = await prisma.sheetMusic.findUnique({ where: { id: params.id } });
      if (!sheet) {
        return NextResponse.json({ success: false, error: 'Sheet not found' }, { status: 404 });
      }

      await prisma.sheetMusic.delete({ where: { id: params.id } });
      await deletePdfFile(sheet.pdfUrl);

      return NextResponse.json({ success: true, message: 'Sheet deleted successfully' });
    } catch (error) {
      console.error('[ADMIN SHEETS API] Error deleting sheet:', error);
      return NextResponse.json({ success: false, error: 'Failed to delete sheet' }, { status: 500 });
    }
  });
}
