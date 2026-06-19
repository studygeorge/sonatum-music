import { NextRequest, NextResponse } from 'next/server';
import { sendMail } from '@/lib/mailer';
import { getCorsHeaders } from '@/lib/cors';

export const dynamic = 'force-dynamic';

// GET/POST /api/_admin/test-mail?to=email@x.ru
// Защита: X-Cron-Secret = CRON_SECRET
export async function POST(request: NextRequest) {
  return handle(request);
}
export async function GET(request: NextRequest) {
  return handle(request);
}

async function handle(request: NextRequest) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const secret = request.headers.get('x-cron-secret');
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ success: false, error: 'forbidden' }, { status: 403, headers: cors });
  }

  const url = new URL(request.url);
  const to = url.searchParams.get('to') || process.env.SMTP_USER || 'info@sonatum-music.ru';

  const result = await sendMail({
    to,
    subject: `Сонатум · тест SMTP (${new Date().toLocaleString('ru-RU')})`,
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:560px;margin:0 auto;padding:32px;color:#1c1c1e;">
        <h1 style="font-size:22px;margin:0 0 16px;">Сонатум · тест SMTP</h1>
        <p style="font-size:15px;line-height:1.6;">Это тестовое письмо. Если вы его получили — отправка через <b>info@sonatum-music.ru</b> работает корректно.</p>
        <p style="font-size:13px;color:#86868b;margin-top:24px;">Сервер: ${process.env.SMTP_HOST}:${process.env.SMTP_PORT}</p>
      </div>
    `,
  });

  return NextResponse.json({ success: result.ok, ...result, to }, { headers: cors });
}

export async function OPTIONS(request: NextRequest) {
  return new Response(null, { status: 204, headers: getCorsHeaders(request.headers.get('origin') || undefined) });
}
