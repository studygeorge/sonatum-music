import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AuthService } from '@/lib/auth';
import { getCorsHeaders } from '@/lib/cors';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const UPLOAD_DIR = process.env.STUDENT_DOCS_DIR || '/app/public/uploads/student-docs';
const PUBLIC_BASE = process.env.STUDENT_DOCS_BASE || '/uploads/student-docs';
const MAX_SIZE = 5 * 1024 * 1024; // 5 МБ по ТЗ
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];

function cuid() {
  return 'sv_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
}

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request.headers.get('origin') || undefined),
  });
}

// GET /api/subscriptions/verify-student — статус последней заявки
export async function GET(request: NextRequest) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) {
    return NextResponse.json({ success: false, error: 'Не авторизован' }, { status: 401, headers: cors });
  }
  const session = await AuthService.validateSession(auth.substring(7));
  if (!session) {
    return NextResponse.json({ success: false, error: 'Сессия истекла' }, { status: 401, headers: cors });
  }

  const [row] = (await prisma.$queryRawUnsafe(
    `SELECT id, institution, document_url, status, admin_note, expires_at, created_at, reviewed_at
       FROM student_verifications WHERE user_id = $1
       ORDER BY created_at DESC LIMIT 1`,
    session.userId
  )) as any[];

  return NextResponse.json({
    success: true,
    data: row ? {
      id: row.id,
      institution: row.institution,
      documentUrl: row.document_url,
      status: row.status,
      adminNote: row.admin_note,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      reviewedAt: row.reviewed_at,
    } : null,
  }, { headers: cors });
}

// POST /api/subscriptions/verify-student — загрузить документ на проверку
// FormData: { document: File, institution: string }
export async function POST(request: NextRequest) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) {
    return NextResponse.json({ success: false, error: 'Не авторизован' }, { status: 401, headers: cors });
  }
  const session = await AuthService.validateSession(auth.substring(7));
  if (!session) {
    return NextResponse.json({ success: false, error: 'Сессия истекла' }, { status: 401, headers: cors });
  }

  const formData = await request.formData();
  const file = formData.get('document') as File | null;
  const institution = String(formData.get('institution') || '').trim();

  if (!file || !institution) {
    return NextResponse.json({ success: false, error: 'Файл и название учреждения обязательны' }, { status: 400, headers: cors });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ success: false, error: 'Файл больше 5 МБ' }, { status: 400, headers: cors });
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ success: false, error: 'Разрешены только JPG, PNG, PDF' }, { status: 400, headers: cors });
  }

  // Сохраняем файл на диск
  const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
  const id = cuid();
  const userDir = path.join(UPLOAD_DIR, session.userId);
  await mkdir(userDir, { recursive: true });
  const filePath = path.join(userDir, `${id}.${ext}`);
  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(filePath, buf);

  const publicUrl = `${PUBLIC_BASE}/${session.userId}/${id}.${ext}`;

  // Срок действия — 1 год с момента подачи. Дальше потребуется новая верификация.
  const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

  await prisma.$executeRawUnsafe(
    `INSERT INTO student_verifications (id, user_id, institution, document_url, status, expires_at)
     VALUES ($1, $2, $3, $4, 'PENDING', $5)`,
    id, session.userId, institution.slice(0, 200), publicUrl, expiresAt
  );

  return NextResponse.json({
    success: true,
    data: {
      id,
      status: 'PENDING',
      message: 'Документы отправлены на проверку. Срок — до 24 часов. Студенческий тариф будет активирован после одобрения.',
    },
  }, { headers: cors });
}
