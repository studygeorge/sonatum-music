'use client';

import { Music2, Edit2, Trash2 } from 'lucide-react';

interface Genre {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  _count: {
    tracks: number;
  };
}

interface GenreCardProps {
  genre: Genre;
  onEdit: (genre: Genre) => void;
  onDelete: (genre: Genre) => void;
}

export default function GenreCard({ genre, onEdit, onDelete }: GenreCardProps) {
  return (
    <div
      className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-200 border-l-4"
      style={{ borderLeftColor: genre.color || '#3B82F6' }}
    >
      {/* Header with Actions */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="text-2xl flex-shrink-0">{genre.icon || '🎵'}</div>
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-gray-900 truncate">
              {genre.name}
            </h3>
            <p className="text-sm text-gray-500">/{genre.slug}</p>
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={() => onEdit(genre)}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            title="Редактировать"
          >
            <Edit2 className="w-5 h-5" />
          </button>
          <button
            onClick={() => onDelete(genre)}
            className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
            title="Удалить"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Description */}
      {genre.description && (
        <p className="text-sm text-gray-600 mb-4 line-clamp-2">
          {genre.description}
        </p>
      )}

      {/* Stats */}
      <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl">
        <Music2 className="w-4 h-4 text-gray-500" />
        <span className="text-sm font-medium text-gray-700">
          {genre._count.tracks} {genre._count.tracks === 1 ? 'трек' : 'треков'}
        </span>
      </div>
    </div>
  );
}
