import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AuthService } from '@/lib/auth';
import { getCorsHeaders } from '@/lib/cors';

export const dynamic = 'force-dynamic';

export async function OPTIONS(request: NextRequest) {
  return new Response(null, { status: 204, headers: getCorsHeaders(request.headers.get('origin') || undefined) });
}

async function requireAdmin(request: NextRequest) {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const s = await AuthService.validateSession(auth.substring(7));
  if (!s || (s.role !== 'ADMIN' && s.role !== 'SUPER_ADMIN')) return null;
  return s;
}

/**
 * GET /api/admin/finance/registries?status=&from=&to=&limit=
 * Список платёжных реестров с агрегатами + платежи каждого реестра.
 */
export async function GET(request: NextRequest) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const s = await requireAdmin(request);
  if (!s) return NextResponse.json({ success: false, error: 'forbidden' }, { status: 403, headers: cors });

  const url = new URL(request.url);
  const status = url.searchParams.get('status') || '';
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const limit = Math.min(500, parseInt(url.searchParams.get('limit') || '100'));
  const detailFor = url.searchParams.get('id'); // если задан — отдаём один реестр со всеми платежами

  if (detailFor) {
    const [reg] = (await prisma.$queryRawUnsafe(
      `SELECT * FROM payout_registries WHERE id = $1`,
      detailFor
    )) as any[];
    if (!reg) return NextResponse.json({ success: false, error: 'not found' }, { status: 404, headers: cors });

    const items = (await prisma.$queryRawUnsafe(
      `SELECT p.id, p.gross, p.tax, p.net, p.tax_holding, p.status, p.receipt_url, p.error,
              p.admin_comment, p.created_at, p.paid_at,
              u.email, u."firstName", u."lastName"
         FROM payouts p
         JOIN users u ON u.id = p.user_id
        WHERE p.registry_id = $1
        ORDER BY p.created_at ASC`,
      detailFor
    )) as any[];

    return NextResponse.json({
      success: true,
      data: {
        registry: {
          id: reg.id,
          correlationId: reg.correlation_id,
          tbankRegistryId: reg.tbank_registry_id ? Number(reg.tbank_registry_id) : null,
          status: reg.status,
          totalGross: Number(reg.total_gross),
          totalNet: Number(reg.total_net),
          totalTax: Number(reg.total_tax),
          paymentCount: reg.payment_count,
          comment: reg.comment,
          createdAt: reg.created_at,
          submittedAt: reg.submitted_at,
          paidAt: reg.paid_at,
          finalizedAt: reg.finalized_at,
          lastError: reg.last_error,
        },
        payments: items.map((p) => ({
          id: p.id,
          user: { email: p.email, name: [p.firstName, p.lastName].filter(Boolean).join(' ') },
          gross: Number(p.gross),
          tax: Number(p.tax),
          net: Number(p.net),
          taxHolding: p.tax_holding,
          status: p.status,
          receiptUrl: p.receipt_url,
          error: p.error,
          adminComment: p.admin_comment,
          createdAt: p.created_at,
          paidAt: p.paid_at,
        })),
      },
    }, { headers: cors });
  }

  // Список
  const conds: string[] = [];
  const args: any[] = [];
  if (status) { args.push(status); conds.push(`r.status = $${args.length}`); }
  if (from)   { args.push(from);   conds.push(`r.created_at >= $${args.length}::date`); }
  if (to)     { args.push(to);     conds.push(`r.created_at < ($${args.length}::date + interval '1 day')`); }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

  const rows = (await prisma.$queryRawUnsafe(
    `SELECT r.id, r.tbank_registry_id, r.status, r.total_gross, r.total_net, r.total_tax,
            r.payment_count, r.comment, r.created_at, r.paid_at, r.finalized_at,
            (SELECT COUNT(*) FROM payouts p WHERE p.registry_id = r.id AND p.receipt_url IS NOT NULL)::int AS receipts_count,
            (SELECT COUNT(*) FROM payouts p WHERE p.registry_id = r.id AND p.status = 'ERROR')::int AS errors_count
       FROM payout_registries r
       ${where}
      ORDER BY r.created_at DESC
      LIMIT ${limit}`,
    ...args
  )) as any[];

  // Сводка по статусам
  const summary = (await prisma.$queryRawUnsafe(
    `SELECT status, COUNT(*)::int AS cnt, COALESCE(SUM(total_gross),0)::numeric AS gross
       FROM payout_registries GROUP BY status`
  )) as any[];

  return NextResponse.json({
    success: true,
    data: rows.map((r) => ({
      id: r.id,
      tbankRegistryId: r.tbank_registry_id ? Number(r.tbank_registry_id) : null,
      status: r.status,
      totalGross: Number(r.total_gross),
      totalNet: Number(r.total_net),
      totalTax: Number(r.total_tax),
      paymentCount: r.payment_count,
      receiptsCount: r.receipts_count,
      errorsCount: r.errors_count,
      comment: r.comment,
      createdAt: r.created_at,
      paidAt: r.paid_at,
      finalizedAt: r.finalized_at,
    })),
    summary: summary.reduce((acc: any, r: any) => {
      acc[r.status] = { count: Number(r.cnt), gross: Number(r.gross) };
      return acc;
    }, {}),
  }, { headers: cors });
}
