'use client';

import { useState, useRef, useEffect } from 'react';
import { Upload, X, Loader, User } from 'lucide-react';
import { uploadAvatar, validateImageFile, UploadProgress } from '@/app/lib/uploadApi';

interface AvatarUploaderProps {
  artistSlug: string;
  onUploadComplete: (avatarUrl: string) => void;
  currentAvatarUrl?: string;
}

export default function AvatarUploader({
  artistSlug,
  onUploadComplete,
  currentAvatarUrl
}: AvatarUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (currentAvatarUrl) {
      const fullUrl = currentAvatarUrl.startsWith('http') 
        ? currentAvatarUrl 
        : `https://sonatum-music.ru${currentAvatarUrl}`;
      setPreviewUrl(fullUrl);
    }
  }, [currentAvatarUrl]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleFile = async (file: File) => {
    console.log('[AVATAR UPLOADER] Received file:', file.name, file.type, file.size);

    const validation = validateImageFile(file);
    if (!validation.valid) {
      setError(validation.error || 'Недопустимый файл');
      return;
    }

    setError(null);
    setUploading(true);
    setUploadProgress(0);

    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    try {
      console.log('[AVATAR UPLOADER] Starting upload for artist:', artistSlug);

      const result = await uploadAvatar(
        file,
        artistSlug,
        (progress: UploadProgress) => {
          console.log('[AVATAR UPLOADER] Upload progress:', progress.percentage);
          setUploadProgress(progress.percentage);
        }
      );

      console.log('[AVATAR UPLOADER] Upload complete:', result);

      if (result.success && result.data?.avatarUrl) {
        onUploadComplete(result.data.avatarUrl);
        setError(null);
      } else {
        setError(result.error || 'Ошибка загрузки аватара');
        setPreviewUrl(currentAvatarUrl ? `https://sonatum-music.ru${currentAvatarUrl}` : null);
      }
    } catch (err) {
      console.error('[AVATAR UPLOADER] Upload failed:', err);
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
      setPreviewUrl(currentAvatarUrl ? `https://sonatum-music.ru${currentAvatarUrl}` : null);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const clearAvatar = () => {
    setPreviewUrl(null);
    onUploadComplete('');
    setError(null);
  };

  return (
    <div className="w-full">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        onChange={handleChange}
        className="hidden"
      />

      <div
        className={`relative border-2 border-dashed rounded-2xl p-6 transition-colors ${
          dragActive
            ? 'border-gray-900 bg-gray-50'
            : 'border-gray-300 hover:border-gray-400'
        } ${uploading ? 'pointer-events-none opacity-60' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        {previewUrl ? (
          <div className="flex flex-col items-center gap-4">
            <div className="relative w-32 h-32 rounded-full overflow-hidden bg-gray-100 border-4 border-gray-200">
              <img
                src={previewUrl}
                alt="Avatar preview"
                className="w-full h-full object-cover"
                onError={(e) => {
                  console.error('[AVATAR UPLOADER] Image load error');
                  e.currentTarget.src = '';
                }}
              />
            </div>

            {!uploading && (
              <div className="flex gap-2">
                <button
                  onClick={handleButtonClick}
                  className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 transition-colors"
                >
                  Изменить
                </button>
                <button
                  onClick={clearAvatar}
                  className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Удалить
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center">
              <User className="w-12 h-12 text-gray-400" />
            </div>

            <div className="text-center">
              <p className="text-sm font-medium text-gray-700 mb-1">
                Загрузите аватар артиста
              </p>
              <p className="text-xs text-gray-500">
                Перетащите изображение или нажмите кнопку
              </p>
            </div>

            <button
              onClick={handleButtonClick}
              disabled={uploading}
              className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Upload className="w-4 h-4" />
              Выбрать файл
            </button>

            <p className="text-xs text-gray-500">
              JPG, PNG, WEBP (макс. 10MB)
            </p>
          </div>
        )}

        {uploading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 rounded-2xl">
            <Loader className="w-8 h-8 text-gray-900 animate-spin mb-3" />
            <p className="text-sm font-medium text-gray-700">
              Загрузка... {uploadProgress}%
            </p>
            <div className="w-48 h-2 bg-gray-200 rounded-full mt-2 overflow-hidden">
              <div
                className="h-full bg-gray-900 transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-3 p-3 bg-gray-50 border border-gray-300 rounded-lg">
          <p className="text-sm text-black">{error}</p>
        </div>
      )}
    </div>
  );
}