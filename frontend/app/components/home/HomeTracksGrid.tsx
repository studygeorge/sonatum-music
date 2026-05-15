'use client';

import Link from 'next/link';
import { usePlayer } from '@/context/PlayerContext';

type Track = {
  id: string;
  title: string;
  slug?: string;
  cover?: string | null;
  audioUrl?: string;
  artist?: { id: string; name: string; slug?: string } | null;
};

type Props = {
  title: string;
  tracks: Track[];
  cols?: 5 | 6;
  rightLink?: { href: string; label: string };
};

export default function HomeTracksGrid({
  title,
  tracks,
  cols = 5,
  rightLink,
}: Props) {
  const { playTrack } = usePlayer();
  const colClass = cols === 6 ? 'lg:grid-cols-6' : 'lg:grid-cols-5';

  return (
    <section>
      <div className="flex flex-wrap justify-between items-end mb-6 gap-2">
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight break-words">
          {title}
        </h2>
        {rightLink && (
          <Link
            href={rightLink.href}
            className="text-[var(--accent)] font-medium hover:underline whitespace-nowrap"
          >
            {rightLink.label}
          </Link>
        )}
      </div>
      <div className={`grid grid-cols-2 md:grid-cols-4 ${colClass} gap-6`}>
        {tracks.map((t) => (
          <button
            key={t.id}
            onClick={() => playTrack(t as any)}
            className="apple-card hover-scale p-4 cursor-pointer group flex flex-col text-left"
          >
            <div className="aspect-square bg-[var(--border)] rounded-xl mb-4 overflow-hidden relative">
              {t.cover && (
                <img
                  src={t.cover}
                  alt={t.title}
                  loading="lazy"
                  decoding="async"
                  width={400}
                  height={400}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              )}
              <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="text-white font-medium bg-black/40 px-4 py-2 rounded-full backdrop-blur-md">
                  Play
                </span>
              </div>
            </div>
            <h3 className="font-semibold text-lg truncate mb-1">{t.title}</h3>
            <p className="text-[var(--text-secondary)] text-sm truncate">
              {t.artist?.name}
            </p>
          </button>
        ))}
      </div>
    </section>
  );
}
