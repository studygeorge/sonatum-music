import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { getCorsHeaders } from "@/lib/cors";
import { sendMail, passwordResetTemplate, mailUrls } from "@/lib/mailer";

import { checkRateLimit, rateLimitResponse } from '@/lib/ratelimit';
export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request.headers.get("origin") || undefined),
  });
}

export async function POST(request: NextRequest) {
  const _rl = checkRateLimit('forgot-password', request, { max: 3, windowSec: 60 });
  if (!_rl.ok) return rateLimitResponse(_rl, request) as any;
  const corsHeaders = getCorsHeaders(request.headers.get("origin") || undefined);
  try {
    const body = await request.json().catch(() => ({} as Record<string, unknown>));
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!email) {
      return NextResponse.json(
        { success: false, error: "Email обязателен" },
        { status: 400, headers: corsHeaders }
      );
    }

    const user = await prisma.user.findUnique({ where: { email } });
    // Не палим, существует ли пользователь.
    if (!user) {
      return NextResponse.json({ success: true }, { headers: corsHeaders });
    }

    // Гасим неиспользованные предыдущие токены.
    await prisma.verificationToken.updateMany({
      where: { userId: user.id, purpose: "PASSWORD_RESET", usedAt: null },
      data: { usedAt: new Date() },
    });

    const token = crypto.randomBytes(32).toString("hex");
    const code = String(crypto.randomInt(100000, 999999));
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 час
    await prisma.$executeRawUnsafe(
      `INSERT INTO verification_tokens (id, token, "userId", purpose, "expiresAt", code)
       VALUES ($1, $2, $3, 'PASSWORD_RESET', $4, $5)`,
      'vt_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10),
      token, user.id, expiresAt, code
    );

    const resetUrl = mailUrls.reset(token);
    await sendMail({
      to: email,
      subject: "Восстановление пароля · Сонатум",
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#1d1d1f;">
          <div style="font-weight:700;font-size:20px;margin-bottom:24px;">Сонатум</div>
          <h1 style="font-size:24px;margin:0 0 16px;">Восстановление пароля</h1>
          <p style="font-size:15px;line-height:1.6;">Вы запросили смену пароля. Используйте код:</p>
          <div style="background:#f4f4f7;border-radius:16px;padding:20px;margin:20px 0;text-align:center;">
            <div style="font-size:36px;font-weight:800;letter-spacing:6px;color:#d52b1e;font-family:monospace;">${code}</div>
            <div style="font-size:12px;color:#86868b;margin-top:8px;">Код действителен 1 час</div>
          </div>
          <p style="font-size:14px;line-height:1.6;">Или перейдите по ссылке:</p>
          <p><a href="${resetUrl}" style="display:inline-block;background:#1d1d1f;color:#fff;padding:12px 28px;border-radius:999px;text-decoration:none;font-weight:600;font-size:14px;">Сменить пароль</a></p>
          <p style="font-size:12px;color:#86868b;margin-top:24px;">Если вы не запрашивали восстановление — проигнорируйте письмо.</p>
        </div>
      `,
    });

    void passwordResetTemplate;

    return NextResponse.json({ success: true }, { headers: corsHeaders });
  } catch (error) {
    console.error("[FORGOT_PASSWORD_ERROR]", error);
    return NextResponse.json(
      { success: false, error: "Ошибка сервера" },
      { status: 500, headers: corsHeaders }
    );
  }
}
