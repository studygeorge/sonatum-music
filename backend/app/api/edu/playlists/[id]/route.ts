import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AuthService } from '@/lib/auth';
import { getCorsHeaders } from '@/lib/cors';

export const dynamic = 'force-dynamic';

export async function OPTIONS(request: NextRequest) {
  return new Response(null, { status: 204, headers: getCorsHeaders(request.headers.get('origin') || undefined) });
}

type Ctx = { institutionId: string; myRole: 'ADMIN' | 'TEACHER' | 'STUDENT'; userId: string };

async function getCtx(request: NextRequest): Promise<Ctx | null> {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const session = await AuthService.validateSession(auth.substring(7));
  if (!session) return null;
  const [asAdmin] = (await prisma.$queryRawUnsafe(
    `SELECT id FROM edu_institutions WHERE admin_user_id = $1 AND status IN ('ACTIVE','APPROVED') LIMIT 1`,
    session.userId
  )) as any[];
  if (asAdmin) return { institutionId: asAdmin.id, myRole: 'ADMIN', userId: session.userId };
  const [m] = (await prisma.$queryRawUnsafe(
    `SELECT institution_id, role FROM edu_members WHERE user_id = $1 LIMIT 1`,
    session.userId
  )) as any[];
  if (m) return { institutionId: m.institution_id, myRole: m.role, userId: session.userId };
  return null;
}

async function getEduPlaylist(institutionId: string, playlistId: string) {
  const [r] = (await prisma.$queryRawUnsafe(
    `SELECT scope, owner_user_id FROM edu_playlists WHERE institution_id = $1 AND playlist_id = $2`,
    institutionId, playlistId
  )) as any[];
  return r || null;
}

// GET /api/edu/playlists/[id] — детали + треки
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const ctx = await getCtx(request);
  if (!ctx) {
    return NextResponse.json({ success: false, error: 'Доступ запрещён' }, { status: 403, headers: cors });
  }
  const ep = await getEduPlaylist(ctx.institutionId, params.id);
  if (!ep) {
    return NextResponse.json({ success: false, error: 'Плейлист не найден' }, { status: 404, headers: cors });
  }

  const playlist = await prisma.playlist.findUnique({
    where: { id: params.id },
    include: {
      tracks: {
        orderBy: { position: 'asc' },
        include: {
          track: {
            select: {
              id: true, title: true, slug: true, duration: true, cover: true, audioUrl: true, playCount: true,
              artist: { select: { id: true, name: true, slug: true, avatar: true } },
            },
          },
        },
      },
    },
  });
  if (!playlist) {
    return NextResponse.json({ success: false, error: 'Плейлист не найден' }, { status: 404, headers: cors });
  }

  return NextResponse.json({
    success: true,
    myRole: ctx.myRole,
    data: {
      id: playlist.id,
      title: playlist.title,
      slug: playlist.slug,
      description: playlist.description,
      cover: playlist.cover,
      scope: ep.scope,
      ownerUserId: ep.owner_user_id,
      isPublic: playlist.isPublic,
      trackCount: playlist.trackCount,
      duration: playlist.duration,
      canEdit: ctx.myRole === 'ADMIN' || ep.owner_user_id === ctx.userId,
      tracks: playlist.tracks.map(pt => ({
        position: pt.position,
        track: pt.track,
      })),
    },
  }, { headers: cors });
}

// PATCH /api/edu/playlists/[id] — обновить название/описание
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const ctx = await getCtx(request);
  if (!ctx) return NextResponse.json({ success: false, error: 'Доступ запрещён' }, { status: 403, headers: cors });
  const ep = await getEduPlaylist(ctx.institutionId, params.id);
  if (!ep) return NextResponse.json({ success: false, error: 'Плейлист не найден' }, { status: 404, headers: cors });
  if (ctx.myRole !== 'ADMIN' && ep.owner_user_id !== ctx.userId) {
    return NextResponse.json({ success: false, error: 'Нет прав' }, { status: 403, headers: cors });
  }

  let body: any;
  try { body = await request.json(); } catch { body = {}; }
  const data: any = {};
  if (body.title !== undefined) data.title = String(body.title).trim().slice(0, 200);
  if (body.description !== undefined) data.description = body.description ? String(body.description).trim().slice(0, 500) : null;
  if (body.isPublic !== undefined) data.isPublic = !!body.isPublic;
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ success: false, error: 'Нет полей' }, { status: 400, headers: cors });
  }
  await prisma.playlist.update({ where: { id: params.id }, data });
  return NextResponse.json({ success: true }, { headers: cors });
}

// POST /api/edu/playlists/[id]/tracks — добавить трек: { trackId }
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const ctx = await getCtx(request);
  if (!ctx) return NextResponse.json({ success: false, error: 'Доступ запрещён' }, { status: 403, headers: cors });
  const ep = await getEduPlaylist(ctx.institutionId, params.id);
  if (!ep) return NextResponse.json({ success: false, error: 'Плейлист не найден' }, { status: 404, headers: cors });
  if (ctx.myRole !== 'ADMIN' && ep.owner_user_id !== ctx.userId) {
    return NextResponse.json({ success: false, error: 'Нет прав на редактирование' }, { status: 403, headers: cors });
  }

  let body: any;
  try { body = await request.json(); } catch { body = {}; }
  const trackId = String(body.trackId || '').trim();
  if (!trackId) {
    return NextResponse.json({ success: false, error: 'Не указан trackId' }, { status: 400, headers: cors });
  }
  const track = await prisma.track.findUnique({ where: { id: trackId }, select: { id: true, duration: true } });
  if (!track) {
    return NextResponse.json({ success: false, error: 'Трек не найден' }, { status: 404, headers: cors });
  }
  // Уже есть?
  const exists = await prisma.playlistTrack.findUnique({
    where: { playlistId_trackId: { playlistId: params.id, trackId } },
  });
  if (exists) {
    return NextResponse.json({ success: false, error: 'Трек уже в плейлисте' }, { status: 409, headers: cors });
  }
  const last = await prisma.playlistTrack.findFirst({
    where: { playlistId: params.id }, orderBy: { position: 'desc' }, select: { position: true },
  });
  await prisma.playlistTrack.create({
    data: { playlistId: params.id, trackId, position: (last?.position || 0) + 1 },
  });
  await prisma.playlist.update({
    where: { id: params.id },
    data: { trackCount: { increment: 1 }, duration: { increment: track.duration || 0 } },
  });
  return NextResponse.json({ success: true }, { headers: cors });
}

// DELETE /api/edu/playlists/[id]/tracks?trackId=X
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const ctx = await getCtx(request);
  if (!ctx) return NextResponse.json({ success: false, error: 'Доступ запрещён' }, { status: 403, headers: cors });
  const ep = await getEduPlaylist(ctx.institutionId, params.id);
  if (!ep) return NextResponse.json({ success: false, error: 'Плейлист не найден' }, { status: 404, headers: cors });
  if (ctx.myRole !== 'ADMIN' && ep.owner_user_id !== ctx.userId) {
    return NextResponse.json({ success: false, error: 'Нет прав' }, { status: 403, headers: cors });
  }
  const { searchParams } = new URL(request.url);
  const trackId = searchParams.get('trackId');
  if (!trackId) return NextResponse.json({ success: false, error: 'Не указан trackId' }, { status: 400, headers: cors });

  const pt = await prisma.playlistTrack.findUnique({
    where: { playlistId_trackId: { playlistId: params.id, trackId } },
    include: { track: { select: { duration: true } } },
  });
  if (!pt) return NextResponse.json({ success: false, error: 'Не найден' }, { status: 404, headers: cors });
  await prisma.playlistTrack.delete({ where: { playlistId_trackId: { playlistId: params.id, trackId } } });
  await prisma.playlist.update({
    where: { id: params.id },
    data: { trackCount: { decrement: 1 }, duration: { decrement: pt.track?.duration || 0 } },
  });
  return NextResponse.json({ success: true }, { headers: cors });
}
