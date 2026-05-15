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
        { slug: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [artists, total] = await Promise.all([
      prisma.artist.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: {
            select: {
              email: true,
              username: true
            }
          },
          _count: {
            select: { 
              tracks: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.artist.count({ where })
    ]);

    return NextResponse.json({
      success: true,
      data: {
        artists,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('[ADMIN ARTISTS GET] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка загрузки артистов' },
      { status: 500 }
    );
  }
}

async function handlePOST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, slug, bio, avatar, verified, userId } = body;

    if (!name || !slug) {
      return NextResponse.json(
        { success: false, error: 'Название и slug обязательны' },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Необходимо указать пользователя (userId)' },
        { status: 400 }
      );
    }

    // Проверка существования пользователя
    const userExists = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!userExists) {
      return NextResponse.json(
        { success: false, error: 'Пользователь не найден' },
        { status: 404 }
      );
    }

    // Проверка, что у пользователя еще нет профиля артиста
    const existingArtist = await prisma.artist.findUnique({
      where: { userId }
    });

    if (existingArtist) {
      return NextResponse.json(
        { success: false, error: 'У этого пользователя уже есть профиль артиста' },
        { status: 400 }
      );
    }

    // Проверка уникальности slug
    const slugExists = await prisma.artist.findUnique({
      where: { slug }
    });

    if (slugExists) {
      return NextResponse.json(
        { success: false, error: 'Артист с таким slug уже существует' },
        { status: 400 }
      );
    }

    const artist = await prisma.artist.create({
      data: {
        userId,
        name,
        slug,
        bio: bio || null,
        avatar: avatar || null,
        verified: verified || false
      },
      include: {
        user: {
          select: {
            email: true,
            username: true
          }
        },
        _count: {
          select: { 
            tracks: true
          }
        }
      }
    });

    // Обновить роль пользователя на ARTIST
    await prisma.user.update({
      where: { id: userId },
      data: { role: 'ARTIST' }
    });

    return NextResponse.json({
      success: true,
      data: artist
    });
  } catch (error) {
    console.error('[ADMIN ARTISTS POST] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка создания артиста' },
      { status: 500 }
    );
  }
}

export const GET = withRole(handleGET, 'ADMIN', 'SUPER_ADMIN');
export const POST = withRole(handlePOST, 'ADMIN', 'SUPER_ADMIN');
