'use client';

import { Track } from '@/app/types';
import { Play, Heart, ShoppingCart, Clock, Music } from 'lucide-react';

interface AuthorTracksProps {
  tracks: Track[];
  onPlay: (track: Track) => void;
  onLike: (track: Track) => void;
}

export default function AuthorTracks({ tracks, onPlay, onLike }: AuthorTracksProps) {
  console.log('[AUTHOR TRACKS] Rendering with tracks:', tracks.length);

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div>
      <h2 className="text-3xl font-semibold text-gray-900 mb-6">
        Треки ({tracks.length})
      </h2>

      {tracks.length > 0 ? (
        <div className="space-y-2">
          {tracks.map((track, index) => (
            <div
              key={track.id}
              className="track-row apple-card p-4 flex items-center gap-4 rounded-2xl group cursor-pointer hover:bg-gray-50 transition-all"
              onClick={() => onPlay(track)}
            >
              {/* Index / Play Button */}
              <div className="w-8 text-center flex-shrink-0 relative">
                <span className="text-gray-500 group-hover:opacity-0 transition-opacity">
                  {index + 1}
                </span>
                <button
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity w-8 h-8 bg-gray-900 text-white rounded-full flex items-center justify-center mx-auto hover:scale-110 transition-transform"
                  onClick={(e) => {
                    e.stopPropagation();
                    onPlay(track);
                  }}
                >
                  <Play className="w-4 h-4 ml-0.5" fill="currentColor" />
                </button>
              </div>

              {/* Cover */}
              <div className="w-14 h-14 rounded-lg overflow-hidden bg-gradient-to-br from-purple-100 to-pink-100 flex-shrink-0">
                {track.cover ? (
                  <img
                    src={track.cover}
                    alt={track.title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      console.error('[AUTHOR TRACKS] Cover failed to load:', track.cover);
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Music className="w-6 h-6 text-gray-300" />
                  </div>
                )}
              </div>

              {/* Track Info */}
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-gray-900 truncate group-hover:text-purple-600 transition-colors">
                  {track.title}
                </h3>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  {track.isExplicit && (
                    <span className="px-1.5 py-0.5 bg-gray-200 rounded text-xs font-medium">
                      E
                    </span>
                  )}
                  {track.genres && track.genres.length > 0 && (
                    <span className="truncate">
                      {track.genres.slice(0, 2).map(g => g.name).join(' · ')}
                    </span>
                  )}
                </div>
              </div>

              {/* Duration */}
              <div className="flex items-center gap-2 text-sm text-gray-500 flex-shrink-0">
                <Clock className="w-4 h-4" />
                {formatDuration(track.duration)}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onLike(track);
                  }}
                  className="w-8 h-8 flex items-center justify-center hover:bg-gray-200 rounded-full transition-colors"
                >
                  <Heart className="w-5 h-5 text-gray-600 hover:text-red-500 transition-colors" />
                </button>
                {track.isForSale && (
                  <button 
                    onClick={(e) => e.stopPropagation()}
                    className="w-8 h-8 flex items-center justify-center hover:bg-gray-200 rounded-full transition-colors"
                  >
                    <ShoppingCart className="w-5 h-5 text-gray-600 hover:text-green-500 transition-colors" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="liquid-glass rounded-3xl p-12 text-center">
          <Music className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600 text-lg">
            У этого автора пока нет опубликованных треков
          </p>
        </div>
      )}

      <style jsx>{`
        .track-row {
          transition: all 0.2s ease;
        }
      `}</style>
    </div>
  );
}
