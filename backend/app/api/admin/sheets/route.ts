import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/middleware';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return withRole(request, ['ADMIN', 'SUPER_ADMIN'], async () => {
    try {
      const { searchParams } = new URL(request.url);
      const page = parseInt(searchParams.get('page') || '1');
      const limit = parseInt(searchParams.get('limit') || '20');
      const skip = (page - 1) * limit;

      const [sheets, total] = await Promise.all([
        prisma.sheetMusic.findMany({
          skip,
          take: limit,
          include: {
            composer: { select: { id: true, name: true, slug: true } },
            uploader: { select: { id: true, username: true, email: true } },
            track: { select: { id: true, title: true } }
          },
          orderBy: { createdAt: 'desc' }
        }),
        prisma.sheetMusic.count()
      ]);

      return NextResponse.json({
        success: true,
        data: {
          sheets,
          pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
        }
      });
    } catch (error) {
      console.error('[ADMIN SHEETS API] Error fetched sheets:', error);
      return NextResponse.json({ success: false, error: 'Failed to fetch sheets' }, { status: 500 });
    }
  });
}

export async function POST(request: NextRequest) {
  return withRole(request, ['ADMIN', 'SUPER_ADMIN'], async (req, session) => {
    try {
      const body = await request.json();
      const { title, pdfUrl, instrument, difficulty, price, composerId, trackId, isPublicDomain } = body;

      if (!title || !pdfUrl || !instrument) {
        return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
      }

      const sheet = await prisma.sheetMusic.create({
        data: {
          title,
          pdfUrl,
          instrument,
          difficulty: difficulty || 'BEGINNER',
          price: price ? Number(price) : null,
          isPublicDomain: isPublicDomain || false,
          composerId: composerId || null,
          trackId: trackId || null,
          uploaderId: session.userId,
          verifyStatus: 'APPROVED'
        }
      });

      return NextResponse.json({ success: true, data: sheet });
    } catch (error) {
      console.error('[ADMIN SHEETS API] Error creating sheet:', error);
      return NextResponse.json({ success: false, error: 'Failed to create sheet' }, { status: 500 });
    }
  });
}
