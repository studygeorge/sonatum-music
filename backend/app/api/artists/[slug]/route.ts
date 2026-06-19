import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AuthService } from '@/lib/auth';
import { isProfiAuthor } from '@/lib/subscription';

export const dynamic = 'force-dynamic';

async function getUserId(request: NextRequest): Promise<string | null> {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  try {
    const session = await AuthService.validateSession(auth.substring(7));
    return session?.userId || null;
  } catch {
    return null;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const artist = await prisma.artist.findUnique({
      where: { slug: params.slug },
      include: {
        user: { select: { username: true, createdAt: true } },
        genres: {
          include: {
            genre: { select: { id: true, name: true, slug: true, color: true, icon: true } },
          },
        },
        tracks: {
          where: { status: 'PUBLISHED' },
          orderBy: { playCount: 'desc' },
          include: {
            artist: { select: { id: true, name: true, slug: true, avatar: true, verified: true } },
            album: { select: { id: true, title: true, slug: true, cover: true } },
            genres: {
              include: {
                genre: { select: { id: true, name: true, slug: true, color: true, icon: true } },
              },
            },
          },
        },
        albums: {
          where: { status: 'PUBLISHED' },
          orderBy: { releaseDate: 'desc' },
          include: { _count: { select: { tracks: true } } },
        },
        _count: { select: { tracks: true, albums: true } },
      },
    });

    if (!artist) {
      return NextResponse.json(
        { success: false, error: 'Artist not found' },
        { status: 404 }
      );
    }

    const totalPlays = await prisma.track.aggregate({
      where: { artistId: artist.id, status: 'PUBLISHED' },
      _sum: { playCount: true },
    });

    // Если юзер залогинен — проверяем подписку.
    let isFollowing = false;
    const userId = await getUserId(request);
    if (userId) {
      const follow = await (prisma as any).artistFollow.findUnique({
        where: { userId_artistId: { userId, artistId: artist.id } },
      }).catch(() => null);
      isFollowing = !!follow;
    }

    // ПРОФИ-статус автора (бейдж в публичном профиле)
    const isProfi = artist.userId ? await isProfiAuthor(artist.userId) : false;

    const transformedArtist = {
      ...artist,
      genres: artist.genres.map(ag => ag.genre),
      tracks: artist.tracks.map(track => ({
        ...track,
        genres: track.genres.map(tg => tg.genre),
      })),
      totalPlays: totalPlays._sum.playCount || 0,
      isFollowing,
      isProfi,
    };

    return NextResponse.json({ success: true, data: transformedArtist });
  } catch (error) {
    console.error('[API ARTIST] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch artist' },
      { status: 500 }
    );
  }
}
