import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyNotification } from '@/lib/tinkoff';

// Webhook от Т-Банка: нужно вернуть текст "OK" в случае успеха.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    console.log('[TINKOFF_NOTIFY]', JSON.stringify(body));

    if (!verifyNotification(body)) {
      console.error('[TINKOFF_NOTIFY] invalid signature');
      return new Response('BAD_SIGN', { status: 400 });
    }

    const orderId: string = body.OrderId || '';
    const status: string = body.Status || '';
    const success: boolean = body.Success === true || body.Success === 'true';

    // ===== Подписка =====
    let m = orderId.match(/^sub_([^_]+)_/);
    if (m) {
      const subId = m[1];
      if (success && (status === 'CONFIRMED' || status === 'AUTHORIZED')) {
        const now = new Date();
        const endDate = new Date(now);
        endDate.setMonth(endDate.getMonth() + 1);
        await prisma.subscription.update({
          where: { id: subId },
          data: {
            status: 'ACTIVE' as any,
            startDate: now,
            endDate,
          },
        });
        console.log(`[TINKOFF_NOTIFY] sub ${subId} → ACTIVE`);
      } else if (status === 'REJECTED' || status === 'AUTH_FAIL' || status === 'CANCELED') {
        await prisma.subscription
          .update({ where: { id: subId }, data: { status: 'EXPIRED' as any } })
          .catch(() => null);
        console.log(`[TINKOFF_NOTIFY] sub ${subId} → REJECTED (${status})`);
      }
      return new Response('OK', { status: 200 });
    }

    // ===== Лицензия =====
    m = orderId.match(/^lic_([a-z0-9]+)_/);
    if (m) {
      const lpId = m[1];
      if (success && (status === 'CONFIRMED' || status === 'AUTHORIZED')) {
        await prisma.$executeRawUnsafe(
          `UPDATE license_purchases
             SET status = 'PAID', paid_at = now()
           WHERE id = $1`,
          lpId
        );

        // Начисление на баланс артиста
        const [lp] = (await prisma.$queryRawUnsafe(
          `SELECT lp.artist_amount, t."artistId", a."userId"
           FROM license_purchases lp
           JOIN tracks t ON t.id = lp.track_id
           JOIN artists a ON a.id = t."artistId"
           WHERE lp.id = $1`,
          lpId
        )) as any[];

        if (lp?.user_id) {
          await prisma.$executeRawUnsafe(
            `UPDATE users SET balance = balance + $1, updated_at = now() WHERE id = $2`,
            lp.artist_amount,
            lp.user_id
          );
        }

        console.log(`[TINKOFF_NOTIFY] license ${lpId} → PAID`);
      } else if (status === 'REJECTED' || status === 'AUTH_FAIL' || status === 'CANCELED') {
        await prisma
          .$executeRawUnsafe(
            `UPDATE license_purchases SET status = 'REJECTED' WHERE id = $1`,
            lpId
          )
          .catch(() => null);
        console.log(`[TINKOFF_NOTIFY] license ${lpId} → REJECTED (${status})`);
      }
      return new Response('OK', { status: 200 });
    }

    // ===== ПРОФИ-подписка автора =====
    m = orderId.match(/^prof_([a-z0-9]+)_/);
    if (m) {
      const subId = m[1];
      if (success && (status === 'CONFIRMED' || status === 'AUTHORIZED')) {
        const now = new Date();
        const endsAt = new Date(now);
        endsAt.setMonth(endsAt.getMonth() + 1);
        await prisma.$executeRawUnsafe(
          `UPDATE author_subscriptions
             SET status = 'ACTIVE', starts_at = $1, ends_at = $2, updated_at = now()
           WHERE id = $3`,
          now, endsAt, subId
        );
        console.log(`[TINKOFF_NOTIFY] author_sub ${subId} → ACTIVE PROFI`);
      } else if (status === 'REJECTED' || status === 'AUTH_FAIL' || status === 'CANCELED') {
        await prisma.$executeRawUnsafe(
          `UPDATE author_subscriptions SET status = 'EXPIRED' WHERE id = $1`,
          subId
        ).catch(() => null);
      }
      return new Response('OK', { status: 200 });
    }

    // ===== Донат =====
    m = orderId.match(/^don_([a-z0-9]+)_/);
    if (m) {
      const donId = m[1];
      if (success && (status === 'CONFIRMED' || status === 'AUTHORIZED')) {
        await prisma.$executeRawUnsafe(
          `UPDATE donations SET status = 'PAID', paid_at = now() WHERE id = $1`,
          donId
        );

        // Начисление 100% получателю
        const [d] = (await prisma.$queryRawUnsafe(
          `SELECT d.amount, d.recipient_artist_id, d.recipient_collective_id,
                  a."userId" AS artist_user_id,
                  c."leaderId" AS collective_user_id
           FROM donations d
           LEFT JOIN artists a ON a.id = d.recipient_artist_id
           LEFT JOIN collectives c ON c.id = d.recipient_collective_id
           WHERE d.id = $1`,
          donId
        )) as any[];
        const recipientUserId = d?.artist_user_id || d?.collective_user_id;
        if (recipientUserId) {
          await prisma.$executeRawUnsafe(
            `UPDATE users SET balance = balance + $1, updated_at = now() WHERE id = $2`,
            d.amount,
            recipientUserId
          );
        }
        console.log(`[TINKOFF_NOTIFY] donation ${donId} → PAID`);
      }
      return new Response('OK', { status: 200 });
    }

    console.error('[TINKOFF_NOTIFY] unknown order format', orderId);
    return new Response('OK', { status: 200 });
  } catch (e) {
    console.error('[TINKOFF_NOTIFY_ERR]', e);
    return new Response('ERR', { status: 500 });
  }
}
