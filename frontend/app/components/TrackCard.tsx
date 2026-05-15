'use client';

import { useState } from 'react';

interface Track {
  id: number;
  title: string;
  artist: string;
  duration: string;
  cover?: string;
}

interface TrackCardProps {
  track: Track;
  onPlay: (track: Track) => void;
}

export default function TrackCard({ track, onPlay }: TrackCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="apple-card p-4 cursor-pointer"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onPlay(track)}
    >
      {/* Обложка */}
      <div className="relative mb-4 aspect-square rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200 overflow-hidden">
        <div className="w-full h-full flex items-center justify-center text-6xl">
          {track.cover}
        </div>
        
        {/* Кнопка Play */}
        {isHovered && (
          <div className="absolute inset-0 bg-black/10 backdrop-blur-sm flex items-center justify-center animate-fadeInUp">
            <button className="w-14 h-14 rounded-full bg-white shadow-lg flex items-center justify-center hover:scale-110 transition-transform">
              <svg className="w-6 h-6 text-gray-900 ml-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Информация */}
      <div className="space-y-1">
        <h3 className="font-semibold text-gray-900 truncate">{track.title}</h3>
        <p className="text-sm text-gray-600 truncate">{track.artist}</p>
        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-gray-500">{track.duration}</span>
          <button className="text-gray-400 hover:text-gray-900 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
