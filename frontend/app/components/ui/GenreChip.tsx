'use client';

import { Genre } from '@/app/types';

interface GenreChipProps {
  genre: Genre;
  selected?: boolean;
  onClick?: () => void;
}

export default function GenreChip({ genre, selected = false, onClick }: GenreChipProps) {
  const genreColor = genre.color || '#6b7280';
  
  return (
    <button
      onClick={onClick}
      className={`
        relative overflow-hidden rounded-2xl px-5 py-3 transition-all duration-300
        ${selected 
          ? 'shadow-lg scale-105' 
          : 'shadow-sm hover:shadow-md hover:scale-102'}
      `}
      style={{
        background: selected
          ? `linear-gradient(135deg, ${genreColor}20, ${genreColor}10)`
          : 'linear-gradient(135deg, rgba(255,255,255,0.9), rgba(255,255,255,0.95))',
      }}
    >
      {selected && (
        <div 
          className="absolute inset-0 opacity-20"
          style={{
            background: `radial-gradient(circle at 30% 50%, ${genreColor}, transparent 70%)`
          }}
        />
      )}
      
      <div className="relative flex items-center gap-3">
        <span className="text-2xl">{genre.icon}</span>
        <div className="text-left">
          <p className={`font-semibold text-sm ${selected ? 'text-gray-900' : 'text-gray-700'}`}>
            {genre.name}
          </p>
          {genre._count && (
            <p className="text-xs text-gray-500">
              {genre._count.tracks} треков
            </p>
          )}
        </div>
      </div>
      
      {selected && (
        <div 
          className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center"
          style={{ backgroundColor: genreColor }}
        >
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}
    </button>
  );
}
