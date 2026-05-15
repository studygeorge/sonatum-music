import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, AuthUser } from '@/lib/auth';
import { getCorsHeaders } from '@/lib/cors';
import { uploadFile } from '@/lib/s3'; // Представим, что есть такой метод загрузки
import { SheetDifficulty } from '@prisma/client';

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request.headers.get('origin') || undefined),
  });
}

// Получение списка нот
export async function GET(request: NextRequest) {
  const origin = request.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin || undefined);

  try {
    const { searchParams } = new URL(request.url);
    const instrument = searchParams.get('instrument');
    const difficulty = searchParams.get('difficulty') as SheetDifficulty;
    const composerId = searchParams.get('composerId');

    const where: any = {};
    if (instrument) where.instrument = instrument;
    if (difficulty) where.difficulty = difficulty;
    if (composerId) where.composerId = composerId;

    const sheets = await prisma.sheetMusic.findMany({
      where,
      include: {
        composer: { select: { name: true, slug: true } },
        track: { select: { title: true, slug: true, cover: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    return NextResponse.json({ success: true, data: sheets }, { headers: corsHeaders });
  } catch (error) {
    console.error('[SHEETS_GET_ERROR]', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка получения нотного архива' },
      { status: 500, headers: corsHeaders }
    );
  }
}

// Загрузка новых нот
async function postHandler(request: NextRequest, user: AuthUser) {
  const origin = request.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin || undefined);

  try {
    const formData = await request.formData();
    const title = formData.get('title') as string;
    const instrument = formData.get('instrument') as string;
    const difficulty = formData.get('difficulty') as SheetDifficulty || 'BEGINNER';
    const trackId = formData.get('trackId') as string;
    const pdfFile = formData.get('file');

    if (!title || !instrument || !pdfFile) {
      return NextResponse.json(
        { success: false, error: 'Заполните обязательные поля и прикрепите PDF' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Mock PDF upload - в реальном проекте здесь будет загрузка
    const pdfUrl = `https://storage.sonatum.ru/sheets/${Date.now()}_sheet.pdf`;

    const sheet = await prisma.sheetMusic.create({
      data: {
        title,
        instrument,
        difficulty,
        pdfUrl,
        trackId: trackId ? trackId.toString() : null,
        uploaderId: user.id.toString(),
        isPublicDomain: formData.get('isPublicDomain') === 'true',
        price: formData.get('price') ? Number(formData.get('price')) : null
      }
    });

    return NextResponse.json({ success: true, data: sheet }, { headers: corsHeaders });
  } catch (error) {
    console.error('[SHEETS_POST_ERROR]', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка загрузки нот' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export const POST = requireAuth(postHandler);
