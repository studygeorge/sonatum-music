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
      <div className={`grid grid-cols-2 md:grid-cols-4 ${colClass} gap-3 md:gap-6`}>
        {tracks.map((t) => (
          <button
            key={t.id}
            onClick={() => playTrack(t as any)}
            className="apple-card hover-scale p-3 md:p-4 cursor-pointer group flex flex-col text-left w-full min-w-0 overflow-hidden"
          >
            {/* Квадрат через padding-приём — работает и на старых браузерах без aspect-ratio */}
            <div className="relative w-full rounded-xl mb-3 md:mb-4 overflow-hidden bg-[var(--border)]">
              <div style={{ paddingBottom: '100%' }} aria-hidden="true" />
              {t.cover ? (
                <img
                  src={t.cover}
                  alt={t.title}
                  loading="lazy"
                  decoding="async"
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <span className="absolute inset-0 flex items-center justify-center text-[var(--text-secondary)]">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
                </span>
              )}
              <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="text-white font-medium bg-black/40 px-4 py-2 rounded-full backdrop-blur-md">
                  Play
                </span>
              </div>
            </div>
            <h3 className="font-semibold text-sm md:text-lg w-full truncate mb-1">{t.title}</h3>
            <p className="text-[var(--text-secondary)] text-xs md:text-sm w-full truncate">
              {t.artist?.name}
            </p>
          </button>
        ))}
      </div>
    </section>
  );
}
