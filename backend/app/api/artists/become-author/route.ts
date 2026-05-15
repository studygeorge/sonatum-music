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

type Body = {
  format: 'SOLO' | 'COLLECTIVE';
  role: 'AUTHORIAL' | 'PERFORMING' | 'FULL_CREATIVE'; // авторский / исполнительский / полнотворческий
  stageName: string;       // сценическое имя или название коллектива
  shortName?: string;      // только для коллектива
  region?: string;
  city?: string;
  bio?: string;
  contactEmail?: string;
  contactPhone?: string;
  // для коллектива:
  payeeType?: 'LEGAL_ENTITY' | 'SOLE_PROP' | 'SELF_EMPLOYED';
  legalName?: string;
  legalInn?: string;
  legalKpp?: string;
  accountNumber?: string;
  bankName?: string;
};

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9а-яё\s-]/gi, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

function roleToAuthorType(role: Body['role']): 'COMPOSER' | 'PERFORMER' | 'BOTH' {
  if (role === 'AUTHORIAL') return 'COMPOSER';
  if (role === 'PERFORMING') return 'PERFORMER';
  return 'BOTH';
}

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

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json(
      { success: false, error: 'Невалидный JSON' },
      { status: 400, headers: cors }
    );
  }

  if (!body.format || !body.role || !body.stageName?.trim()) {
    return NextResponse.json(
      { success: false, error: 'Заполните формат, роль и название' },
      { status: 400, headers: cors }
    );
  }
  if (body.format === 'COLLECTIVE' && !body.payeeType) {
    return NextResponse.json(
      { success: false, error: 'Укажите получателя выплат для коллектива' },
      { status: 400, headers: cors }
    );
  }

  const userId = session.userId;
  const stageName = body.stageName.trim();
  const baseSlug = slugify(stageName) || `artist-${Date.now()}`;
  const authorType = roleToAuthorType(body.role);

  // уникальный slug
  let slug = baseSlug;
  for (let i = 2; i < 50; i++) {
    const exists =
      body.format === 'SOLO'
        ? await prisma.artist.findFirst({ where: { slug } })
        : await prisma.collective.findFirst({ where: { slug } });
    if (!exists) break;
    slug = `${baseSlug}-${i}`;
  }

  // Обновляем User: role=ARTIST, account_kind
  await prisma.$executeRawUnsafe(
    `UPDATE users SET role = 'ARTIST', account_kind = $1, updated_at = now() WHERE id = $2`,
    body.format === 'SOLO' ? 'SOLO_AUTHOR' : 'COLLECTIVE_LEADER',
    userId
  );

  if (body.format === 'SOLO') {
    // создать или обновить Artist
    const existing = await prisma.artist.findUnique({ where: { userId } });
    if (existing) {
      await prisma.artist.update({
        where: { id: existing.id },
        data: {
          name: stageName,
          slug,
          bio: body.bio || null,
          region: body.region || null,
          city: body.city || null,
          authorType,
        },
      });
      await prisma.$executeRawUnsafe(
        `UPDATE artists SET project_format = 'SOLO' WHERE id = $1`,
        existing.id
      );
    } else {
      const created = await prisma.artist.create({
        data: {
          userId,
          name: stageName,
          slug,
          bio: body.bio || null,
          region: body.region || null,
          city: body.city || null,
          authorType,
        },
      });
      await prisma.$executeRawUnsafe(
        `UPDATE artists SET project_format = 'SOLO' WHERE id = $1`,
        created.id
      );
    }
  } else {
    // COLLECTIVE
    const existing = await prisma.collective.findUnique({ where: { leaderId: userId } });
    if (existing) {
      await prisma.collective.update({
        where: { id: existing.id },
        data: { name: stageName, slug, bio: body.bio || null },
      });
      await prisma.$executeRawUnsafe(
        `UPDATE collectives SET
           role_type = $1, payee_type = $2,
           legal_name = $3, legal_inn = $4, legal_kpp = $5,
           account_number = $6, bank_name = $7,
           region = $8, short_name = $9,
           contact_email = $10, contact_phone = $11
         WHERE id = $12`,
        body.role,
        body.payeeType || null,
        body.legalName || null,
        body.legalInn || null,
        body.legalKpp || null,
        body.accountNumber || null,
        body.bankName || null,
        body.region || null,
        body.shortName || null,
        body.contactEmail || null,
        body.contactPhone || null,
        existing.id
      );
    } else {
      const created = await prisma.collective.create({
        data: { name: stageName, slug, leaderId: userId, bio: body.bio || null },
      });
      await prisma.$executeRawUnsafe(
        `UPDATE collectives SET
           role_type = $1, payee_type = $2,
           legal_name = $3, legal_inn = $4, legal_kpp = $5,
           account_number = $6, bank_name = $7,
           region = $8, short_name = $9,
           contact_email = $10, contact_phone = $11
         WHERE id = $12`,
        body.role,
        body.payeeType || null,
        body.legalName || null,
        body.legalInn || null,
        body.legalKpp || null,
        body.accountNumber || null,
        body.bankName || null,
        body.region || null,
        body.shortName || null,
        body.contactEmail || null,
        body.contactPhone || null,
        created.id
      );
    }
  }

  return NextResponse.json(
    { success: true, slug, format: body.format, role: body.role },
    { headers: cors }
  );
}
