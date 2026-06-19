/**
 * Утилиты для проверки уровня подписки пользователя.
 * Используется во всём backend, где нужно различать Free / Premium / Student.
 */

import { prisma } from '@/lib/prisma';

export type SubLevel = 'FREE' | 'PREMIUM' | 'STUDENT';

export type SubInfo = {
  level: SubLevel;
  isPremium: boolean;      // true для PREMIUM или STUDENT (доступ к платному контенту)
  status: string | null;
  endsAt: Date | null;
};

/**
 * Возвращает уровень подписки пользователя.
 * PREMIUM/STUDENT учитывается только если status='ACTIVE' и endDate в будущем (или null).
 * ADMIN/SUPER_ADMIN автоматически считаются Premium (для проверки контента).
 */
export async function getSubLevel(userId: string): Promise<SubInfo> {
  const [user, sub] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { role: true } }),
    prisma.subscription.findUnique({ where: { userId } }),
  ]);

  // Admin/SuperAdmin → premium
  if (user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') {
    return { level: 'PREMIUM', isPremium: true, status: 'ACTIVE', endsAt: null };
  }

  const isActive =
    !!sub &&
    sub.status === 'ACTIVE' &&
    (sub.tier === 'PREMIUM' || sub.tier === 'STUDENT') &&
    (!sub.endDate || new Date(sub.endDate).getTime() > Date.now());

  if (!isActive) {
    return { level: 'FREE', isPremium: false, status: sub?.status || null, endsAt: sub?.endDate || null };
  }

  return {
    level: sub!.tier === 'STUDENT' ? 'STUDENT' : 'PREMIUM',
    isPremium: true,
    status: sub!.status,
    endsAt: sub!.endDate,
  };
}

/**
 * Удобный гард: бросает 403-style объект если не Premium.
 * Возвращает true если разрешено.
 */
export async function isPremiumUser(userId: string): Promise<boolean> {
  const s = await getSubLevel(userId);
  return s.isPremium;
}

// Лимиты для Free-тарифа (по ТЗ)
export const FREE_LIMITS = {
  MAX_PLAYLISTS: 5,
  HISTORY_DAYS: 7,
  CAN_WRITE_COMMENTS: false,
  CAN_REPLY_TO_COMMENTS: false,
  CAN_DOWNLOAD: false,
  CAN_VIEW_FULL_LYRICS: false,
  CAN_VIEW_FULL_SHEETS: false,
} as const;

/**
 * Проверка активной ПРОФИ-подписки автора.
 * ПРОФИ даёт:
 *   - бесплатные афиши
 *   - детальную аналитику (по дням, география до городов, демография)
 *   - приоритетную модерацию треков (до 3 дней vs 7)
 *   - выгрузку отчётов в PDF/Excel
 *   - бейдж «ПРОФИ» в профиле
 */
export async function isProfiAuthor(userId: string): Promise<boolean> {
  const [row] = (await prisma.$queryRawUnsafe(
    `SELECT status, ends_at FROM author_subscriptions
      WHERE user_id = $1 AND tier = 'PROFI' LIMIT 1`,
    userId
  )) as any[];
  if (!row) return false;
  if (row.status !== 'ACTIVE') return false;
  if (row.ends_at && new Date(row.ends_at).getTime() <= Date.now()) return false;
  return true;
}
