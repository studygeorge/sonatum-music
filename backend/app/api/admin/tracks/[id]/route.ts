import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/middleware';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: {
    id: string;
  };
}

// GET - Получить трек по ID
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  return withRole(request, ['ADMIN', 'SUPER_ADMIN'], async (req, session) => {
    try {
      const { id } = context.params;

      const track = await prisma.track.findUnique({
        where: { id },
        include: {
          artist: {
            select: {
              id: true,
              name: true,
              slug: true,
              verified: true
            }
          },
          album: {
            select: {
              id: true,
              title: true
            }
          },
          genres: {
            include: {
              genre: true
            }
          },
          tags: {
            include: {
              tag: true
            }
          },
          sheetMusic: true
        }
      });

      if (!track) {
        return NextResponse.json(
          { success: false, error: 'Track not found' },
          { status: 404 }
        );
      }

      // Подтягиваем V2-поля (snake_case колонки которых нет в Prisma-модели)
      const rows: any[] = await prisma.$queryRawUnsafe(
        `SELECT content_type, original_composer, recording_year, recording_place,
                era, mood, instruments, difficulty, tempo,
                allow_donations, allow_exclusive
           FROM tracks WHERE id = $1`,
        id
      );
      const extra = rows?.[0] || {};

      return NextResponse.json({
        success: true,
        data: {
          ...track,
          contentType: extra.content_type,
          originalComposer: extra.original_composer,
          recordingYear: extra.recording_year,
          recordingPlace: extra.recording_place,
          era: extra.era,
          mood: extra.mood,
          instruments: extra.instruments,
          difficulty: extra.difficulty,
          tempo: extra.tempo,
          allowDonations: extra.allow_donations,
          allowExclusive: extra.allow_exclusive,
        },
      });

    } catch (error) {
      console.error('Admin get track error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch track' },
        { status: 500 }
      );
    }
  });
}

// PATCH - Обновить трек
export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  return withRole(request, ['ADMIN', 'SUPER_ADMIN'], async (req, session) => {
    const timestamp = new Date().toISOString();
    const requestId = Math.random().toString(36).substring(7);

    try {
      console.error('='.repeat(100));
      console.error(`[${timestamp}] [UPDATE TRACK API] [${requestId}] 🔄 TRACK UPDATE REQUEST`);

      const { id } = context.params;
      const body = await request.json();

      console.error(`[${timestamp}] [UPDATE TRACK API] [${requestId}] Track ID: ${id}`);
      console.error(`[${timestamp}] [UPDATE TRACK API] [${requestId}] Update data:`, body);

      const existingTrack = await prisma.track.findUnique({
        where: { id },
        include: { sheetMusic: true }
      });

      if (!existingTrack) {
        console.error(`[${timestamp}] [UPDATE TRACK API] [${requestId}] ❌ Track not found`);
        return NextResponse.json(
          { success: false, error: 'Track not found' },
          { status: 404 }
        );
      }

      const {
        title,
        slug,
        duration,
        audioUrl,
        cover,
        lyrics,
        bpm,
        key,
        price,
        isFree,
        isForSale,
        albumId,
        genreIds,
        tagIds,
        status,
        sheetPdfUrl,
        sheetInstrument,
        sheetDifficulty,
        sheetPrice,
        isPublicDomain,
        // Расширенный набор
        instrumentalUrl,
        instrumentalPrice,
        audioType,
        releaseDate,
        // V2-поля
        contentType,
        originalComposer,
        recordingYear,
        recordingPlace,
        era,
        mood,
        instruments,
        difficulty,
        tempo,
        allowDonations,
        allowExclusive,
      } = body;

      // Обновляем основные поля трека
      const updateData: any = {};
      if (title !== undefined) updateData.title = title;
      if (slug !== undefined) updateData.slug = slug;
      if (duration !== undefined) updateData.duration = duration;
      if (audioUrl !== undefined) updateData.audioUrl = audioUrl;
      if (cover !== undefined) updateData.cover = cover;
      if (lyrics !== undefined) updateData.lyrics = lyrics;
      if (bpm !== undefined) updateData.bpm = bpm ? Number(bpm) : null;
      if (key !== undefined) updateData.key = key || null;
      if (price !== undefined) updateData.price = price === '' || price === null ? null : Number(price);
      if (isFree !== undefined) updateData.isFree = !!isFree;
      if (isForSale !== undefined) updateData.isForSale = !!isForSale;
      if (albumId !== undefined) updateData.albumId = albumId;
      if (releaseDate !== undefined) updateData.releaseDate = releaseDate ? new Date(releaseDate) : null;
      if (instrumentalUrl !== undefined) updateData.instrumentalUrl = instrumentalUrl || null;
      if (instrumentalPrice !== undefined) updateData.instrumentalPrice = instrumentalPrice === '' || instrumentalPrice === null ? null : Number(instrumentalPrice);
      if (audioType && ['FULL', 'INSTRUMENTAL', 'BOTH'].includes(audioType)) {
        updateData.audioType = audioType;
      }
      if (status !== undefined) {
        updateData.status = status;
        if (status === 'PUBLISHED' && !existingTrack.publishedAt) {
          updateData.publishedAt = new Date();
        }
      }

      if (sheetPdfUrl !== undefined) {
        if (sheetPdfUrl) {
          updateData.sheetMusic = {
            upsert: {
              create: {
                title: title || existingTrack.title,
                pdfUrl: sheetPdfUrl,
                instrument: sheetInstrument || 'Фортепиано',
                difficulty: sheetDifficulty || 'BEGINNER',
                price: sheetPrice ? Number(sheetPrice) : null,
                isPublicDomain: !!isPublicDomain,
                uploaderId: session.userId,
                verifyStatus: 'APPROVED'
              },
              update: {
                pdfUrl: sheetPdfUrl,
                instrument: sheetInstrument || 'Фортепиано',
                difficulty: sheetDifficulty || 'BEGINNER',
                price: sheetPrice ? Number(sheetPrice) : null,
                isPublicDomain: !!isPublicDomain
              }
            }
          };
        } else if (existingTrack.sheetMusic) {
          updateData.sheetMusic = { delete: true };
        }
      }

      const track = await prisma.track.update({
        where: { id },
        data: updateData
      });

      // V2-поля через raw SQL (snake_case колонки)
      const hasExtras =
        contentType !== undefined || originalComposer !== undefined ||
        recordingYear !== undefined || recordingPlace !== undefined ||
        era !== undefined || mood !== undefined ||
        instruments !== undefined || difficulty !== undefined ||
        tempo !== undefined || allowDonations !== undefined ||
        allowExclusive !== undefined;
      if (hasExtras) {
        await prisma.$executeRawUnsafe(
          `UPDATE tracks SET
             content_type = COALESCE($1, content_type),
             original_composer = COALESCE($2, original_composer),
             recording_year = COALESCE($3, recording_year),
             recording_place = COALESCE($4, recording_place),
             era = COALESCE($5, era),
             mood = COALESCE($6, mood),
             instruments = COALESCE($7::jsonb, instruments),
             difficulty = COALESCE($8, difficulty),
             tempo = COALESCE($9, tempo),
             allow_donations = COALESCE($10, allow_donations),
             allow_exclusive = COALESCE($11, allow_exclusive),
             "updatedAt" = now()
           WHERE id = $12`,
          contentType || null,
          originalComposer || null,
          recordingYear ? Number(recordingYear) : null,
          recordingPlace || null,
          era || null,
          mood || null,
          instruments ? (Array.isArray(instruments) ? JSON.stringify(instruments) : (typeof instruments === 'string' ? JSON.stringify(instruments.split(',').map((s: string) => s.trim()).filter(Boolean)) : JSON.stringify(instruments))) : null,
          difficulty || null,
          tempo || null,
          allowDonations === undefined ? null : !!allowDonations,
          allowExclusive === undefined ? null : !!allowExclusive,
          id
        );
      }

      // Обновляем жанры
      if (genreIds !== undefined) {
        await prisma.trackGenre.deleteMany({
          where: { trackId: id }
        });

        if (genreIds.length > 0) {
          await prisma.trackGenre.createMany({
            data: genreIds.map((genreId: string) => ({
              trackId: id,
              genreId
            }))
          });
        }
      }

      // Обновляем теги
      if (tagIds !== undefined) {
        await prisma.trackTag.deleteMany({
          where: { trackId: id }
        });

        if (tagIds.length > 0) {
          await prisma.trackTag.createMany({
            data: tagIds.map((tagId: string) => ({
              trackId: id,
              tagId
            }))
          });
        }
      }

      const updatedTrack = await prisma.track.findUnique({
        where: { id },
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

      console.error(`[${timestamp}] [UPDATE TRACK API] [${requestId}] ✅ Track updated:`, {
        id: updatedTrack?.id,
        slug: updatedTrack?.slug,
        cover: updatedTrack?.cover
      });
      console.error('='.repeat(100));

      return NextResponse.json({
        success: true,
        data: updatedTrack,
        message: 'Track updated successfully'
      });

    } catch (error) {
      const ts = new Date().toISOString();
      console.error('='.repeat(100));
      console.error(`[${ts}] [UPDATE TRACK API] [${requestId}] ❌ FATAL ERROR`);
      console.error(`[${ts}] [UPDATE TRACK API] [${requestId}] Error:`, error);
      console.error('='.repeat(100));

      return NextResponse.json(
        { success: false, error: 'Failed to update track' },
        { status: 500 }
      );
    }
  });
}

// DELETE - Удалить трек
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  return withRole(request, ['ADMIN', 'SUPER_ADMIN'], async (req, session) => {
    try {
      const { id } = context.params;

      const track = await prisma.track.findUnique({
        where: { id }
      });

      if (!track) {
        return NextResponse.json(
          { success: false, error: 'Track not found' },
          { status: 404 }
        );
      }

      await prisma.track.delete({
        where: { id }
      });

      return NextResponse.json({
        success: true,
        message: 'Track deleted successfully'
      });

    } catch (error) {
      console.error('Admin delete track error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to delete track' },
        { status: 500 }
      );
    }
  });
}