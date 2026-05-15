import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, AuthUser } from '@/lib/auth';
import { getCorsHeaders } from '@/lib/cors';

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request.headers.get('origin') || undefined),
  });
}

async function postHandler(request: NextRequest, user: AuthUser) {
  const origin = request.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin || undefined);

  try {
    const formData = await request.formData();
    const documentFile = formData.get('document');
    const university = formData.get('university');

    if (!documentFile || !university) {
      return NextResponse.json(
        { success: false, error: 'Документ и название учебного заведения обязательны' },
        { status: 400, headers: corsHeaders }
      );
    }

    // В реальном приложении здесь была бы загрузка файла в S3
    // и создание записи (Report/Ticket) для ручной модерации администратором.
    // Пока создадим заявку в B2BRequest для простоты.
    
    // @ts-ignore
    const fileName = documentFile.name || 'document';

    const requestStatus = await prisma.b2BRequest.create({
      data: {
        requesterId: user.id.toString(),
        companyName: university.toString(),
        email: user.email,
        message: `Заявка на студенческую подписку. Приложен файл: ${fileName}`,
        requestType: 'OTHER'
      }
    });

    return NextResponse.json({ 
      success: true, 
      data: { message: 'Документы отправлены на проверку', requestId: requestStatus.id } 
    }, { headers: corsHeaders });
  } catch (error) {
    console.error('[VERIFY_STUDENT_ERROR]', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка загрузки документов' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export const POST = requireAuth(postHandler);
