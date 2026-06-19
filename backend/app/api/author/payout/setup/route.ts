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

  // === Проверка условий монетизации из ТЗ ===
  // 1) Возраст аккаунта ≥ 3 месяцев
  // 2) Не менее 3 опубликованных треков
  // 3) Верификация самозанятого (выполняется ниже по факту указания ИНН)
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, createdAt: true, role: true },
  });
  if (!user) {
    return NextResponse.json({ success: false, error: 'Пользователь не найден' }, { status: 404, headers: cors });
  }
  if (user.role !== 'ARTIST' && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
    return NextResponse.json(
      { success: false, error: 'Подключение выплат доступно только авторам' },
      { status: 403, headers: cors }
    );
  }

  // Возраст аккаунта (≥ 3 мес)
  const accountAgeMs = Date.now() - new Date(user.createdAt).getTime();
  const MIN_AGE_MS = 90 * 86_400_000;
  if (user.role === 'ARTIST' && accountAgeMs < MIN_AGE_MS) {
    const monthsLeft = Math.ceil((MIN_AGE_MS - accountAgeMs) / (30 * 86_400_000));
    return NextResponse.json(
      {
        success: false,
        error: `Аккаунту должно быть не менее 3 месяцев с момента регистрации. Осталось ~${monthsLeft} мес.`,
        code: 'ACCOUNT_TOO_YOUNG',
      },
      { status: 403, headers: cors }
    );
  }

  // Количество опубликованных треков (≥ 3)
  if (user.role === 'ARTIST') {
    const artist = await prisma.artist.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });
    if (artist) {
      const publishedCount = await prisma.track.count({
        where: { artistId: artist.id, status: 'PUBLISHED' },
      });
      const MIN_TRACKS = 3;
      if (publishedCount < MIN_TRACKS) {
        return NextResponse.json(
          {
            success: false,
            error: `Нужно не менее ${MIN_TRACKS} опубликованных треков, прошедших модерацию. У вас: ${publishedCount}.`,
            code: 'NOT_ENOUGH_TRACKS',
          },
          { status: 403, headers: cors }
        );
      }
    }
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
