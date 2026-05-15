'use client';

import { usePlayer } from '@/context/PlayerContext';

type Track = {
  id: string;
  title: string;
  cover?: string | null;
  playCount?: number;
  artist?: { name: string } | null;
};

export default function HomeChart({ tracks }: { tracks: Track[] }) {
  const { playTrack } = usePlayer();
  return (
    <div className="bg-white rounded-3xl p-2 shadow-sm border border-[var(--border)] overflow-hidden min-w-0">
      {tracks.map((t, i) => (
        <button
          key={t.id}
          onClick={() => playTrack(t as any)}
          className="w-full h-16 flex items-center gap-4 px-3 rounded-2xl hover:bg-[var(--hover)] transition-colors cursor-pointer group text-left"
        >
          <div className="w-10 text-center text-[var(--text-secondary)] font-semibold text-lg tabular-nums shrink-0">
            {i + 1}
          </div>
          <div className="w-12 aspect-square bg-gray-100 rounded-lg overflow-hidden shrink-0 relative">
            {t.cover && (
              <img
                src={t.cover}
                alt={t.title}
                loading="lazy"
                decoding="async"
                className="absolute inset-0 w-full h-full object-cover"
              />
            )}
          </div>
          <div className="flex-grow min-w-0">
            <h4 className="font-semibold text-[var(--text-primary)] truncate">
              {t.title}
            </h4>
            <p className="text-sm text-[var(--text-secondary)] truncate">
              {t.artist?.name}
            </p>
          </div>
          <div className="text-sm text-[var(--text-secondary)] hidden sm:block pr-4 whitespace-nowrap shrink-0">
            {(t.playCount || 0).toLocaleString('ru-RU')} прослушиваний
          </div>
        </button>
      ))}
    </div>
  );
}
