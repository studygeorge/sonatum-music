import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withRole } from '@/lib/auth';

async function handleGET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';
    
    const skip = (page - 1) * limit;

    const where: any = {};
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [genres, total] = await Promise.all([
      prisma.genre.findMany({
        where,
        skip,
        take: limit,
        include: {
          _count: {
            select: { tracks: true }
          }
        },
        orderBy: { name: 'asc' }
      }),
      prisma.genre.count({ where })
    ]);

    console.log('[ADMIN GENRES GET] Loaded genres:', genres.length);

    return NextResponse.json({
      success: true,
      data: {
        genres,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error: any) {
    console.error('[ADMIN GENRES GET] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Ошибка загрузки жанров' },
      { status: 500 }
    );
  }
}

async function handlePOST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, slug, description, color, icon } = body;

    console.log('[ADMIN GENRES POST] Data:', { name, slug, description, color, icon });

    if (!name || !slug) {
      return NextResponse.json(
        { success: false, error: 'Название и slug обязательны' },
        { status: 400 }
      );
    }

    // Проверка уникальности slug
    const existingGenre = await prisma.genre.findUnique({
      where: { slug }
    });

    if (existingGenre) {
      return NextResponse.json(
        { success: false, error: 'Жанр с таким slug уже существует' },
        { status: 400 }
      );
    }

    const genre = await prisma.genre.create({
      data: {
        name,
        slug,
        description: description || null,
        color: color || null,
        icon: icon || null
      },
      include: {
        _count: {
          select: { tracks: true }
        }
      }
    });

    console.log('[ADMIN GENRES POST] Success:', genre.name);

    return NextResponse.json({
      success: true,
      data: genre
    });
  } catch (error: any) {
    console.error('[ADMIN GENRES POST] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Ошибка создания жанра' },
      { status: 500 }
    );
  }
}

export const GET = withRole(handleGET, 'ADMIN', 'SUPER_ADMIN');
export const POST = withRole(handlePOST, 'ADMIN', 'SUPER_ADMIN');