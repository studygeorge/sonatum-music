import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/middleware';
import { prisma } from '@/lib/prisma';

// Создать трек (только артисты)
export async function POST(request: NextRequest) {
  return withRole(request, ['ARTIST', 'ADMIN', 'SUPER_ADMIN'], async (req, session) => {
    try {
      const body = await request.json();
      const {
        title,
        duration,
        audioUrl,
        cover,
        lyrics,
        bpm,
        key,
        price,
        isFree,
        isForSale,
        format,
        albumId,
        genreIds,
        tagIds,
        releaseDate
      } = body;

      if (!title || !duration || !audioUrl) {
        return NextResponse.json(
          { success: false, error: 'Missing required fields' },
          { status: 400 }
        );
      }

      const artist = await prisma.artist.findUnique({
        where: { userId: session.userId }
      });

      if (!artist) {
        return NextResponse.json(
          { success: false, error: 'Artist profile not found' },
          { status: 404 }
        );
      }

      const slug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`;

      const track = await prisma.track.create({
        data: {
          title,
          slug,
          duration,
          audioUrl,
          cover,
          lyrics,
          bpm,
          key,
          price,
          isFree: isFree || false,
          isForSale: isForSale || false,
          format,
          artistId: artist.id,
          albumId,
          releaseDate: releaseDate ? new Date(releaseDate) : null,
          status: 'PENDING'
        }
      });

      if (genreIds && genreIds.length > 0) {
        await prisma.trackGenre.createMany({
          data: genreIds.map((genreId: string) => ({
            trackId: track.id,
            genreId
          }))
        });
      }

      if (tagIds && tagIds.length > 0) {
        await prisma.trackTag.createMany({
          data: tagIds.map((tagId: string) => ({
            trackId: track.id,
            tagId
          }))
        });
      }

      const fullTrack = await prisma.track.findUnique({
        where: { id: track.id },
        include: {
          artist: true,
          album: true,
          genres: {
            include: { genre: true }
          },
          tags: {
            include: { tag: true }
          }
        }
      });

      return NextResponse.json({
        success: true,
        data: fullTrack
      }, { status: 201 });

    } catch (error) {
      console.error('Create track error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to create track' },
        { status: 500 }
      );
    }
  });
}
