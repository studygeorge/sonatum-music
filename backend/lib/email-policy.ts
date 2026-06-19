/**
 * Политика допустимых email-доменов для регистрации/смены email.
 *
 * По решению владельца: Gmail запрещён (плохая доставляемость наших писем
 * через российский SMTP + блокировки Google для российских доменов).
 *
 * Использование:
 *   const v = checkEmailPolicy(email);
 *   if (!v.ok) return NextResponse.json({ success: false, error: v.error }, { status: 400 });
 */

const BLOCKED_DOMAINS = new Set<string>([
  'gmail.com',
  'googlemail.com',
]);

const BLOCKED_MESSAGE =
  'Регистрация с Gmail не поддерживается — наши письма с подтверждениями и чеками часто не доходят. Используйте Яндекс, Mail.ru, VK, Outlook или любой другой почтовый сервис.';

export function emailDomain(email: string): string {
  const idx = email.lastIndexOf('@');
  if (idx < 0) return '';
  return email.slice(idx + 1).toLowerCase().trim();
}

export function isBlockedEmail(email: string): boolean {
  const d = emailDomain(email);
  if (!d) return false;
  return BLOCKED_DOMAINS.has(d);
}

export function checkEmailPolicy(email: string): { ok: true } | { ok: false; error: string } {
  if (!email) return { ok: false, error: 'Введите email' };
  if (!email.includes('@')) return { ok: false, error: 'Введите корректный email' };
  if (isBlockedEmail(email)) return { ok: false, error: BLOCKED_MESSAGE };
  return { ok: true };
}

export const GMAIL_BLOCKED_HINT = BLOCKED_MESSAGE;
