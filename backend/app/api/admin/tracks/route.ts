import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/middleware';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET - Получить все треки для модерации
export async function GET(request: NextRequest) {
  return withRole(request, ['ADMIN', 'SUPER_ADMIN'], async (req, session) => {
    try {
      const { searchParams } = new URL(request.url);
      const status = searchParams.get('status');
      const artistId = searchParams.get('artistId'); // 👈 ДОБАВЛЕНО
      const page = parseInt(searchParams.get('page') || '1');
      const limit = parseInt(searchParams.get('limit') || '20');
      const skip = (page - 1) * limit;

      console.log('[ADMIN TRACKS GET] Query params:', {
        status,
        artistId,
        page,
        limit
      });

      const where: any = {};
      
      if (status && status !== 'undefined' && status !== 'null') {
        where.status = status;
      }

      // 👇 ДОБАВЛЕНО: фильтр по артисту
      if (artistId && artistId !== 'undefined' && artistId !== 'null') {
        where.artistId = artistId;
        console.log('[ADMIN TRACKS GET] Filtering by artistId:', artistId);
      }

      const [tracks, total] = await Promise.all([
        prisma.track.findMany({
          where,
          skip,
          take: limit,
          include: {
            artist: {
              select: {
                id: true,
                name: true,
                slug: true,
                verified: true,
                user: {
                  select: {
                    email: true,
                    username: true
                  }
                }
              }
            },
            album: {
              select: {
                title: true
              }
            },
            genres: {
              include: {
                genre: true
              }
            },
            _count: {
              select: {
                purchases: true,
                likedBy: true
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        }),
        prisma.track.count({ where })
      ]);

      console.log('[ADMIN TRACKS GET] Found tracks:', tracks.length);
      if (artistId) {
        console.log('[ADMIN TRACKS GET] Track artistIds:', tracks.map(t => t.artistId));
      }

      return NextResponse.json({
        success: true,
        data: {
          tracks,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
          }
        }
      });

    } catch (error) {
      console.error('[ADMIN TRACKS GET] Error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch tracks' },
        { status: 500 }
      );
    }
  });
}

// POST - Создать трек
export async function POST(request: NextRequest) {
  return withRole(request, ['ADMIN', 'SUPER_ADMIN'], async (req, session) => {
    const timestamp = new Date().toISOString();
    const requestId = Math.random().toString(36).substring(7);

    try {
      console.error('='.repeat(100));
      console.error(`[${timestamp}] [CREATE TRACK API] [${requestId}] 🎵 NEW TRACK CREATE REQUEST`);

      const body = await request.json();
      
      console.error(`[${timestamp}] [CREATE TRACK API] [${requestId}] ✅ Request body received:`, {
        title: body.title,
        slug: body.slug,
        audioUrl: body.audioUrl,
        cover: body.cover,
        artistId: body.artistId,
        genreIds: body.genreIds,
        status: body.status
      });

      const { 
        title, 
        slug, 
        duration, 
        audioUrl,
        cover,
        artistId, 
        genreIds, 
        status,
        sheetPdfUrl,
        sheetInstrument,
        sheetDifficulty,
        sheetPrice,
        isPublicDomain
      } = body;

      if (!title || !slug || !audioUrl || !artistId) {
        console.error(`[${timestamp}] [CREATE TRACK API] [${requestId}] ❌ Missing required fields`);
        return NextResponse.json(
          { success: false, error: 'Missing required fields: title, slug, audioUrl, artistId' },
          { status: 400 }
        );
      }

      console.error(`[${timestamp}] [CREATE TRACK API] [${requestId}] Creating track in DB...`);

      const track = await prisma.track.create({
        data: {
          title,
          slug,
          duration: duration || 180,
          audioUrl,
          cover: cover || null,
          status: status || 'PUBLISHED',
          artistId,
          publishedAt: status === 'PUBLISHED' ? new Date() : null,
          sheetMusic: sheetPdfUrl ? {
            create: {
              title: title,
              pdfUrl: sheetPdfUrl,
              instrument: sheetInstrument || 'Фортепиано',
              difficulty: sheetDifficulty || 'BEGINNER',
              price: sheetPrice ? Number(sheetPrice) : null,
              isPublicDomain: !!isPublicDomain,
              uploaderId: session.userId,
              verifyStatus: 'APPROVED'
            }
          } : undefined
        }
      });

      console.error(`[${timestamp}] [CREATE TRACK API] [${requestId}] ✅ Track created:`, {
        id: track.id,
        slug: track.slug,
        cover: track.cover
      });

      if (genreIds && genreIds.length > 0) {
        console.error(`[${timestamp}] [CREATE TRACK API] [${requestId}] Adding ${genreIds.length} genres...`);
        await prisma.trackGenre.createMany({
          data: genreIds.map((genreId: string) => ({
            trackId: track.id,
            genreId
          }))
        });
      }

      console.error(`[${timestamp}] [CREATE TRACK API] [${requestId}] ✅ SUCCESS`);
      console.error('='.repeat(100));

      return NextResponse.json({
        success: true,
        data: track,
        message: 'Track created successfully'
      });

    } catch (error) {
      const ts = new Date().toISOString();
      console.error('='.repeat(100));
      console.error(`[${ts}] [CREATE TRACK API] [${requestId}] ❌ FATAL ERROR`);
      console.error(`[${ts}] [CREATE TRACK API] [${requestId}] Error:`, error);
      console.error('='.repeat(100));

      return NextResponse.json(
        { success: false, error: 'Failed to create track' },
        { status: 500 }
      );
    }
  });
}