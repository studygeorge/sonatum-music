import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/middleware';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// POST /api/admin/tracks/[id]/approve-pending
// Применяет metadata.pendingChanges к основным полям трека и очищает pending.
// Это используется для случаев, когда автор редактировал уже опубликованный трек —
// его изменения копились в metadata.pendingChanges, публика видела старую версию,
// а админ теперь одобряет новую.
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return withRole(request, ['ADMIN', 'SUPER_ADMIN'], async (req, session) => {
    try {
      const track: any = await prisma.track.findUnique({
        where: { id: params.id },
        include: { artist: { select: { userId: true } } },
      });
      if (!track) return NextResponse.json({ success: false, error: 'Трек не найден' }, { status: 404 });

      const meta = (track.metadata as any) || {};
      const pending = meta.pendingChanges;
      if (!pending || Object.keys(pending).length === 0) {
        return NextResponse.json({ success: false, error: 'Нет правок на модерации' }, { status: 400 });
      }

      // Поля Prisma-модели, которые можно применить через update()
      const prismaFields: Record<string, any> = {};
      const directPrisma = [
        'title', 'lyrics', 'cover', 'price', 'instrumentalPrice',
        'isForSale', 'isFree', 'bpm', 'key', 'audioUrl', 'duration',
        'instrumentalUrl', 'audioType', 'releaseDate',
      ];
      for (const f of directPrisma) {
        if (pending[f] !== undefined) {
          prismaFields[f] =
            f === 'releaseDate' ? (pending[f] ? new Date(pending[f]) : null) :
            (f === 'price' || f === 'instrumentalPrice') ? (pending[f] === null ? null : Number(pending[f])) :
            (f === 'bpm' || f === 'duration') ? (pending[f] === null ? null : Math.round(Number(pending[f]))) :
            pending[f];
        }
      }

      // V2-поля через raw SQL (snake_case в БД)
      const v2map: Record<string, string> = {
        contentType: 'content_type', originalComposer: 'original_composer',
        recordingYear: 'recording_year', recordingPlace: 'recording_place',
        era: 'era', mood: 'mood', instruments: 'instruments',
        difficulty: 'difficulty', tempo: 'tempo',
        allowDonations: 'allow_donations', allowExclusive: 'allow_exclusive',
      };
      const v2updates: Array<{ col: string; val: any }> = [];
      for (const [camel, snake] of Object.entries(v2map)) {
        if (pending[camel] !== undefined) v2updates.push({ col: snake, val: pending[camel] });
      }

      // Ноты (sheetUrl)
      const sheetUrl = pending.sheetUrl;

      // Очищаем metadata.pendingChanges
      const cleanedMeta = { ...meta };
      delete cleanedMeta.pendingChanges;
      delete cleanedMeta.hasPendingChanges;
      delete cleanedMeta.pendingSubmittedAt;

      await prisma.track.update({
        where: { id: params.id },
        data: {
          ...prismaFields,
          metadata: cleanedMeta,
        },
      });

      // V2-поля
      if (v2updates.length > 0) {
        const setParts = v2updates.map((u, i) =>
          u.col === 'instruments'
            ? `${u.col} = $${i + 1}::jsonb`
            : `${u.col} = $${i + 1}`
        );
        const values = v2updates.map((u) =>
          u.col === 'instruments' ? JSON.stringify(u.val) : u.val
        );
        await prisma.$executeRawUnsafe(
          `UPDATE tracks SET ${setParts.join(', ')}, "updatedAt" = now() WHERE id = $${v2updates.length + 1}`,
          ...values,
          params.id
        );
      }

      // Ноты — PDF + метаданные (instrument, difficulty, price, isPublicDomain)
      const sheetTouched =
        sheetUrl !== undefined || pending.sheetInstrument !== undefined ||
        pending.sheetDifficulty !== undefined || pending.sheetPrice !== undefined ||
        pending.sheetIsPublicDomain !== undefined;

      if (sheetTouched) {
        const sheetExists = await prisma.sheetMusic.findUnique({ where: { trackId: params.id } });
        const finalUrl = sheetUrl !== undefined ? (sheetUrl || null) : (sheetExists?.pdfUrl || null);

        if (finalUrl) {
          const sheetData: any = { pdfUrl: finalUrl };
          if (pending.sheetInstrument !== undefined) sheetData.instrument = pending.sheetInstrument || 'Не указан';
          if (pending.sheetDifficulty !== undefined && ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'].includes(pending.sheetDifficulty)) {
            sheetData.difficulty = pending.sheetDifficulty;
          }
          if (pending.sheetPrice !== undefined) {
            sheetData.price = pending.sheetPrice === '' || pending.sheetPrice === null ? null : Number(pending.sheetPrice);
          }
          if (pending.sheetIsPublicDomain !== undefined) sheetData.isPublicDomain = !!pending.sheetIsPublicDomain;

          if (sheetExists) {
            await prisma.sheetMusic.update({ where: { trackId: params.id }, data: sheetData });
          } else {
            const uploaderId = track.artist?.userId || session.userId;
            await prisma.sheetMusic.create({
              data: {
                trackId: params.id,
                pdfUrl: finalUrl,
                title: track.title,
                composerId: track.artistId,
                uploaderId,
                instrument: sheetData.instrument || 'Не указан',
                ...(sheetData.difficulty ? { difficulty: sheetData.difficulty } : {}),
                ...(sheetData.price !== undefined ? { price: sheetData.price } : {}),
                ...(sheetData.isPublicDomain !== undefined ? { isPublicDomain: sheetData.isPublicDomain } : {}),
              },
            });
          }
        } else if (sheetExists && sheetUrl === '') {
          await prisma.sheetMusic.delete({ where: { trackId: params.id } });
        }
      }

      return NextResponse.json({ success: true, message: 'Правки применены к публикации' });
    } catch (error) {
      console.error('[ADMIN APPROVE PENDING] Error:', error);
      return NextResponse.json({ success: false, error: 'Ошибка применения правок' }, { status: 500 });
    }
  });
}
