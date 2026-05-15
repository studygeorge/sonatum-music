import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withRole } from '@/lib/auth';

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

export const PATCH = withRole(handlePATCH, 'ADMIN', 'SUPER_ADMIN');
export const DELETE = withRole(handleDELETE, 'SUPER_ADMIN');
