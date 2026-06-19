import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AuthService } from '@/lib/auth';
import { getCorsHeaders } from '@/lib/cors';
import { sendMail } from '@/lib/mailer';

const SITE_URL = process.env.SITE_URL || 'https://sonatum-music.ru';

const ROLE_LABEL_RU: Record<string, string> = {
  TEACHER: 'преподаватель',
  STUDENT: 'учащийся',
};

export async function sendEduInviteMail(args: {
  email: string;
  fullName?: string | null;
  role: string;
  institutionName: string;
  alreadyRegistered: boolean;
}) {
  const { email, fullName, role, institutionName, alreadyRegistered } = args;
  const greeting = fullName ? fullName : 'друг';
  const roleRu = ROLE_LABEL_RU[role] || 'участник';

  const subject = alreadyRegistered
    ? `Вас добавили в «${institutionName}» · Сонатум`
    : `Приглашение в «${institutionName}» на Сонатум`;

  const bodyAlreadyRegistered = `
    <p style="font-size:15px;line-height:1.6;">Здравствуйте, ${greeting}!</p>
    <p style="font-size:15px;line-height:1.6;">
      Администратор учебного заведения <b>${institutionName}</b> добавил вас как
      <b>${roleRu}</b>. В вашем личном кабинете теперь доступен раздел EDU
      с плейлистами учреждения, нотами и материалами курса.
    </p>
    <p style="margin:24px 0;">
      <a href="${SITE_URL}/edu" style="display:inline-block;background:#1c1c1e;color:#fff;padding:12px 28px;border-radius:999px;text-decoration:none;font-weight:600;font-size:14px;">
        Открыть EDU
      </a>
    </p>
    <p style="font-size:13px;color:#86868b;">
      Доступ к обычному функционалу Сонатум (стриминг, лайки, плейлисты) у вас сохраняется без изменений —
      EDU добавляется параллельно.
    </p>
  `;

  const bodyInvite = `
    <p style="font-size:15px;line-height:1.6;">Здравствуйте, ${greeting}!</p>
    <p style="font-size:15px;line-height:1.6;">
      Администратор учебного заведения <b>${institutionName}</b> приглашает вас на платформу
      <b>Сонатум</b> как <b>${roleRu}</b>.
    </p>
    <p style="font-size:15px;line-height:1.6;">
      Чтобы получить доступ, зарегистрируйтесь по этому email — вы автоматически
      окажетесь в учебном заведении.
    </p>
    <p style="margin:24px 0;">
      <a href="${SITE_URL}/register?email=${encodeURIComponent(email)}" style="display:inline-block;background:#1c1c1e;color:#fff;padding:12px 28px;border-radius:999px;text-decoration:none;font-weight:600;font-size:14px;">
        Зарегистрироваться
      </a>
    </p>
    <p style="font-size:13px;color:#86868b;">
      Сонатум — российская музыкальная платформа. Стриминг, ноты, образование, лицензии для бизнеса.
    </p>
  `;

  await sendMail({
    to: email,
    subject,
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:560px;margin:0 auto;padding:32px;color:#1c1c1e;">
        <div style="font-weight:700;font-size:20px;margin-bottom:24px;">Сонатум</div>
        <h1 style="font-size:24px;margin:0 0 16px;">${alreadyRegistered ? 'Доступ к учебному заведению' : 'Приглашение в учебное заведение'}</h1>
        ${alreadyRegistered ? bodyAlreadyRegistered : bodyInvite}
      </div>
    `,
  });
}

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

// Проверка прав админа учреждения
async function getMyInstitution(userId: string, allowedRoles: string[] = ['ADMIN']) {
  const [r] = (await prisma.$queryRawUnsafe(
    `SELECT id FROM edu_institutions WHERE admin_user_id = $1 AND status IN ('ACTIVE','APPROVED') LIMIT 1`,
    userId
  )) as any[];
  if (r) return { institutionId: r.id, myRole: 'ADMIN' };
  if (allowedRoles.includes('TEACHER') || allowedRoles.includes('STUDENT')) {
    const [m] = (await prisma.$queryRawUnsafe(
      `SELECT institution_id, role FROM edu_members WHERE user_id = $1 LIMIT 1`,
      userId
    )) as any[];
    if (m && allowedRoles.includes(m.role)) {
      return { institutionId: m.institution_id, myRole: m.role };
    }
  }
  return null;
}

// GET /api/edu/members — список участников моего учреждения
export async function GET(request: NextRequest) {
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
  const ctx = await getMyInstitution(session.userId, ['ADMIN', 'TEACHER', 'STUDENT']);
  if (!ctx) {
    return NextResponse.json(
      { success: false, error: 'Вы не привязаны к учебному заведению' },
      { status: 403, headers: cors }
    );
  }
  const rows = (await prisma.$queryRawUnsafe(
    `SELECT em.id, em.email, em.full_name, em.role, em.user_id, em.joined_at, em.created_at,
            u.username, u.avatar
       FROM edu_members em
       LEFT JOIN users u ON u.id = em.user_id
      WHERE em.institution_id = $1
      ORDER BY em.role, em.created_at DESC`,
    ctx.institutionId
  )) as any[];
  return NextResponse.json(
    {
      success: true,
      myRole: ctx.myRole,
      data: rows.map((r) => ({
        id: r.id,
        email: r.email,
        fullName: r.full_name,
        role: r.role,
        userId: r.user_id,
        username: r.username,
        avatar: r.avatar,
        joinedAt: r.joined_at,
        createdAt: r.created_at,
      })),
    },
    { headers: cors }
  );
}

// POST /api/edu/members — пригласить (только админ)
// Body: { email, fullName?, role: 'TEACHER'|'STUDENT' }
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
  const ctx = await getMyInstitution(session.userId, ['ADMIN']);
  if (!ctx) {
    return NextResponse.json(
      { success: false, error: 'Только администратор учреждения' },
      { status: 403, headers: cors }
    );
  }

  let body: any;
  try { body = await request.json(); } catch { body = {}; }
  const email = String(body.email || '').trim().toLowerCase();
  const role = body.role === 'TEACHER' ? 'TEACHER' : 'STUDENT';
  if (!email || !email.includes('@')) {
    return NextResponse.json(
      { success: false, error: 'Введите корректный email' },
      { status: 400, headers: cors }
    );
  }

  // Если такой пользователь уже есть на платформе — линкуем сразу
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
      ctx.institutionId,
      email,
      body.fullName || null,
      role,
      existingUser?.id || null,
      existingUser ? new Date() : null
    );
  } catch (e: any) {
    if (e?.message?.includes('duplicate') || e?.code === 'P2002') {
      return NextResponse.json(
        { success: false, error: 'Этот email уже добавлен' },
        { status: 409, headers: cors }
      );
    }
    throw e;
  }

  // Узнаём название учреждения для письма
  const [ins] = (await prisma.$queryRawUnsafe(
    `SELECT COALESCE(short_name, full_name) AS name FROM edu_institutions WHERE id = $1`,
    ctx.institutionId
  )) as any[];
  const institutionName = ins?.name || 'учебное заведение';

  // Письмо приглашённому (fire-and-forget)
  sendEduInviteMail({
    email,
    fullName: body.fullName || null,
    role,
    institutionName,
    alreadyRegistered: !!existingUser,
  }).catch((e) => console.error('[EDU_INVITE_MAIL]', e));

  return NextResponse.json(
    {
      success: true,
      id,
      linked: !!existingUser,
      message: existingUser
        ? 'Пользователь добавлен в учреждение. Уведомление отправлено на почту.'
        : 'Приглашение отправлено на почту. После регистрации пользователь автоматически получит доступ.',
    },
    { headers: cors }
  );
}

// DELETE /api/edu/members?id=X
export async function DELETE(request: NextRequest) {
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
  const ctx = await getMyInstitution(session.userId, ['ADMIN']);
  if (!ctx) {
    return NextResponse.json(
      { success: false, error: 'Только администратор учреждения' },
      { status: 403, headers: cors }
    );
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json(
      { success: false, error: 'Не указан id' },
      { status: 400, headers: cors }
    );
  }

  await prisma.$executeRawUnsafe(
    `DELETE FROM edu_members WHERE id = $1 AND institution_id = $2`,
    id,
    ctx.institutionId
  );

  return NextResponse.json({ success: true }, { headers: cors });
}
