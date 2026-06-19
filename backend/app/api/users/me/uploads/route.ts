import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AuthService } from '@/lib/auth';
import { getCorsHeaders } from '@/lib/cors';
import { getSubLevel } from '@/lib/subscription';

export const dynamic = 'force-dynamic';

function cuid() {
  return 'pup_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
}

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request.headers.get('origin') || undefined),
  });
}

async function getSession(request: NextRequest) {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return AuthService.validateSession(auth.substring(7));
}

// GET /api/users/me/uploads — список моих загрузок
export async function GET(request: NextRequest) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const session = await getSession(request);
  if (!session) return NextResponse.json({ success: false, error: 'Не авторизован' }, { status: 401, headers: cors });

  const rows = (await prisma.$queryRawUnsafe(
    `SELECT id, title, artist_name, audio_url, duration, cover_url, file_size_bytes, created_at
       FROM personal_uploads WHERE user_id = $1
       ORDER BY created_at DESC LIMIT 200`,
    session.userId
  )) as any[];

  return NextResponse.json({
    success: true,
    data: rows.map((r) => ({
      id: r.id,
      title: r.title,
      artistName: r.artist_name,
      audioUrl: r.audio_url,
      duration: r.duration,
      coverUrl: r.cover_url,
      fileSize: r.file_size_bytes ? Number(r.file_size_bytes) : null,
      createdAt: r.created_at,
    })),
  }, { headers: cors });
}

// POST /api/users/me/uploads — добавить личную загрузку. Только Premium/Student.
// Body: { title, artistName?, audioUrl, duration?, coverUrl?, fileSize? }
// audioUrl должен быть результатом /api/upload/audio — мы не загружаем файл здесь, а только регистрируем ссылку.
export async function POST(request: NextRequest) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const session = await getSession(request);
  if (!session) return NextResponse.json({ success: false, error: 'Не авторизован' }, { status: 401, headers: cors });

  // Проверка Premium
  const sub = await getSubLevel(session.userId);
  if (!sub.isPremium) {
    return NextResponse.json(
      { success: false, error: 'Загрузка своей музыки доступна только с Premium', code: 'PREMIUM_REQUIRED' },
      { status: 403, headers: cors }
    );
  }

  let body: any;
  try { body = await request.json(); } catch { body = {}; }
  const title = String(body.title || '').trim();
  const audioUrl = String(body.audioUrl || '').trim();
  if (!title || !audioUrl) {
    return NextResponse.json({ success: false, error: 'Укажите название и аудиофайл' }, { status: 400, headers: cors });
  }

  // Лимит: до 50 личных файлов на пользователя — защита от злоупотреблений
  const [{ c }] = (await prisma.$queryRawUnsafe(
    `SELECT COUNT(*)::int AS c FROM personal_uploads WHERE user_id = $1`,
    session.userId
  )) as any[];
  if (c >= 50) {
    return NextResponse.json(
      { success: false, error: 'Достигнут лимит: до 50 личных загрузок' },
      { status: 403, headers: cors }
    );
  }

  const id = cuid();
  await prisma.$executeRawUnsafe(
    `INSERT INTO personal_uploads (id, user_id, title, artist_name, audio_url, duration, cover_url, file_size_bytes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    id, session.userId,
    title.slice(0, 200),
    body.artistName ? String(body.artistName).trim().slice(0, 200) : null,
    audioUrl,
    body.duration ? Math.round(Number(body.duration)) : null,
    body.coverUrl ? String(body.coverUrl).trim() : null,
    body.fileSize ? Math.round(Number(body.fileSize)) : null
  );

  return NextResponse.json({ success: true, id }, { headers: cors });
}

// DELETE /api/users/me/uploads?id=X
export async function DELETE(request: NextRequest) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const session = await getSession(request);
  if (!session) return NextResponse.json({ success: false, error: 'Не авторизован' }, { status: 401, headers: cors });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ success: false, error: 'Не указан id' }, { status: 400, headers: cors });

  // Только свои
  const r = await prisma.$executeRawUnsafe(
    `DELETE FROM personal_uploads WHERE id = $1 AND user_id = $2`,
    id, session.userId
  );

  if (!r) return NextResponse.json({ success: false, error: 'Не найдено' }, { status: 404, headers: cors });
  return NextResponse.json({ success: true }, { headers: cors });
}
