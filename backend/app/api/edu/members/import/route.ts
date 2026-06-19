import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AuthService } from '@/lib/auth';
import { getCorsHeaders } from '@/lib/cors';
import { sendEduInviteMail } from '../route';

export const dynamic = 'force-dynamic';

function cuid() {
  return 'em_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
}

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request.headers.get('origin') || undefined),
  });
}

// Простой CSV-парсер: поддерживает запятую/точку с запятой/таб, кавычки
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    // Определяем разделитель по первой строке
    const sep = line.includes(';') ? ';' : line.includes('\t') ? '\t' : ',';
    const cells: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') { inQuotes = false; }
        else { cur += ch; }
      } else {
        if (ch === '"') inQuotes = true;
        else if (ch === sep) { cells.push(cur); cur = ''; }
        else cur += ch;
      }
    }
    cells.push(cur);
    rows.push(cells.map((c) => c.trim()));
  }
  return rows;
}

// POST /api/edu/members/import
// Body: { csv: string }  ИЛИ multipart с file
// CSV: email,fullName,role  (role = TEACHER|STUDENT, по умолчанию STUDENT)
// Первая строка может быть заголовком — детектится автоматически.
export async function POST(request: NextRequest) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) {
    return NextResponse.json(
      { success: false, error: 'Требуется авторизация' },
      { status: 401, headers: cors }
    );
  }
  const session = await AuthService.validateSession(auth.substring(7));
  if (!session) {
    return NextResponse.json(
      { success: false, error: 'Сессия истекла' },
      { status: 401, headers: cors }
    );
  }

  // Только админ учреждения
  const [ins] = (await prisma.$queryRawUnsafe(
    `SELECT id FROM edu_institutions WHERE admin_user_id = $1 AND status IN ('ACTIVE','APPROVED') LIMIT 1`,
    session.userId
  )) as any[];
  if (!ins) {
    return NextResponse.json(
      { success: false, error: 'Только администратор учреждения' },
      { status: 403, headers: cors }
    );
  }
  const institutionId = ins.id;

  // Достаём текст CSV: либо JSON {csv}, либо multipart
  let csvText = '';
  const ct = request.headers.get('content-type') || '';
  try {
    if (ct.includes('multipart/form-data')) {
      const form = await request.formData();
      const file = form.get('file') as File | null;
      if (file) csvText = await file.text();
      else csvText = String(form.get('csv') || '');
    } else {
      const body = await request.json().catch(() => ({}));
      csvText = String(body.csv || '');
    }
  } catch {
    return NextResponse.json(
      { success: false, error: 'Не удалось прочитать CSV' },
      { status: 400, headers: cors }
    );
  }

  if (!csvText.trim()) {
    return NextResponse.json(
      { success: false, error: 'Пустой файл' },
      { status: 400, headers: cors }
    );
  }

  const rows = parseCsv(csvText);
  if (rows.length === 0) {
    return NextResponse.json(
      { success: false, error: 'Нет данных' },
      { status: 400, headers: cors }
    );
  }

  // Определяем индексы колонок по заголовку (если есть)
  let emailIdx = 0, nameIdx = 1, roleIdx = 2;
  const header = rows[0].map((c) => c.toLowerCase());
  const hasHeader = header.some((c) => /email|почта|@/.test(c));
  let dataRows = rows;
  if (hasHeader) {
    const eI = header.findIndex((c) => /email|почта|e-?mail/.test(c));
    const nI = header.findIndex((c) => /name|имя|фио|full/.test(c));
    const rI = header.findIndex((c) => /role|роль|тип/.test(c));
    if (eI >= 0) emailIdx = eI;
    if (nI >= 0) nameIdx = nI;
    if (rI >= 0) roleIdx = rI;
    dataRows = rows.slice(1);
  }

  const added: string[] = [];
  const skipped: { email: string; reason: string }[] = [];
  const invitesPending: Array<{ email: string; fullName: string | null; role: string; alreadyRegistered: boolean }> = [];

  // Узнаём название учреждения для писем
  const [instRow] = (await prisma.$queryRawUnsafe(
    `SELECT COALESCE(short_name, full_name) AS name FROM edu_institutions WHERE id = $1`,
    institutionId
  )) as any[];
  const institutionName = instRow?.name || 'учебное заведение';

  for (const r of dataRows) {
    const email = String(r[emailIdx] || '').trim().toLowerCase();
    const fullName = (r[nameIdx] || '').trim() || null;
    const roleRaw = (r[roleIdx] || '').trim().toUpperCase();
    const role = roleRaw === 'TEACHER' || /преп|учит/i.test(roleRaw) ? 'TEACHER' : 'STUDENT';

    if (!email || !email.includes('@')) {
      skipped.push({ email: email || '(пусто)', reason: 'некорректный email' });
      continue;
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    const id = cuid();
    try {
      await prisma.$executeRawUnsafe(
        `INSERT INTO edu_members (id, institution_id, email, full_name, role, user_id, joined_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        id,
        institutionId,
        email,
        fullName,
        role,
        existingUser?.id || null,
        existingUser ? new Date() : null
      );
      added.push(email);
      invitesPending.push({ email, fullName, role, alreadyRegistered: !!existingUser });
    } catch (e: any) {
      if (e?.message?.includes('duplicate') || e?.code === 'P2002') {
        skipped.push({ email, reason: 'уже добавлен' });
      } else {
        skipped.push({ email, reason: 'ошибка БД' });
      }
    }
  }

  // Письма (fire-and-forget, паузы между отправками чтобы не упереться в rate-limit)
  (async () => {
    for (const inv of invitesPending) {
      try {
        await sendEduInviteMail({
          email: inv.email,
          fullName: inv.fullName,
          role: inv.role,
          institutionName,
          alreadyRegistered: inv.alreadyRegistered,
        });
        await new Promise((r) => setTimeout(r, 250));
      } catch (e) {
        console.error('[EDU_CSV_MAIL]', inv.email, e);
      }
    }
  })();

  return NextResponse.json(
    {
      success: true,
      added: added.length,
      skipped: skipped.length,
      addedEmails: added,
      skippedDetails: skipped,
      message: `Добавлено: ${added.length}, пропущено: ${skipped.length}`,
    },
    { headers: cors }
  );
}
