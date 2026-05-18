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

  // Если у трека есть pendingChanges — накладываем их на ответ, чтобы автор
  // видел свою «черновую» версию в форме редактирования (для публики
  // эти данные не показываются — у публики свой эндпоинт без оверлея).
  const meta = (track.metadata as any) || {};
  const pending = meta.pendingChanges || null;

  const merged: any = {
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
    hasPendingChanges: !!meta.hasPendingChanges,
    pendingSubmittedAt: meta.pendingSubmittedAt || null,
  };
  // Накладываем pending поверх current — автор редактирует свою «черновую» версию
  if (pending) Object.assign(merged, pending);

  return NextResponse.json({ success: true, data: merged }, { headers: cors });
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
  });
  if (!existing) return NextResponse.json({ success: false, error: 'Not found or not yours' }, { status: 404, headers: cors });

  const body = await request.json().catch(() => ({}));

  // Поток A: трек уже PUBLISHED — НЕ трогаем публичные поля, копим всё в
  // metadata.pendingChanges. Аудитория продолжает видеть старую версию пока
  // админ не одобрит. Статус остаётся PUBLISHED, но в metadata появляется
  // hasPendingChanges=true.
  if (existing.status === 'PUBLISHED') {
    const pending: any = {};

    // Базовые поля
    if (typeof body.title === 'string' && body.title.trim() && body.title.trim() !== existing.title) pending.title = body.title.trim();
    if (typeof body.lyrics === 'string' && (body.lyrics || null) !== (existing.lyrics || null)) pending.lyrics = body.lyrics || null;
    if (typeof body.cover === 'string' && (body.cover || null) !== (existing.cover || null)) pending.cover = body.cover || null;
    if (body.price !== undefined) {
      const np = body.price === '' || body.price === null ? null : Number(body.price);
      if ((existing.price ? Number(existing.price) : null) !== np) pending.price = np;
    }
    if (body.instrumentalPrice !== undefined) {
      const np = body.instrumentalPrice === '' || body.instrumentalPrice === null ? null : Number(body.instrumentalPrice);
      if ((existing.instrumentalPrice ? Number(existing.instrumentalPrice) : null) !== np) pending.instrumentalPrice = np;
    }
    if (body.isForSale !== undefined && !!body.isForSale !== !!existing.isForSale) pending.isForSale = !!body.isForSale;
    if (body.isFree !== undefined && !!body.isFree !== !!existing.isFree) pending.isFree = !!body.isFree;
    if (body.bpm !== undefined) {
      const nb = body.bpm ? Number(body.bpm) : null;
      if ((existing.bpm || null) !== nb) pending.bpm = nb;
    }
    if (body.key !== undefined && (body.key || null) !== (existing.key || null)) pending.key = body.key || null;
    if (body.releaseDate !== undefined) pending.releaseDate = body.releaseDate || null;

    // Аудио-файлы и audioType — тоже идут в pending (новый файл не должен заменять
    // старый, пока не одобрен)
    if (typeof body.audioUrl === 'string' && body.audioUrl && body.audioUrl !== existing.audioUrl) {
      pending.audioUrl = body.audioUrl;
    }
    if (body.instrumentalUrl !== undefined && (body.instrumentalUrl || null) !== (existing.instrumentalUrl || null)) {
      pending.instrumentalUrl = body.instrumentalUrl || null;
    }
    if (body.audioType && ['FULL', 'INSTRUMENTAL', 'BOTH'].includes(body.audioType) && body.audioType !== existing.audioType) {
      pending.audioType = body.audioType;
    }

    // V2-поля (raw columns) — снимаем сначала текущие значения, потом diff
    const [cur]: any[] = await prisma.$queryRawUnsafe(
      `SELECT content_type, original_composer, recording_year, recording_place,
              era, mood, instruments, difficulty, tempo,
              allow_donations, allow_exclusive
         FROM tracks WHERE id = $1`,
      params.id
    );
    const v2map: Record<string, string> = {
      contentType: 'content_type', originalComposer: 'original_composer',
      recordingYear: 'recording_year', recordingPlace: 'recording_place',
      era: 'era', mood: 'mood', instruments: 'instruments',
      difficulty: 'difficulty', tempo: 'tempo',
      allowDonations: 'allow_donations', allowExclusive: 'allow_exclusive',
    };
    for (const [camel, snake] of Object.entries(v2map)) {
      if (body[camel] !== undefined) {
        const newVal = body[camel];
        const curVal = cur?.[snake];
        if (JSON.stringify(newVal ?? null) !== JSON.stringify(curVal ?? null)) {
          pending[camel] = newVal;
        }
      }
    }

    // Sheet (ноты) — диф против текущего pdfUrl
    if (body.sheetUrl !== undefined) {
      const sheetExists = await prisma.sheetMusic.findUnique({ where: { trackId: params.id } });
      const cur = sheetExists?.pdfUrl || null;
      const next = body.sheetUrl || null;
      if (cur !== next) pending.sheetUrl = next;
    }

    // Записываем в metadata.pendingChanges, не трогая публичные поля
    const existingMeta = (existing.metadata as any) || {};
    const updatedMeta = {
      ...existingMeta,
      pendingChanges: Object.keys(pending).length > 0 ? pending : null,
      hasPendingChanges: Object.keys(pending).length > 0,
      pendingSubmittedAt: Object.keys(pending).length > 0 ? new Date().toISOString() : null,
    };

    const track = await prisma.track.update({
      where: { id: params.id },
      data: { metadata: updatedMeta },
    });

    return NextResponse.json(
      {
        success: true,
        data: track,
        pendingChanges: pending,
        message: Object.keys(pending).length > 0
          ? 'Изменения отправлены на повторную модерацию. Опубликованная версия пока не меняется.'
          : 'Нет изменений',
      },
      { headers: cors }
    );
  }

  // Поток B: трек в DRAFT / PENDING / REJECTED / ARCHIVED — публики нет,
  // правки применяем сразу.
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

  if (typeof body.audioUrl === 'string' && body.audioUrl) data.audioUrl = body.audioUrl;
  if (body.instrumentalUrl !== undefined) data.instrumentalUrl = body.instrumentalUrl || null;
  if (body.audioType && ['FULL', 'INSTRUMENTAL', 'BOTH'].includes(body.audioType)) {
    data.audioType = body.audioType;
  } else if (body.audioUrl || body.instrumentalUrl !== undefined) {
    const hasFull = !!(body.audioUrl ?? existing.audioUrl);
    const hasInstr = !!(body.instrumentalUrl !== undefined ? body.instrumentalUrl : existing.instrumentalUrl);
    data.audioType = hasFull && hasInstr ? 'BOTH' : hasInstr && !hasFull ? 'INSTRUMENTAL' : 'FULL';
  }

  const track = await prisma.track.update({
    where: { id: params.id },
    data,
  });

  // V2-поля через raw SQL
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
         "updatedAt" = now()
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
