import { NextRequest, NextResponse } from 'next/server';
import { parseForm, validatePdfFile, savePdfFile } from '@/lib/fileUpload';

export async function POST(req: NextRequest) {
  try {
    const { fields, file } = await parseForm(req);
    const { titleSlug } = fields;

    if (!file) {
      return NextResponse.json({ success: false, error: 'PDF файл не найден' }, { status: 400 });
    }
    if (!titleSlug) {
      return NextResponse.json({ success: false, error: 'Не указан titleSlug' }, { status: 400 });
    }

    const validation = validatePdfFile(file);
    if (!validation.valid) {
      return NextResponse.json({ success: false, error: validation.error }, { status: 400 });
    }

    const result = await savePdfFile(file.buffer, file.filename, titleSlug);

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('[UPLOAD PDF API] Error:', error);
    return NextResponse.json({ success: false, error: 'Upload failed' }, { status: 500 });
  }
}
