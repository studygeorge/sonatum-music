import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AuthService } from '@/lib/auth';
import { getCorsHeaders } from '@/lib/cors';

export const dynamic = 'force-dynamic';

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request.headers.get('origin') || undefined),
  });
}

async function requireAuthAndOwnCollective(request: NextRequest) {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const session = await AuthService.validateSession(auth.substring(7));
  if (!session) return null;
  const col = await prisma.collective.findUnique({ where: { leaderId: session.userId } });
  return { userId: session.userId, collective: col };
}

// GET /api/author/collective — мой коллектив (полная информация для лидера)
export async function GET(request: NextRequest) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const ctx = await requireAuthAndOwnCollective(request);
  if (!ctx) {
    return NextResponse.json({ success: false, error: 'Не авторизован' }, { status: 401, headers: cors });
  }
  if (!ctx.collective) {
    return NextResponse.json({ success: true, data: null }, { headers: cors });
  }
  const c = ctx.collective as any;
  return NextResponse.json({
    success: true,
    data: {
      id: c.id,
      name: c.name,
      slug: c.slug,
      shortName: c.short_name,
      bio: c.bio,
      avatar: c.avatar,
      region: c.region,
      roleType: c.role_type,
      payeeType: c.payee_type,
      legalName: c.legal_name,
      legalInn: c.legal_inn,
      legalKpp: c.legal_kpp,
      accountNumber: c.account_number,
      bankName: c.bank_name,
      contactEmail: c.contact_email,
      contactPhone: c.contact_phone,
      verified: c.verified,
      members: Array.isArray(c.members) ? c.members : [],
    },
  }, { headers: cors });
}

// PATCH /api/author/collective — обновить реквизиты получателя и контакты
export async function PATCH(request: NextRequest) {
  const cors = getCorsHeaders(request.headers.get('origin') || undefined);
  const ctx = await requireAuthAndOwnCollective(request);
  if (!ctx) return NextResponse.json({ success: false, error: 'Не авторизован' }, { status: 401, headers: cors });
  if (!ctx.collective) {
    return NextResponse.json({ success: false, error: 'Коллектив не найден' }, { status: 404, headers: cors });
  }

  let body: any;
  try { body = await request.json(); } catch { body = {}; }

  const allowed: Record<string, string> = {
    name: 'name',
    shortName: 'short_name',
    bio: 'bio',
    avatar: 'avatar',
    region: 'region',
    roleType: 'role_type',         // AUTHOR | PERFORMER | BOTH
    payeeType: 'payee_type',       // LEGAL_ENTITY | SELF_EMPLOYED | INDIVIDUAL_ENTREPRENEUR
    legalName: 'legal_name',
    legalInn: 'legal_inn',
    legalKpp: 'legal_kpp',
    accountNumber: 'account_number',
    bankName: 'bank_name',
    contactEmail: 'contact_email',
    contactPhone: 'contact_phone',
  };

  const updates: Array<{ col: string; val: any }> = [];
  for (const [camel, snake] of Object.entries(allowed)) {
    if (body[camel] !== undefined) {
      const val = body[camel] === '' ? null : body[camel];
      updates.push({ col: snake, val });
    }
  }

  // Валидация ИНН
  const innUpdate = updates.find(u => u.col === 'legal_inn');
  if (innUpdate && innUpdate.val && !/^\d{10}(\d{2})?$/.test(String(innUpdate.val))) {
    return NextResponse.json({ success: false, error: 'ИНН должен быть 10 или 12 цифр' }, { status: 400, headers: cors });
  }

  // Валидация типа получателя
  const payeeUpdate = updates.find(u => u.col === 'payee_type');
  if (payeeUpdate && payeeUpdate.val && !['LEGAL_ENTITY', 'SELF_EMPLOYED', 'INDIVIDUAL_ENTREPRENEUR'].includes(String(payeeUpdate.val))) {
    return NextResponse.json({ success: false, error: 'Тип получателя должен быть LEGAL_ENTITY, SELF_EMPLOYED или INDIVIDUAL_ENTREPRENEUR' }, { status: 400, headers: cors });
  }

  if (updates.length === 0) {
    return NextResponse.json({ success: false, error: 'Нет полей для обновления' }, { status: 400, headers: cors });
  }

  const setParts = updates.map((u, i) => `${u.col} = $${i + 1}`);
  const values = updates.map(u => u.val);
  await prisma.$executeRawUnsafe(
    `UPDATE collectives SET ${setParts.join(', ')}, "updatedAt" = now() WHERE id = $${updates.length + 1}`,
    ...values,
    ctx.collective.id
  );

  return NextResponse.json({ success: true, message: 'Данные коллектива обновлены' }, { headers: cors });
}
