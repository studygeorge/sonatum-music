// Tinkoff (Т-Банк) Acquiring API helper.
// Документация: https://www.tbank.ru/kassa/dev/payments/

import crypto from "crypto";

const TINKOFF_API = process.env.TINKOFF_API_BASE || "https://securepay.tinkoff.ru/v2";

const TERMINAL = process.env.TINKOFF_TERMINAL_KEY || "";
const PASSWORD = process.env.TINKOFF_PASSWORD || "";

if (!TERMINAL || !PASSWORD) {
  console.warn("[TINKOFF] Не настроены TINKOFF_TERMINAL_KEY / TINKOFF_PASSWORD");
}

const EXCLUDED = new Set(["DATA", "Receipt", "Items", "Shops", "Token", "Descriptor", "Route", "Source"]);

export function sign(params: Record<string, any>): string {
  const flat: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    if (EXCLUDED.has(k)) continue;
    if (v === null || v === undefined) continue;
    if (typeof v === "object") continue;
    flat[k] = typeof v === "boolean" ? (v ? "true" : "false") : String(v);
  }
  flat.Password = PASSWORD;
  const sorted = Object.keys(flat).sort();
  const concat = sorted.map(k => flat[k]).join("");
  return crypto.createHash("sha256").update(concat).digest("hex");
}

export function verifyNotification(body: Record<string, any>): boolean {
  const incoming = body.Token;
  if (!incoming) return false;
  const computed = sign(body);
  return incoming === computed;
}

export type InitParams = {
  orderId: string;
  amountKopecks: number;
  description: string;
  email?: string;
  phone?: string;
  successUrl: string;
  failUrl: string;
  notificationUrl: string;
  receipt?: {
    items: { name: string; priceKopecks: number; quantity: number }[];
    taxation?: string;
  };
};

export async function init(p: InitParams): Promise<{
  ok: boolean;
  paymentId?: string;
  paymentUrl?: string;
  error?: string;
}> {
  const params: Record<string, any> = {
    TerminalKey: TERMINAL,
    Amount: p.amountKopecks,
    OrderId: p.orderId,
    Description: p.description,
    SuccessURL: p.successUrl,
    FailURL: p.failUrl,
    NotificationURL: p.notificationUrl,
  };
  if (p.email) params.DATA = { Email: p.email };

  if (p.receipt && p.receipt.items.length > 0) {
    params.Receipt = {
      Email: p.email,
      Phone: p.phone,
      Taxation: p.receipt.taxation || "usn_income",
      Items: p.receipt.items.map(it => ({
        Name: it.name,
        Price: it.priceKopecks,
        Quantity: it.quantity,
        Amount: it.priceKopecks * it.quantity,
        Tax: "none",
        PaymentMethod: "full_payment",
        PaymentObject: "service",
      })),
    };
  }

  params.Token = sign(params);

  const res = await fetch(`${TINKOFF_API}/Init`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const json = await res.json().catch(() => ({}));
  if (!json?.Success) {
    console.error("[TINKOFF_INIT_ERR]", json);
    return { ok: false, error: json?.Message || json?.Details || "Ошибка платежа" };
  }
  return {
    ok: true,
    paymentId: String(json.PaymentId),
    paymentUrl: json.PaymentURL,
  };
}
