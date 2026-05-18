import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/middleware';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// POST /api/admin/tracks/[id]/reject-pending
// Сбрасывает metadata.pendingChanges, оставляя публичную версию трека без изменений.
// Можно передать body.reason — будет сохранён в metadata.lastRejection.
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return withRole(request, ['ADMIN', 'SUPER_ADMIN'], async (req) => {
    try {
      const track: any = await prisma.track.findUnique({ where: { id: params.id } });
      if (!track) return NextResponse.json({ success: false, error: 'Трек не найден' }, { status: 404 });

      const meta = (track.metadata as any) || {};
      if (!meta.pendingChanges) {
        return NextResponse.json({ success: false, error: 'Нет правок на модерации' }, { status: 400 });
      }

      let reason: string | null = null;
      try {
        const body = await req.json();
        if (typeof body?.reason === 'string') reason = body.reason.trim() || null;
      } catch {}

      const cleanedMeta = { ...meta };
      delete cleanedMeta.pendingChanges;
      delete cleanedMeta.hasPendingChanges;
      delete cleanedMeta.pendingSubmittedAt;
      if (reason) {
        cleanedMeta.lastRejection = {
          reason,
          rejectedAt: new Date().toISOString(),
        };
      }

      await prisma.track.update({
        where: { id: params.id },
        data: { metadata: cleanedMeta },
      });

      return NextResponse.json({ success: true, message: 'Правки отклонены, публикация без изменений' });
    } catch (error) {
      console.error('[ADMIN REJECT PENDING] Error:', error);
      return NextResponse.json({ success: false, error: 'Ошибка отклонения правок' }, { status: 500 });
    }
  });
}
