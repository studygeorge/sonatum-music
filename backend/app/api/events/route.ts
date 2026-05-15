import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AuthService } from '@/lib/auth';
import { getCorsHeaders } from '@/lib/cors';

export const dynamic = 'force-dynamic';

function cuid() {
  return 'ev_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
}

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request.headers.get('origin') || undefined),
  });
}

// GET /api/events — публичный список (только APPROVED, будущие)
// GET /api/events?mine=1 — все события текущего пользователя (требует токен)
// GET /api/events?status=PENDING&admin=1 — на модерации (только админ)
export async function GET(request: NextRequest) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const { searchParams } = new URL(request.url);
  const mine = searchParams.get('mine') === '1';
  const admin = searchParams.get('admin') === '1';
  const status = searchParams.get('status');
  const limit = Math.min(100, parseInt(searchParams.get('limit') || '50'));

  let rows: any[];

  if (mine || admin) {
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

    if (admin) {
      if (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN') {
        return NextResponse.json(
          { success: false, error: 'Только админ' },
          { status: 403, headers: cors }
        );
      }
      rows = (await prisma.$queryRawUnsafe(
        `SELECT e.*, u.email AS author_email, COALESCE(a.name, c.name, u.username) AS author_name,
                a.slug AS artist_slug, c.slug AS collective_slug
           FROM events e
           JOIN users u ON u.id = e.author_id
           LEFT JOIN artists a ON a."userId" = u.id
           LEFT JOIN collectives c ON c."leaderId" = u.id
          WHERE ${status ? 'e.status = $1' : '1=1'}
          ORDER BY e.created_at DESC
          LIMIT ${limit}`,
        ...(status ? [status] : [])
      )) as any[];
    } else {
      rows = (await prisma.$queryRawUnsafe(
        `SELECT e.*, COALESCE(a.name, c.name, u.username) AS author_name,
                a.slug AS artist_slug, c.slug AS collective_slug
           FROM events e
           JOIN users u ON u.id = e.author_id
           LEFT JOIN artists a ON a."userId" = u.id
           LEFT JOIN collectives c ON c."leaderId" = u.id
          WHERE e.author_id = $1
          ORDER BY e.starts_at DESC
          LIMIT ${limit}`,
        session.userId
      )) as any[];
    }
  } else {
    // Публичный: только APPROVED, будущие
    rows = (await prisma.$queryRawUnsafe(
      `SELECT e.*, COALESCE(a.name, c.name, u.username) AS author_name,
              a.slug AS artist_slug, c.slug AS collective_slug,
              a.avatar AS artist_avatar
         FROM events e
         JOIN users u ON u.id = e.author_id
         LEFT JOIN artists a ON a."userId" = u.id
         LEFT JOIN collectives c ON c."leaderId" = u.id
        WHERE e.status = 'APPROVED' AND e.starts_at > now()
        ORDER BY e.starts_at ASC
        LIMIT ${limit}`
    )) as any[];
  }

  return NextResponse.json(
    {
      success: true,
      data: rows.map((r) => ({
        id: r.id,
        authorId: r.author_id,
        authorName: r.author_name,
        authorEmail: r.author_email,
        artistSlug: r.artist_slug,
        collectiveSlug: r.collective_slug,
        artistAvatar: r.artist_avatar,
        posterUrl: r.poster_url,
        title: r.title,
        startsAt: r.starts_at,
        venueCity: r.venue_city,
        venueName: r.venue_name,
        venueAddress: r.venue_address,
        isOnline: r.is_online,
        onlineUrl: r.online_url,
        description: r.description,
        ticketPrice: r.ticket_price ? Number(r.ticket_price) : null,
        ticketUrl: r.ticket_url,
        status: r.status,
        rejectionReason: r.rejection_reason,
        paidPublication: r.paid_publication,
        attendeesCount: r.attendees_count || 0,
        createdAt: r.created_at,
      })),
    },
    { headers: cors }
  );
}

// POST /api/events
export async function POST(request: NextRequest) {
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

  // Только авторы могут создавать события
  if (session.role !== 'ARTIST' && session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN') {
    return NextResponse.json(
      { success: false, error: 'Создавать события могут только авторы' },
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

  if (!body.title?.trim() || !body.startsAt) {
    return NextResponse.json(
      { success: false, error: 'Заполните название и дату начала' },
      { status: 400, headers: cors }
    );
  }

  const startsAt = new Date(body.startsAt);
  if (isNaN(startsAt.getTime())) {
    return NextResponse.json(
      { success: false, error: 'Невалидная дата' },
      { status: 400, headers: cors }
    );
  }
  if (startsAt < new Date()) {
    return NextResponse.json(
      { success: false, error: 'Дата должна быть в будущем' },
      { status: 400, headers: cors }
    );
  }

  // Проверим ПРОФИ-подписку — для бесплатной публикации
  const [profi] = (await prisma.$queryRawUnsafe(
    `SELECT tier FROM author_subscriptions WHERE user_id = $1 AND status = 'ACTIVE' AND (ends_at IS NULL OR ends_at > now()) LIMIT 1`,
    session.userId
  )) as any[];
  const isProfi = profi?.tier === 'PROFI';

  const evId = cuid();
  // Если автор не ПРОФИ — событие сразу в PENDING с пометкой paid_publication=false (потом будет оплата 250₽)
  // Для ПРОФИ автоматически идёт в PENDING (на модерацию)
  await prisma.$executeRawUnsafe(
    `INSERT INTO events
     (id, author_id, poster_url, title, starts_at, venue_city, venue_name, venue_address,
      is_online, online_url, description, ticket_price, ticket_url, status, paid_publication, publication_fee)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
    evId,
    session.userId,
    body.posterUrl || null,
    body.title.trim(),
    startsAt,
    body.venueCity || null,
    body.venueName || null,
    body.venueAddress || null,
    !!body.isOnline,
    body.onlineUrl || null,
    body.description || null,
    body.ticketPrice ? Number(body.ticketPrice) : null,
    body.ticketUrl || null,
    'PENDING',
    isProfi,
    isProfi ? 0 : 250
  );

  return NextResponse.json(
    {
      success: true,
      eventId: evId,
      requiresPayment: !isProfi,
      paymentAmount: isProfi ? 0 : 250,
      message: isProfi
        ? 'Событие отправлено на модерацию. После проверки появится в афише.'
        : 'Событие создано. Для публикации требуется оплата 250 ₽ (или подписка ПРОФИ — бесплатно).',
    },
    { headers: cors }
  );
}
