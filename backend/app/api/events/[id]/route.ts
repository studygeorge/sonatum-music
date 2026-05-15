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

// GET /api/events/[id] — публичный, если APPROVED, или владелец/админ
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const [ev] = (await prisma.$queryRawUnsafe(
    `SELECT e.*, COALESCE(a.name, c.name, u.username) AS author_name,
            a.slug AS artist_slug, c.slug AS collective_slug, a.avatar AS artist_avatar
       FROM events e
       JOIN users u ON u.id = e.author_id
       LEFT JOIN artists a ON a."userId" = u.id
       LEFT JOIN collectives c ON c."leaderId" = u.id
      WHERE e.id = $1
      LIMIT 1`,
    params.id
  )) as any[];

  if (!ev) {
    return NextResponse.json(
      { success: false, error: 'Событие не найдено' },
      { status: 404, headers: cors }
    );
  }

  if (ev.status !== 'APPROVED') {
    const auth = request.headers.get('Authorization');
    let allowed = false;
    if (auth?.startsWith('Bearer ')) {
      const s = await AuthService.validateSession(auth.substring(7));
      if (s && (s.userId === ev.author_id || s.role === 'ADMIN' || s.role === 'SUPER_ADMIN')) {
        allowed = true;
      }
    }
    if (!allowed) {
      return NextResponse.json(
        { success: false, error: 'Событие не опубликовано' },
        { status: 404, headers: cors }
      );
    }
  }

  return NextResponse.json(
    {
      success: true,
      data: {
        id: ev.id,
        authorId: ev.author_id,
        authorName: ev.author_name,
        artistSlug: ev.artist_slug,
        collectiveSlug: ev.collective_slug,
        artistAvatar: ev.artist_avatar,
        posterUrl: ev.poster_url,
        title: ev.title,
        startsAt: ev.starts_at,
        venueCity: ev.venue_city,
        venueName: ev.venue_name,
        venueAddress: ev.venue_address,
        isOnline: ev.is_online,
        onlineUrl: ev.online_url,
        description: ev.description,
        ticketPrice: ev.ticket_price ? Number(ev.ticket_price) : null,
        ticketUrl: ev.ticket_url,
        status: ev.status,
        rejectionReason: ev.rejection_reason,
        paidPublication: ev.paid_publication,
        attendeesCount: ev.attendees_count || 0,
        createdAt: ev.created_at,
      },
    },
    { headers: cors }
  );
}

// PATCH /api/events/[id] — модерация (только админ) или редактирование автором
// Body: { action: 'APPROVE' | 'REJECT', reason? } или поля события
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

  const [ev] = (await prisma.$queryRawUnsafe(
    `SELECT id, author_id, status FROM events WHERE id = $1 LIMIT 1`,
    params.id
  )) as any[];
  if (!ev) {
    return NextResponse.json(
      { success: false, error: 'Событие не найдено' },
      { status: 404, headers: cors }
    );
  }

  let body: any;
  try { body = await request.json(); } catch { body = {}; }

  const isAdmin = session.role === 'ADMIN' || session.role === 'SUPER_ADMIN';
  const isOwner = ev.author_id === session.userId;

  if (!isAdmin && !isOwner) {
    return NextResponse.json(
      { success: false, error: 'Нет прав' },
      { status: 403, headers: cors }
    );
  }

  // Действие модерации
  if (body.action && isAdmin) {
    if (body.action === 'APPROVE') {
      await prisma.$executeRawUnsafe(
        `UPDATE events SET status = 'APPROVED', rejection_reason = NULL, updated_at = now() WHERE id = $1`,
        params.id
      );
    } else if (body.action === 'REJECT') {
      await prisma.$executeRawUnsafe(
        `UPDATE events SET status = 'REJECTED', rejection_reason = $1, updated_at = now() WHERE id = $2`,
        body.reason || 'Без указания причины',
        params.id
      );
    } else {
      return NextResponse.json(
        { success: false, error: 'Неизвестное действие' },
        { status: 400, headers: cors }
      );
    }
    return NextResponse.json({ success: true }, { headers: cors });
  }

  // Редактирование (владельцем — только пока PENDING/DRAFT)
  if (isOwner && (ev.status === 'PENDING' || ev.status === 'DRAFT' || isAdmin)) {
    await prisma.$executeRawUnsafe(
      `UPDATE events SET
         poster_url = COALESCE($1, poster_url),
         title = COALESCE($2, title),
         starts_at = COALESCE($3::timestamptz, starts_at),
         venue_city = COALESCE($4, venue_city),
         venue_name = COALESCE($5, venue_name),
         venue_address = COALESCE($6, venue_address),
         is_online = COALESCE($7, is_online),
         online_url = COALESCE($8, online_url),
         description = COALESCE($9, description),
         ticket_price = COALESCE($10, ticket_price),
         ticket_url = COALESCE($11, ticket_url),
         updated_at = now()
       WHERE id = $12`,
      body.posterUrl ?? null,
      body.title ?? null,
      body.startsAt ?? null,
      body.venueCity ?? null,
      body.venueName ?? null,
      body.venueAddress ?? null,
      body.isOnline ?? null,
      body.onlineUrl ?? null,
      body.description ?? null,
      body.ticketPrice ?? null,
      body.ticketUrl ?? null,
      params.id
    );
    return NextResponse.json({ success: true }, { headers: cors });
  }

  return NextResponse.json(
    { success: false, error: 'Нечего обновлять' },
    { status: 400, headers: cors }
  );
}

// DELETE /api/events/[id]
export async function DELETE(
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
  const [ev] = (await prisma.$queryRawUnsafe(
    `SELECT id, author_id FROM events WHERE id = $1 LIMIT 1`,
    params.id
  )) as any[];
  if (!ev) {
    return NextResponse.json(
      { success: false, error: 'Не найдено' },
      { status: 404, headers: cors }
    );
  }
  if (ev.author_id !== session.userId && session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN') {
    return NextResponse.json(
      { success: false, error: 'Нет прав' },
      { status: 403, headers: cors }
    );
  }
  await prisma.$executeRawUnsafe(`DELETE FROM events WHERE id = $1`, params.id);
  return NextResponse.json({ success: true }, { headers: cors });
}
