'use client';

import { useState } from 'react';

interface Playlist {
  id: number;
  name: string;
  trackCount: number;
  cover: string;
}

interface PlaylistCardProps {
  playlist: Playlist;
}

export default function PlaylistCard({ playlist }: PlaylistCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="apple-card p-4 cursor-pointer"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Обложка */}
      <div className="relative mb-3 aspect-square rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200 overflow-hidden">
        <div className="w-full h-full flex items-center justify-center text-6xl">
          {playlist.cover}
        </div>

        {/* Кнопка Play при hover */}
        {isHovered && (
          <div className="absolute inset-0 bg-black/10 backdrop-blur-sm flex items-center justify-center animate-fadeInUp">
            <button className="w-12 h-12 rounded-full bg-white shadow-lg flex items-center justify-center hover:scale-110 transition-transform">
              <svg className="w-5 h-5 text-gray-900 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Информация */}
      <div>
        <h3 className="font-semibold text-gray-900 truncate mb-0.5">
          {playlist.name}
        </h3>
        <p className="text-sm text-gray-600">
          {playlist.trackCount} треков
        </p>
      </div>
    </div>
  );
}
