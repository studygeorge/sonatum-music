import { NextRequest, NextResponse } from 'next/server';
import { parseForm, validateImageFile, saveAvatarFile } from '@/lib/fileUpload';

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] [UPLOAD AVATAR] ========== REQUEST START ==========`);

  try {
    const { fields, file } = await parseForm(request);
    console.error(`[${timestamp}] [UPLOAD AVATAR] Form parsed:`, {
      fields: Object.keys(fields),
      hasFile: !!file
    });

    if (!file) {
      console.error(`[${timestamp}] [UPLOAD AVATAR] ❌ No file provided`);
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    const artistSlug = fields.artistSlug;
    if (!artistSlug) {
      console.error(`[${timestamp}] [UPLOAD AVATAR] ❌ No artistSlug provided`);
      return NextResponse.json(
        { success: false, error: 'Artist slug is required' },
        { status: 400 }
      );
    }

    console.error(`[${timestamp}] [UPLOAD AVATAR] Artist slug: ${artistSlug}`);

    const validation = validateImageFile(file);
    if (!validation.valid) {
      console.error(`[${timestamp}] [UPLOAD AVATAR] ❌ Validation failed:`, validation.error);
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      );
    }

    console.error(`[${timestamp}] [UPLOAD AVATAR] ✅ Validation passed, saving file...`);

    const result = await saveAvatarFile(file.buffer, file.filename, artistSlug);

    console.error(`[${timestamp}] [UPLOAD AVATAR] ✅ File saved successfully:`, result.avatarUrl);

    return NextResponse.json({
      success: true,
      data: {
        avatarUrl: result.avatarUrl,
        filename: result.filename,
        size: result.size
      },
      message: 'Avatar uploaded successfully'
    });

  } catch (error) {
    console.error(`[${timestamp}] [UPLOAD AVATAR] ❌ FATAL ERROR:`, error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Upload failed' 
      },
      { status: 500 }
    );
  } finally {
    console.error(`[${timestamp}] [UPLOAD AVATAR] ========== REQUEST END ==========`);
  }
}