import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { getCorsHeaders } from "@/lib/cors";
import { sendMail, verifyEmailTemplate, mailUrls } from "@/lib/mailer";

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request.headers.get("origin") || undefined),
  });
}

const RATE_LIMIT_MS = 60_000;

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
    // Не раскрываем существование пользователя.
    if (!user || user.emailVerified) {
      return NextResponse.json({ success: true }, { headers: corsHeaders });
    }

    // Анти-спам — не чаще, чем раз в минуту.
    const recent = await prisma.verificationToken.findFirst({
      where: { userId: user.id, purpose: "VERIFY_EMAIL", usedAt: null },
      orderBy: { createdAt: "desc" },
    });
    if (recent && Date.now() - recent.createdAt.getTime() < RATE_LIMIT_MS) {
      return NextResponse.json(
        { success: false, error: "Слишком часто. Попробуйте через минуту." },
        { status: 429, headers: corsHeaders }
      );
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await prisma.verificationToken.create({
      data: { token, userId: user.id, purpose: "VERIFY_EMAIL", expiresAt },
    });

    const tpl = verifyEmailTemplate(mailUrls.verify(token));
    await sendMail({ to: email, subject: tpl.subject, html: tpl.html });

    return NextResponse.json({ success: true }, { headers: corsHeaders });
  } catch (error) {
    console.error("[SEND_VERIFY_ERROR]", error);
    return NextResponse.json(
      { success: false, error: "Ошибка сервера" },
      { status: 500, headers: corsHeaders }
    );
  }
}
