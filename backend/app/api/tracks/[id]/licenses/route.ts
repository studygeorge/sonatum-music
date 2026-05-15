import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AuthService } from '@/lib/auth';
import { getCorsHeaders } from '@/lib/cors';

export const dynamic = 'force-dynamic';

function cuid() {
  return 'tl_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
}

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request.headers.get('origin') || undefined),
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const rows = (await prisma.$queryRawUnsafe(
    `SELECT tl.license_code, tl.enabled, tl.price, tl.custom_terms,
            lc.name, lc.short_name, lc.audience, lc.description, lc.default_price, lc.commission_pct, lc.is_b2b, lc.requires_manager
     FROM track_licenses tl
     JOIN license_catalog lc ON lc.code = tl.license_code
     WHERE tl.track_id = $1 AND tl.enabled = true
     ORDER BY lc.sort_order`,
    params.id
  )) as any[];

  return NextResponse.json(
    {
      success: true,
      data: rows.map((r) => ({
        code: r.license_code,
        name: r.name,
        shortName: r.short_name,
        audience: r.audience,
        description: r.description,
        price: r.price ? Number(r.price) : Number(r.default_price),
        commissionPct: r.commission_pct,
        isB2B: r.is_b2b,
        requiresManager: r.requires_manager,
        customTerms: r.custom_terms,
      })),
    },
    { headers: cors }
  );
}

// PUT /api/tracks/[id]/licenses — заменяет полный набор лицензий для трека
// Body: { licenses: [{ code, price?, customTerms? }] }
export async function PUT(
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

  // проверяем что трек принадлежит автору
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
  const licenses = Array.isArray(body?.licenses) ? body.licenses : [];

  // удаляем старые, вставляем новые
  await prisma.$executeRawUnsafe(
    `DELETE FROM track_licenses WHERE track_id = $1`,
    params.id
  );

  for (const l of licenses) {
    if (!l?.code) continue;
    await prisma.$executeRawUnsafe(
      `INSERT INTO track_licenses (id, track_id, license_code, enabled, price, custom_terms)
       VALUES ($1, $2, $3, true, $4, $5)
       ON CONFLICT (track_id, license_code) DO UPDATE SET enabled = true, price = $4, custom_terms = $5`,
      cuid(),
      params.id,
      l.code,
      l.price != null ? Number(l.price) : null,
      l.customTerms || null
    );
  }

  return NextResponse.json({ success: true, count: licenses.length }, { headers: cors });
}
