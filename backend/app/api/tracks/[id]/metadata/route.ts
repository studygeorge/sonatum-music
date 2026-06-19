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

// PATCH /api/tracks/[id]/metadata — обновляет расширенные поля трека (V2 fields)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) {
    return NextResponse.json(
      { success: false, error: 'Требуется авторизация' },
      { status: 401, headers: cors }
    );
  }
  const session = await AuthService.validateSession(auth.substring(7));
  if (!session) {
    return NextResponse.json(
      { success: false, error: 'Сессия истекла' },
      { status: 401, headers: cors }
    );
  }

  const track = await prisma.track.findUnique({
    where: { id: params.id },
    include: { artist: true },
  });
  if (!track) {
    return NextResponse.json(
      { success: false, error: 'Трек не найден' },
      { status: 404, headers: cors }
    );
  }
  if (track.artist.userId !== session.userId && session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN') {
    return NextResponse.json(
      { success: false, error: 'Нет прав' },
      { status: 403, headers: cors }
    );
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Невалидный JSON' },
      { status: 400, headers: cors }
    );
  }

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
       has_minus = COALESCE($10, has_minus),
       minus_audio_url = COALESCE($11, minus_audio_url),
       minus_price = COALESCE($12, minus_price),
       rights_confirmed = COALESCE($13, rights_confirmed),
       allow_donations = COALESCE($14, allow_donations),
       allow_exclusive = COALESCE($15, allow_exclusive),
       "isExplicit" = COALESCE($16, "isExplicit"),
       "updatedAt" = now()
     WHERE id = $17`,
    body.contentType || null,
    body.originalComposer || null,
    body.recordingYear || null,
    body.recordingPlace || null,
    body.era || null,
    body.mood || null,
    body.instruments ? JSON.stringify(body.instruments) : null,
    body.difficulty || null,
    body.tempo || null,
    body.hasMinus ?? null,
    body.minusAudioUrl || null,
    body.minusPrice ?? null,
    body.rightsConfirmed ?? null,
    body.allowDonations ?? null,
    body.allowExclusive ?? null,
    body.isExplicit ?? null,
    params.id
  );

  // Соавторы и состав исполнителей сохраняем в metadata JSON
  if (body.coAuthors !== undefined || body.performers !== undefined) {
    const meta: any = (track as any).metadata || {};
    if (body.coAuthors !== undefined) meta.coAuthors = body.coAuthors;
    if (body.performers !== undefined) meta.performers = body.performers;
    await prisma.track.update({ where: { id: params.id }, data: { metadata: meta } });
  }

  // Sheet music — если передали sheetUrl и нет существующего
  if (body.sheetUrl) {
    const existing = await prisma.sheetMusic.findUnique({ where: { trackId: params.id } });
    if (!existing) {
      await prisma.sheetMusic.create({
        data: {
          trackId: params.id,
          pdfUrl: body.sheetUrl,
          title: track.title,
          composerId: track.artistId,
          uploaderId: session.userId,
          instrument: body.instruments && body.instruments.length > 0
            ? String(body.instruments[0])
            : 'Не указан',
        },
      });
    } else {
      await prisma.sheetMusic.update({
        where: { trackId: params.id },
        data: { pdfUrl: body.sheetUrl },
      });
    }
  }

  return NextResponse.json({ success: true }, { headers: cors });
}
