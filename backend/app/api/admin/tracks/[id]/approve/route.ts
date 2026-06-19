import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/middleware';
import { prisma } from '@/lib/prisma';
import { sendMail } from '@/lib/mailer';

const SITE_URL = process.env.SITE_URL || 'https://sonatum-music.ru';

// Одобрить трек
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return withRole(request, ['ADMIN', 'SUPER_ADMIN'], async (req, session) => {
    try {
      const track = await prisma.track.findUnique({
        where: { id: params.id }
      });

      if (!track) {
        return NextResponse.json(
          { success: false, error: 'Track not found' },
          { status: 404 }
        );
      }

      if (track.status !== 'PENDING') {
        return NextResponse.json(
          { success: false, error: 'Track is not pending approval' },
          { status: 400 }
        );
      }

      const updated = await prisma.track.update({
        where: { id: params.id },
        data: {
          status: 'PUBLISHED',
          publishedAt: new Date()
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

      // Письмо автору
      const email = (updated as any).artist?.user?.email;
      if (email) {
        sendMail({
          to: email,
          subject: `Трек «${updated.title}» опубликован · Сонатум`,
          html: `
            <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:560px;margin:0 auto;padding:32px;color:#1c1c1e;">
              <h1 style="font-size:22px;margin:0 0 16px;">🎵 Трек опубликован</h1>
              <p style="font-size:15px;line-height:1.6;">
                Ваш трек <b>«${updated.title}»</b> прошёл модерацию и теперь доступен слушателям на Сонатуме.
              </p>
              <a href="${SITE_URL}/tracks/${updated.slug || updated.id}" style="display:inline-block;background:#1c1c1e;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:600;font-size:14px;margin-top:16px;">
                Открыть трек
              </a>
              <p style="font-size:13px;color:#86868b;margin-top:24px;">Подписчики получат уведомление о новом релизе автоматически.</p>
            </div>
          `,
        }).catch((e) => console.error('[MAIL approve]', e));
      }

      return NextResponse.json({
        success: true,
        data: updated,
        message: 'Track approved and published'
      });

    } catch (error) {
      console.error('Approve track error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to approve track' },
        { status: 500 }
      );
    }
  });
}
