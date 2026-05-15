import fs from 'fs/promises';
import path from 'path';
import { NextRequest } from 'next/server';

const FRONTEND_PUBLIC = '/app/public';
const AUDIO_DIR = path.join(FRONTEND_PUBLIC, 'audio/tracks');
const COVERS_DIR = path.join(FRONTEND_PUBLIC, 'images/tracks/covers');
const AVATARS_DIR = path.join(FRONTEND_PUBLIC, 'images/artists/avatars');
const PDF_DIR = path.join(FRONTEND_PUBLIC, 'sheets/pdf');

export async function parseForm(req: NextRequest): Promise<{ 
  fields: Record<string, string>; 
  file: { buffer: Buffer; filename: string; mimetype: string; size: number } | null 
}> {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] [PARSE FORM] Starting...`);

  try {
    const contentType = req.headers.get('content-type') || '';
    console.error(`[${timestamp}] [PARSE FORM] Content-Type: ${contentType}`);

    const formData = await req.formData();
    console.error(`[${timestamp}] [PARSE FORM] FormData received`);

    const fields: Record<string, string> = {};
    let file: { buffer: Buffer; filename: string; mimetype: string; size: number } | null = null;

    for (const [key, value] of formData.entries()) {
      if (value instanceof File) {
        console.error(`[${timestamp}] [PARSE FORM] File found:`, {
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
        console.error(`[${timestamp}] [PARSE FORM] Field: ${key} = ${value}`);
      }
    }

    console.error(`[${timestamp}] [PARSE FORM] ✅ Parsing complete. Fields: ${Object.keys(fields).length}, File: ${file ? 'YES' : 'NO'}`);
    return { fields, file };

  } catch (error) {
    console.error(`[${timestamp}] [PARSE FORM] ❌ Error:`, error);
    throw error;
  }
}

export function validateAudioFile(file: { 
  filename: string; 
  mimetype: string; 
  size: number 
}): { valid: boolean; error?: string } {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] [VALIDATE AUDIO] Starting validation`);
  console.error(`[${timestamp}] [VALIDATE AUDIO] File:`, {
    filename: file.filename,
    mimetype: file.mimetype,
    size: file.size
  });

  if (!file.size || file.size < 1024) {
    console.error(`[${timestamp}] [VALIDATE AUDIO] ❌ File too small: ${file.size} bytes`);
    return { valid: false, error: 'Файл слишком маленький (минимум 1KB)' };
  }

  if (file.size > 500 * 1024 * 1024) {
    console.error(`[${timestamp}] [VALIDATE AUDIO] ❌ File too large: ${file.size} bytes`);
    return { valid: false, error: 'Файл слишком большой (максимум 500MB)' };
  }

  const ext = path.extname(file.filename).toLowerCase();
  console.error(`[${timestamp}] [VALIDATE AUDIO] Extension: ${ext}`);
  
  if (ext !== '.mp3') {
    console.error(`[${timestamp}] [VALIDATE AUDIO] ❌ Invalid extension: ${ext}`);
    return { valid: false, error: 'Поддерживается только формат MP3' };
  }

  console.error(`[${timestamp}] [VALIDATE AUDIO] ✅ Validation passed!`);
  return { valid: true };
}

export function validateImageFile(file: { 
  filename: string; 
  mimetype: string; 
  size: number 
}): { valid: boolean; error?: string } {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] [VALIDATE IMAGE] Starting validation`);
  console.error(`[${timestamp}] [VALIDATE IMAGE] File:`, {
    filename: file.filename,
    mimetype: file.mimetype,
    size: file.size
  });

  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const validExtensions = ['.jpg', '.jpeg', '.png', '.webp'];

  if (!validTypes.includes(file.mimetype) && 
      !validExtensions.some(ext => file.filename.toLowerCase().endsWith(ext))) {
    console.error(`[${timestamp}] [VALIDATE IMAGE] ❌ Invalid type/extension`);
    return { valid: false, error: 'Поддерживаются только JPG, PNG, WEBP' };
  }

  if (file.size < 100) {
    console.error(`[${timestamp}] [VALIDATE IMAGE] ❌ File too small: ${file.size} bytes`);
    return { valid: false, error: 'Файл слишком маленький' };
  }

  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    console.error(`[${timestamp}] [VALIDATE IMAGE] ❌ File too large: ${file.size} bytes`);
    return { valid: false, error: 'Файл слишком большой (максимум 10MB)' };
  }

  console.error(`[${timestamp}] [VALIDATE IMAGE] ✅ Validation passed!`);
  return { valid: true };
}

function generateSafeFilename(artistSlug: string, trackSlug: string, extension: string, kind?: 'full' | 'instrumental'): string {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000000);

  const cleanArtist = artistSlug.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
  const cleanTrack = trackSlug.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
  const suffix = kind === 'instrumental' ? '-instr' : '';

  return `${cleanArtist}-${cleanTrack}${suffix}-${timestamp}-${random}${extension}`;
}

function generateAvatarFilename(artistSlug: string, extension: string): string {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000000);
  
  const cleanArtist = artistSlug.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
  
  return `${cleanArtist}-${timestamp}-${random}${extension}`;
}

export async function saveAudioFile(
  buffer: Buffer,
  originalFilename: string,
  artistSlug: string,
  trackSlug: string,
  kind: 'full' | 'instrumental' = 'full'
): Promise<{ audioUrl: string; filename: string; size: number; mimetype: string; fullPath: string }> {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] [SAVE AUDIO] Starting save process`);
  console.error(`[${timestamp}] [SAVE AUDIO] Buffer size: ${buffer.length} bytes (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);
  console.error(`[${timestamp}] [SAVE AUDIO] Original filename: ${originalFilename}`);
  console.error(`[${timestamp}] [SAVE AUDIO] Artist slug: ${artistSlug}`);
  console.error(`[${timestamp}] [SAVE AUDIO] Track slug: ${trackSlug}`);

  try {
    await fs.mkdir(AUDIO_DIR, { recursive: true });

    const artistDir = path.join(AUDIO_DIR, artistSlug);
    console.error(`[${timestamp}] [SAVE AUDIO] Creating artist dir: ${artistDir}`);
    await fs.mkdir(artistDir, { recursive: true });

    const filename = generateSafeFilename(artistSlug, trackSlug, '.mp3', kind);
    const finalPath = path.join(artistDir, filename);
    console.error(`[${timestamp}] [SAVE AUDIO] Final path: ${finalPath}`);

    await fs.writeFile(finalPath, buffer);
    console.error(`[${timestamp}] [SAVE AUDIO] ✅ File written successfully`);

    const finalStats = await fs.stat(finalPath);
    console.error(`[${timestamp}] [SAVE AUDIO] ✅ File verified, size: ${finalStats.size} bytes`);

    const audioUrl = `/audio/tracks/${artistSlug}/${filename}`;

    const result = {
      audioUrl,
      filename,
      size: finalStats.size,
      mimetype: 'audio/mpeg',
      fullPath: finalPath
    };

    console.error(`[${timestamp}] [SAVE AUDIO] ✅ SUCCESS! Result:`, result);
    return result;

  } catch (error) {
    console.error(`[${timestamp}] [SAVE AUDIO] ❌ ERROR:`, error);
    throw error;
  }
}

export async function saveCoverFile(
  buffer: Buffer,
  originalFilename: string,
  artistSlug: string,
  trackSlug: string
): Promise<{ coverUrl: string; filename: string; size: number; fullPath: string }> {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] [SAVE COVER] Starting save process`);

  try {
    await fs.mkdir(COVERS_DIR, { recursive: true });

    const ext = path.extname(originalFilename).toLowerCase();
    const filename = generateSafeFilename(artistSlug, trackSlug, ext);
    const finalPath = path.join(COVERS_DIR, filename);

    console.error(`[${timestamp}] [SAVE COVER] Final path: ${finalPath}`);

    await fs.writeFile(finalPath, buffer);
    console.error(`[${timestamp}] [SAVE COVER] ✅ File written successfully`);

    const finalStats = await fs.stat(finalPath);
    const coverUrl = `/images/tracks/covers/${filename}`;

    console.error(`[${timestamp}] [SAVE COVER] ✅ SUCCESS! Cover URL: ${coverUrl}`);
    
    return {
      coverUrl,
      filename,
      size: finalStats.size,
      fullPath: finalPath
    };

  } catch (error) {
    console.error(`[${timestamp}] [SAVE COVER] ❌ ERROR:`, error);
    throw error;
  }
}

export async function saveAvatarFile(
  buffer: Buffer,
  originalFilename: string,
  artistSlug: string
): Promise<{ avatarUrl: string; filename: string; size: number; fullPath: string }> {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] [SAVE AVATAR] Starting save process`);

  try {
    await fs.mkdir(AVATARS_DIR, { recursive: true });

    const ext = path.extname(originalFilename).toLowerCase();
    const filename = generateAvatarFilename(artistSlug, ext);
    const finalPath = path.join(AVATARS_DIR, filename);

    console.error(`[${timestamp}] [SAVE AVATAR] Final path: ${finalPath}`);

    await fs.writeFile(finalPath, buffer);
    console.error(`[${timestamp}] [SAVE AVATAR] ✅ File written successfully`);

    const finalStats = await fs.stat(finalPath);
    const avatarUrl = `/images/artists/avatars/${filename}`;

    console.error(`[${timestamp}] [SAVE AVATAR] ✅ SUCCESS! Avatar URL: ${avatarUrl}`);
    
    return {
      avatarUrl,
      filename,
      size: finalStats.size,
      fullPath: finalPath
    };

  } catch (error) {
    console.error(`[${timestamp}] [SAVE AVATAR] ❌ ERROR:`, error);
    throw error;
  }
}

export async function deleteAudioFile(audioUrl: string): Promise<void> {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] [DELETE AUDIO] Deleting: ${audioUrl}`);
  
  try {
    const filePath = path.join(FRONTEND_PUBLIC, audioUrl);
    await fs.unlink(filePath);
    console.error(`[${timestamp}] [DELETE AUDIO] ✅ Deleted successfully`);
  } catch (error) {
    console.error(`[${timestamp}] [DELETE AUDIO] ❌ Error:`, error);
    throw error;
  }
}

export async function deleteCoverFile(coverUrl: string): Promise<void> {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] [DELETE COVER] Deleting: ${coverUrl}`);
  
  try {
    const filePath = path.join(FRONTEND_PUBLIC, coverUrl);
    await fs.unlink(filePath);
    console.error(`[${timestamp}] [DELETE COVER] ✅ Deleted successfully`);
  } catch (error) {
    console.error(`[${timestamp}] [DELETE COVER] ❌ Error:`, error);
  }
}

export async function deleteAvatarFile(avatarUrl: string): Promise<void> {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] [DELETE AVATAR] Deleting: ${avatarUrl}`);
  
  try {
    const filePath = path.join(FRONTEND_PUBLIC, avatarUrl);
    await fs.unlink(filePath);
    console.error(`[${timestamp}] [DELETE AVATAR] ✅ Deleted successfully`);
  } catch (error) {
    console.error(`[${timestamp}] [DELETE AVATAR] ❌ Error:`, error);
  }
}

export async function getAudioFileInfo(audioUrl: string) {
  try {
    const filePath = path.join(FRONTEND_PUBLIC, audioUrl);
    const stats = await fs.stat(filePath);
    return { 
      exists: true, 
      size: stats.size, 
      path: filePath,
      modified: stats.mtime
    };
  } catch {
    return { exists: false };
  }
}

export function validatePdfFile(file: { 
  filename: string; 
  mimetype: string; 
  size: number 
}): { valid: boolean; error?: string } {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] [VALIDATE PDF] File:`, { filename: file.filename, mimetype: file.mimetype });

  if (file.mimetype !== 'application/pdf' && !file.filename.toLowerCase().endsWith('.pdf')) {
    return { valid: false, error: 'Поддерживается только формат PDF' };
  }
  if (file.size > 50 * 1024 * 1024) { // 50MB
    return { valid: false, error: 'Файл слишком большой (максимум 50MB)' };
  }
  return { valid: true };
}

export async function savePdfFile(
  buffer: Buffer,
  originalFilename: string,
  generateName: string
): Promise<{ pdfUrl: string; filename: string; size: number; fullPath: string }> {
  try {
    await fs.mkdir(PDF_DIR, { recursive: true });
    const ext = path.extname(originalFilename).toLowerCase();
    const cleanName = generateName.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
    const filename = `${cleanName}-${Date.now()}${ext}`;
    const finalPath = path.join(PDF_DIR, filename);

    await fs.writeFile(finalPath, buffer);
    const finalStats = await fs.stat(finalPath);
    const pdfUrl = `/sheets/pdf/${filename}`;

    return { pdfUrl, filename, size: finalStats.size, fullPath: finalPath };
  } catch (error) {
    console.error('[SAVE PDF] Error:', error);
    throw error;
  }
}

export async function deletePdfFile(pdfUrl: string): Promise<void> {
  try {
    const filePath = path.join(FRONTEND_PUBLIC, pdfUrl);
    await fs.unlink(filePath);
  } catch (error) {
    console.error('[DELETE PDF] Error:', error);
  }
}