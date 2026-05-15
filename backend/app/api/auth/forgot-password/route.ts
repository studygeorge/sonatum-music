import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { getCorsHeaders } from "@/lib/cors";
import { sendMail, passwordResetTemplate, mailUrls } from "@/lib/mailer";

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request.headers.get("origin") || undefined),
  });
}

export async function POST(request: NextRequest) {
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
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 час
    await prisma.verificationToken.create({
      data: { token, userId: user.id, purpose: "PASSWORD_RESET", expiresAt },
    });

    const tpl = passwordResetTemplate(mailUrls.reset(token));
    await sendMail({ to: email, subject: tpl.subject, html: tpl.html });

    return NextResponse.json({ success: true }, { headers: corsHeaders });
  } catch (error) {
    console.error("[FORGOT_PASSWORD_ERROR]", error);
    return NextResponse.json(
      { success: false, error: "Ошибка сервера" },
      { status: 500, headers: corsHeaders }
    );
  }
}
