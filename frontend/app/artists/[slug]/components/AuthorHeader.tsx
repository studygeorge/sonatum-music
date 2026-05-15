'use client';

import { Artist } from '@/app/types';
import { Users } from 'lucide-react';

interface AuthorHeaderProps {
  author: Artist;
}

export default function AuthorHeader({ author }: AuthorHeaderProps) {
  console.log('[AUTHOR HEADER] Rendering with author:', author.name);
  console.log('[AUTHOR HEADER] Avatar:', author.avatar);
  console.log('[AUTHOR HEADER] Cover:', author.coverImage);

  return (
    <div className="mb-4">
      {/* Только круглый аватар по центру */}
      <div className="flex flex-col items-center">
        <div className="relative mb-3">
          <div className="w-40 h-40 rounded-full overflow-hidden shadow-xl bg-gradient-to-br from-purple-100 to-pink-100 border-4 border-white">
            {author.avatar ? (
              <img
                src={author.avatar}
                alt={author.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  console.error('[AUTHOR HEADER] Avatar failed to load:', author.avatar);
                  const target = e.currentTarget;
                  target.style.display = 'none';
                  const parent = target.parentElement;
                  if (parent) {
                    const fallback = document.createElement('div');
                    fallback.className = 'w-full h-full flex items-center justify-center';
                    fallback.innerHTML = `<svg class="w-20 h-20 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>`;
                    parent.appendChild(fallback);
                  }
                }}
                onLoad={() => {
                  console.log('[AUTHOR HEADER] Avatar loaded successfully:', author.avatar);
                }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Users className="w-20 h-20 text-gray-300" />
              </div>
            )}
          </div>
          
          {/* Verified Badge */}
          {author.verified && (
            <div className="absolute bottom-1 right-1 w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center shadow-lg border-3 border-white">
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
          )}
        </div>

        {/* Name */}
        <div className="text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-1">
            {author.name}
          </h1>
          {author.verified && (
            <div className="inline-flex items-center gap-1.5 text-blue-600">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span className="font-medium text-xs">Подтвержденный автор</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
