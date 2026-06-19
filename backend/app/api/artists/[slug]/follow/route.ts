import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AuthService } from '@/lib/auth';
import { getCorsHeaders } from '@/lib/cors';
import { sendMail } from '@/lib/mailer';

const SITE_URL = process.env.SITE_URL || 'https://sonatum-music.ru';

async function getUserId(request: NextRequest): Promise<string | null> {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const session = await AuthService.validateSession(auth.substring(7));
  return session?.userId || null;
}

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request.headers.get('origin') || undefined),
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const corsHeaders = getCorsHeaders(request.headers.get('origin') || undefined);
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Требуется авторизация' },
        { status: 401, headers: corsHeaders }
      );
    }

    const artist = await prisma.artist.findUnique({
      where: { slug: params.slug },
      select: { id: true, userId: true },
    });
    if (!artist) {
      return NextResponse.json(
        { success: false, error: 'Артист не найден' },
        { status: 404, headers: corsHeaders }
      );
    }
    if (artist.userId === userId) {
      return NextResponse.json(
        { success: false, error: 'Нельзя подписаться на самого себя' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Проверяем, не подписан ли уже (идемпотентность).
    const existing = await (prisma as any).artistFollow.findUnique({
      where: { userId_artistId: { userId, artistId: artist.id } },
    });

    if (!existing) {
      await prisma.$transaction([
        (prisma as any).artistFollow.create({
          data: { userId, artistId: artist.id },
        }),
        prisma.artist.update({
          where: { id: artist.id },
          data: { followers: { increment: 1 } },
        }),
      ]);

      // Письмо автору о новом подписчике (с учётом настроек уведомлений)
      try {
        const [r] = (await prisma.$queryRawUnsafe(
          `SELECT au.email AS author_email, au."firstName" AS author_first, au.username AS author_username,
                  au.notification_settings,
                  a.name AS artist_name, a.slug AS artist_slug,
                  fu.username AS follower_username, fu."firstName" AS follower_first
             FROM artists a
             JOIN users au ON au.id = a."userId"
             JOIN users fu ON fu.id = $1
            WHERE a.id = $2`,
          userId, artist.id
        )) as any[];
        const wantsMail = !r?.notification_settings ||
          (r.notification_settings as any).recommendations !== false;
        if (r?.author_email && wantsMail) {
          const followerName = r.follower_first || r.follower_username || 'Слушатель';
          sendMail({
            to: r.author_email,
            subject: `Новый подписчик: ${followerName} · Сонатум`,
            html: `
              <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:560px;margin:0 auto;padding:32px;color:#1c1c1e;">
                <h1 style="font-size:22px;margin:0 0 16px;">У вас новый подписчик</h1>
                <p style="font-size:15px;line-height:1.6;">Здравствуйте, ${r.author_first || r.author_username || 'автор'}!</p>
                <p style="font-size:15px;line-height:1.6;">
                  <b>${followerName}</b> подписался на «${r.artist_name}». Теперь ваш слушатель будет получать уведомления о ваших релизах.
                </p>
                <a href="${SITE_URL}/artists/${r.artist_slug}" style="display:inline-block;background:#1c1c1e;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:600;font-size:14px;margin-top:16px;">
                  Открыть профиль
                </a>
              </div>
            `,
          }).catch(() => {});
        }
      } catch (e) { console.error('[MAIL follow]', e); }
    }

    const updated = await prisma.artist.findUnique({
      where: { id: artist.id },
      select: { followers: true },
    });

    return NextResponse.json(
      { success: true, following: true, followers: updated?.followers || 0 },
      { headers: corsHeaders }
    );
  } catch (e) {
    console.error('[ARTIST_FOLLOW]', e);
    return NextResponse.json(
      { success: false, error: 'Ошибка сервера' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const corsHeaders = getCorsHeaders(request.headers.get('origin') || undefined);
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Требуется авторизация' },
        { status: 401, headers: corsHeaders }
      );
    }

    const artist = await prisma.artist.findUnique({
      where: { slug: params.slug },
      select: { id: true },
    });
    if (!artist) {
      return NextResponse.json(
        { success: false, error: 'Артист не найден' },
        { status: 404, headers: corsHeaders }
      );
    }

    const existing = await (prisma as any).artistFollow.findUnique({
      where: { userId_artistId: { userId, artistId: artist.id } },
    });

    if (existing) {
      await prisma.$transaction([
        (prisma as any).artistFollow.delete({
          where: { userId_artistId: { userId, artistId: artist.id } },
        }),
        prisma.artist.update({
          where: { id: artist.id },
          data: { followers: { decrement: 1 } },
        }),
      ]);
    }

    const updated = await prisma.artist.findUnique({
      where: { id: artist.id },
      select: { followers: true },
    });

    return NextResponse.json(
      { success: true, following: false, followers: Math.max(0, updated?.followers || 0) },
      { headers: corsHeaders }
    );
  } catch (e) {
    console.error('[ARTIST_UNFOLLOW]', e);
    return NextResponse.json(
      { success: false, error: 'Ошибка сервера' },
      { status: 500, headers: corsHeaders }
    );
  }
}

// GET /api/artists/[slug]/follow — проверить, подписан ли текущий пользователь
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const corsHeaders = getCorsHeaders(request.headers.get('origin') || undefined);
  const userId = await getUserId(request);
  if (!userId) {
    return NextResponse.json({ success: true, isFollowing: false }, { headers: corsHeaders });
  }
  const artist = await prisma.artist.findUnique({
    where: { slug: params.slug },
    select: { id: true },
  });
  if (!artist) {
    return NextResponse.json({ success: false, error: 'Артист не найден' }, { status: 404, headers: corsHeaders });
  }
  const [row] = (await prisma.$queryRawUnsafe(
    `SELECT 1 FROM artist_follows WHERE "userId" = $1 AND "artistId" = $2 LIMIT 1`,
    userId, artist.id
  )) as any[];
  return NextResponse.json({ success: true, isFollowing: !!row }, { headers: corsHeaders });
}
