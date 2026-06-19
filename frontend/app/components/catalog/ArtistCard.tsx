'use client';

import { Artist } from '@/app/types';
import Link from 'next/link';
import { MapPin, Users, Music } from 'lucide-react';

interface ArtistCardProps {
  artist: Artist;
}

export default function ArtistCard({ artist }: ArtistCardProps) {
  console.log('[ARTIST CARD] Rendering:', artist.name, artist); // Debug log

  return (
    <Link href={`/artist/${artist.slug}`}>
      <div className="apple-card p-6 hover-scale cursor-pointer group">
        {/* Avatar */}
        <div className="relative mb-4">
          <div className="w-full aspect-square rounded-2xl overflow-hidden bg-gradient-to-br from-gray-200 to-gray-300">
            {artist.avatar ? (
              <img 
                src={artist.avatar} 
                alt={artist.name}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400 text-4xl font-semibold">
                {artist.name[0]}
              </div>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="space-y-2">
          <h3 className="font-semibold text-lg text-gray-900 truncate">
            {artist.name}
          </h3>
          
          {artist.region && (
            <div className="flex items-center gap-1 text-sm text-gray-600">
              <MapPin size={14} />
              <span>{artist.region}</span>
            </div>
          )}

          <div className="flex items-center gap-4 text-sm text-gray-500">
            <div className="flex items-center gap-1">
              <Users size={14} />
              <span>{(artist.followers / 1000).toFixed(1)}K</span>
            </div>
            {artist._count && (
              <div className="flex items-center gap-1">
                <Music size={14} />
                <span>{artist._count.tracks} треков</span>
              </div>
            )}
          </div>

          {/* Genres */}
          {artist.genres && artist.genres.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2">
              {artist.genres.slice(0, 2).map((genre) => (
                <span
                  key={genre.id}
                  className="px-2 py-1 text-xs font-medium rounded-full"
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
        </div>
      </div>
    </Link>
  );
}
