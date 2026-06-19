'use client';

import Link from 'next/link';
import { Artist } from '@/app/types';
import { Users, Music } from 'lucide-react';

interface TopArtistsSectionProps {
  artists: Artist[];
  loading: boolean;
}

export default function TopArtistsSection({ artists, loading }: TopArtistsSectionProps) {
  const formatFollowers = (count: number): string => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    }
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  return (
    <section className="mb-16">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-3xl font-semibold text-gray-900">
          Популярные артисты
        </h2>
        <Link href="/catalog">
          <button className="text-gray-600 hover:text-gray-900 font-medium transition-colors flex items-center gap-2 group">
            Показать все
            <svg 
              className="w-5 h-5 transform group-hover:translate-x-1 transition-transform" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="apple-card p-6 animate-pulse">
              <div className="w-full aspect-square rounded-2xl bg-gray-200 mb-4"></div>
              <div className="h-5 bg-gray-200 rounded mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-2/3"></div>
            </div>
          ))}
        </div>
      ) : Array.isArray(artists) && artists.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {artists.map((artist, index) => (
            <Link
              key={artist.id}
              href={`/artists/${artist.slug}`}
              className="group animate-fadeInUp"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="apple-card p-6 hover:scale-105 transition-all duration-300 h-full flex flex-col">
                {/* Avatar */}
                <div className="relative w-full aspect-square mb-4 overflow-hidden rounded-2xl bg-gradient-to-br from-purple-100 to-pink-100">
                  {artist.avatar ? (
                    <img
                      src={artist.avatar}
                      alt={artist.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Users className="w-16 h-16 text-gray-300" />
                    </div>
                  )}
                </div>

                {/* Artist Info */}
                <div className="flex-1 flex flex-col">
                  <h3 className="font-semibold text-gray-900 mb-2 line-clamp-1 group-hover:text-purple-600 transition-colors">
                    {artist.name}
                  </h3>
                  
                  <div className="flex items-center justify-between text-sm text-gray-500 mt-auto">
                    <div className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      <span>{formatFollowers(artist.followers || 0)}</span>
                    </div>
                    
                    {artist._count?.tracks !== undefined && (
                      <div className="flex items-center gap-1">
                        <Music className="w-4 h-4" />
                        <span>{artist._count.tracks}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="liquid-glass rounded-3xl p-12 text-center">
          <p className="text-gray-600 text-lg">
            Артисты появятся здесь
          </p>
        </div>
      )}
    </section>
  );
}