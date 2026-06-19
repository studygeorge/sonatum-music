/**
 * Лёгкий «Sentry-lite»: пишем ошибки в БД для просмотра в админке.
 *
 * Применять в catch-блоках критичных операций:
 *   try { ... } catch (e: any) { await logError('payments.init', e, { url: request.url }); throw e; }
 */
import { prisma } from '@/lib/prisma';
import { NextRequest } from 'next/server';

type Level = 'ERROR' | 'WARN' | 'FATAL';

export async function logError(
  scope: string,
  err: any,
  ctx?: { url?: string; method?: string; userId?: string; request?: NextRequest; extra?: any; level?: Level }
): Promise<void> {
  try {
    const level = ctx?.level || 'ERROR';
    const message = String(err?.message || err || 'unknown').slice(0, 2000);
    const stack = err?.stack ? String(err.stack).slice(0, 8000) : null;
    const url = ctx?.url || ctx?.request?.url || null;
    const method = ctx?.method || ctx?.request?.method || null;
    const userId = ctx?.userId || null;
    const context = { scope, ...(ctx?.extra || {}) };

    await prisma.$executeRawUnsafe(
      `INSERT INTO error_log (id, level, message, stack, url, method, user_id, context)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
      'er_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      level, message, stack, url, method, userId, JSON.stringify(context)
    );
  } catch (e) {
    // Никогда не падаем из logger'а
    console.error('[logError fallback]', scope, err, '— logger failed:', e);
  }
}
