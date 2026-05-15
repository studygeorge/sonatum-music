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
    
    // Динамические фильтры (JSON metadata и колонки)
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

    // Применение динамических фильтров для колонок
    if (confession) where.AND.push({ confession });
    if (language) where.AND.push({ language });
    if (era) where.AND.push({ eraId: era });
    
    // Применение JSON-метаданных:
    if (recordingFormat) where.AND.push({ metadata: { path: ['format'], equals: recordingFormat } });
    if (choirType) where.AND.push({ metadata: { path: ['choirType'], equals: choirType } });
    if (performanceStyle) where.AND.push({ metadata: { path: ['performanceStyle'], equals: performanceStyle } });
    if (subcategory) where.AND.push({ metadata: { path: ['subcategory'], equals: subcategory } });
    if (mood) where.AND.push({ metadata: { path: ['mood'], equals: mood } });
    if (theme) where.AND.push({ metadata: { path: ['theme'], equals: theme } });
    if (style) where.AND.push({ metadata: { path: ['style'], equals: style } });
    if (regionFilter) where.AND.push({ metadata: { path: ['region'], equals: regionFilter } });
    
    // Инструменты в виде массива в JSON: используем фильтрацию по строке, если Prisma не может искать внутри массивов jsonb
    // Если нужно строго, то array_contains не работает напрямую в equals. Мы можем использовать array_contains в Prisma >= 4, если поддерживается
    if (instruments) {
      where.AND.push({
        metadata: { path: ['instruments'], array_contains: [instruments] }
      });
    }

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
