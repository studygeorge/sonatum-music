import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCorsHeaders } from '@/lib/cors';

export const dynamic = 'force-dynamic';

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request.headers.get('origin') || undefined),
  });
}

export async function GET(request: NextRequest) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const rows = (await prisma.$queryRawUnsafe(
    `SELECT id, code, name, short_name, audience, description, rights_allowed, rights_forbidden, territory, default_price, min_price, max_price, commission_pct, is_b2b, requires_manager, sort_order
     FROM license_catalog WHERE active = true ORDER BY sort_order ASC, name ASC`
  )) as any[];

  return NextResponse.json(
    {
      success: true,
      data: rows.map((r) => ({
        id: r.id,
        code: r.code,
        name: r.name,
        shortName: r.short_name,
        audience: r.audience,
        description: r.description,
        rightsAllowed: r.rights_allowed,
        rightsForbidden: r.rights_forbidden,
        territory: r.territory,
        defaultPrice: Number(r.default_price || 0),
        minPrice: r.min_price ? Number(r.min_price) : null,
        maxPrice: r.max_price ? Number(r.max_price) : null,
        commissionPct: r.commission_pct,
        isB2B: r.is_b2b,
        requiresManager: r.requires_manager,
        sortOrder: r.sort_order,
      })),
    },
    { headers: cors }
  );
}
