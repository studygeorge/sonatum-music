/**
 * Минималистичный mailer для Сонатум.
 *
 * Поддерживает два режима:
 *   1) Resend (https://resend.com) — если в env есть RESEND_API_KEY и MAIL_FROM,
 *      письма уходят через их HTTP API. Хостинг блокирует SMTP, поэтому
 *      используем именно HTTP-провайдера.
 *   2) Console — если ключа нет, письмо просто печатается в stdout backend-контейнера
 *      и сохраняется в локальную таблицу `email_log` (через Prisma model EmailLog,
 *      если она есть; иначе тихо пропускаем). Удобно в dev и пока ключ не настроен.
 *
 * Использовать так:
 *   import { sendMail } from '@/lib/mailer';
 *   await sendMail({ to, subject, html, text });
 */

export type MailPayload = {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
};

const RESEND_ENDPOINT = "https://api.resend.com/emails";

function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+\n/g, "\n")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

// Lazy nodemailer transport (создаётся 1 раз)
let _smtpTransporter: any = null;
function getSmtpTransporter() {
  if (_smtpTransporter) return _smtpTransporter;
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;
  // require, чтобы не падать на сборке если nodemailer не установлен
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const nodemailer = require("nodemailer");
  const port = Number(process.env.SMTP_PORT || 465);
  const secure = process.env.SMTP_SECURE !== "false";
  // На reg.ru TLS-handshake с Docker-NAT нестабилен. Если SMTP_NO_TLS=1 — шлём plaintext.
  const ignoreTLS = process.env.SMTP_NO_TLS === "1";
  _smtpTransporter = nodemailer.createTransport({
    host,
    port,
    secure,
    ignoreTLS,
    requireTLS: !ignoreTLS && !secure,
    auth: { user, pass },
    tls: {
      // reg.ru / Exim поддерживает только TLSv1.2 (не v1.3)
      minVersion: "TLSv1.2",
      maxVersion: "TLSv1.2",
      rejectUnauthorized: false,
      servername: host,
      ciphers: "DEFAULT@SECLEVEL=0",
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 30000,
    logger: process.env.SMTP_DEBUG === "1",
    debug: process.env.SMTP_DEBUG === "1",
  });
  return _smtpTransporter;
}

export async function sendMail(payload: MailPayload): Promise<{ ok: boolean; provider: string; id?: string; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM || "Сонатум <info@sonatum-music.ru>";

  const text = payload.text || (payload.html ? htmlToText(payload.html) : "");

  // 1) Приоритет — SMTP (если настроен)
  const smtp = getSmtpTransporter();
  if (smtp) {
    try {
      const info = await smtp.sendMail({
        from,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
        text,
        replyTo: payload.replyTo,
      });
      return { ok: true, provider: "smtp", id: info?.messageId };
    } catch (e: any) {
      console.error("[MAIL:smtp]", e?.message || e);
      return { ok: false, provider: "smtp", error: e?.message || "smtp error" };
    }
  }

  // 2) Иначе Resend API
  if (!apiKey) {
    // Console fallback — не падаем, просто логируем.
    console.log(
      `[MAIL:console] ${new Date().toISOString()} → ${payload.to}\n` +
        `Subject: ${payload.subject}\n` +
        `${text}\n` +
        `--- end of message ---`
    );
    return { ok: true, provider: "console" };
  }

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
        text,
        reply_to: payload.replyTo,
      }),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => "");
      console.error(`[MAIL:resend] ${res.status} ${err}`);
      return { ok: false, provider: "resend", error: `${res.status} ${err}` };
    }
    const json = (await res.json().catch(() => ({}))) as { id?: string };
    return { ok: true, provider: "resend", id: json.id };
  } catch (e: any) {
    console.error("[MAIL:resend] network error", e?.message || e);
    return { ok: false, provider: "resend", error: e?.message || "network" };
  }
}

const baseUrl = () =>
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.PUBLIC_BASE_URL ||
  "https://sonatum-music.ru";

const styles = `font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#1d1d1f;line-height:1.55;`;
const button = `display:inline-block;background:#1d1d1f;color:#fff;padding:14px 28px;border-radius:999px;text-decoration:none;font-weight:600;`;

function shell(title: string, body: string) {
  return `
<div style="${styles}max-width:560px;margin:0 auto;padding:32px 24px;">
  <div style="font-weight:700;font-size:20px;margin-bottom:24px;">Сонатум</div>
  <h1 style="font-size:24px;margin:0 0 16px;">${title}</h1>
  ${body}
  <hr style="border:none;border-top:1px solid #e5e5e7;margin:32px 0 16px;" />
  <div style="color:#86868b;font-size:13px;">
    Если письмо пришло по ошибке — проигнорируйте его.<br/>
    © ${new Date().getFullYear()} ООО «СОНАТУМ»
  </div>
</div>`;
}

export function verifyEmailTemplate(verifyUrl: string) {
  return {
    subject: "Подтверждение регистрации в Сонатум",
    html: shell(
      "Подтвердите email",
      `<p>Спасибо за регистрацию на Сонатум. Чтобы активировать аккаунт, нажмите кнопку:</p>
       <p style="margin:24px 0;"><a href="${verifyUrl}" style="${button}">Подтвердить email</a></p>
       <p style="color:#86868b;font-size:13px;">Или скопируйте ссылку: <br/><a href="${verifyUrl}">${verifyUrl}</a></p>
       <p style="color:#86868b;font-size:13px;">Ссылка действительна 24 часа.</p>`
    ),
  };
}

export function passwordResetTemplate(resetUrl: string) {
  return {
    subject: "Восстановление пароля Сонатум",
    html: shell(
      "Восстановление пароля",
      `<p>Вы запросили смену пароля. Нажмите кнопку, чтобы задать новый:</p>
       <p style="margin:24px 0;"><a href="${resetUrl}" style="${button}">Сменить пароль</a></p>
       <p style="color:#86868b;font-size:13px;">Если вы не запрашивали восстановление — просто проигнорируйте письмо.</p>
       <p style="color:#86868b;font-size:13px;">Ссылка действительна 1 час.</p>`
    ),
  };
}

export const mailUrls = {
  verify: (token: string) => `${baseUrl()}/auth/verify-email/${token}`,
  reset: (token: string) => `${baseUrl()}/auth/reset/${token}`,
};
