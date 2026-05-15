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

// POST /api/author/payout/setup
// Body: { tin, sbpPhone, fullName?, birthDate? }
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

  const tin = String(body.tin || '').replace(/\D/g, '');
  const sbpPhone = String(body.sbpPhone || '').replace(/[^\d+]/g, '');

  if (!/^\d{12}$/.test(tin)) {
    return NextResponse.json(
      { success: false, error: 'ИНН должен быть 12 цифр' },
      { status: 400, headers: cors }
    );
  }
  if (!/^\+?\d{10,15}$/.test(sbpPhone)) {
    return NextResponse.json(
      { success: false, error: 'Укажите корректный номер телефона для СБП' },
      { status: 400, headers: cors }
    );
  }

  // Для MVP — автоматически верифицируем как самозанятого (в реальности тут идёт запрос к Госуслугам или НПД API)
  await prisma.$executeRawUnsafe(
    `UPDATE users SET
       tin = $1,
       sbp_phone = $2,
       payout_enabled = true,
       self_employed_verified_at = now(),
       updated_at = now()
     WHERE id = $3`,
    tin,
    sbpPhone,
    session.userId
  );

  return NextResponse.json(
    {
      success: true,
      message:
        'Выплаты подключены. Теперь вы сможете вывести накопленный баланс через СБП.',
    },
    { headers: cors }
  );
}
