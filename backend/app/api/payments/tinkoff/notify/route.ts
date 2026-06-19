import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyNotification } from '@/lib/tinkoff';
import { sendMail } from '@/lib/mailer';

import { logError } from '@/lib/errors';
const SITE_URL = process.env.SITE_URL || 'https://sonatum-music.ru';

// Письмо автору о новой продаже лицензии
async function notifySaleToAuthor(lpId: string) {
  try {
    const [r] = (await prisma.$queryRawUnsafe(
      `SELECT lp.price, lp.artist_amount, lp.buyer_email, lp.buyer_name, lp.license_code,
              t.title AS track_title, t.slug AS track_slug,
              a.name AS artist_name,
              u.email AS author_email, u."firstName", u.username,
              lc.name AS license_name
         FROM license_purchases lp
         JOIN tracks t ON t.id = lp.track_id
         JOIN artists a ON a.id = t."artistId"
         JOIN users u ON u.id = a."userId"
         LEFT JOIN license_catalog lc ON lc.code = lp.license_code
        WHERE lp.id = $1`,
      lpId
    )) as any[];
    if (!r?.author_email) return;
    const greeting = r.firstName || r.username || 'автор';
    await sendMail({
      to: r.author_email,
      subject: `Новая продажа на Сонатум: «${r.track_title}» · ${Math.round(r.artist_amount)} ₽`,
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:560px;margin:0 auto;padding:32px;color:#1c1c1e;">
          <h1 style="font-size:22px;margin:0 0 16px;">🎉 Новая продажа</h1>
          <p style="font-size:15px;line-height:1.6;">Здравствуйте, ${greeting}!</p>
          <p style="font-size:15px;line-height:1.6;">
            Поздравляем — ваш трек <b>«${r.track_title}»</b> только что приобрели по лицензии «${r.license_name || r.license_code}».
          </p>
          <div style="background:#f4f4f7;border-radius:16px;padding:20px;margin:20px 0;">
            <div style="font-size:13px;color:#86868b;">Вам начислено на баланс</div>
            <div style="font-size:26px;font-weight:800;color:#1d4cb8;">${Math.round(r.artist_amount)} ₽</div>
            <div style="font-size:12px;color:#86868b;margin-top:8px;">из ${Math.round(r.price)} ₽ покупки</div>
          </div>
          <a href="${SITE_URL}/author/finance" style="display:inline-block;background:#1c1c1e;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:600;font-size:14px;">
            Открыть финансы
          </a>
          <p style="font-size:12px;color:#9ca3af;margin-top:32px;">Покупатель: ${r.buyer_name || '—'} (${r.buyer_email})</p>
        </div>
      `,
    });
  } catch (e) {
    logError('tinkoff.notify', e, { extra: { tag: 'NOTIFY_SALE' } }).catch(()=>{}); console.error('[NOTIFY_SALE]', e);
  }
}

// Письмо покупателю — чек об оплате лицензии
async function notifyBuyerReceipt(lpId: string) {
  try {
    const [r] = (await prisma.$queryRawUnsafe(
      `SELECT lp.price, lp.buyer_email, lp.buyer_name, lp.id, lp.license_pdf_url, lp.download_url,
              t.title AS track_title, t.slug AS track_slug,
              a.name AS artist_name,
              lc.name AS license_name
         FROM license_purchases lp
         JOIN tracks t ON t.id = lp.track_id
         JOIN artists a ON a.id = t."artistId"
         LEFT JOIN license_catalog lc ON lc.code = lp.license_code
        WHERE lp.id = $1`,
      lpId
    )) as any[];
    if (!r?.buyer_email) return;
    await sendMail({
      to: r.buyer_email,
      subject: `Спасибо за покупку — «${r.track_title}» · Сонатум`,
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:560px;margin:0 auto;padding:32px;color:#1c1c1e;">
          <h1 style="font-size:22px;margin:0 0 16px;">Оплата подтверждена</h1>
          <p style="font-size:15px;line-height:1.6;">Здравствуйте${r.buyer_name ? ', ' + r.buyer_name : ''}!</p>
          <p style="font-size:15px;line-height:1.6;">
            Спасибо за покупку лицензии «${r.license_name}» на трек <b>«${r.track_title}»</b> (${r.artist_name}).
          </p>
          <div style="background:#f4f4f7;border-radius:16px;padding:20px;margin:20px 0;">
            <div style="font-size:13px;color:#86868b;">Сумма</div>
            <div style="font-size:26px;font-weight:800;">${Math.round(r.price)} ₽</div>
            <div style="font-size:12px;color:#86868b;margin-top:8px;">№ покупки: ${r.id}</div>
          </div>
          ${r.download_url ? `<p><a href="${r.download_url}" style="color:#1d4cb8;">Скачать трек</a></p>` : ''}
          ${r.license_pdf_url ? `<p><a href="${r.license_pdf_url}" style="color:#1d4cb8;">Скачать договор-лицензию (PDF)</a></p>` : ''}
          <a href="${SITE_URL}/profile?tab=purchases" style="display:inline-block;background:#1c1c1e;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:600;font-size:14px;margin-top:16px;">
            Мои покупки
          </a>
        </div>
      `,
    });
  } catch (e) {
    logError('tinkoff.notify', e, { extra: { tag: 'NOTIFY_BUYER' } }).catch(()=>{}); console.error('[NOTIFY_BUYER]', e);
  }
}

// Письмо получателю о новом донате
async function notifyDonation(donId: string) {
  try {
    const [r] = (await prisma.$queryRawUnsafe(
      `SELECT d.amount, d.recipient_amount, d.message, d.donor_nickname,
              a."userId" AS artist_user_id,
              c."leaderId" AS collective_user_id,
              ua.email AS artist_email, ua."firstName" AS artist_first,
              uc.email AS collective_email, uc."firstName" AS collective_first
         FROM donations d
         LEFT JOIN artists a ON a.id = d.recipient_artist_id
         LEFT JOIN collectives c ON c.id = d.recipient_collective_id
         LEFT JOIN users ua ON ua.id = a."userId"
         LEFT JOIN users uc ON uc.id = c."leaderId"
        WHERE d.id = $1`,
      donId
    )) as any[];
    const email = r?.artist_email || r?.collective_email;
    if (!email) return;
    const greeting = r.artist_first || r.collective_first || 'автор';
    const credited = r.recipient_amount != null ? Number(r.recipient_amount) : Math.round(Number(r.amount) * 0.9);
    await sendMail({
      to: email,
      subject: `💝 Новый донат на ${Math.round(credited)} ₽ · Сонатум`,
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:560px;margin:0 auto;padding:32px;color:#1c1c1e;">
          <h1 style="font-size:22px;margin:0 0 16px;">Вам отправили донат</h1>
          <p style="font-size:15px;line-height:1.6;">Здравствуйте, ${greeting}!</p>
          <p style="font-size:15px;line-height:1.6;">
            ${r.donor_nickname ? `<b>${r.donor_nickname}</b>` : 'Слушатель'} поддержал ваше творчество.
          </p>
          <div style="background:#fef3c7;border-radius:16px;padding:20px;margin:20px 0;">
            <div style="font-size:13px;color:#92400e;">На баланс зачислено</div>
            <div style="font-size:26px;font-weight:800;color:#92400e;">${Math.round(credited)} ₽</div>
            <div style="font-size:12px;color:#86868b;margin-top:8px;">из ${Math.round(r.amount)} ₽ (комиссия платформы 10%)</div>
          </div>
          ${r.message ? `<div style="background:#f4f4f7;border-radius:12px;padding:16px;margin:16px 0;"><div style="font-size:12px;color:#86868b;margin-bottom:6px;">Сообщение от слушателя:</div><div style="font-size:14px;font-style:italic;">«${r.message}»</div></div>` : ''}
          <a href="${SITE_URL}/author/finance" style="display:inline-block;background:#1c1c1e;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:600;font-size:14px;">
            Открыть финансы
          </a>
        </div>
      `,
    });
  } catch (e) {
    logError('tinkoff.notify', e, { extra: { tag: 'NOTIFY_DONATION' } }).catch(()=>{}); console.error('[NOTIFY_DONATION]', e);
  }
}

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
        // Т-Банк присылает и AUTHORIZED, и CONFIRMED — активируем идемпотентно,
        // а письмо шлём только при ПЕРВОМ переходе в ACTIVE (иначе придёт дважды).
        const prev = await prisma.subscription.findUnique({
          where: { id: subId },
          select: { status: true },
        });
        const alreadyActive = prev?.status === 'ACTIVE';

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

        // Письмо подписчику — только если подписка ещё не была активной
        if (!alreadyActive) try {
          const [s] = (await prisma.$queryRawUnsafe(
            `SELECT s.tier, s."endDate", u.email, u."firstName", u.username
               FROM subscriptions s JOIN users u ON u.id = s."userId" WHERE s.id = $1`,
            subId
          )) as any[];
          if (s?.email) {
            const greeting = s.firstName || s.username || 'друг';
            const endStr = new Date(s.endDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
            sendMail({
              to: s.email,
              subject: `Premium активирован · Сонатум`,
              html: `
                <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:560px;margin:0 auto;padding:32px;color:#1c1c1e;">
                  <h1 style="font-size:22px;margin:0 0 16px;">Premium активирован</h1>
                  <p style="font-size:15px;line-height:1.6;">Здравствуйте, ${greeting}!</p>
                  <p style="font-size:15px;line-height:1.6;">
                    Спасибо за оформление подписки <b>${s.tier}</b>. Все возможности Сонатума открыты до <b>${endStr}</b>.
                  </p>
                  <ul style="font-size:14px;line-height:1.8;color:#1c1c1e;padding-left:20px;">
                    <li>Доступ к нотам</li>
                    <li>Комментарии к трекам</li>
                    <li>Безлимит плейлистов</li>
                    <li>Полное прослушивание без рекламы</li>
                  </ul>
                  <a href="${SITE_URL}/profile?tab=subscription" style="display:inline-block;background:#1c1c1e;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:600;font-size:14px;margin-top:16px;">
                    Открыть подписку
                  </a>
                </div>
              `,
            }).catch(() => {});
          }
        } catch (e) { logError('tinkoff.notify', e, { extra: { tag: 'MAIL' } }).catch(()=>{}); console.error('[MAIL]', e); }

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
        // Если у лицензии есть period_days — выставляем valid_until = now() + period_days
        await prisma.$executeRawUnsafe(
          `UPDATE license_purchases lp
             SET status = 'PAID',
                 paid_at = now(),
                 valid_until = CASE
                   WHEN (SELECT period_days FROM license_catalog WHERE code = lp.license_code) IS NOT NULL
                   THEN now() + ((SELECT period_days FROM license_catalog WHERE code = lp.license_code) || ' days')::interval
                   ELSE lp.valid_until
                 END
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

        // Письма: автору о продаже + покупателю о чеке
        notifySaleToAuthor(lpId).catch(() => {});
        notifyBuyerReceipt(lpId).catch(() => {});

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

        // Письмо подписчику-автору
        try {
          const [s] = (await prisma.$queryRawUnsafe(
            `SELECT asub.ends_at, asub.tier, u.email, u."firstName", u.username
               FROM author_subscriptions asub
               JOIN users u ON u.id = asub.user_id
              WHERE asub.id = $1`,
            subId
          )) as any[];
          if (s?.email) {
            const greeting = s.firstName || s.username || 'автор';
            const endStr = new Date(s.ends_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
            sendMail({
              to: s.email,
              subject: '⭐ Тариф ПРОФИ активирован · Сонатум',
              html: `
                <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:560px;margin:0 auto;padding:32px;color:#1c1c1e;">
                  <h1 style="font-size:22px;margin:0 0 16px;">ПРОФИ активирован</h1>
                  <p style="font-size:15px;line-height:1.6;">Здравствуйте, ${greeting}!</p>
                  <p style="font-size:15px;line-height:1.6;">
                    Тариф <b>ПРОФИ</b> активен до <b>${endStr}</b>. Теперь 0% комиссии платформы на ваши продажи.
                  </p>
                  <a href="${SITE_URL}/author/finance" style="display:inline-block;background:#1c1c1e;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:600;font-size:14px;margin-top:16px;">
                    Открыть финансы
                  </a>
                </div>
              `,
            }).catch(() => {});
          }
        } catch (e) { logError('tinkoff.notify', e, { extra: { tag: 'MAIL' } }).catch(()=>{}); console.error('[MAIL]', e); }

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

        // Начисление получателю (с учётом 10% комиссии платформы)
        const [d] = (await prisma.$queryRawUnsafe(
          `SELECT d.amount, d.recipient_amount, d.recipient_artist_id, d.recipient_collective_id,
                  a."userId" AS artist_user_id,
                  c."leaderId" AS collective_user_id
           FROM donations d
           LEFT JOIN artists a ON a.id = d.recipient_artist_id
           LEFT JOIN collectives c ON c.id = d.recipient_collective_id
           WHERE d.id = $1`,
          donId
        )) as any[];
        const recipientUserId = d?.artist_user_id || d?.collective_user_id;
        // Если recipient_amount пуст (старые записи) — считаем 90% от amount
        const toCredit = d?.recipient_amount != null
          ? Number(d.recipient_amount)
          : Math.round(Number(d?.amount || 0) * 0.9 * 100) / 100;
        if (recipientUserId && toCredit > 0) {
          await prisma.$executeRawUnsafe(
            `UPDATE users SET balance = balance + $1, updated_at = now() WHERE id = $2`,
            toCredit,
            recipientUserId
          );
        }
        // Письмо получателю
        notifyDonation(donId).catch(() => {});
        console.log(`[TINKOFF_NOTIFY] donation ${donId} → PAID`);
      }
      return new Response('OK', { status: 200 });
    }

    logError('tinkoff.notify', orderId, { extra: { tag: 'TINKOFF_NOTIFY' } }).catch(()=>{}); console.error('[TINKOFF_NOTIFY]', orderId);
    return new Response('OK', { status: 200 });
  } catch (e) {
    logError('tinkoff.notify', e, { extra: { tag: 'TINKOFF_NOTIFY_ERR' } }).catch(()=>{}); console.error('[TINKOFF_NOTIFY_ERR]', e);
    return new Response('ERR', { status: 500 });
  }
}
