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
  return withRole(request, ['ADMIN', 'SUPER_ADMIN'], async () => {
    try {
      const track: any = await prisma.track.findUnique({ where: { id: params.id } });
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
        'isForSale', 'isFree', 'bpm', 'key', 'audioUrl',
        'instrumentalUrl', 'audioType', 'releaseDate',
      ];
      for (const f of directPrisma) {
        if (pending[f] !== undefined) {
          prismaFields[f] =
            f === 'releaseDate' ? (pending[f] ? new Date(pending[f]) : null) :
            (f === 'price' || f === 'instrumentalPrice') ? (pending[f] === null ? null : Number(pending[f])) :
            f === 'bpm' ? (pending[f] === null ? null : Number(pending[f])) :
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

      // Ноты
      if (sheetUrl !== undefined) {
        const sheetExists = await prisma.sheetMusic.findUnique({ where: { trackId: params.id } });
        if (sheetUrl) {
          if (sheetExists) {
            await prisma.sheetMusic.update({ where: { trackId: params.id }, data: { pdfUrl: sheetUrl } });
          } else {
            await prisma.sheetMusic.create({
              data: {
                trackId: params.id,
                pdfUrl: sheetUrl,
                title: track.title,
                composerId: track.artistId,
                uploaderId: track.artistId, // запасной вариант, точнее uploaderId недоступен здесь
                instrument: 'Не указан',
              },
            });
          }
        } else if (sheetExists) {
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
