import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCorsHeaders } from '@/lib/cors';

export const dynamic = 'force-dynamic';

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin');
  const headers = getCorsHeaders(origin || undefined);
  return new Response(null, { status: 204, headers });
}

export async function GET(request: NextRequest) {
  const origin = request.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin || undefined);

  try {
    const { searchParams } = new URL(request.url);
    
    const search = searchParams.get('search') || '';
    const genres = searchParams.get('genres')?.split(',').filter(Boolean) || [];
    const regions = searchParams.get('regions')?.split(',').filter(Boolean) || [];
    const priceMin = searchParams.get('priceMin') ? parseFloat(searchParams.get('priceMin')!) : undefined;
    const priceMax = searchParams.get('priceMax') ? parseFloat(searchParams.get('priceMax')!) : undefined;
    const isFree = searchParams.get('isFree') === 'true';
    const isForSale = searchParams.get('isForSale') === 'true';
    
    // Динамические фильтры (отдельные колонки + JSON metadata fallback)
    const confession = searchParams.get('confession');
    const language = searchParams.get('language');
    const era = searchParams.get('era') || searchParams.get('eraId');
    const recordingFormat = searchParams.get('recordingFormat') || searchParams.get('format');
    const choirType = searchParams.get('choirType');
    const performanceStyle = searchParams.get('performanceStyle');
    const subcategory = searchParams.get('subcategory');
    const mood = searchParams.get('mood');
    const theme = searchParams.get('theme');
    const instruments = searchParams.get('instruments');
    const style = searchParams.get('style');
    const regionFilter = searchParams.get('regionFilter');

    // Новые фильтры из ТЗ
    const difficulty = searchParams.get('difficulty');         // BEGINNER / INTERMEDIATE / ADVANCED
    const tempo = searchParams.get('tempo');                   // SLOW / MEDIUM / FAST
    const bpmMin = searchParams.get('bpmMin') ? parseInt(searchParams.get('bpmMin')!) : undefined;
    const bpmMax = searchParams.get('bpmMax') ? parseInt(searchParams.get('bpmMax')!) : undefined;
    const yearMin = searchParams.get('yearMin') ? parseInt(searchParams.get('yearMin')!) : undefined;
    const yearMax = searchParams.get('yearMax') ? parseInt(searchParams.get('yearMax')!) : undefined;
    const hasSheets = searchParams.get('hasSheets') === 'true';
    const hasLyrics = searchParams.get('hasLyrics') === 'true';
    const hasMinus = searchParams.get('hasMinus') === 'true';
    const chantType = searchParams.get('chantType');
    const serviceType = searchParams.get('serviceType');

    const sortBy = searchParams.get('sortBy') || 'releaseDate';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '100');
    const skip = (page - 1) * limit;

    const where: any = {
      AND: [
        { status: 'PUBLISHED' }
      ]
    };

    if (search) {
      where.AND.push({
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { artist: { name: { contains: search, mode: 'insensitive' } } },
          { album: { title: { contains: search, mode: 'insensitive' } } }
        ]
      });
    }

    if (genres.length > 0) {
      where.AND.push({
        genres: {
          some: {
            genre: {
              slug: { in: genres }
            }
          }
        }
      });
    }

    if (regions.length > 0) {
      where.AND.push({
        artist: {
          region: { in: regions }
        }
      });
    }

    if (isFree) {
      where.AND.push({ isFree: true });
    }

    if (isForSale) {
      where.AND.push({ isForSale: true });
    }

    // Колонки tracks-таблицы (приоритет, т.к. индексированы)
    if (confession) where.AND.push({ confession });
    if (language) where.AND.push({ language });
    if (era) where.AND.push({ OR: [{ eraId: era }, { era }] });
    if (mood) where.AND.push({ mood });
    if (difficulty && ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'].includes(difficulty)) {
      where.AND.push({ difficulty });
    }
    if (tempo && ['SLOW', 'MEDIUM', 'FAST'].includes(tempo)) {
      where.AND.push({ tempo });
    }
    if (chantType) where.AND.push({ chantType });
    if (serviceType) where.AND.push({ serviceType });

    // BPM-диапазон
    if (bpmMin !== undefined || bpmMax !== undefined) {
      const cond: any = {};
      if (bpmMin !== undefined) cond.gte = bpmMin;
      if (bpmMax !== undefined) cond.lte = bpmMax;
      where.AND.push({ bpm: cond });
    }

    // Диапазон годов (releaseDate или recording_year)
    if (yearMin !== undefined || yearMax !== undefined) {
      const conds: any[] = [];
      if (yearMin !== undefined) {
        conds.push({ releaseDate: { gte: new Date(yearMin, 0, 1) } });
      }
      if (yearMax !== undefined) {
        conds.push({ releaseDate: { lt: new Date(yearMax + 1, 0, 1) } });
      }
      conds.forEach((c) => where.AND.push(c));
    }

    // Наличие нот / текста / минусовки
    if (hasSheets) {
      where.AND.push({ sheetMusic: { isNot: null } } as any);
    }
    if (hasLyrics) {
      where.AND.push({ NOT: { lyrics: null } });
    }
    if (hasMinus) {
      where.AND.push({ instrumentalUrl: { not: '' } });
    }

    // Инструменты (массив строк в колонке instruments или метадате)
    if (instruments) {
      // Колонка instruments — jsonb массив, делаем raw условие
      where.AND.push({
        OR: [
          { instruments: { array_contains: instruments } as any },
          { metadata: { path: ['instruments'], array_contains: [instruments] } },
        ],
      });
    }

    // Остальные — JSON-метаданные (legacy)
    if (recordingFormat) where.AND.push({ metadata: { path: ['format'], equals: recordingFormat } });
    if (choirType) where.AND.push({ metadata: { path: ['choirType'], equals: choirType } });
    if (performanceStyle) where.AND.push({ metadata: { path: ['performanceStyle'], equals: performanceStyle } });
    if (subcategory) where.AND.push({ metadata: { path: ['subcategory'], equals: subcategory } });
    if (theme) where.AND.push({ metadata: { path: ['theme'], equals: theme } });
    if (style) where.AND.push({ metadata: { path: ['style'], equals: style } });
    if (regionFilter) where.AND.push({ metadata: { path: ['region'], equals: regionFilter } });

    if (priceMin !== undefined || priceMax !== undefined) {
      const priceCondition: any = {};
      if (priceMin !== undefined) priceCondition.gte = priceMin;
      if (priceMax !== undefined) priceCondition.lte = priceMax;
      where.AND.push({ price: priceCondition });
    }

    if (where.AND.length === 1) {
      delete where.AND;
    }

    const orderBy: any = {};
    switch (sortBy) {
      case 'popularity':
        orderBy.playCount = sortOrder;
        break;
      case 'likes':
        orderBy.likeCount = sortOrder;
        break;
      case 'price':
        orderBy.price = sortOrder;
        break;
      case 'title':
        orderBy.title = sortOrder;
        break;
      case 'artist':
        orderBy.artist = { name: sortOrder };
        break;
      default:
        orderBy.releaseDate = sortOrder;
    }

    const [tracks, total] = await Promise.all([
      prisma.track.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          artist: {
            select: {
              id: true,
              name: true,
              slug: true,
              avatar: true,
              verified: true,
              region: true
            }
          },
          album: {
            select: {
              id: true,
              title: true,
              slug: true,
              cover: true
            }
          },
          genres: {
            include: {
              genre: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  color: true,
                  icon: true
                }
              }
            }
          }
        }
      }),
      prisma.track.count({ where })
    ]);

    const formattedTracks = tracks.map(track => ({
      id: track.id,
      title: track.title,
      slug: track.slug,
      duration: track.duration,
      audioUrl: track.audioUrl,
      cover: track.cover || track.album?.cover,
      price: track.price,
      isFree: track.isFree,
      isForSale: track.isForSale,
      format: track.format,
      bpm: track.bpm,
      key: track.key,
      playCount: track.playCount,
      likeCount: track.likeCount,
      releaseDate: track.releaseDate,
      isExplicit: track.isExplicit,
      artist: track.artist,
      album: track.album,
      genres: track.genres.map(tg => tg.genre)
    }));

    return NextResponse.json(
      {
        success: true,
        data: {
          tracks: formattedTracks,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
          }
        }
      },
      { headers: corsHeaders }
    );

  } catch (error) {
    console.error('Catalog API Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch catalog' },
      { status: 500, headers: corsHeaders }
    );
  }
}
