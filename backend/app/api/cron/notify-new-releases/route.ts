import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendMail } from '@/lib/mailer';
import { getCorsHeaders } from '@/lib/cors';

export const dynamic = 'force-dynamic';

const SITE_URL = process.env.SITE_URL || 'https://sonatum-music.ru';

// POST /api/cron/notify-new-releases
// Находит треки, опубликованные за последние 24 часа, у которых ещё не рассылали уведомления,
// и шлёт письмо каждому подписчику артиста (artist_follows). Метит трек.
// Защита: X-Cron-Secret = CRON_SECRET.
export async function POST(request: NextRequest) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const secret = request.headers.get('x-cron-secret');
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ success: false, error: 'Доступ запрещён' }, { status: 403, headers: cors });
  }

  // Свежие треки за 24ч без уведомлений
  const fresh = (await prisma.$queryRawUnsafe(
    `SELECT t.id, t.title, t.slug, t.cover, t."artistId",
            a.name AS artist_name, a.slug AS artist_slug
       FROM tracks t
       JOIN artists a ON a.id = t."artistId"
      WHERE t.status = 'PUBLISHED'
        AND t.new_release_notified_at IS NULL
        AND t."createdAt" >= now() - interval '24 hours'
      ORDER BY t."createdAt" DESC
      LIMIT 100`
  )) as any[];

  let totalEmails = 0;
  const trackIdsNotified: string[] = [];

  for (const t of fresh) {
    // Подписчики артиста, у которых не отключены уведомления о релизах
    const followers = (await prisma.$queryRawUnsafe(
      `SELECT u.id, u.email, u."firstName", u.username, u.notification_settings
         FROM artist_follows af
         JOIN users u ON u.id = af."userId"
        WHERE af."artistId" = $1
          AND u.email IS NOT NULL
          AND COALESCE((u.notification_settings->>'newReleases')::boolean, true) = true`,
      t.artistId
    )) as any[];

    if (followers.length === 0) {
      // Метим, чтобы не проверять снова
      await prisma.$executeRawUnsafe(
        `UPDATE tracks SET new_release_notified_at = now() WHERE id = $1`,
        t.id
      );
      trackIdsNotified.push(t.id);
      continue;
    }

    const trackUrl = `${SITE_URL}/tracks/${t.slug || t.id}`;
    const artistUrl = `${SITE_URL}/artists/${t.artist_slug || t.artistId}`;

    for (const f of followers) {
      const greeting = f.firstName || f.username || 'друг';
      try {
        await sendMail({
          to: f.email,
          subject: `Новый трек от ${t.artist_name} — «${t.title}» · Сонатум`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; color: #1c1c1e;">
              <h1 style="font-size: 22px; margin: 0 0 16px;">Новый релиз!</h1>
              <p style="font-size: 15px; line-height: 1.5;">Здравствуйте, ${greeting}!</p>
              <p style="font-size: 15px; line-height: 1.5;">
                <a href="${artistUrl}" style="color: #1d4cb8; text-decoration: none; font-weight: 600;">${t.artist_name}</a>
                опубликовал(а) новый трек:
              </p>
              <div style="background: #f4f4f7; border-radius: 16px; padding: 20px; margin: 20px 0;">
                ${t.cover ? `<img src="${t.cover}" alt="" style="width: 120px; height: 120px; border-radius: 12px; display: block; margin-bottom: 12px;" />` : ''}
                <div style="font-size: 18px; font-weight: 700;">${t.title}</div>
                <div style="font-size: 13px; color: #6b7280; margin-top: 4px;">${t.artist_name}</div>
              </div>
              <a href="${trackUrl}" style="display: inline-block; background: #1c1c1e; color: #fff; padding: 12px 24px; border-radius: 999px; text-decoration: none; font-weight: 600; font-size: 14px;">
                Слушать на Сонатум
              </a>
              <p style="font-size: 12px; color: #9ca3af; margin-top: 32px; line-height: 1.5;">
                Вы получили это письмо, потому что подписаны на этого автора на сонатум-music.ru.
                <br>
                <a href="${SITE_URL}/profile?tab=settings" style="color: #9ca3af;">Настроить уведомления</a>
              </p>
            </div>
          `,
        });
        totalEmails += 1;
      } catch (e) {
        console.error('[NOTIFY_RELEASES] sendMail failed:', e);
      }
    }

    await prisma.$executeRawUnsafe(
      `UPDATE tracks SET new_release_notified_at = now() WHERE id = $1`,
      t.id
    );
    trackIdsNotified.push(t.id);
  }

  return NextResponse.json(
    {
      success: true,
      tracksProcessed: fresh.length,
      tracksNotified: trackIdsNotified.length,
      emailsSent: totalEmails,
    },
    { headers: cors }
  );
}

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request.headers.get('origin') || undefined),
  });
}

// GET — то же без секрета (для ручного теста). В проде советую использовать POST с секретом.
export const GET = POST;
