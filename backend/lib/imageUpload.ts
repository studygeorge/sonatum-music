import fs from 'fs/promises';
import path from 'path';
import { NextRequest } from 'next/server';
import sharp from 'sharp';

const FRONTEND_PUBLIC = '/app/public/images/tracks/covers';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const COVER_SIZE = 1000; // 1000x1000px

export async function parseImageForm(req: NextRequest): Promise<{ 
  fields: Record<string, string>; 
  file: { buffer: Buffer; filename: string; mimetype: string; size: number } | null 
}> {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] [PARSE IMAGE] Starting...`);

  try {
    const formData = await req.formData();
    console.error(`[${timestamp}] [PARSE IMAGE] FormData received`);

    const fields: Record<string, string> = {};
    let file: { buffer: Buffer; filename: string; mimetype: string; size: number } | null = null;

    for (const [key, value] of formData.entries()) {
      if (value instanceof File) {
        console.error(`[${timestamp}] [PARSE IMAGE] File found:`, {
          key,
          name: value.name,
          size: value.size,
          type: value.type
        });

        const arrayBuffer = await value.arrayBuffer();
        file = {
          buffer: Buffer.from(arrayBuffer),
          filename: value.name,
          mimetype: value.type,
          size: value.size
        };
      } else {
        fields[key] = value.toString();
      }
    }

    console.error(`[${timestamp}] [PARSE IMAGE] ✅ Parsing complete`);
    return { fields, file };

  } catch (error) {
    console.error(`[${timestamp}] [PARSE IMAGE] ❌ Error:`, error);
    throw error;
  }
}

export function validateImageFile(file: { 
  filename: string; 
  mimetype: string; 
  size: number 
}): { valid: boolean; error?: string } {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] [VALIDATE IMAGE] Starting validation`);

  if (!file.size || file.size < 100) {
    console.error(`[${timestamp}] [VALIDATE IMAGE] ❌ File too small`);
    return { valid: false, error: 'Файл слишком маленький' };
  }

  if (file.size > MAX_FILE_SIZE) {
    console.error(`[${timestamp}] [VALIDATE IMAGE] ❌ File too large: ${file.size} bytes`);
    return { valid: false, error: 'Файл слишком большой (максимум 10MB)' };
  }

  const validMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (file.mimetype && !validMimeTypes.includes(file.mimetype.toLowerCase())) {
    console.error(`[${timestamp}] [VALIDATE IMAGE] ❌ Invalid mimetype: ${file.mimetype}`);
    return { valid: false, error: 'Поддерживаются только JPG, PNG, WEBP' };
  }

  const ext = path.extname(file.filename).toLowerCase();
  const validExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
  if (!validExtensions.includes(ext)) {
    console.error(`[${timestamp}] [VALIDATE IMAGE] ❌ Invalid extension: ${ext}`);
    return { valid: false, error: 'Поддерживаются только JPG, PNG, WEBP' };
  }

  console.error(`[${timestamp}] [VALIDATE IMAGE] ✅ Validation passed`);
  return { valid: true };
}

function generateSafeFilename(artistSlug: string, trackSlug: string): string {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000000);
  
  const cleanArtist = artistSlug.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
  const cleanTrack = trackSlug.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
  
  return `${cleanArtist}-${cleanTrack}-${timestamp}-${random}.jpg`;
}

export async function saveCoverImage(
  buffer: Buffer,
  originalFilename: string,
  artistSlug: string,
  trackSlug: string
): Promise<{ coverUrl: string; filename: string; size: number; width: number; height: number }> {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] [SAVE COVER] Starting save process`);
  console.error(`[${timestamp}] [SAVE COVER] Original buffer size: ${buffer.length} bytes`);
  console.error(`[${timestamp}] [SAVE COVER] Artist slug: ${artistSlug}`);
  console.error(`[${timestamp}] [SAVE COVER] Track slug: ${trackSlug}`);

  try {
    // Создаем базовую папку
    await fs.mkdir(FRONTEND_PUBLIC, { recursive: true });
    console.error(`[${timestamp}] [SAVE COVER] Directory verified: ${FRONTEND_PUBLIC}`);

    // Обрабатываем изображение: resize до 1000x1000, конвертируем в JPEG
    console.error(`[${timestamp}] [SAVE COVER] Processing image with sharp...`);
    const processedBuffer = await sharp(buffer)
      .resize(COVER_SIZE, COVER_SIZE, {
        fit: 'cover',
        position: 'center'
      })
      .jpeg({
        quality: 90,
        progressive: true
      })
      .toBuffer();

    console.error(`[${timestamp}] [SAVE COVER] ✅ Image processed, new size: ${processedBuffer.length} bytes`);

    // Генерируем имя файла
    const filename = generateSafeFilename(artistSlug, trackSlug);
    const finalPath = path.join(FRONTEND_PUBLIC, filename);
    console.error(`[${timestamp}] [SAVE COVER] Final path: ${finalPath}`);

    // Записываем файл
    await fs.writeFile(finalPath, processedBuffer);
    console.error(`[${timestamp}] [SAVE COVER] ✅ File written successfully`);

    // Проверяем файл
    const finalStats = await fs.stat(finalPath);
    console.error(`[${timestamp}] [SAVE COVER] ✅ File verified, size: ${finalStats.size} bytes`);

    // Формируем URL
    const coverUrl = `/images/tracks/covers/${filename}`;
    console.error(`[${timestamp}] [SAVE COVER] Cover URL: ${coverUrl}`);

    const result = {
      coverUrl,
      filename,
      size: finalStats.size,
      width: COVER_SIZE,
      height: COVER_SIZE
    };

    console.error(`[${timestamp}] [SAVE COVER] ✅ SUCCESS! Result:`, result);
    return result;

  } catch (error) {
    const ts = new Date().toISOString();
    console.error(`[${ts}] [SAVE COVER] ❌ ERROR:`, error);
    throw error;
  }
}

export async function deleteCoverImage(coverUrl: string): Promise<void> {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] [DELETE COVER] Deleting: ${coverUrl}`);
  
  try {
    const filePath = path.join('/home/sonatum-music/frontend/public', coverUrl);
    await fs.unlink(filePath);
    console.error(`[${timestamp}] [DELETE COVER] ✅ Deleted successfully`);
  } catch (error) {
    console.error(`[${timestamp}] [DELETE COVER] ❌ Error:`, error);
    throw error;
  }
}