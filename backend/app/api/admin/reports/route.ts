import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/middleware';

export async function GET(request: NextRequest) {
  return withAuth(request, async (req, session) => {
    try {
      const user = await prisma.user.findUnique({ where: { id: session.userId } });
      if (!user || !['ADMIN', 'MODERATOR'].includes(user.role)) {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
      }

      const { searchParams } = new URL(req.url);
      const status = searchParams.get('status') || 'PENDING'; // PENDING, RESOLVED, DISMISSED

      const reports = await prisma.report.findMany({
        where: { status: status as any },
        include: {
          reporter: { select: { id: true, firstName: true, lastName: true, username: true } },
          // optional relations depending on what was reported
          track: { select: { id: true, title: true } },
          comment: { select: { id: true, content: true } },
          reportedUser: { select: { id: true, username: true } }
        },
        orderBy: { createdAt: 'desc' }
      });

      return NextResponse.json({ success: true, data: reports });
    } catch (error) {
      console.error('[ADMIN_REPORTS_GET]', error);
      return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
  });
}
