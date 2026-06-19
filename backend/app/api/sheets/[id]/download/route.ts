import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, AuthUser } from '@/lib/auth';
import { getCorsHeaders } from '@/lib/cors';
import { PDFDocument, rgb } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request.headers.get('origin') || undefined),
  });
}

async function getHandler(
  request: NextRequest, 
  user: AuthUser,
  context: { params: { id: string } }
) {
  const origin = request.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin || undefined);

  try {
    const { id } = context.params;

    const sheet = await prisma.sheetMusic.findUnique({
      where: { id },
      include: {
        uploader: { select: { id: true, email: true } }
      }
    });

    if (!sheet) {
      return NextResponse.json(
        { success: false, error: 'Ноты не найдены' },
        { status: 404, headers: corsHeaders }
      );
    }

    // Извлечем активную подписку — только ACTIVE статус с не истёкшим endDate
    const subscription = await prisma.subscription.findUnique({ where: { userId: user.id as string } });
    const subActive =
      !!subscription &&
      subscription.status === 'ACTIVE' &&
      ['PREMIUM', 'STUDENT'].includes(subscription.tier) &&
      (!subscription.endDate || new Date(subscription.endDate) > new Date());
    const isPremium =
      user.role === 'ADMIN' || user.role === 'SUPER_ADMIN' || subActive;

    // Доступ к нотам — только Premium-подписчикам
    if (!isPremium) {
      return NextResponse.json(
        { success: false, error: 'Требуется активная подписка Premium' },
        { status: 403, headers: corsHeaders }
      );
    }

    // ЛОГИКА МОНЕТИЗАЦИИ (14 руб автору)
    if (isPremium && sheet.uploaderId && sheet.uploaderId !== user.id.toString()) {
      // Проверяем, качал ли этот пользователь уже эти ноты
      const existingDownload = await prisma.sheetMusicDownload.findUnique({
        where: { userId_sheetMusicId: { userId: user.id.toString(), sheetMusicId: sheet.id } }
      });

      if (!existingDownload) {
        // Транзакция: Начисляем автору 14 руб и фиксируем скачивание
        const amountEarned = 14.00;
        await prisma.$transaction(async (tx: any) => {
          await tx.sheetMusicDownload.create({
            data: { userId: user.id.toString(), sheetMusicId: sheet.id, amountEarned }
          });
          
          await tx.user.update({
            where: { id: sheet.uploaderId as string },
            data: { balance: { increment: amountEarned } }
          });

          await tx.transaction.create({
            data: {
              userId: sheet.uploaderId as string,
              amount: amountEarned,
              type: 'EARNING',
              description: `Платное скачивание нот: ${sheet.title}`
            }
          });
        });
      }
    }

    // В реальном проекте: загружаем PDF по sheet.pdfUrl
    // Для мока создадим пустой PDF в памяти
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]); // A4
    page.drawText(`Ноты: ${sheet.title}`, { x: 50, y: 800, size: 20 });
    
    // ДОБАВЛЯЕМ ВОДЯНОЙ ЗНАК (Вотермарк)
    const watermarkText = `Downloaded by ${user.email} on ${new Date().toISOString().split('T')[0]}`;
    page.drawText(watermarkText, {
      x: 50,
      y: 50,
      size: 10,
      color: rgb(0.5, 0.5, 0.5),
    });

    const pdfBytes = await pdfDoc.save();

    // Возвращаем файл
    return new NextResponse(Buffer.from(pdfBytes) as any, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${sheet.title}.pdf"`
      }
    });

  } catch (error) {
    console.error('[SHEETS_DOWNLOAD_ERROR]', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка скачивания' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export const GET = requireAuth(getHandler);
