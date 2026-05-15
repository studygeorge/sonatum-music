import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';
    const instrument = searchParams.get('instrument');
    const difficulty = searchParams.get('difficulty');
    const genreId = searchParams.get('genreId');
    const regionId = searchParams.get('regionId');
    const eraId = searchParams.get('eraId');
    
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    // Base Where clause
    const where: any = {
      verifyStatus: 'APPROVED',
      ...(q ? {
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { composer: { name: { contains: q, mode: 'insensitive' } } }
        ]
      } : {})
    };

    if (instrument) where.instrument = instrument;
    if (difficulty) where.difficulty = difficulty;
    
    if (genreId || regionId) {
      where.composer = {};
      if (regionId) where.composer.regionId = regionId;
      if (genreId) {
        where.composer.genres = { some: { genreId } };
      }
    }
    
    if (eraId) {
      where.track = { eraId };
    }

    const [items, total] = await Promise.all([
      prisma.sheetMusic.findMany({
        where,
        include: {
          composer: { select: { id: true, name: true, slug: true, avatar: true } },
          uploader: { select: { id: true, username: true, nickname: true, firstName: true, lastName: true } },
          track: { select: { slug: true } }
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.sheetMusic.count({ where })
    ]);

    return NextResponse.json({
      success: true,
      data: items,
      pagination: {
        page, limit, total, totalPages: Math.ceil(total / limit)
      }
    });

  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
