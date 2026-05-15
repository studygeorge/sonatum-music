import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const [regions, genres] = await Promise.all([
      prisma.region.findMany({ orderBy: { name: 'asc' } }),
      prisma.genre.findMany({ where: { parentId: null }, orderBy: { name: 'asc' } })
    ]);
    
    // Получить уникальные инструменты из базы
    const instrumentsResult = await prisma.sheetMusic.findMany({
      select: { instrument: true },
      distinct: ['instrument']
    });
    const instruments = instrumentsResult.map(i => i.instrument).filter(Boolean).sort();

    return NextResponse.json({
      success: true,
      data: {
        regions,
        genres,
        instruments,
        difficulties: [
          { value: 'BEGINNER', label: 'Начальный (1-5 класс)' },
          { value: 'INTERMEDIATE', label: 'Средний (6-8 класс)' },
          { value: 'ADVANCED', label: 'Проф. (Училище/ВУЗ)' }
        ]
      }
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
