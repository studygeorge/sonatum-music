import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withRole } from '@/lib/auth';

async function handlePATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await req.json();
    const { name, slug, description, color, icon } = body;

    console.log('[ADMIN GENRES PATCH] ID:', id);
    console.log('[ADMIN GENRES PATCH] Body:', body);

    if (!name || !slug) {
      return NextResponse.json(
        { success: false, error: 'Название и slug обязательны' },
        { status: 400 }
      );
    }

    // Проверка существования жанра
    const existingGenre = await prisma.genre.findUnique({
      where: { id }
    });

    if (!existingGenre) {
      console.log('[ADMIN GENRES PATCH] Genre not found:', id);
      return NextResponse.json(
        { success: false, error: 'Жанр не найден' },
        { status: 404 }
      );
    }

    // Проверка уникальности slug (если изменился)
    if (slug !== existingGenre.slug) {
      const duplicateSlug = await prisma.genre.findUnique({
        where: { slug }
      });

      if (duplicateSlug) {
        return NextResponse.json(
          { success: false, error: 'Жанр с таким slug уже существует' },
          { status: 400 }
        );
      }
    }

    const updateData: any = {
      name,
      slug,
      description: description || null,
      color: color || null,
      icon: icon || null
    };

    const genre = await prisma.genre.update({
      where: { id },
      data: updateData,
      include: {
        _count: {
          select: { tracks: true }
        }
      }
    });

    console.log('[ADMIN GENRES PATCH] Success:', genre.name);

    return NextResponse.json({
      success: true,
      data: genre
    });
  } catch (error: any) {
    console.error('[ADMIN GENRES PATCH] Error:', error);
    
    // Обработка Prisma ошибок
    if (error.code === 'P2025') {
      return NextResponse.json(
        { success: false, error: 'Жанр не найден' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: false, error: error.message || 'Ошибка обновления жанра' },
      { status: 500 }
    );
  }
}

async function handleDELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    console.log('[ADMIN GENRES DELETE] Starting deletion for ID:', id);

    // Проверяем существование жанра и количество связанных треков
    const existingGenre = await prisma.genre.findUnique({
      where: { id },
      include: {
        _count: {
          select: { tracks: true }
        }
      }
    });

    console.log('[ADMIN GENRES DELETE] Found genre:', existingGenre ? existingGenre.name : 'NOT FOUND');

    if (!existingGenre) {
      console.log('[ADMIN GENRES DELETE] Genre does not exist:', id);
      return NextResponse.json(
        { success: false, error: 'Жанр не найден или уже удалён' },
        { status: 404 }
      );
    }

    const tracksCount = existingGenre._count.tracks;
    console.log('[ADMIN GENRES DELETE] Tracks count:', tracksCount);

    // Проверка связанных треков
    if (tracksCount > 0) {
      console.log('[ADMIN GENRES DELETE] Cannot delete: genre has tracks');
      return NextResponse.json(
        { 
          success: false, 
          error: `Невозможно удалить жанр: используется в ${tracksCount} треках. Сначала удалите или измените жанр у этих треков.` 
        },
        { status: 400 }
      );
    }

    // Удаление жанра
    console.log('[ADMIN GENRES DELETE] Attempting to delete genre:', id);
    
    await prisma.genre.delete({
      where: { id }
    });

    console.log('[ADMIN GENRES DELETE] ✅ Success: Genre deleted');

    return NextResponse.json({
      success: true,
      data: { message: 'Жанр успешно удалён' }
    });

  } catch (error: any) {
    console.error('[ADMIN GENRES DELETE] ❌ Error:', error);
    console.error('[ADMIN GENRES DELETE] Error code:', error.code);
    console.error('[ADMIN GENRES DELETE] Error message:', error.message);

    // Обработка специфичных Prisma ошибок
    if (error.code === 'P2025') {
      // Запись не найдена (уже удалена)
      console.log('[ADMIN GENRES DELETE] P2025: Record does not exist');
      return NextResponse.json(
        { success: false, error: 'Жанр не найден или уже удалён' },
        { status: 404 }
      );
    }

    if (error.code === 'P2003') {
      // Foreign key constraint failed
      console.log('[ADMIN GENRES DELETE] P2003: Foreign key constraint');
      return NextResponse.json(
        { success: false, error: 'Невозможно удалить жанр: существуют связанные записи' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: error.message || 'Ошибка удаления жанра' },
      { status: 500 }
    );
  }
}

export const PATCH = withRole(handlePATCH, 'ADMIN', 'SUPER_ADMIN');
export const DELETE = withRole(handleDELETE, 'ADMIN', 'SUPER_ADMIN');