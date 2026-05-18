import { NextRequest, NextResponse } from 'next/server';
import { parseForm, validatePdfFile, savePdfFile } from '@/lib/fileUpload';

export async function POST(req: NextRequest) {
  try {
    const { fields, file } = await parseForm(req);
    // Принимаем разные имена slug-поля для обратной совместимости:
    // /author/upload шлёт trackSlug, /sheets/upload шлёт titleSlug.
    const slug = fields.titleSlug || fields.trackSlug || fields.slug;

    if (!file) {
      return NextResponse.json({ success: false, error: 'PDF файл не найден' }, { status: 400 });
    }
    if (!slug) {
      return NextResponse.json({ success: false, error: 'Не указан titleSlug/trackSlug' }, { status: 400 });
    }

    const validation = validatePdfFile(file);
    if (!validation.valid) {
      return NextResponse.json({ success: false, error: validation.error }, { status: 400 });
    }

    const result = await savePdfFile(file.buffer, file.filename, slug);
    const url = (result as any).pdfUrl || (result as any).url;
    return NextResponse.json({
      success: true,
      pdfUrl: url,
      url,
      data: { ...result, url, pdfUrl: url }
    });
  } catch (error) {
    console.error('[UPLOAD PDF API] Error:', error);
    return NextResponse.json({ success: false, error: 'Upload failed' }, { status: 500 });
  }
}
