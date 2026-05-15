import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Этот endpoint отключён — оформление подписки идёт через
// POST /api/payments/init (Tinkoff acquiring). См. lib/tinkoff.ts.
export async function POST(_: NextRequest) {
  return NextResponse.json(
    { success: false, error: "Используйте /api/payments/init" },
    { status: 410 }
  );
}
