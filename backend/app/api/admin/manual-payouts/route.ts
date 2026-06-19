import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AuthService } from '@/lib/auth';
import { getCorsHeaders } from '@/lib/cors';

export const dynamic = 'force-dynamic';

function mid(): string {
  return 'mp_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request.headers.get('origin') || undefined),
  });
}

async function requireAdmin(request: NextRequest) {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const s = await AuthService.validateSession(auth.substring(7));
  if (!s) return null;
  if (s.role !== 'ADMIN' && s.role !== 'SUPER_ADMIN') return null;
  return s;
}

/**
 * GET /api/admin/manual-payouts?status=ACTIVE  — список ручных начислений
 */
export async function GET(request: NextRequest) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const session = await requireAdmin(request);
  if (!session) return NextResponse.json({ success: false, error: 'forbidden' }, { status: 403, headers: cors });

  const url = new URL(request.url);
  const status = url.searchParams.get('status') || '';
  const limit = Math.min(500, parseInt(url.searchParams.get('limit') || '100'));

  const where = status ? `WHERE mp.status = $1` : '';
  const args = status ? [status] : [];

  const rows = (await prisma.$queryRawUnsafe(
    `SELECT mp.id, mp.author_id, mp.admin_id, mp.gross, mp.source_amount, mp.commission_pct,
            mp.contract_ref, mp.comment, mp.status, mp.created_at, mp.reversed_at, mp.reverse_reason,
            au.email AS author_email, au."firstName" AS author_first, au."lastName" AS author_last,
            ad.email AS admin_email
       FROM manual_payouts mp
       JOIN users au ON au.id = mp.author_id
       JOIN users ad ON ad.id = mp.admin_id
       ${where}
      ORDER BY mp.created_at DESC
      LIMIT ${limit}`,
    ...args
  )) as any[];

  return NextResponse.json({
    success: true,
    data: rows.map((r) => ({
      id: r.id,
      author: { id: r.author_id, email: r.author_email, name: [r.author_first, r.author_last].filter(Boolean).join(' ') },
      adminEmail: r.admin_email,
      gross: Number(r.gross),
      sourceAmount: r.source_amount ? Number(r.source_amount) : null,
      commissionPct: r.commission_pct,
      contractRef: r.contract_ref,
      comment: r.comment,
      status: r.status,
      createdAt: r.created_at,
      reversedAt: r.reversed_at,
      reverseReason: r.reverse_reason,
    })),
  }, { headers: cors });
}

/**
 * POST /api/admin/manual-payouts
 * Body: { authorId, sourceAmount?, gross, commissionPct?, contractRef?, comment }
 *
 * Создаёт ручное начисление и добавляет к users.balance.
 * Логирование: кто (admin_id), когда (created_at), сколько (gross), почему (comment).
 */
export async function POST(request: NextRequest) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const session = await requireAdmin(request);
  if (!session) return NextResponse.json({ success: false, error: 'forbidden' }, { status: 403, headers: cors });

  const body = await request.json().catch(() => ({}));
  const authorId = String(body.authorId || '');
  const sourceAmount = body.sourceAmount != null ? Number(body.sourceAmount) : null;
  const commissionPct = body.commissionPct != null ? Math.min(50, Math.max(0, Number(body.commissionPct))) : 20;
  let gross = Number(body.gross || 0);
  // Если задана исходная сумма счёта — рассчитываем gross автоматически (80% по умолчанию)
  if (sourceAmount && (!gross || gross === 0)) {
    gross = Math.round((sourceAmount * (100 - commissionPct) / 100) * 100) / 100;
  }
  const contractRef = body.contractRef ? String(body.contractRef).slice(0, 300) : null;
  const comment = String(body.comment || '').slice(0, 1000);

  if (!authorId) {
    return NextResponse.json({ success: false, error: 'Выберите автора' }, { status: 400, headers: cors });
  }
  if (!gross || gross <= 0) {
    return NextResponse.json({ success: false, error: 'Сумма начисления должна быть больше 0' }, { status: 400, headers: cors });
  }
  if (!comment.trim()) {
    return NextResponse.json({ success: false, error: 'Укажите комментарий (договор, ссылка)' }, { status: 400, headers: cors });
  }

  // Проверка что автор существует и роль ARTIST
  const author = await prisma.user.findUnique({
    where: { id: authorId },
    select: { id: true, role: true, balance: true },
  });
  if (!author) {
    return NextResponse.json({ success: false, error: 'Автор не найден' }, { status: 404, headers: cors });
  }
  if (author.role !== 'ARTIST') {
    return NextResponse.json({ success: false, error: 'Пользователь не является автором' }, { status: 400, headers: cors });
  }

  const id = mid();
  await prisma.$transaction([
    prisma.$executeRawUnsafe(
      `INSERT INTO manual_payouts (id, author_id, admin_id, gross, source_amount, commission_pct, contract_ref, comment, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ACTIVE')`,
      id, authorId, session.userId, gross, sourceAmount, commissionPct, contractRef, comment
    ),
    prisma.user.update({
      where: { id: authorId },
      data: { balance: { increment: gross } },
    }),
  ]);

  return NextResponse.json({ success: true, data: { id, gross } }, { headers: cors });
}

/**
 * PATCH /api/admin/manual-payouts  { id, reverseReason }
 * Отмена ошибочного начисления с возвратом баланса.
 */
export async function PATCH(request: NextRequest) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const session = await requireAdmin(request);
  if (!session) return NextResponse.json({ success: false, error: 'forbidden' }, { status: 403, headers: cors });

  const body = await request.json().catch(() => ({}));
  const id = String(body.id || '');
  const reverseReason = String(body.reverseReason || '').slice(0, 500);

  if (!id) return NextResponse.json({ success: false, error: 'id обязателен' }, { status: 400, headers: cors });
  if (!reverseReason.trim()) {
    return NextResponse.json({ success: false, error: 'Укажите причину отмены' }, { status: 400, headers: cors });
  }

  const [mp] = (await prisma.$queryRawUnsafe(
    `SELECT id, author_id, gross, status FROM manual_payouts WHERE id = $1`,
    id
  )) as any[];
  if (!mp) return NextResponse.json({ success: false, error: 'Не найдено' }, { status: 404, headers: cors });
  if (mp.status !== 'ACTIVE') return NextResponse.json({ success: false, error: 'Уже отменено' }, { status: 400, headers: cors });

  await prisma.$transaction([
    prisma.$executeRawUnsafe(
      `UPDATE manual_payouts SET status = 'REVERSED', reversed_at = now(), reversed_by = $1, reverse_reason = $2 WHERE id = $3`,
      session.userId, reverseReason, id
    ),
    prisma.user.update({
      where: { id: mp.author_id },
      data: { balance: { decrement: Number(mp.gross) } },
    }),
  ]);

  return NextResponse.json({ success: true }, { headers: cors });
}
