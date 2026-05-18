'use client';

import { useState, useRef } from 'react';
import { Upload, X, Image as ImageIcon, CheckCircle, AlertCircle } from 'lucide-react';
import { uploadCover, validateImageFile, formatFileSize } from '@/app/lib/uploadApi';

interface CoverUploaderProps {
  artistSlug: string;
  trackSlug: string;
  onUploadComplete: (coverUrl: string) => void;
  currentCoverUrl?: string;
}

export default function CoverUploader({
  artistSlug,
  trackSlug,
  onUploadComplete,
  currentCoverUrl
}: CoverUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (selectedFile: File) => {
    console.log('[COVER UPLOADER] File selected:', {
      name: selectedFile.name,
      size: selectedFile.size,
      type: selectedFile.type
    });

    setError(null);
    setSuccess(false);

    const validation = validateImageFile(selectedFile);
    if (!validation.valid) {
      console.error('[COVER UPLOADER] Validation failed:', validation.error);
      setError(validation.error || 'Недопустимый файл');
      return;
    }

    setFile(selectedFile);

    // Создаем превью
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(selectedFile);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.type.startsWith('image/')) {
      handleFileSelect(droppedFile);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFileSelect(selectedFile);
    }
  };

  const handleUpload = async () => {
    console.log('[COVER UPLOADER] Upload button clicked');

    if (!file) {
      setError('Файл не выбран');
      return;
    }

    if (!artistSlug || artistSlug === 'unknown') {
      setError('Сначала выберите артиста');
      return;
    }

    if (!trackSlug || trackSlug === 'untitled') {
      setError('Сначала введите название трека');
      return;
    }

    setUploading(true);
    setError(null);
    setProgress(0);

    try {
      const result = await uploadCover(file, artistSlug, trackSlug, (progressData) => {
        setProgress(progressData.percentage);
      });

      if (result.success && result.data) {
        setSuccess(true);
        setProgress(100);
        onUploadComplete(result.data.coverUrl!);
      } else {
        setError(result.error || 'Ошибка загрузки');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    setFile(null);
    setPreview(null);
    setError(null);
    setSuccess(false);
    setProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const canUpload = file && artistSlug && artistSlug !== 'unknown' && trackSlug && trackSlug !== 'untitled';

  return (
    <div className="space-y-4">
      {!file && !currentCoverUrl && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-gray-400 hover:bg-gray-50 transition-colors"
        >
          <ImageIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 mb-2">
            Перетащите изображение сюда или нажмите для выбора
          </p>
          <p className="text-sm text-gray-500">
            JPG, PNG, WEBP • Максимум 10MB • Будет обрезано до 1000x1000px
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            onChange={handleFileInputChange}
            className="hidden"
          />
        </div>
      )}

      {(preview || currentCoverUrl) && (
        <div className="bg-white rounded-xl border border-gray-300 p-4">
          <div className="flex items-start gap-4">
            <div className="w-32 h-32 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100">
              <img
                src={preview || `https://sonatum-music.ru${currentCoverUrl}`}
                alt="Cover preview"
                className="w-full h-full object-cover"
              />
            </div>
            
            <div className="flex-1 min-w-0">
              {file && (
                <>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{file.name}</p>
                      <p className="text-sm text-gray-500">{formatFileSize(file.size)}</p>
                    </div>
                    
                    {!uploading && !success && (
                      <button
                        onClick={handleRemove}
                        className="p-1 text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    )}
                  </div>

                  {uploading && (
                    <div className="space-y-2">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-black h-2 rounded-full transition-all duration-300"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <p className="text-sm text-gray-600">Загрузка: {progress}%</p>
                    </div>
                  )}

                  {success && (
                    <div className="flex items-center gap-2 text-black">
                      <CheckCircle className="w-5 h-5" />
                      <span className="text-sm font-medium">Обложка успешно загружена</span>
                    </div>
                  )}

                  {error && (
                    <div className="flex items-center gap-2 text-black">
                      <AlertCircle className="w-5 h-5" />
                      <span className="text-sm">{error}</span>
                    </div>
                  )}

                  {!uploading && !success && (
                    <div className="mt-3 space-y-2">
                      {!canUpload && (
                        <p className="text-sm text-gray-600">
                          {!artistSlug || artistSlug === 'unknown' ? 'Выберите артиста' : 
                           !trackSlug || trackSlug === 'untitled' ? 'Введите название трека' : 
                           'Заполните все обязательные поля'}
                        </p>
                      )}
                      <button
                        onClick={handleUpload}
                        disabled={!canUpload}
                        className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Загрузить обложку
                      </button>
                    </div>
                  )}
                </>
              )}

              {!file && currentCoverUrl && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-900">Обложка загружена</p>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1 text-sm bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
                  >
                    Заменить
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                    onChange={handleFileInputChange}
                    className="hidden"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}