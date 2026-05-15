import { authStorage } from './auth';

const API_BASE_URL = '/api';

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export interface UploadResult {
  success: boolean;
  data?: {
    audioUrl?: string;
    coverUrl?: string;
    avatarUrl?: string;
    filename: string;
    size: number;
    width?: number;
    height?: number;
  };
  error?: string;
}

/**
 * Универсальная функция загрузки файлов
 */
async function uploadFile(
  endpoint: string,
  file: File,
  fieldName: string,
  additionalFields: Record<string, string>,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> {
  console.log(`[UPLOAD API] Starting ${fieldName} upload:`, {
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type,
    endpoint,
    fields: additionalFields,
    apiUrl: API_BASE_URL
  });

  try {
    const token = authStorage.getToken();
    
    console.log('[UPLOAD API] Token:', token ? 'present' : 'missing');
    
    if (!token) {
      return {
        success: false,
        error: 'Требуется авторизация'
      };
    }

    const formData = new FormData();
    formData.append(fieldName, file);
    
    Object.entries(additionalFields).forEach(([key, value]) => {
      formData.append(key, value);
    });

    console.log('[UPLOAD API] FormData created');

    const uploadUrl = `${API_BASE_URL}${endpoint}`;
    console.log('[UPLOAD API] Upload URL:', uploadUrl);

    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable && onProgress) {
          const percentage = Math.round((event.loaded / event.total) * 100);
          console.log('[UPLOAD API] Progress:', percentage + '%');
          onProgress({
            loaded: event.loaded,
            total: event.total,
            percentage
          });
        }
      });

      xhr.addEventListener('load', () => {
        console.log('[UPLOAD API] Load event:', {
          status: xhr.status,
          statusText: xhr.statusText,
          responseText: xhr.responseText.substring(0, 500)
        });

        try {
          const response = JSON.parse(xhr.responseText);
          console.log('[UPLOAD API] Response parsed:', response);
          resolve(response);
        } catch (error) {
          console.error('[UPLOAD API] Failed to parse response:', error);
          resolve({
            success: false,
            error: 'Ошибка обработки ответа сервера'
          });
        }
      });

      xhr.addEventListener('error', (event) => {
        console.error('[UPLOAD API] XHR error event:', event);
        resolve({
          success: false,
          error: 'Ошибка сети при загрузке файла'
        });
      });

      xhr.addEventListener('abort', () => {
        console.log('[UPLOAD API] Upload aborted');
        resolve({
          success: false,
          error: 'Загрузка отменена'
        });
      });

      xhr.addEventListener('timeout', () => {
        console.error('[UPLOAD API] Upload timeout');
        resolve({
          success: false,
          error: 'Превышено время ожидания'
        });
      });

      console.log('[UPLOAD API] Opening XHR connection...');
      xhr.open('POST', uploadUrl);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      
      console.log('[UPLOAD API] Sending request...');
      xhr.send(formData);
      console.log('[UPLOAD API] Request sent');
    });
  } catch (error) {
    console.error('[UPLOAD API] Exception:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка'
    };
  }
}

/**
 * Загрузка аудио файла на сервер
 */
export async function uploadAudio(
  file: File,
  artistSlug: string,
  trackSlug: string,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> {
  return uploadFile(
    '/api/upload/audio',
    file,
    'audio',
    { artistSlug, trackSlug },
    onProgress
  );
}

/**
 * Загрузка обложки трека на сервер
 */
export async function uploadCover(
  file: File,
  artistSlug: string,
  trackSlug: string,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> {
  return uploadFile(
    '/api/upload/cover',
    file,
    'cover',
    { artistSlug, trackSlug },
    onProgress
  );
}

/**
 * Загрузка аватара артиста на сервер
 */
export async function uploadAvatar(
  file: File,
  artistSlug: string,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> {
  return uploadFile(
    '/api/upload/avatar',
    file,
    'avatar',
    { artistSlug },
    onProgress
  );
}

/**
 * Валидация аудио файла на клиенте
 */
export function validateAudioFile(file: File): { valid: boolean; error?: string } {
  const allowedTypes = ['audio/mpeg', 'audio/mp3'];
  if (!allowedTypes.includes(file.type) && !file.name.toLowerCase().endsWith('.mp3')) {
    return {
      valid: false,
      error: 'Недопустимый формат файла. Разрешены только MP3 файлы.'
    };
  }

  if (file.size < 1024) {
    return {
      valid: false,
      error: 'Файл слишком маленький. Минимальный размер: 1 КБ'
    };
  }

  const maxSize = 500 * 1024 * 1024; // 500MB
  if (file.size > maxSize) {
    return {
      valid: false,
      error: 'Файл слишком большой (максимум 500MB)'
    };
  }

  return { valid: true };
}

/**
 * Валидация изображения на клиенте
 */
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  
  if (!validTypes.includes(file.type)) {
    return {
      valid: false,
      error: 'Поддерживаются только JPG, PNG, WEBP'
    };
  }

  if (file.size < 100) {
    return {
      valid: false,
      error: 'Файл слишком маленький'
    };
  }

  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    return {
      valid: false,
      error: 'Файл слишком большой (максимум 10MB)'
    };
  }

  return { valid: true };
}

/**
 * Форматирование размера файла
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Получение длительности аудио файла
 */
export function getAudioDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    const objectUrl = URL.createObjectURL(file);
    
    audio.addEventListener('loadedmetadata', () => {
      URL.revokeObjectURL(objectUrl);
      resolve(Math.round(audio.duration));
    });
    
    audio.addEventListener('error', () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Не удалось получить длительность аудио'));
    });
    
    audio.src = objectUrl;
  });
}