import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AuthService } from '@/lib/auth';
import { getCorsHeaders } from '@/lib/cors';

export const dynamic = 'force-dynamic';

function cuid() {
  return 'epl_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
}

function slugify(s: string) {
  return (s.toLowerCase()
    .replace(/[а-я]/g, ch => ({ а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'c',ч:'ch',ш:'sh',щ:'sh',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya' } as any)[ch] || '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60) || 'pl') + '-' + Math.random().toString(36).slice(2, 6);
}

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

// GET /api/edu/playlists — все плейлисты учреждения
// query: scope=CORP|TEACHER|METHOD (опционально), filter по правам:
//   - все видят CORP и METHOD
//   - TEACHER + STUDENT: TEACHER-плейлисты only если public ИЛИ свои
//   - ADMIN видит всё
export async function GET(request: NextRequest) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const ctx = await getCtx(request);
  if (!ctx) {
    return NextResponse.json({ success: false, error: 'Доступ запрещён' }, { status: 403, headers: cors });
  }

  const rows = (await prisma.$queryRawUnsafe(
    `SELECT ep.id AS map_id, ep.scope, ep.owner_user_id,
            p.id, p.title, p.slug, p.description, p.cover, p."isPublic", p."trackCount", p."duration", p."createdAt"
       FROM edu_playlists ep
       JOIN playlists p ON p.id = ep.playlist_id
      WHERE ep.institution_id = $1
      ORDER BY ep.created_at DESC`,
    ctx.institutionId
  )) as any[];

  const visible = rows.filter(r => {
    if (ctx.myRole === 'ADMIN') return true;
    if (r.scope === 'CORP' || r.scope === 'METHOD') return true;
    if (r.scope === 'TEACHER') {
      return r.owner_user_id === ctx.userId || r.isPublic;
    }
    return false;
  });

  return NextResponse.json({
    success: true,
    myRole: ctx.myRole,
    data: visible.map(r => ({
      id: r.id,
      title: r.title,
      slug: r.slug,
      description: r.description,
      cover: r.cover,
      scope: r.scope,
      ownerUserId: r.owner_user_id,
      isPublic: r.isPublic,
      trackCount: r.trackCount,
      duration: r.duration,
      createdAt: r.createdAt,
      canEdit: ctx.myRole === 'ADMIN' || r.owner_user_id === ctx.userId,
    })),
  }, { headers: cors });
}

// POST /api/edu/playlists — создать плейлист в рамках учреждения
// Body: { title, description?, scope: 'CORP'|'TEACHER'|'METHOD', isPublic? }
// Права: ADMIN может создать любой scope; TEACHER — только TEACHER
export async function POST(request: NextRequest) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const ctx = await getCtx(request);
  if (!ctx) {
    return NextResponse.json({ success: false, error: 'Доступ запрещён' }, { status: 403, headers: cors });
  }
  if (ctx.myRole === 'STUDENT') {
    return NextResponse.json({ success: false, error: 'Студенты не могут создавать плейлисты' }, { status: 403, headers: cors });
  }

  let body: any;
  try { body = await request.json(); } catch { body = {}; }
  const title = String(body.title || '').trim();
  if (!title) {
    return NextResponse.json({ success: false, error: 'Введите название' }, { status: 400, headers: cors });
  }
  const description = body.description ? String(body.description).trim().slice(0, 500) : null;
  let scope = String(body.scope || 'TEACHER').toUpperCase();
  if (!['CORP', 'TEACHER', 'METHOD'].includes(scope)) scope = 'TEACHER';
  if (ctx.myRole !== 'ADMIN' && scope !== 'TEACHER') {
    return NextResponse.json({ success: false, error: 'Только администратор может создавать корпоративные и методические плейлисты' }, { status: 403, headers: cors });
  }
  const isPublic = body.isPublic !== false;

  // Create the underlying Playlist
  const playlist = await prisma.playlist.create({
    data: {
      title,
      slug: slugify(title),
      description,
      cover: null,
      isPublic,
      type: 'USER',
      userId: ctx.userId,
    },
  });

  const id = cuid();
  await prisma.$executeRawUnsafe(
    `INSERT INTO edu_playlists (id, institution_id, playlist_id, scope, owner_user_id) VALUES ($1, $2, $3, $4, $5)`,
    id, ctx.institutionId, playlist.id, scope, ctx.userId
  );

  return NextResponse.json({ success: true, id: playlist.id, scope }, { headers: cors });
}

// DELETE /api/edu/playlists?id=<playlistId>
export async function DELETE(request: NextRequest) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const ctx = await getCtx(request);
  if (!ctx) {
    return NextResponse.json({ success: false, error: 'Доступ запрещён' }, { status: 403, headers: cors });
  }
  const { searchParams } = new URL(request.url);
  const playlistId = searchParams.get('id');
  if (!playlistId) {
    return NextResponse.json({ success: false, error: 'Не указан id' }, { status: 400, headers: cors });
  }

  const [row] = (await prisma.$queryRawUnsafe(
    `SELECT owner_user_id, scope FROM edu_playlists WHERE institution_id = $1 AND playlist_id = $2`,
    ctx.institutionId, playlistId
  )) as any[];
  if (!row) {
    return NextResponse.json({ success: false, error: 'Плейлист не найден' }, { status: 404, headers: cors });
  }
  if (ctx.myRole !== 'ADMIN' && row.owner_user_id !== ctx.userId) {
    return NextResponse.json({ success: false, error: 'Нет прав на удаление' }, { status: 403, headers: cors });
  }

  await prisma.$executeRawUnsafe(`DELETE FROM edu_playlists WHERE institution_id = $1 AND playlist_id = $2`, ctx.institutionId, playlistId);
  await prisma.playlist.delete({ where: { id: playlistId } }).catch(() => {});

  return NextResponse.json({ success: true }, { headers: cors });
}
