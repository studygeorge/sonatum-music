'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import AudioUploader from '@/app/admin/components/AudioUploader';
import CoverUploader from '@/app/admin/components/CoverUploader';
import PdfUploader from '@/app/admin/components/PdfUploader';

interface Artist {
  id: string;
  name: string;
  slug: string;
}

interface Genre {
  id: string;
  name: string;
  slug: string;
}

interface Track {
  id: string;
  title: string;
  slug: string;
  duration: number;
  audioUrl: string;
  cover: string | null;
  status: string;
  artistId: string;
  genres: Array<{ genre: { id: string } }>;
  sheetMusic?: {
    pdfUrl: string;
    instrument: string;
    difficulty: string;
    price: number | null;
    isPublicDomain: boolean;
  } | null;
}

interface EditTrackModalProps {
  isOpen: boolean;
  track: Track | null;
  onClose: () => void;
  onSubmit: (trackId: string, formData: any) => Promise<void>;
  artists: Artist[];
  genres: Genre[];
}

export default function EditTrackModal({
  isOpen,
  track,
  onClose,
  onSubmit,
  artists,
  genres
}: EditTrackModalProps) {
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    duration: 180,
    audioUrl: '',
    cover: '',
    artistId: '',
    genreIds: [] as string[],
    status: 'PUBLISHED',
    hasSheetMusic: false,
    sheetPdfUrl: '',
    sheetInstrument: 'Фортепиано',
    sheetDifficulty: 'BEGINNER',
    sheetPrice: '',
    isPublicDomain: false
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (track && isOpen) {
      setFormData({
        title: track.title,
        slug: track.slug,
        duration: track.duration,
        audioUrl: track.audioUrl,
        cover: track.cover || '',
        artistId: track.artistId,
        genreIds: track.genres.map(g => g.genre.id),
        status: track.status,
        hasSheetMusic: !!track.sheetMusic,
        sheetPdfUrl: track.sheetMusic?.pdfUrl || '',
        sheetInstrument: track.sheetMusic?.instrument || 'Фортепиано',
        sheetDifficulty: track.sheetMusic?.difficulty || 'BEGINNER',
        sheetPrice: track.sheetMusic?.price ? String(track.sheetMusic.price) : '',
        isPublicDomain: track.sheetMusic?.isPublicDomain || false
      });
    }
  }, [track, isOpen]);

  const generateSlug = (title: string) => {
    const translitMap: { [key: string]: string } = {
      'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
      'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
      'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
      'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch',
      'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
      'і': 'i', 'ї': 'yi', 'є': 'ye', 'ґ': 'g'
    };

    return title
      .toLowerCase()
      .split('')
      .map(char => translitMap[char] || char)
      .join('')
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .trim();
  };

  const handleSubmit = async () => {
    if (!track || !formData.title || !formData.audioUrl || !formData.artistId) {
      alert('Заполните обязательные поля');
      return;
    }

    setIsSubmitting(true);
    try {
      const submitData = {
        ...formData,
        sheetPdfUrl: formData.hasSheetMusic ? (formData.sheetPdfUrl || '') : ''
      };
      await onSubmit(track.id, submitData);
      onClose();
    } catch (error) {
      console.error('Error updating track:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedArtist = artists.find(a => a.id === formData.artistId);

  if (!isOpen || !track) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-7xl max-h-[95vh] flex flex-col my-8">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-semibold text-gray-900">
            Редактировать трек
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="grid grid-cols-3 gap-6 p-6 overflow-y-auto">
          {/* Колонка 1 */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Название трека *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => {
                  const title = e.target.value;
                  setFormData(prev => ({
                    ...prev,
                    title,
                    slug: generateSlug(title)
                  }));
                }}
                placeholder="Название трека"
                className="w-full px-4 py-2 rounded-xl border border-gray-300 focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Slug (URL) *
              </label>
              <input
                type="text"
                value={formData.slug}
                onChange={(e) => setFormData(prev => ({...prev, slug: e.target.value}))}
                placeholder="track-slug"
                className="w-full px-4 py-2 rounded-xl border border-gray-300 focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Артист *
              </label>
              <select
                value={formData.artistId}
                onChange={(e) => setFormData(prev => ({...prev, artistId: e.target.value}))}
                className="w-full px-4 py-2 rounded-xl border border-gray-300 focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 outline-none"
              >
                <option value="">Выберите артиста</option>
                {artists.map(artist => (
                  <option key={artist.id} value={artist.id}>{artist.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Жанры
              </label>
              <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto p-2 border border-gray-300 rounded-xl">
                {genres.map(genre => (
                  <label key={genre.id} className="flex items-center gap-2 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={formData.genreIds.includes(genre.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData(prev => ({...prev, genreIds: [...prev.genreIds, genre.id]}));
                        } else {
                          setFormData(prev => ({...prev, genreIds: prev.genreIds.filter(id => id !== genre.id)}));
                        }
                      }}
                      className="rounded"
                    />
                    <span>{genre.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Статус
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData(prev => ({...prev, status: e.target.value}))}
                className="w-full px-4 py-2 rounded-xl border border-gray-300 focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 outline-none"
              >
                <option value="PUBLISHED">Опубликован</option>
                <option value="PENDING">На модерации</option>
                <option value="DRAFT">Черновик</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Длительность (секунды)
              </label>
              <input
                type="number"
                value={formData.duration}
                readOnly
                className="w-full px-4 py-2 rounded-xl border border-gray-300 bg-gray-50 outline-none"
              />
            </div>
          </div>

          {/* Колонка 2 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Аудио файл *
            </label>
            <AudioUploader
              artistSlug={selectedArtist?.slug || 'unknown'}
              trackSlug={formData.slug || 'untitled'}
              onUploadComplete={(audioUrl, duration) => {
                setFormData(prev => ({
                  ...prev,
                  audioUrl,
                  duration: Math.round(duration)
                }));
              }}
              currentAudioUrl={formData.audioUrl}
            />
          </div>

          {/* Колонка 3 */}
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Обложка трека
              </label>
              <CoverUploader
                artistSlug={selectedArtist?.slug || 'unknown'}
                trackSlug={formData.slug || 'untitled'}
                onUploadComplete={(coverUrl) => {
                  setFormData(prev => ({...prev, cover: coverUrl}));
                }}
                currentCoverUrl={formData.cover}
              />
            </div>

            <div className="pt-6 border-t border-gray-200">
              <label className="flex items-center gap-2 cursor-pointer font-medium text-gray-900 mb-4">
                <input 
                  type="checkbox" 
                  checked={formData.hasSheetMusic}
                  onChange={e => setFormData(prev => ({...prev, hasSheetMusic: e.target.checked}))}
                  className="rounded border-gray-300 w-4 h-4"
                />
                Прикрепить ноты (PDF)
              </label>

              {formData.hasSheetMusic && (
                <div className="space-y-4">
                  <PdfUploader
                    titleSlug={formData.slug || 'untitled'}
                    onUploadComplete={(pdfUrl) => setFormData(prev => ({...prev, sheetPdfUrl: pdfUrl}))}
                    currentPdfUrl={formData.sheetPdfUrl}
                  />
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Инструмент</label>
                    <input 
                      type="text" 
                      value={formData.sheetInstrument} 
                      onChange={e => setFormData(prev => ({...prev, sheetInstrument: e.target.value}))} 
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none" 
                      placeholder="Фортепиано" 
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-3 p-6 border-t">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={handleSubmit}
            disabled={!formData.title || !formData.audioUrl || !formData.artistId || isSubmitting}
            className="flex-1 px-4 py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Сохранение...' : 'Сохранить изменения'}
          </button>
        </div>
      </div>
    </div>
  );
}