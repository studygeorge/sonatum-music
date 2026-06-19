import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware';
import { prisma } from '@/lib/prisma';
import { getSubLevel, FREE_LIMITS } from '@/lib/subscription';

export async function GET(request: NextRequest) {
  return withAuth(request, async (req, session) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: session.userId },
        select: {
          id: true,
          email: true,
          username: true,
          firstName: true,
          lastName: true,
          avatar: true,
          bio: true,
          nickname: true,
          regionId: true,
          favoriteGenres: true,
          favoriteEras: true,
          favoriteComposers: true,
          role: true,
          status: true,
          createdAt: true,
          balance: true,
          subscription: true,
          artistProfile: {
            select: {
              id: true,
              name: true,
              slug: true,
              avatar: true,
              verified: true,
              followers: true,
              canSellMusic: true
            }
          }
        }
      });

      if (!user) {
        return NextResponse.json(
          { success: false, error: 'User not found' },
          { status: 404 }
        );
      }

      // Прокидываем актуальный уровень подписки (с проверкой статуса)
      // и лимиты Free-тарифа — UI использует это для блокировки кнопок.
      const subInfo = await getSubLevel(user.id);
      const playlistCount = await prisma.playlist.count({ where: { userId: user.id } });

      // birth_date — raw, т.к. колонка не в Prisma-схеме
      const [extra] = (await prisma.$queryRawUnsafe(
        `SELECT birth_date FROM users WHERE id = $1`,
        user.id
      ).catch(() => [])) as any[];

      return NextResponse.json({
        success: true,
        data: {
          ...user,
          birthDate: extra?.birth_date || null,
          subLevel: subInfo.level,                  // 'FREE' | 'PREMIUM' | 'STUDENT'
          isPremium: subInfo.isPremium,
          limits: subInfo.isPremium ? null : {
            maxPlaylists: FREE_LIMITS.MAX_PLAYLISTS,
            playlistsUsed: playlistCount,
            historyDays: FREE_LIMITS.HISTORY_DAYS,
            canWriteComments: false,
          },
        },
      });

    } catch (error) {
      console.error('Get user error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to get user data' },
        { status: 500 }
      );
    }
  });
}
