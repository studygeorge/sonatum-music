'use client';

import Link from 'next/link';
import { Genre } from '@/app/types';

interface GenresSectionProps {
  genres: Genre[];
}

export default function GenresSection({ genres }: GenresSectionProps) {
  return (
    <section className="mb-16">
      <div className="mb-6">
        <h2 className="text-3xl font-semibold text-gray-900">
          Жанры
        </h2>
      </div>

      {Array.isArray(genres) && genres.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {genres.map((genre, index) => (
            <Link key={genre.id} href={`/catalog?genres=${genre.slug}`}>
              <div
                className="apple-card p-6 text-center hover-scale cursor-pointer group relative overflow-hidden"
                style={{ 
                  animationDelay: `${index * 0.05}s`,
                  background: genre.color 
                    ? `linear-gradient(135deg, ${genre.color}15 0%, ${genre.color}05 100%)`
                    : undefined
                }}
              >
                {/* Hover effect overlay */}
                <div 
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{
                    background: genre.color 
                      ? `linear-gradient(135deg, ${genre.color}30 0%, ${genre.color}10 100%)`
                      : 'linear-gradient(135deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.02) 100%)'
                  }}
                ></div>

                <div className="relative z-10">
                  {/* Цветная полоска вместо иконки */}
                  <div 
                    className="h-1 w-12 mx-auto mb-4 rounded-full transform group-hover:scale-x-150 transition-transform duration-300"
                    style={{ backgroundColor: genre.color || '#gray-400' }}
                  ></div>
                  
                  <h3 className="font-semibold text-gray-900 mb-1">{genre.name}</h3>
                  {genre._count?.tracks !== undefined && (
                    <p className="text-sm text-gray-600">
                      {genre._count.tracks} {genre._count.tracks === 1 ? 'трек' : 'треков'}
                    </p>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="liquid-glass rounded-3xl p-12 text-center">
          <p className="text-gray-600 text-lg">Жанры появятся здесь</p>
        </div>
      )}
    </section>
  );
}
