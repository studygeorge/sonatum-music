import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/middleware';
import { prisma } from '@/lib/prisma';
import { sendMail } from '@/lib/mailer';

const SITE_URL = process.env.SITE_URL || 'https://sonatum-music.ru';

// Отклонить трек
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return withRole(request, ['ADMIN', 'SUPER_ADMIN'], async (req, session) => {
    try {
      const body = await request.json();
      const { reason } = body;

      if (!reason) {
        return NextResponse.json(
          { success: false, error: 'Rejection reason is required' },
          { status: 400 }
        );
      }

      const track = await prisma.track.findUnique({
        where: { id: params.id }
      });

      if (!track) {
        return NextResponse.json(
          { success: false, error: 'Track not found' },
          { status: 404 }
        );
      }

      const updated = await prisma.track.update({
        where: { id: params.id },
        data: {
          status: 'REJECTED'
        },
        include: {
          artist: {
            select: {
              name: true,
              user: {
                select: {
                  email: true
                }
              }
            }
          }
        }
      });

      const email = (updated as any).artist?.user?.email;
      if (email) {
        sendMail({
          to: email,
          subject: `Трек «${updated.title}» отклонён модерацией · Сонатум`,
          html: `
            <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:560px;margin:0 auto;padding:32px;color:#1c1c1e;">
              <h1 style="font-size:22px;margin:0 0 16px;">Трек не прошёл модерацию</h1>
              <p style="font-size:15px;line-height:1.6;">
                Ваш трек <b>«${updated.title}»</b> отклонён модерацией.
              </p>
              <div style="background:#fee2e2;border-radius:12px;padding:16px;margin:16px 0;">
                <div style="font-size:12px;color:#991b1b;margin-bottom:6px;">Причина:</div>
                <div style="font-size:14px;color:#991b1b;">${reason}</div>
              </div>
              <p style="font-size:14px;line-height:1.6;">Вы можете отредактировать трек и отправить его на модерацию повторно.</p>
              <a href="${SITE_URL}/profile?tab=uploads" style="display:inline-block;background:#1c1c1e;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:600;font-size:14px;margin-top:16px;">
                Мои загрузки
              </a>
            </div>
          `,
        }).catch((e) => console.error('[MAIL reject]', e));
      }

      return NextResponse.json({
        success: true,
        data: updated,
        message: 'Track rejected'
      });

    } catch (error) {
      console.error('Reject track error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to reject track' },
        { status: 500 }
      );
    }
  });
}
