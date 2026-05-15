'use client';

import { useState, useRef } from 'react';
import { Upload, X, FileText, Loader } from 'lucide-react';

interface PdfUploaderProps {
  titleSlug: string;
  onUploadComplete: (pdfUrl: string, filename: string) => void;
  currentPdfUrl?: string;
}

export default function PdfUploader({
  titleSlug,
  onUploadComplete,
  currentPdfUrl
}: PdfUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setError('Пожалуйста, выберите PDF файл');
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      setError('Размер файла не должен превышать 50MB');
      return;
    }

    try {
      setIsUploading(true);
      setError(null);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('titleSlug', titleSlug || 'untitled-sheet');

      const response = await fetch('/api/upload/pdf', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        onUploadComplete(data.data.pdfUrl, data.data.filename);
      } else {
        setError(data.error || 'Ошибка загрузки файла');
      }
    } catch (err) {
      setError('Произошла ошибка при загрузке');
      console.error('Upload error:', err);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="space-y-4">
      {currentPdfUrl ? (
        <div className="relative p-6 border-2 border-gray-200 rounded-xl bg-gray-50 flex items-center gap-4">
          <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <FileText className="w-6 h-6 text-red-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              PDF загружен
            </p>
            <a 
              href={currentPdfUrl.startsWith('http') ? currentPdfUrl : `https://sonatum-music.ru${currentPdfUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              Смотреть файл
            </a>
          </div>
          <button
            onClick={() => onUploadComplete('', '')}
            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Удалить файл"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      ) : (
        <div 
          onClick={() => !isUploading && fileInputRef.current?.click()}
          className={`
            relative p-8 border-2 border-dashed rounded-xl cursor-pointer
            flex flex-col items-center justify-center text-center transition-colors
            ${isUploading ? 'bg-gray-50 border-gray-300' : 'hover:bg-gray-50 border-gray-300 hover:border-gray-400'}
            ${error ? 'border-red-300 bg-red-50' : ''}
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            onChange={handleFileChange}
            className="hidden"
            disabled={isUploading}
          />

          {isUploading ? (
            <div className="space-y-3">
              <Loader className="w-8 h-8 text-gray-400 animate-spin mx-auto" />
              <div className="text-sm text-gray-600">Загрузка PDF файла...</div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
                <Upload className="w-6 h-6 text-gray-500" />
              </div>
              <div>
                <span className="text-sm font-medium text-gray-900">
                  Нажмите для загрузки PDF файла
                </span>
                <p className="text-xs text-gray-500 mt-1">Один файл до 50MB (PDF)</p>
              </div>
            </div>
          )}
        </div>
      )}
      
      {error && (
        <p className="text-sm text-red-600 font-medium">
          {error}
        </p>
      )}
    </div>
  );
}
