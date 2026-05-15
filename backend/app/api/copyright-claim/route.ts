import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCorsHeaders } from "@/lib/cors";

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request.headers.get("origin") || undefined),
  });
}

const trim = (v: unknown, max = 2000) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin || undefined);

  try {
    const body = await request.json().catch(() => ({} as Record<string, unknown>));

    const claimantName = trim(body.claimantName, 200);
    const claimantOrg = trim(body.claimantOrg, 200);
    const email = trim(body.email, 200);
    const phone = trim(body.phone, 50);
    const workTitle = trim(body.workTitle, 300);
    const workAuthor = trim(body.workAuthor, 300);
    const infringingUrl = trim(body.infringingUrl, 500);
    const description = trim(body.description, 5000);
    const agree = body.agree === true;

    if (!claimantName || !email || !workTitle || !workAuthor || !infringingUrl || !description) {
      return NextResponse.json(
        { success: false, error: "Заполните все обязательные поля" },
        { status: 400, headers: corsHeaders }
      );
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { success: false, error: "Некорректный email" },
        { status: 400, headers: corsHeaders }
      );
    }
    if (!agree) {
      return NextResponse.json(
        { success: false, error: "Требуется согласие на обработку ПД" },
        { status: 400, headers: corsHeaders }
      );
    }

    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      request.headers.get("x-real-ip") ||
      null;

    const claim = await prisma.copyrightClaim.create({
      data: {
        claimantName,
        claimantOrg: claimantOrg || null,
        email,
        phone: phone || null,
        workTitle,
        workAuthor,
        infringingUrl,
        description,
        ip,
      },
    });

    console.log(`[COPYRIGHT_CLAIM] id=${claim.id} from=${email} url=${infringingUrl}`);

    return NextResponse.json(
      { success: true, data: { id: claim.id } },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error("[COPYRIGHT_CLAIM_ERROR]", error);
    return NextResponse.json(
      { success: false, error: "Ошибка сервера" },
      { status: 500, headers: corsHeaders }
    );
  }
}
