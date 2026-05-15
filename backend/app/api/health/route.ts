import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    
    const stats = await Promise.all([
      prisma.user.count(),
      prisma.artist.count(),
      prisma.track.count({ where: { status: 'PUBLISHED' } }),
      prisma.genre.count(),
    ]);

    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      database: 'connected',
      stats: {
        users: stats[0],
        artists: stats[1],
        tracks: stats[2],
        genres: stats[3],
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        timestamp: new Date().toISOString(),
        database: 'disconnected',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 503 }
    );
  }
}
