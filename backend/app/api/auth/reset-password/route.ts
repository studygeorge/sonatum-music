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
    const password = typeof body.password === "string" ? body.password : "";

    if (!token || token.length < 16) {
      return NextResponse.json(
        { success: false, error: "Некорректный токен" },
        { status: 400, headers: corsHeaders }
      );
    }
    if (!password || password.length < 8) {
      return NextResponse.json(
        { success: false, error: "Пароль должен быть не короче 8 символов" },
        { status: 400, headers: corsHeaders }
      );
    }

    const record = await prisma.verificationToken.findUnique({
      where: { token },
    });
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
