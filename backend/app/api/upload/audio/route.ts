import { NextRequest, NextResponse } from 'next/server';
import { parseForm, validateAudioFile, saveAudioFile } from '@/lib/fileUpload';

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);
  const timestamp = new Date().toISOString();
  
  console.error('='.repeat(100));
  console.error(`[${timestamp}] [UPLOAD API] [${requestId}] 🎵 NEW UPLOAD REQUEST`);
  console.error(`[${timestamp}] [UPLOAD API] [${requestId}] URL: ${req.url}`);
  console.error(`[${timestamp}] [UPLOAD API] [${requestId}] Method: ${req.method}`);
  console.error(`[${timestamp}] [UPLOAD API] [${requestId}] Headers:`, {
    'content-type': req.headers.get('content-type'),
    'content-length': req.headers.get('content-length'),
    'user-agent': req.headers.get('user-agent')
  });
  console.error('='.repeat(100));

  try {
    console.error(`[${timestamp}] [UPLOAD API] [${requestId}] Step 1: Parsing form data...`);
    const { fields, file } = await parseForm(req);

    console.error(`[${timestamp}] [UPLOAD API] [${requestId}] Step 2: Form parsed successfully`);
    console.error(`[${timestamp}] [UPLOAD API] [${requestId}] Fields:`, fields);
    console.error(`[${timestamp}] [UPLOAD API] [${requestId}] File:`, file ? {
      filename: file.filename,
      size: file.size,
      mimetype: file.mimetype
    } : 'NO FILE');

    const { artistSlug, trackSlug } = fields;
    const kind: 'full' | 'instrumental' = fields.kind === 'instrumental' ? 'instrumental' : 'full';

    if (!file) {
      console.error(`[${timestamp}] [UPLOAD API] [${requestId}] ❌ No audio file in request`);
      return NextResponse.json({ 
        success: false, 
        error: 'Аудио файл не найден в запросе' 
      }, { status: 400 });
    }

    if (!artistSlug || !trackSlug) {
      console.error(`[${timestamp}] [UPLOAD API] [${requestId}] ❌ Missing slugs. artistSlug: ${artistSlug}, trackSlug: ${trackSlug}`);
      return NextResponse.json({ 
        success: false, 
        error: 'Не указаны artistSlug или trackSlug' 
      }, { status: 400 });
    }

    console.error(`[${timestamp}] [UPLOAD API] [${requestId}] Step 3: Validating file...`);
    const validation = validateAudioFile(file);
    
    if (!validation.valid) {
      console.error(`[${timestamp}] [UPLOAD API] [${requestId}] ❌ Validation failed: ${validation.error}`);
      return NextResponse.json({ 
        success: false, 
        error: validation.error 
      }, { status: 400 });
    }

    console.error(`[${timestamp}] [UPLOAD API] [${requestId}] Step 4: Saving file (kind=${kind}) to frontend/public...`);
    const result = await saveAudioFile(file.buffer, file.filename, artistSlug, trackSlug, kind);

    console.error(`[${timestamp}] [UPLOAD API] [${requestId}] ✅ UPLOAD COMPLETE!`);
    console.error(`[${timestamp}] [UPLOAD API] [${requestId}] Result:`, result);
    console.error('='.repeat(100));

    return NextResponse.json({ 
      success: true, 
      data: result 
    });

  } catch (error) {
    const ts = new Date().toISOString();
    console.error('='.repeat(100));
    console.error(`[${ts}] [UPLOAD API] [${requestId}] ❌ FATAL ERROR`);
    console.error(`[${ts}] [UPLOAD API] [${requestId}] Error name:`, error instanceof Error ? error.name : 'Unknown');
    console.error(`[${ts}] [UPLOAD API] [${requestId}] Error message:`, error instanceof Error ? error.message : 'Unknown error');
    console.error(`[${ts}] [UPLOAD API] [${requestId}] Error stack:`, error instanceof Error ? error.stack : 'No stack');
    console.error('='.repeat(100));
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Неизвестная ошибка загрузки',
        details: process.env.NODE_ENV === 'development' && error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}