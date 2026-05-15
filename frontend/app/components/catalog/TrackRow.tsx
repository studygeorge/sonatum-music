'use client';

import { Track } from '@/app/types';
import { Play, Heart, ShoppingCart, MoreVertical } from 'lucide-react';
import { useState } from 'react';

interface TrackRowProps {
  track: Track;
  index: number;
  onPlay: () => void;
  onLike?: () => void;
  onPurchase?: () => void;
  isLiked?: boolean;
}

export default function TrackRow({ track, index, onPlay, onLike, onPurchase, isLiked = false }: TrackRowProps) {
  const [isHovered, setIsHovered] = useState(false);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div
      className={`
        group relative flex items-center gap-4 p-4 rounded-2xl transition-all duration-300
        ${isHovered ? 'bg-white/90 shadow-md' : 'bg-white/50 hover:bg-white/70'}
      `}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Index / Play Button */}
      <div className="w-8 flex items-center justify-center">
        {isHovered ? (
          <button
            onClick={onPlay}
            className="w-8 h-8 rounded-full bg-gray-900 text-white flex items-center justify-center hover:scale-110 transition-transform"
          >
            <Play size={14} fill="white" />
          </button>
        ) : (
          <span className="text-sm text-gray-400 font-medium">{index + 1}</span>
        )}
      </div>

      {/* Cover */}
      <div className="w-12 h-12 rounded-lg overflow-hidden bg-gradient-to-br from-gray-200 to-gray-300 flex-shrink-0">
        {track.cover ? (
          <img src={track.cover} alt={track.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs font-medium">
            ?
          </div>
        )}
      </div>

      {/* Track Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-semibold text-gray-900 truncate">{track.title}</h3>
          {track.isExplicit && (
            <span className="px-2 py-0.5 text-xs bg-gray-200 text-gray-700 rounded font-medium">E</span>
          )}
        </div>
        <p className="text-sm text-gray-600 truncate">{track.artist.name}</p>
      </div>

      {/* Genre Tags */}
      {track.genres && track.genres.length > 0 && (
        <div className="hidden md:flex items-center gap-2">
          {track.genres.slice(0, 2).map((genre) => (
            <span
              key={genre.id}
              className="px-3 py-1 text-xs font-medium rounded-full"
              style={{
                backgroundColor: genre.color ? `${genre.color}20` : '#e5e7eb',
                color: genre.color || '#6b7280',
              }}
            >
              {genre.name}
            </span>
          ))}
        </div>
      )}

      {/* Stats */}
      <div className="hidden lg:flex items-center gap-4 text-sm text-gray-500">
        <span>{track.playCount.toLocaleString()} прослушиваний</span>
      </div>

      {/* Duration */}
      <div className="text-sm text-gray-500 font-medium w-12 text-right">
        {formatDuration(track.duration)}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {onLike && (
          <button
            onClick={onLike}
            className={`p-2 rounded-full transition-all ${
              isLiked 
                ? 'text-red-500 bg-red-50' 
                : 'text-gray-400 hover:text-red-500 hover:bg-red-50'
            }`}
          >
            <Heart size={18} fill={isLiked ? 'currentColor' : 'none'} />
          </button>
        )}

        {track.isForSale && track.price && onPurchase && (
          <button
            onClick={onPurchase}
            className="px-4 py-2 rounded-full bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors"
          >
            {track.price} ₽
          </button>
        )}

        <button className="p-2 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
          <MoreVertical size={18} />
        </button>
      </div>
    </div>
  );
}
