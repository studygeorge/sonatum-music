/**
 * Простой in-memory rate-limit без Redis.
 *
 * Ключ: `${endpoint}:${ip}`. Окно: skida указанное число секунд.
 * Состояние живёт в памяти процесса — для standalone-Next.js один процесс,
 * этого хватает. При горизонтальном масштабировании понадобится Redis.
 *
 * API:
 *   const r = checkRateLimit('login', request, { max: 5, windowSec: 60 });
 *   if (!r.ok) return rateLimitResponse(r);
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCorsHeaders } from '@/lib/cors';

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

// Чистка по таймеру (раз в 5 минут)
let cleanerStarted = false;
function startCleaner() {
  if (cleanerStarted) return;
  cleanerStarted = true;
  setInterval(() => {
    const now = Date.now();
    for (const [k, b] of buckets.entries()) {
      if (b.resetAt < now) buckets.delete(k);
    }
  }, 5 * 60 * 1000).unref?.();
}

export function clientIp(request: NextRequest): string {
  const fwd = request.headers.get('x-forwarded-for') || '';
  if (fwd) return fwd.split(',')[0].trim();
  const real = request.headers.get('x-real-ip');
  if (real) return real;
  return 'unknown';
}

export function checkRateLimit(
  endpoint: string,
  request: NextRequest,
  opts: { max: number; windowSec: number; extraKey?: string }
): { ok: boolean; remaining: number; retryAfter: number } {
  startCleaner();
  const ip = clientIp(request);
  const key = `${endpoint}:${ip}${opts.extraKey ? ':' + opts.extraKey : ''}`;
  const now = Date.now();
  const winMs = opts.windowSec * 1000;

  let b = buckets.get(key);
  if (!b || b.resetAt < now) {
    b = { count: 0, resetAt: now + winMs };
    buckets.set(key, b);
  }

  b.count += 1;
  if (b.count > opts.max) {
    return { ok: false, remaining: 0, retryAfter: Math.ceil((b.resetAt - now) / 1000) };
  }
  return { ok: true, remaining: opts.max - b.count, retryAfter: 0 };
}

export function rateLimitResponse(r: { retryAfter: number }, request: NextRequest): Response {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  return NextResponse.json(
    {
      success: false,
      error: 'Слишком много запросов. Попробуйте позже.',
      retryAfter: r.retryAfter,
    },
    {
      status: 429,
      headers: { ...cors, 'Retry-After': String(r.retryAfter) },
    }
  );
}
