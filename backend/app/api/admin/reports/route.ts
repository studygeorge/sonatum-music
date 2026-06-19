import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/middleware';

async function ensureStaff(session: any) {
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  return user && ['ADMIN', 'SUPER_ADMIN', 'MODERATOR'].includes(user.role) ? user : null;
}

export async function GET(request: NextRequest) {
  return withAuth(request, async (req, session) => {
    try {
      if (!(await ensureStaff(session))) {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
      }

      const { searchParams } = new URL(req.url);
      const status = searchParams.get('status') || 'PENDING'; // PENDING, RESOLVED, REJECTED

      const reports = await prisma.report.findMany({
        where: { status: status as any },
        include: {
          reporter: { select: { id: true, firstName: true, lastName: true, username: true } },
          track: { select: { id: true, title: true, slug: true } },
          comment: { select: { id: true, content: true } },
          reportedUser: { select: { id: true, username: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      return NextResponse.json({ success: true, data: reports });
    } catch (error) {
      console.error('[ADMIN_REPORTS_GET]', error);
      return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
  });
}

export async function PATCH(request: NextRequest) {
  return withAuth(request, async (req, session) => {
    try {
      if (!(await ensureStaff(session))) {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
      }

      const body = await req.json().catch(() => ({}));
      const { id, status } = body || {};
      if (!id || !['PENDING', 'RESOLVED', 'REJECTED'].includes(status)) {
        return NextResponse.json({ success: false, error: 'Некорректные данные' }, { status: 400 });
      }

      await prisma.report.update({ where: { id }, data: { status: status as any } });
      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('[ADMIN_REPORTS_PATCH]', error);
      return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
  });
}
