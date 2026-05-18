import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withRole } from '@/lib/auth';

// GET /api/admin/artists/[id]
// Полный профиль артиста для админки: контакты, все треки, все ноты,
// агрегированные финансы и активность.
async function handleGET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;

    // Артист + связанные базовые данные
    const artist = await prisma.artist.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true,
            firstName: true,
            lastName: true,
            avatar: true,
            bio: true,
            balance: true,
            role: true,
            status: true,
            emailVerified: true,
            lastLoginAt: true,
            createdAt: true,
            nickname: true,
            regionId: true,
            favoriteGenres: true,
            favoriteEras: true,
            favoriteComposers: true,
            privacySettings: true,
            subscription: {
              select: {
                tier: true,
                status: true,
                startDate: true,
                endDate: true,
                autoRenew: true,
                price: true,
              },
            },
          },
        },
        genres: { include: { genre: { select: { id: true, name: true, slug: true, color: true } } } },
        Region: { select: { id: true, name: true, slug: true } },
        _count: {
          select: {
            tracks: true,
            albums: true,
            sheetMusicAsComposer: true,
            sheetMusicAsArranger: true,
            followedBy: true,
          },
        },
      },
    });

    if (!artist) {
      return NextResponse.json(
        { success: false, error: 'Артист не найден' },
        { status: 404 }
      );
    }

    // Все треки артиста, сгруппированы по статусу
    const tracks = await prisma.track.findMany({
      where: { artistId: id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        slug: true,
        duration: true,
        status: true,
        audioUrl: true,
        audioType: true,
        instrumentalUrl: true,
        instrumentalPrice: true,
        cover: true,
        price: true,
        isFree: true,
        isForSale: true,
        playCount: true,
        likeCount: true,
        purchaseCount: true,
        releaseDate: true,
        createdAt: true,
        publishedAt: true,
        genres: { include: { genre: { select: { name: true, slug: true, color: true } } } },
        _count: { select: { purchases: true, comments: true, reports: true } },
      },
    });

    // Все альбомы
    const albums = await prisma.album.findMany({
      where: { artistId: id },
      orderBy: { releaseDate: 'desc' },
      select: {
        id: true,
        title: true,
        slug: true,
        cover: true,
        releaseDate: true,
        createdAt: true,
        _count: { select: { tracks: true } },
      },
    });

    // Все ноты, где артист является композитором или аранжировщиком
    const sheets = await prisma.sheetMusic.findMany({
      where: { OR: [{ composerId: id }, { arrangerId: id }] },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        pdfUrl: true,
        instrument: true,
        instrumentation: true,
        difficulty: true,
        price: true,
        isPublicDomain: true,
        verifyStatus: true,
        composerId: true,
        arrangerId: true,
        createdAt: true,
        _count: { select: { annotations: true, downloads: true } },
      },
    });

    // Заявки B2B на треки этого артиста
    const b2bRequests = await prisma.b2BRequest.findMany({
      where: { track: { artistId: id } },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        companyName: true,
        email: true,
        phone: true,
        requestType: true,
        status: true,
        trackId: true,
        message: true,
        createdAt: true,
      },
    });

    // Жалобы (Report) на контент артиста
    const reports = await prisma.report.findMany({
      where: { track: { artistId: id } },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        reason: true,
        details: true,
        status: true,
        targetType: true,
        targetId: true,
        reporterId: true,
        reporter: { select: { email: true, username: true } },
        createdAt: true,
      },
    });

    // Агрегаты по трекам и финансам
    const totals = await prisma.track.aggregate({
      where: { artistId: id },
      _sum: { playCount: true, likeCount: true, purchaseCount: true },
    });

    const tracksByStatus = {
      DRAFT: tracks.filter((t) => t.status === 'DRAFT').length,
      PENDING: tracks.filter((t) => t.status === 'PENDING').length,
      PUBLISHED: tracks.filter((t) => t.status === 'PUBLISHED').length,
      REJECTED: tracks.filter((t) => t.status === 'REJECTED').length,
      ARCHIVED: tracks.filter((t) => t.status === 'ARCHIVED').length,
    };

    // Транзакции и выплаты пользователя
    const transactions = await prisma.transaction.findMany({
      where: { userId: artist.userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, amount: true, type: true, description: true, createdAt: true },
    });

    return NextResponse.json({
      success: true,
      data: {
        artist,
        tracks,
        tracksByStatus,
        albums,
        sheets,
        b2bRequests,
        reports,
        transactions,
        totals: {
          plays: Number(totals._sum.playCount || 0),
          likes: Number(totals._sum.likeCount || 0),
          purchases: Number(totals._sum.purchaseCount || 0),
        },
      },
    });
  } catch (error) {
    console.error('[ADMIN ARTIST GET] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка получения профиля артиста' },
      { status: 500 }
    );
  }
}

async function handlePATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    const body = await req.json();
    const { name, slug, bio, avatar, verified } = body;

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (slug !== undefined) updateData.slug = slug;
    if (bio !== undefined) updateData.bio = bio;
    if (avatar !== undefined) updateData.avatar = avatar;
    if (verified !== undefined) updateData.verified = verified;

    const artist = await prisma.artist.update({
      where: { id },
      data: updateData,
      include: {
        _count: {
          select: { 
            tracks: true
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      data: artist
    });
  } catch (error) {
    console.error('[ADMIN ARTISTS PATCH] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка обновления артиста' },
      { status: 500 }
    );
  }
}

async function handleDELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;

    const tracksCount = await prisma.track.count({
      where: { artistId: id }
    });

    if (tracksCount > 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Невозможно удалить артиста: у него ${tracksCount} треков` 
        },
        { status: 400 }
      );
    }

    await prisma.artist.delete({
      where: { id }
    });

    return NextResponse.json({
      success: true,
      data: { message: 'Артист успешно удалён' }
    });
  } catch (error) {
    console.error('[ADMIN ARTISTS DELETE] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка удаления артиста' },
      { status: 500 }
    );
  }
}

export const GET = withRole(handleGET, 'ADMIN', 'SUPER_ADMIN');
export const PATCH = withRole(handlePATCH, 'ADMIN', 'SUPER_ADMIN');
export const DELETE = withRole(handleDELETE, 'SUPER_ADMIN');
