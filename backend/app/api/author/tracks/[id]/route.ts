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

// GET — один трек, если он принадлежит этому автору
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

  return NextResponse.json({ success: true, data: track }, { headers: cors });
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

  const existing = await prisma.track.findFirst({
    where: { id: params.id, artistId: artist.id },
    select: { id: true, status: true },
  });
  if (!existing) return NextResponse.json({ success: false, error: 'Not found or not yours' }, { status: 404, headers: cors });

  const body = await request.json().catch(() => ({}));

  // Только разрешённые поля — берём с подменой undefined, чтобы не затирать
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

  // Если редактируется опубликованный трек — отправляем обратно на модерацию,
  // чтобы любые изменения утвердил админ. Черновики/REJECTED остаются как есть
  // до отправки на модерацию.
  if (existing.status === 'PUBLISHED' && Object.keys(data).length > 0) {
    data.status = 'PENDING';
  }

  const track = await prisma.track.update({
    where: { id: params.id },
    data,
  });

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
