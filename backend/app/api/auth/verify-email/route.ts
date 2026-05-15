import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
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
    if (!token || token.length < 16) {
      return NextResponse.json(
        { success: false, error: "Некорректный токен" },
        { status: 400, headers: corsHeaders }
      );
    }

    const record = await prisma.verificationToken.findUnique({
      where: { token },
      include: { user: true },
    });
    if (!record || record.purpose !== "VERIFY_EMAIL") {
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
        { success: false, error: "Ссылка истекла. Запросите новую." },
        { status: 400, headers: corsHeaders }
      );
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: { emailVerified: new Date(), status: "ACTIVE" },
      }),
      prisma.verificationToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return NextResponse.json(
      { success: true, data: { email: record.user.email } },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error("[VERIFY_EMAIL_ERROR]", error);
    return NextResponse.json(
      { success: false, error: "Ошибка сервера" },
      { status: 500, headers: corsHeaders }
    );
  }
}
