import { NextRequest, NextResponse } from 'next/server';
import { parseImageForm, validateImageFile, saveCoverImage } from '@/lib/imageUpload';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);
  const timestamp = new Date().toISOString();
  
  console.error('='.repeat(100));
  console.error(`[${timestamp}] [UPLOAD COVER API] [${requestId}] 🖼️ NEW COVER UPLOAD REQUEST`);
  console.error(`[${timestamp}] [UPLOAD COVER API] [${requestId}] URL: ${req.url}`);
  console.error('='.repeat(100));

  try {
    console.error(`[${timestamp}] [UPLOAD COVER API] [${requestId}] Step 1: Parsing form data...`);
    const { fields, file } = await parseImageForm(req);

    console.error(`[${timestamp}] [UPLOAD COVER API] [${requestId}] Step 2: Form parsed`);
    const { artistSlug, trackSlug } = fields;

    if (!file) {
      console.error(`[${timestamp}] [UPLOAD COVER API] [${requestId}] ❌ No image file`);
      return NextResponse.json({ 
        success: false, 
        error: 'Изображение не найдено в запросе' 
      }, { status: 400 });
    }

    if (!artistSlug || !trackSlug) {
      console.error(`[${timestamp}] [UPLOAD COVER API] [${requestId}] ❌ Missing slugs`);
      return NextResponse.json({ 
        success: false, 
        error: 'Не указаны artistSlug или trackSlug' 
      }, { status: 400 });
    }

    console.error(`[${timestamp}] [UPLOAD COVER API] [${requestId}] Step 3: Validating...`);
    const validation = validateImageFile(file);
    
    if (!validation.valid) {
      console.error(`[${timestamp}] [UPLOAD COVER API] [${requestId}] ❌ Validation failed: ${validation.error}`);
      return NextResponse.json({ 
        success: false, 
        error: validation.error 
      }, { status: 400 });
    }

    console.error(`[${timestamp}] [UPLOAD COVER API] [${requestId}] Step 4: Saving and processing image...`);
    const result = await saveCoverImage(file.buffer, file.filename, artistSlug, trackSlug);

    console.error(`[${timestamp}] [UPLOAD COVER API] [${requestId}] ✅ COVER UPLOAD COMPLETE!`);
    console.error('='.repeat(100));

    return NextResponse.json({ 
      success: true, 
      data: result 
    });

  } catch (error) {
    const ts = new Date().toISOString();
    console.error('='.repeat(100));
    console.error(`[${ts}] [UPLOAD COVER API] [${requestId}] ❌ FATAL ERROR`);
    console.error(`[${ts}] [UPLOAD COVER API] [${requestId}] Error:`, error);
    console.error('='.repeat(100));
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Неизвестная ошибка загрузки обложки'
      },
      { status: 500 }
    );
  }
}

