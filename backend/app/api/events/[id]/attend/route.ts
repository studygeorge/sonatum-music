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

// POST /api/events/[id]/attend — отметить «Буду»
// DELETE /api/events/[id]/attend — снять отметку
export async function POST(
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

  await prisma.$executeRawUnsafe(
    `INSERT INTO event_attendees (event_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    params.id,
    session.userId
  );
  await prisma.$executeRawUnsafe(
    `UPDATE events SET attendees_count = (SELECT COUNT(*) FROM event_attendees WHERE event_id = $1) WHERE id = $1`,
    params.id
  );

  return NextResponse.json({ success: true, attending: true }, { headers: cors });
}

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
  await prisma.$executeRawUnsafe(
    `DELETE FROM event_attendees WHERE event_id = $1 AND user_id = $2`,
    params.id,
    session.userId
  );
  await prisma.$executeRawUnsafe(
    `UPDATE events SET attendees_count = (SELECT COUNT(*) FROM event_attendees WHERE event_id = $1) WHERE id = $1`,
    params.id
  );
  return NextResponse.json({ success: true, attending: false }, { headers: cors });
}
