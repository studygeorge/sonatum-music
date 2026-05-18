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

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: { artistProfile: true, collective: true },
  });

  if (!user) {
    return NextResponse.json(
      { success: false, error: 'Пользователь не найден' },
      { status: 404, headers: cors }
    );
  }

  // Расширенные поля через raw query
  const [extras] = (await prisma.$queryRawUnsafe(
    `SELECT account_kind, tin, sbp_phone, payout_enabled, self_employed_verified_at FROM users WHERE id = $1`,
    user.id
  )) as any[];

  let format: 'SOLO' | 'COLLECTIVE' | null = null;
  let role: string | null = null;
  let payoutInfo: any = null;

  if (user.artistProfile) {
    const [a] = (await prisma.$queryRawUnsafe(
      `SELECT project_format FROM artists WHERE id = $1`,
      user.artistProfile.id
    )) as any[];
    format = a?.project_format === 'COLLECTIVE' ? 'COLLECTIVE' : 'SOLO';
    role = user.artistProfile.authorType;
  } else if (user.collective) {
    const [c] = (await prisma.$queryRawUnsafe(
      `SELECT role_type, payee_type, legal_name, legal_inn, legal_kpp, account_number, bank_name, region, short_name, contact_email, contact_phone, verified FROM collectives WHERE id = $1`,
      user.collective.id
    )) as any[];
    format = 'COLLECTIVE';
    role = c?.role_type;
    payoutInfo = c;
  }

  // Балансы и количества
  const [tracksCount, salesAmount, donationsAmount] = await Promise.all([
    user.artistProfile
      ? prisma.track.count({ where: { artistId: user.artistProfile.id } })
      : Promise.resolve(0),
    prisma.$queryRawUnsafe(
      `SELECT COALESCE(SUM(artist_amount),0)::numeric AS total FROM license_purchases lp
       JOIN tracks t ON t.id = lp.track_id
       JOIN artists a ON a.id = t."artistId"
       WHERE a."userId" = $1 AND lp.status = 'PAID'`,
      user.id
    ),
    prisma.$queryRawUnsafe(
      `SELECT COALESCE(SUM(amount),0)::numeric AS total FROM donations d
       LEFT JOIN artists a ON a.id = d.recipient_artist_id
       WHERE d.status = 'PAID' AND (a."userId" = $1 OR d.recipient_collective_id IN
         (SELECT id FROM collectives WHERE "leaderId" = $1))`,
      user.id
    ),
  ]);

  const balance = Number(user.balance) || 0;

  return NextResponse.json(
    {
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          accountKind: extras?.account_kind || 'LISTENER',
          tin: extras?.tin,
          sbpPhone: extras?.sbp_phone,
          payoutEnabled: !!extras?.payout_enabled,
          selfEmployedVerifiedAt: extras?.self_employed_verified_at,
          balance,
        },
        format,
        role,
        artist: user.artistProfile
          ? {
              id: user.artistProfile.id,
              name: user.artistProfile.name,
              slug: user.artistProfile.slug,
              bio: user.artistProfile.bio,
              avatar: user.artistProfile.avatar,
              region: user.artistProfile.region,
              city: user.artistProfile.city,
              verified: user.artistProfile.verified,
              followers: user.artistProfile.followers,
            }
          : null,
        collective: user.collective
          ? {
              id: user.collective.id,
              name: user.collective.name,
              slug: user.collective.slug,
              bio: user.collective.bio,
              avatar: user.collective.avatar,
              ...payoutInfo,
            }
          : null,
        stats: {
          tracksCount,
          totalSales: Number((salesAmount as any)?.[0]?.total || 0),
          totalDonations: Number((donationsAmount as any)?.[0]?.total || 0),
        },
      },
    },
    { headers: cors }
  );
}


// PATCH /api/author/me — обновление профиля артиста самим автором
// (avatar, bio, coverImage, region, city, foundedYear, socialLinks).
// Жёстко защищено сессией — только владелец Artist.
export async function PATCH(request: NextRequest) {
  const cors = getCorsHeaders(request.headers.get("origin") || undefined);
  const auth = request.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) {
    return NextResponse.json(
      { success: false, error: "Требуется авторизация" },
      { status: 401, headers: cors }
    );
  }
  const session = await AuthService.validateSession(auth.substring(7));
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Сессия истекла" },
      { status: 401, headers: cors }
    );
  }

  const artist = await prisma.artist.findUnique({
    where: { userId: session.userId },
    select: { id: true },
  });
  if (!artist) {
    return NextResponse.json(
      { success: false, error: "Профиль артиста не найден" },
      { status: 404, headers: cors }
    );
  }

  const body = await request.json().catch(() => ({}));

  const data: any = {};
  if (typeof body.avatar === "string") data.avatar = body.avatar || null;
  if (typeof body.coverImage === "string") data.coverImage = body.coverImage || null;
  if (typeof body.bio === "string") data.bio = body.bio || null;
  if (typeof body.region === "string") data.region = body.region || null;
  if (typeof body.city === "string") data.city = body.city || null;
  if (body.foundedYear !== undefined) data.foundedYear = body.foundedYear ? Number(body.foundedYear) : null;
  if (body.socialLinks !== undefined) data.socialLinks = body.socialLinks || null;

  const updated = await prisma.artist.update({
    where: { id: artist.id },
    data,
    select: {
      id: true, name: true, slug: true, avatar: true, coverImage: true,
      bio: true, region: true, city: true, foundedYear: true, socialLinks: true,
      verified: true, followers: true,
    },
  });

  return NextResponse.json({ success: true, data: updated }, { headers: cors });
}

