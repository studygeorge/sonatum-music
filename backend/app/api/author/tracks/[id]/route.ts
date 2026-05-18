import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AuthService } from '@/lib/auth';
import { getCorsHeaders } from '@/lib/cors';

export const dynamic = 'force-dynamic';

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request.headers.get('origin') || undefined),
  });
}

// GET — один трек со всеми расширенными V2-полями (для редактирования автором)
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const session = await getSession(request);
  if (!session) return NextResponse.json({ success: false, error: 'Auth' }, { status: 401, headers: cors });

  const artist = await prisma.artist.findUnique({ where: { userId: session.userId }, select: { id: true } });
  if (!artist) return NextResponse.json({ success: false, error: 'No artist profile' }, { status: 404, headers: cors });

  const track = await prisma.track.findFirst({
    where: { id: params.id, artistId: artist.id },
  });
  if (!track) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404, headers: cors });

  // Подтягиваем V2-поля сырым запросом (их нет в Prisma-модели)
  const rows: any[] = await prisma.$queryRawUnsafe(
    `SELECT content_type, original_composer, recording_year, recording_place,
            era, mood, instruments, difficulty, tempo,
            has_minus, minus_audio_url, minus_price,
            rights_confirmed, allow_donations, allow_exclusive
       FROM tracks WHERE id = $1`,
    params.id
  );
  const extra = rows?.[0] || {};

  // Ноты, если есть
  const sheet = await prisma.sheetMusic.findUnique({ where: { trackId: params.id } });

  return NextResponse.json(
    {
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
        hasMinus: extra.has_minus,
        minusAudioUrl: extra.minus_audio_url,
        minusPrice: extra.minus_price,
        rightsConfirmed: extra.rights_confirmed,
        allowDonations: extra.allow_donations,
        allowExclusive: extra.allow_exclusive,
        sheetUrl: sheet?.pdfUrl || null,
        sheetMusicId: sheet?.id || null,
      },
    },
    { headers: cors }
  );
}

// PATCH — обновление трека самим автором.
// Разрешено менять: title, lyrics, cover, price, isForSale, isFree,
// instrumentalPrice, releaseDate. Статус автоматически сбрасывается в PENDING,
// чтобы прошёл повторную модерацию (если редактирование меняет основные поля).
// Запрещено менять: status, audioUrl, instrumentalUrl, audioType (это через
// отдельные upload-эндпоинты).
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const session = await getSession(request);
  if (!session) return NextResponse.json({ success: false, error: 'Auth' }, { status: 401, headers: cors });

  const artist = await prisma.artist.findUnique({ where: { userId: session.userId }, select: { id: true } });
  if (!artist) return NextResponse.json({ success: false, error: 'No artist profile' }, { status: 404, headers: cors });

  const existing: any = await prisma.track.findFirst({
    where: { id: params.id, artistId: artist.id },
    select: { id: true, status: true, audioUrl: true, instrumentalUrl: true },
  });
  if (!existing) return NextResponse.json({ success: false, error: 'Not found or not yours' }, { status: 404, headers: cors });

  const body = await request.json().catch(() => ({}));

  // Только разрешённые Prisma-поля
  const data: any = {};
  if (typeof body.title === 'string' && body.title.trim()) data.title = body.title.trim();
  if (typeof body.lyrics === 'string') data.lyrics = body.lyrics || null;
  if (typeof body.cover === 'string') data.cover = body.cover || null;
  if (body.price !== undefined) data.price = body.price === '' || body.price === null ? null : Number(body.price);
  if (body.instrumentalPrice !== undefined) data.instrumentalPrice = body.instrumentalPrice === '' || body.instrumentalPrice === null ? null : Number(body.instrumentalPrice);
  if (body.isForSale !== undefined) data.isForSale = !!body.isForSale;
  if (body.isFree !== undefined) data.isFree = !!body.isFree;
  if (body.releaseDate !== undefined) data.releaseDate = body.releaseDate ? new Date(body.releaseDate) : null;
  if (body.bpm !== undefined) data.bpm = body.bpm ? Number(body.bpm) : null;
  if (body.key !== undefined) data.key = body.key || null;

  // Аудио-файлы — автор может заменить основной файл или минусовку
  if (typeof body.audioUrl === 'string' && body.audioUrl) data.audioUrl = body.audioUrl;
  if (body.instrumentalUrl !== undefined) data.instrumentalUrl = body.instrumentalUrl || null;
  if (body.audioType && ['FULL', 'INSTRUMENTAL', 'BOTH'].includes(body.audioType)) {
    data.audioType = body.audioType;
  } else if (body.audioUrl || body.instrumentalUrl !== undefined) {
    // Авто-определение типа от наличия файлов
    const hasFull = !!(body.audioUrl ?? existing.audioUrl);
    const hasInstr = !!(body.instrumentalUrl !== undefined ? body.instrumentalUrl : existing.instrumentalUrl);
    data.audioType = hasFull && hasInstr ? 'BOTH' : hasInstr && !hasFull ? 'INSTRUMENTAL' : 'FULL';
  }

  // Если редактируется опубликованный трек — отправляем обратно на модерацию
  if (existing.status === 'PUBLISHED' && Object.keys(data).length > 0) {
    data.status = 'PENDING';
  }

  const track = await prisma.track.update({
    where: { id: params.id },
    data,
  });

  // V2-поля через raw SQL — те же что в /api/tracks/[id]/metadata
  const hasExtras =
    body.contentType !== undefined || body.originalComposer !== undefined ||
    body.recordingYear !== undefined || body.recordingPlace !== undefined ||
    body.era !== undefined || body.mood !== undefined ||
    body.instruments !== undefined || body.difficulty !== undefined ||
    body.tempo !== undefined || body.allowDonations !== undefined ||
    body.allowExclusive !== undefined;

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
         updated_at = now()
       WHERE id = $12`,
      body.contentType || null,
      body.originalComposer || null,
      body.recordingYear || null,
      body.recordingPlace || null,
      body.era || null,
      body.mood || null,
      body.instruments ? JSON.stringify(body.instruments) : null,
      body.difficulty || null,
      body.tempo || null,
      body.allowDonations ?? null,
      body.allowExclusive ?? null,
      params.id
    );
  }

  // Ноты (PDF) — добавить или обновить
  if (body.sheetUrl !== undefined) {
    const sheetExists = await prisma.sheetMusic.findUnique({ where: { trackId: params.id } });
    if (body.sheetUrl) {
      if (sheetExists) {
        await prisma.sheetMusic.update({
          where: { trackId: params.id },
          data: { pdfUrl: body.sheetUrl },
        });
      } else {
        await prisma.sheetMusic.create({
          data: {
            trackId: params.id,
            pdfUrl: body.sheetUrl,
            title: track.title,
            composerId: track.artistId,
            uploaderId: session.userId,
            instrument: 'Не указан',
          },
        });
      }
    } else if (sheetExists) {
      // Пустой URL = удалить ноты
      await prisma.sheetMusic.delete({ where: { trackId: params.id } });
    }
  }

  return NextResponse.json({ success: true, data: track }, { headers: cors });
}

// DELETE — автор может удалить свой собственный трек.
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const session = await getSession(request);
  if (!session) return NextResponse.json({ success: false, error: 'Auth' }, { status: 401, headers: cors });

  const artist = await prisma.artist.findUnique({ where: { userId: session.userId }, select: { id: true } });
  if (!artist) return NextResponse.json({ success: false, error: 'No artist profile' }, { status: 404, headers: cors });

  const existing = await prisma.track.findFirst({
    where: { id: params.id, artistId: artist.id },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ success: false, error: 'Not found or not yours' }, { status: 404, headers: cors });

  await prisma.track.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true }, { headers: cors });
}

async function getSession(request: NextRequest) {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return AuthService.validateSession(auth.substring(7));
}
