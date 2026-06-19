import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AuthService } from '@/lib/auth';
import { getCorsHeaders } from '@/lib/cors';
import { ensureDocument, renderDocPdf, type DocKind } from '@/lib/edu-docs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request.headers.get('origin') || undefined),
  });
}

async function getInstitutionForRequest(request: NextRequest) {
  const auth = request.headers.get('Authorization');
  const url = new URL(request.url);
  const tokenFromUrl = url.searchParams.get('token');
  const token = auth?.startsWith('Bearer ') ? auth.substring(7) : tokenFromUrl;
  if (!token) return null;
  const session = await AuthService.validateSession(token);
  if (!session) return null;
  const [r] = (await prisma.$queryRawUnsafe(
    `SELECT * FROM edu_institutions WHERE admin_user_id = $1 LIMIT 1`,
    session.userId
  )) as any[];
  return r || null;
}

const KIND_MAP: Record<string, DocKind> = {
  'contract.pdf': 'CONTRACT',
  'invoice.pdf': 'INVOICE',
  'act.pdf': 'ACT',
};

// GET /api/edu/documents/[kind]
export async function GET(request: NextRequest, ctx: { params: { kind: string } }) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const inst = await getInstitutionForRequest(request);
  if (!inst) {
    return NextResponse.json({ success: false, error: 'Доступ запрещён' }, { status: 403, headers: cors });
  }
  const kind = KIND_MAP[ctx.params.kind];
  if (!kind) {
    return NextResponse.json({ success: false, error: 'Неизвестный документ' }, { status: 404, headers: cors });
  }

  // Год выпуска — год оплаты лицензии
  const year = (inst.paid_at ? new Date(inst.paid_at) : new Date()).getFullYear();
  const amountKopecks = inst.annual_fee ? Math.round(Number(inst.annual_fee) * 100) : null;

  const docRec = await ensureDocument({
    institutionId: inst.id,
    kind,
    year,
    amountKopecks,
    periodFrom: inst.paid_at ? new Date(inst.paid_at) : null,
    periodTo: inst.expires_at ? new Date(inst.expires_at) : null,
  });

  const buf = await renderDocPdf(kind, inst, docRec);

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      ...cors,
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="sonatum-${kind.toLowerCase()}-${docRec.number}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
