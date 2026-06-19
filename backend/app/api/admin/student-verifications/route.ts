import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AuthService } from '@/lib/auth';
import { getCorsHeaders } from '@/lib/cors';
import { sendMail } from '@/lib/mailer';

const SITE_URL = process.env.SITE_URL || 'https://sonatum-music.ru';

export const dynamic = 'force-dynamic';

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request.headers.get('origin') || undefined),
  });
}

async function requireAdmin(request: NextRequest) {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const session = await AuthService.validateSession(auth.substring(7));
  if (!session) return null;
  if (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN') return null;
  return session;
}

// GET /api/admin/student-verifications?status=PENDING
export async function GET(request: NextRequest) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const session = await requireAdmin(request);
  if (!session) return NextResponse.json({ success: false, error: 'Доступ запрещён' }, { status: 403, headers: cors });

  const url = new URL(request.url);
  const status = url.searchParams.get('status') || 'PENDING';

  const rows = (await prisma.$queryRawUnsafe(
    `SELECT sv.id, sv.user_id, sv.institution, sv.document_url, sv.status, sv.admin_note,
            sv.expires_at, sv.created_at, sv.reviewed_at,
            u.email, u."firstName", u."lastName", u.username
       FROM student_verifications sv
       JOIN users u ON u.id = sv.user_id
       WHERE sv.status = $1
       ORDER BY sv.created_at DESC LIMIT 100`,
    status
  )) as any[];

  return NextResponse.json({
    success: true,
    data: rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      userEmail: r.email,
      userName: [r.firstName, r.lastName].filter(Boolean).join(' ') || r.username,
      institution: r.institution,
      documentUrl: r.document_url,
      status: r.status,
      adminNote: r.admin_note,
      expiresAt: r.expires_at,
      createdAt: r.created_at,
      reviewedAt: r.reviewed_at,
    })),
  }, { headers: cors });
}

// PATCH — { id, status: APPROVED|REJECTED, adminNote? }
// При APPROVED — активируется студенческая подписка пользователя
export async function PATCH(request: NextRequest) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const session = await requireAdmin(request);
  if (!session) return NextResponse.json({ success: false, error: 'Доступ запрещён' }, { status: 403, headers: cors });

  const body = await request.json().catch(() => ({}));
  const id = String(body?.id || '');
  const status = String(body?.status || '');
  const adminNote = body.adminNote ? String(body.adminNote).slice(0, 500) : null;

  if (!id || !['APPROVED', 'REJECTED'].includes(status)) {
    return NextResponse.json({ success: false, error: 'Неверные параметры' }, { status: 400, headers: cors });
  }

  const [verification] = (await prisma.$queryRawUnsafe(
    `SELECT user_id, expires_at FROM student_verifications WHERE id = $1`, id
  )) as any[];
  if (!verification) {
    return NextResponse.json({ success: false, error: 'Заявка не найдена' }, { status: 404, headers: cors });
  }

  await prisma.$executeRawUnsafe(
    `UPDATE student_verifications SET status = $1, admin_note = $2, reviewed_at = now() WHERE id = $3`,
    status, adminNote, id
  );

  // Если одобрено — активируем студенческую подписку
  let endDate: Date | null = null;
  if (status === 'APPROVED') {
    // Только сохраняем дату окончания статуса. Подписку юзер оформляет сам,
    // тариф STUDENT (149₽/мес) станет доступен ему в /profile?tab=subscription.
    endDate = verification.expires_at || new Date(Date.now() + 365 * 86_400_000);
  }

  // Письмо пользователю
  try {
    const user = await prisma.user.findUnique({
      where: { id: verification.user_id },
      select: { email: true, firstName: true, username: true },
    });
    if (user?.email) {
      const greeting = user.firstName || user.username || 'друг';
      if (status === 'APPROVED') {
        const expStr = endDate ? new Date(endDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';
        sendMail({
          to: user.email,
          subject: 'Студенческий статус подтверждён · Сонатум',
          html: `
            <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:560px;margin:0 auto;padding:32px;color:#1c1c1e;">
              <h1 style="font-size:22px;margin:0 0 16px;">Статус подтверждён</h1>
              <p style="font-size:15px;line-height:1.6;">Здравствуйте, ${greeting}!</p>
              <p style="font-size:15px;line-height:1.6;">
                Ваш студенческий статус подтверждён до <b>${expStr}</b>. Теперь вам доступен тариф
                <b>STUDENT — 149 ₽/мес</b> вместо 299 ₽ Premium.
              </p>
              <p style="font-size:15px;line-height:1.6;">
                Чтобы активировать подписку, оформите её в личном кабинете. Статус действует 1 год,
                после чего его нужно будет подтвердить заново.
              </p>
              <p style="margin:24px 0;">
                <a href="${SITE_URL}/profile?tab=subscription" style="display:inline-block;background:#1c1c1e;color:#fff;padding:12px 28px;border-radius:999px;text-decoration:none;font-weight:600;font-size:14px;">
                  Оформить подписку STUDENT
                </a>
              </p>
            </div>
          `,
        }).catch((e) => console.error('[MAIL student approve]', e));
      } else {
        sendMail({
          to: user.email,
          subject: 'Заявка на студенческую подписку отклонена · Сонатум',
          html: `
            <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:560px;margin:0 auto;padding:32px;color:#1c1c1e;">
              <h1 style="font-size:22px;margin:0 0 16px;">Заявка отклонена</h1>
              <p style="font-size:15px;line-height:1.6;">Здравствуйте, ${greeting}!</p>
              <p style="font-size:15px;line-height:1.6;">
                К сожалению, мы не смогли подтвердить ваш студенческий статус.
              </p>
              ${adminNote ? `<div style="background:#fee2e2;border-radius:12px;padding:16px;margin:16px 0;"><div style="font-size:12px;color:#991b1b;margin-bottom:6px;">Комментарий администратора:</div><div style="font-size:14px;color:#991b1b;">${adminNote}</div></div>` : ''}
              <p style="font-size:14px;line-height:1.6;">Вы можете загрузить документ повторно — например, более чёткий скан или актуальную справку с печатью учебного заведения.</p>
              <a href="${SITE_URL}/profile?tab=student-verify" style="display:inline-block;background:#1c1c1e;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:600;font-size:14px;margin-top:16px;">
                Загрузить документ
              </a>
            </div>
          `,
        }).catch((e) => console.error('[MAIL student reject]', e));
      }
    }
  } catch (e) { console.error('[MAIL student]', e); }

  return NextResponse.json({ success: true }, { headers: cors });
}
