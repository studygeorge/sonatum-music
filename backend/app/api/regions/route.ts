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

// GET /api/regions — список регионов (id, name, slug, type)
export async function GET(request: NextRequest) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const rows = (await prisma.$queryRawUnsafe(
    `SELECT id, name, slug, type FROM regions ORDER BY name ASC`
  )) as any[];
  return NextResponse.json(
    { success: true, data: rows }, { headers: { ...cors, 'Cache-Control': 's-maxage=86400, stale-while-revalidate=172800' } });
}
