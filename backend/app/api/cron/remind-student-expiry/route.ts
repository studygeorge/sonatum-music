import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendMail } from '@/lib/mailer';
import { getCorsHeaders } from '@/lib/cors';

export const dynamic = 'force-dynamic';

const SITE_URL = process.env.SITE_URL || 'https://sonatum-music.ru';

// POST /api/cron/remind-student-expiry
// Раз в сутки: ищет одобренные студенческие верификации, у которых до expires_at < 30 дней
// и reminded_at IS NULL → шлёт напоминание о необходимости перевалидировать статус.
export async function POST(request: NextRequest) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const secret = request.headers.get('x-cron-secret');
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ success: false, error: 'Доступ запрещён' }, { status: 403, headers: cors });
  }

  const targets = (await prisma.$queryRawUnsafe(
    `SELECT sv.id, sv.expires_at, sv.institution,
            u.id AS user_id, u.email, u."firstName", u.username
       FROM student_verifications sv
       JOIN users u ON u.id = sv.user_id
      WHERE sv.status = 'APPROVED'
        AND sv.expires_at IS NOT NULL
        AND sv.expires_at > now()
        AND sv.expires_at < now() + interval '30 days'
        AND sv.reminded_at IS NULL
        AND u.email IS NOT NULL
      LIMIT 500`
  )) as any[];

  let sent = 0;
  for (const t of targets) {
    const greeting = t.firstName || t.username || 'друг';
    const expiresStr = new Date(t.expires_at).toLocaleDateString('ru-RU', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
    const daysLeft = Math.max(1, Math.ceil((new Date(t.expires_at).getTime() - Date.now()) / (24 * 3600 * 1000)));

    try {
      await sendMail({
        to: t.email,
        subject: `Студенческая подписка истекает через ${daysLeft} дн. — продлите статус · Сонатум`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; color: #1c1c1e;">
            <h1 style="font-size: 22px; margin: 0 0 16px;">Студенческий статус скоро истечёт</h1>
            <p style="font-size: 15px; line-height: 1.6;">Здравствуйте, ${greeting}!</p>
            <p style="font-size: 15px; line-height: 1.6;">
              Ваша студенческая подписка действует до <b>${expiresStr}</b> — осталось ${daysLeft} дн.
              Учреждение: <b>${t.institution}</b>.
            </p>
            <p style="font-size: 15px; line-height: 1.6;">
              После окончания периода подписка автоматически перейдёт в обычный Premium.
              Чтобы продолжать пользоваться Сонатумом бесплатно как студент, загрузите
              актуальный документ повторно.
            </p>
            <a href="${SITE_URL}/profile?tab=student-verify"
               style="display: inline-block; background: #1c1c1e; color: #fff; padding: 12px 24px; border-radius: 999px; text-decoration: none; font-weight: 600; font-size: 14px; margin: 8px 0;">
              Перепроверить статус
            </a>
            <p style="font-size: 12px; color: #9ca3af; margin-top: 32px; line-height: 1.5;">
              Это автоматическое напоминание. Если вы планируете перейти на платный Premium —
              просто проигнорируйте письмо.
            </p>
          </div>
        `,
      });
      await prisma.$executeRawUnsafe(
        `UPDATE student_verifications SET reminded_at = now() WHERE id = $1`,
        t.id
      );
      sent += 1;
    } catch (e) {
      console.error('[REMIND_STUDENT] sendMail failed:', e);
    }
  }

  return NextResponse.json(
    { success: true, candidates: targets.length, reminded: sent },
    { headers: cors }
  );
}

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request.headers.get('origin') || undefined),
  });
}

export const GET = POST;
