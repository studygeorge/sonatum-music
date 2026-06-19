import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AuthService } from '@/lib/auth';
import { getCorsHeaders } from '@/lib/cors';

export const dynamic = 'force-dynamic';

function svid(): string { return 'sv_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10); }

export async function OPTIONS(request: NextRequest) {
  return new Response(null, { status: 204, headers: getCorsHeaders(request.headers.get('origin') || undefined) });
}

/**
 * POST /api/sheets/[id]/view
 * Фиксирует просмотр PDF нот для подсчёта активности автора.
 * Антиспам: одинаковый sheet × user → не чаще 1р/5мин.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const sheetId = params.id;
  if (!sheetId) return NextResponse.json({ success: false, error: 'no id' }, { status: 400, headers: cors });

  let userId: string | null = null;
  const auth = request.headers.get('Authorization');
  if (auth?.startsWith('Bearer ')) {
    const s = await AuthService.validateSession(auth.substring(7));
    userId = s?.userId || null;
  }

  // Антиспам
  if (userId) {
    const [recent] = (await prisma.$queryRawUnsafe(
      `SELECT id FROM sheet_views_history
        WHERE user_id = $1 AND sheet_id = $2 AND viewed_at > now() - interval '5 minutes' LIMIT 1`,
      userId, sheetId
    )) as any[];
    if (recent) return NextResponse.json({ success: true, deduped: true }, { headers: cors });
  }

  await prisma.$executeRawUnsafe(
    `INSERT INTO sheet_views_history (id, user_id, sheet_id) VALUES ($1, $2, $3)`,
    svid(), userId, sheetId
  );

  return NextResponse.json({ success: true }, { headers: cors });
}
