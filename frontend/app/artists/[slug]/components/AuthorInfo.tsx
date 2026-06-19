'use client';

import { Artist } from '@/app/types';
import { Users, Music, MapPin, Calendar, ExternalLink } from 'lucide-react';
import Link from 'next/link';

interface AuthorInfoProps {
  author: Artist;
}

export default function AuthorInfo({ author }: AuthorInfoProps) {
  const formatFollowers = (count: number): string => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  return (
    <div className="mb-8">
      <div className="apple-card p-6 rounded-3xl">
        {/* Stats */}
        <div className="flex flex-wrap gap-4 mb-4 text-gray-600 justify-center">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            <span className="font-medium text-sm">{formatFollowers(author.followers || 0)} подписчиков</span>
          </div>
          {author._count?.tracks !== undefined && (
            <div className="flex items-center gap-2">
              <Music className="w-4 h-4" />
              <span className="font-medium text-sm">{author._count.tracks} треков</span>
            </div>
          )}
          {author.region && (
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              <span className="text-sm">{author.region}{author.city ? `, ${author.city}` : ''}</span>
            </div>
          )}
          {author.foundedYear && (
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span className="text-sm">С {author.foundedYear} года</span>
            </div>
          )}
        </div>

        {/* Bio */}
        {author.bio && (
          <p className="text-gray-700 leading-relaxed mb-4 text-center text-sm">
            {author.bio}
          </p>
        )}

        {/* Genres */}
        {author.genres && author.genres.length > 0 && (
          <div className="mb-4">
            <h3 className="text-xs font-medium text-gray-500 mb-2 text-center">Жанры</h3>
            <div className="flex flex-wrap gap-2 justify-center">
              {author.genres.map((genre) => (
                <Link key={genre.id} href={`/catalog?genres=${genre.slug}`}>
                  <span
                    className="px-3 py-1.5 rounded-full text-xs font-medium transition-all hover:scale-105 cursor-pointer"
                    style={{
                      background: genre.color
                        ? `linear-gradient(135deg, ${genre.color}20, ${genre.color}40)`
                        : 'linear-gradient(135deg, #f3f4f6, #e5e7eb)',
                      color: genre.color || '#6b7280',
                    }}
                  >
                    {genre.name}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Social Links */}
        {author.socialLinks && Object.keys(author.socialLinks).length > 0 && (
          <div>
            <h3 className="text-xs font-medium text-gray-500 mb-2 text-center">Соцсети</h3>
            <div className="flex flex-wrap gap-2 justify-center">
              {author.socialLinks.vk && (
                <a
                  href={author.socialLinks.vk}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors flex items-center gap-1.5 text-xs font-medium"
                >
                  <ExternalLink className="w-3 h-3" />
                  VK
                </a>
              )}
              {author.socialLinks.telegram && (
                <a
                  href={author.socialLinks.telegram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-blue-400 text-white rounded-full hover:bg-blue-500 transition-colors flex items-center gap-1.5 text-xs font-medium"
                >
                  <ExternalLink className="w-3 h-3" />
                  Telegram
                </a>
              )}
              {author.socialLinks.youtube && (
                <a
                  href={author.socialLinks.youtube}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-[var(--text-primary)] text-white rounded-full hover:opacity-90 transition-colors flex items-center gap-1.5 text-xs font-medium"
                >
                  <ExternalLink className="w-3 h-3" />
                  YouTube
                </a>
              )}
              {author.socialLinks.instagram && (
                <a
                  href={author.socialLinks.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full hover:from-purple-600 hover:to-pink-600 transition-colors flex items-center gap-1.5 text-xs font-medium"
                >
                  <ExternalLink className="w-3 h-3" />
                  Instagram
                </a>
              )}
              {author.socialLinks.website && (
                <a
                  href={author.socialLinks.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-gray-700 text-white rounded-full hover:bg-gray-800 transition-colors flex items-center gap-1.5 text-xs font-medium"
                >
                  <ExternalLink className="w-3 h-3" />
                  Сайт
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
