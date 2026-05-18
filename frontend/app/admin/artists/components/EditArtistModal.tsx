'use client';

import { useState, useEffect } from 'react';
import { toast } from '@/app/admin/lib/toast';
import { X } from 'lucide-react';
import AvatarUploader from '@/app/admin/components/AvatarUploader';

interface Artist {
  id: string;
  name: string;
  slug: string;
  bio: string | null;
  avatar: string | null;
  verified: boolean;
}

interface EditArtistModalProps {
  isOpen: boolean;
  artist: Artist | null;
  onClose: () => void;
  onSubmit: (artistId: string, formData: any) => Promise<void>;
}

export default function EditArtistModal({
  isOpen,
  artist,
  onClose,
  onSubmit
}: EditArtistModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    bio: '',
    avatar: '',
    verified: false
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (artist && isOpen) {
      setFormData({
        name: artist.name,
        slug: artist.slug,
        bio: artist.bio || '',
        avatar: artist.avatar || '',
        verified: artist.verified
      });
    }
  }, [artist, isOpen]);

  const generateSlug = (name: string) => {
    const translitMap: { [key: string]: string } = {
      'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
      'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
      'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
      'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch',
      'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
      'і': 'i', 'ї': 'yi', 'є': 'ye', 'ґ': 'g'
    };

    return name
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
    if (!artist || !formData.name || !formData.slug) {
      toast('Заполните обязательные поля', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(artist.id, formData);
      onClose();
    } catch (error) {
      console.error('Error updating artist:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !artist) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white">
          <h2 className="text-2xl font-semibold text-gray-900">
            Редактировать артиста
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Имя артиста *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => {
                const name = e.target.value;
                setFormData(prev => ({
                  ...prev,
                  name,
                  slug: generateSlug(name)
                }));
              }}
              placeholder="Имя артиста"
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
              placeholder="artist-slug"
              className="w-full px-4 py-2 rounded-xl border border-gray-300 focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Биография
            </label>
            <textarea
              value={formData.bio}
              onChange={(e) => setFormData(prev => ({...prev, bio: e.target.value}))}
              placeholder="Биография артиста..."
              rows={4}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 outline-none resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Аватар артиста
            </label>
            <AvatarUploader
              artistSlug={formData.slug || 'unknown'}
              onUploadComplete={(avatarUrl) => {
                console.log('[EDIT MODAL] Avatar uploaded:', avatarUrl);
                setFormData(prev => ({ ...prev, avatar: avatarUrl }));
              }}
              currentAvatarUrl={formData.avatar}
            />
          </div>

          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.verified}
                onChange={(e) => setFormData(prev => ({...prev, verified: e.target.checked}))}
                className="w-5 h-5 rounded border-gray-300"
              />
              <span className="text-sm font-medium text-gray-700">
                Верифицированный артист
              </span>
            </label>
          </div>
        </div>

        <div className="flex gap-3 p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-xl hover:bg-white transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={handleSubmit}
            disabled={!formData.name || !formData.slug || isSubmitting}
            className="flex-1 px-4 py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Сохранение...' : 'Сохранить изменения'}
          </button>
        </div>
      </div>
    </div>
  );
}
