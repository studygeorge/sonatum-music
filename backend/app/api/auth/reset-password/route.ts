import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PasswordService } from "@/lib/password";
import { getCorsHeaders } from "@/lib/cors";

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
    const token = typeof body.token === "string" ? body.token.trim() : "";
    const code = typeof body.code === "string" ? body.code.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!token && !(code && email)) {
      return NextResponse.json(
        { success: false, error: "Нужен токен или код+email" },
        { status: 400, headers: corsHeaders }
      );
    }
    if (!password || password.length < 8) {
      return NextResponse.json(
        { success: false, error: "Пароль должен быть не короче 8 символов" },
        { status: 400, headers: corsHeaders }
      );
    }

    let record: any = null;
    if (token) {
      record = await prisma.verificationToken.findUnique({ where: { token } });
    } else {
      const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      if (user) {
        const [r] = (await prisma.$queryRawUnsafe(
          `SELECT id, token, "userId", purpose, "expiresAt", "usedAt"
             FROM verification_tokens
            WHERE "userId" = $1 AND code = $2 AND purpose = 'PASSWORD_RESET'
            ORDER BY "createdAt" DESC LIMIT 1`,
          user.id, code
        )) as any[];
        record = r;
      }
    }
    if (!record || record.purpose !== "PASSWORD_RESET") {
      return NextResponse.json(
        { success: false, error: "Ссылка недействительна" },
        { status: 400, headers: corsHeaders }
      );
    }
    if (record.usedAt) {
      return NextResponse.json(
        { success: false, error: "Ссылка уже использована" },
        { status: 400, headers: corsHeaders }
      );
    }
    if (record.expiresAt.getTime() < Date.now()) {
      return NextResponse.json(
        { success: false, error: "Ссылка истекла. Запросите восстановление заново." },
        { status: 400, headers: corsHeaders }
      );
    }

    const passwordHash = await PasswordService.hash(password);
    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      }),
      prisma.verificationToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      // Сбрасываем все активные сессии — пусть перелогинится свежим паролем
      prisma.session.deleteMany({ where: { userId: record.userId } }),
    ]);

    return NextResponse.json({ success: true }, { headers: corsHeaders });
  } catch (error) {
    console.error("[RESET_PASSWORD_ERROR]", error);
    return NextResponse.json(
      { success: false, error: "Ошибка сервера" },
      { status: 500, headers: corsHeaders }
    );
  }
}
