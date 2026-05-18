'use client';

import { useState, useRef, useEffect } from 'react';
import { Upload, X, Music, CheckCircle, AlertCircle } from 'lucide-react';
import { uploadAudio, validateAudioFile, formatFileSize, getAudioDuration } from '@/app/lib/uploadApi';

interface AudioUploaderProps {
  artistSlug: string;
  trackSlug: string;
  onUploadComplete: (audioUrl: string, duration: number) => void;
  currentAudioUrl?: string;
}

export default function AudioUploader({
  artistSlug,
  trackSlug,
  onUploadComplete,
  currentAudioUrl
}: AudioUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [duration, setDuration] = useState<number | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    console.log('[UPLOADER] Props updated:', {
      artistSlug,
      trackSlug,
      hasFile: !!file,
      currentAudioUrl
    });
  }, [artistSlug, trackSlug, file, currentAudioUrl]);

  const handleFileSelect = async (selectedFile: File) => {
    console.log('[UPLOADER] File selected:', {
      name: selectedFile.name,
      size: selectedFile.size,
      type: selectedFile.type
    });

    setError(null);
    setSuccess(false);

    // Валидация файла
    const validation = validateAudioFile(selectedFile);
    if (!validation.valid) {
      console.error('[UPLOADER] Validation failed:', validation.error);
      setError(validation.error || 'Недопустимый файл');
      return;
    }

    console.log('[UPLOADER] Validation passed');
    setFile(selectedFile);

    // Получаем длительность аудио
    try {
      console.log('[UPLOADER] Getting audio duration...');
      const audioDuration = await getAudioDuration(selectedFile);
      setDuration(audioDuration);
      console.log('[UPLOADER] Audio duration:', audioDuration);
    } catch (err) {
      console.warn('[UPLOADER] Could not get audio duration:', err);
      setDuration(180); // Дефолтная длительность
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
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
    console.log('[UPLOADER] Upload button clicked');
    console.log('[UPLOADER] State:', {
      hasFile: !!file,
      artistSlug,
      trackSlug,
      duration,
      uploading
    });

    if (!file) {
      console.error('[UPLOADER] No file selected');
      setError('Файл не выбран');
      return;
    }

    if (!artistSlug || artistSlug === 'unknown') {
      console.error('[UPLOADER] Invalid artistSlug:', artistSlug);
      setError('Сначала выберите артиста');
      return;
    }

    if (!trackSlug || trackSlug === 'untitled') {
      console.error('[UPLOADER] Invalid trackSlug:', trackSlug);
      setError('Сначала введите название трека');
      return;
    }

    setUploading(true);
    setError(null);
    setProgress(0);

    console.log('[UPLOADER] Starting upload with params:', {
      fileName: file.name,
      artistSlug,
      trackSlug
    });

    try {
      const result = await uploadAudio(file, artistSlug, trackSlug, (progressData) => {
        setProgress(progressData.percentage);
      });

      console.log('[UPLOADER] Upload result:', result);

      if (result.success && result.data && result.data.audioUrl) {
        setSuccess(true);
        setProgress(100);
        
        // Вызываем callback с URL и длительностью
        const finalDuration = duration || 180;
        console.log('[UPLOADER] Calling onUploadComplete with:', {
          audioUrl: result.data.audioUrl,
          duration: finalDuration
        });
        
        onUploadComplete(result.data.audioUrl, finalDuration);
      } else {
        console.error('[UPLOADER] Upload failed:', result.error || 'No audioUrl in response');
        setError(result.error || 'Ошибка загрузки: не получен URL файла');
      }
    } catch (err) {
      console.error('[UPLOADER] Upload exception:', err);
      setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    console.log('[UPLOADER] Removing file');
    setFile(null);
    setError(null);
    setSuccess(false);
    setProgress(0);
    setDuration(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const canUpload = file && artistSlug && artistSlug !== 'unknown' && trackSlug && trackSlug !== 'untitled';

  return (
    <div className="space-y-4">
      {!file && !currentAudioUrl && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-gray-400 hover:bg-gray-50 transition-colors"
        >
          <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 mb-2">
            Перетащите MP3 файл сюда или нажмите для выбора
          </p>
          <p className="text-sm text-gray-500">
            Поддерживается только формат MP3, без ограничения размера
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/mpeg,audio/mp3,.mp3"
            onChange={handleFileInputChange}
            className="hidden"
          />
        </div>
      )}

      {file && (
        <div className="bg-white rounded-xl border border-gray-300 p-4">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-gray-100 rounded-lg">
              <Music className="w-6 h-6 text-gray-700" />
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{file.name}</p>
                  <p className="text-sm text-gray-500">
                    {formatFileSize(file.size)}
                    {duration && ` • ${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')}`}
                  </p>
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
                <div className="flex items-center gap-2 text-gray-900">
                  <CheckCircle className="w-5 h-5" />
                  <span className="text-sm font-medium">Файл успешно загружен</span>
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
                    Загрузить файл
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {currentAudioUrl && !file && (
        <div className="bg-gray-50 border border-gray-300 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-black shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900">Аудио файл загружен</p>
              <p className="text-xs text-gray-500 truncate" title={currentAudioUrl}>{currentAudioUrl}</p>
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="shrink-0 px-3 py-1.5 text-sm bg-white border border-gray-300 text-gray-900 rounded hover:bg-gray-100"
            >
              Заменить
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/mpeg,audio/mp3,.mp3"
            onChange={handleFileInputChange}
            className="hidden"
          />
        </div>
      )}
    </div>
  );
}
