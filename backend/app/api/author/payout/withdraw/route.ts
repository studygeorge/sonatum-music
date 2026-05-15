import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AuthService } from '@/lib/auth';
import { getCorsHeaders } from '@/lib/cors';

export const dynamic = 'force-dynamic';

function cuid() {
  return 'wd_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
}

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request.headers.get('origin') || undefined),
  });
}

// POST /api/author/payout/withdraw
// Body: { amount }
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

  let body: any;
  try { body = await request.json(); } catch { body = {}; }
  const amount = Math.floor(Number(body.amount) || 0);
  if (!amount || amount < 100) {
    return NextResponse.json(
      { success: false, error: 'Минимальная сумма вывода — 100 ₽' },
      { status: 400, headers: cors }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { balance: true },
  });
  const balance = Number(user?.balance) || 0;
  if (balance < amount) {
    return NextResponse.json(
      { success: false, error: 'Недостаточно средств на балансе' },
      { status: 400, headers: cors }
    );
  }

  const [extras] = (await prisma.$queryRawUnsafe(
    `SELECT payout_enabled, sbp_phone FROM users WHERE id = $1`,
    session.userId
  )) as any[];
  if (!extras?.payout_enabled) {
    return NextResponse.json(
      { success: false, error: 'Выплаты не подключены' },
      { status: 400, headers: cors }
    );
  }
  if (!extras?.sbp_phone) {
    return NextResponse.json(
      { success: false, error: 'Не указан телефон для СБП' },
      { status: 400, headers: cors }
    );
  }

  const wdId = cuid();
  await prisma.$transaction([
    prisma.$executeRawUnsafe(
      `INSERT INTO withdrawals (id, user_id, amount, sbp_phone, status)
       VALUES ($1, $2, $3, $4, 'PENDING')`,
      wdId,
      session.userId,
      amount,
      extras.sbp_phone
    ),
    prisma.user.update({
      where: { id: session.userId },
      data: { balance: { decrement: amount } },
    }),
  ]);

  return NextResponse.json(
    {
      success: true,
      withdrawalId: wdId,
      message:
        'Заявка на вывод принята. Перевод поступит на ваш СБП в течение 1-3 рабочих дней.',
    },
    { headers: cors }
  );
}

// GET /api/author/payout/withdraw — история выводов
export async function GET(request: NextRequest) {
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
  const rows = (await prisma.$queryRawUnsafe(
    `SELECT id, amount, sbp_phone, status, notes, created_at, completed_at
       FROM withdrawals WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
    session.userId
  )) as any[];
  return NextResponse.json(
    {
      success: true,
      data: rows.map((r) => ({
        id: r.id,
        amount: Number(r.amount),
        sbpPhone: r.sbp_phone,
        status: r.status,
        notes: r.notes,
        createdAt: r.created_at,
        completedAt: r.completed_at,
      })),
    },
    { headers: cors }
  );
}
