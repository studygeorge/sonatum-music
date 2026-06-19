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

// GET /api/users/me/purchases — все «покупки» текущего пользователя:
// лицензии, подписки Premium / Студент, ПРОФИ, донаты исходящие
export async function GET(request: NextRequest) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) {
    return NextResponse.json({ success: false, error: 'Не авторизован' }, { status: 401, headers: cors });
  }
  const session = await AuthService.validateSession(auth.substring(7));
  if (!session) {
    return NextResponse.json({ success: false, error: 'Сессия истекла' }, { status: 401, headers: cors });
  }

  const userId = session.userId;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  const email = user?.email || '';

  // Лицензии (включая минусовки)
  // === В «Покупках» показываем ТОЛЬКО успешно выполненные транзакции ===
  // PENDING / AWAITING_MANAGER / REJECTED / EXCLUSIVE_REQUESTED не показываем —
  // по этим записям деньги не списались / операция не завершена.

  // Лицензии — только оплаченные
  const licenses = (await prisma.$queryRawUnsafe(
    `SELECT lp.id, lp.price, lp.status, lp.created_at, lp.paid_at, lp.license_code,
            lc.short_name AS license_name, t.title AS track_title, t.slug AS track_slug,
            a.name AS artist_name
       FROM license_purchases lp
       JOIN tracks t ON t.id = lp.track_id
       LEFT JOIN license_catalog lc ON lc.code = lp.license_code
       LEFT JOIN artists a ON a.id = t."artistId"
      WHERE (lp.buyer_id = $1 OR lp.buyer_email = $2)
        AND lp.status = 'PAID'
      ORDER BY lp.created_at DESC`,
    userId, email
  )) as any[];

  // Premium-подписки — только реально оплаченные (ACTIVE/EXPIRED/CANCELED)
  const subs = (await prisma.$queryRawUnsafe(
    `SELECT id, tier, status, price, "startDate" AS start_date, "endDate" AS end_date, "createdAt" AS created_at
       FROM subscriptions
      WHERE "userId" = $1 AND status IN ('ACTIVE','EXPIRED','CANCELED')
      ORDER BY "createdAt" DESC LIMIT 20`,
    userId
  )) as any[];

  // ПРОФИ-подписки автора — только оплаченные
  const profis = (await prisma.$queryRawUnsafe(
    `SELECT id, tier, status, price, starts_at AS start_date, ends_at AS end_date, created_at
       FROM author_subscriptions
      WHERE user_id = $1 AND status IN ('ACTIVE','EXPIRED','CANCELED')
      ORDER BY created_at DESC LIMIT 20`,
    userId
  )) as any[];

  // Исходящие донаты — только оплаченные
  const donations = (await prisma.$queryRawUnsafe(
    `SELECT d.id, d.amount, d.status, d.created_at, d.paid_at, d.message,
            COALESCE(a.name, c.name) AS recipient_name,
            COALESCE(a.slug, c.slug) AS recipient_slug
       FROM donations d
       LEFT JOIN artists a ON a.id = d.recipient_artist_id
       LEFT JOIN collectives c ON c.id = d.recipient_collective_id
      WHERE d.donor_id = $1 AND d.status = 'PAID'
      ORDER BY d.created_at DESC LIMIT 50`,
    userId
  )) as any[];

  // Объединяем в один список
  type Item = {
    id: string;
    kind: 'Лицензия' | 'Premium' | 'ПРОФИ' | 'Донат';
    subject: string;
    detail?: string;
    amount: number;
    status: string;
    createdAt: any;
    paidAt: any;
    receiptUrl?: string;
  };

  const items: Item[] = [
    ...licenses.map((l): Item => ({
      id: l.id,
      kind: 'Лицензия',
      subject: l.track_title || '—',
      detail: [l.license_name, l.artist_name].filter(Boolean).join(' · '),
      amount: Number(l.price || 0),
      status: l.status,
      createdAt: l.created_at,
      paidAt: l.paid_at,
    })),
    ...subs.map((s): Item => ({
      id: s.id,
      kind: 'Premium',
      subject: `Sonatum ${s.tier === 'STUDENT' ? 'Студент' : 'Premium'}`,
      detail: s.end_date ? `до ${new Date(s.end_date).toLocaleDateString('ru-RU')}` : undefined,
      amount: Number(s.price || 0),
      status: s.status,
      createdAt: s.created_at,
      paidAt: s.start_date,
    })),
    ...profis.map((p): Item => ({
      id: p.id,
      kind: 'ПРОФИ',
      subject: 'Подписка ПРОФИ автора',
      detail: p.end_date ? `до ${new Date(p.end_date).toLocaleDateString('ru-RU')}` : undefined,
      amount: Number(p.price || 0),
      status: p.status,
      createdAt: p.created_at,
      paidAt: p.start_date,
    })),
    ...donations.map((d): Item => ({
      id: d.id,
      kind: 'Донат',
      subject: `Поддержка автора: ${d.recipient_name || '—'}`,
      detail: d.message ? `«${String(d.message).slice(0, 60)}»` : undefined,
      amount: Number(d.amount || 0),
      status: d.status,
      createdAt: d.created_at,
      paidAt: d.paid_at,
    })),
  ];

  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return NextResponse.json({ success: true, data: items }, { headers: cors });
}
