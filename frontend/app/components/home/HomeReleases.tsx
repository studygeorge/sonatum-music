'use client';

import { usePlayer } from '@/context/PlayerContext';

type Track = {
  id: string;
  title: string;
  cover?: string | null;
  artist?: { name: string } | null;
};

export default function HomeReleases({ tracks }: { tracks: Track[] }) {
  const { playTrack } = usePlayer();
  return (
    <div className="flex flex-col gap-4">
      {tracks.map((t) => (
        <button
          key={t.id}
          onClick={() => playTrack(t as any)}
          className="apple-card p-4 flex gap-4 cursor-pointer hover-scale text-left"
        >
          <div className="w-16 h-16 bg-[var(--border)] rounded-lg shrink-0 overflow-hidden">
            {t.cover && (
              <img
                src={t.cover}
                alt={t.title}
                loading="lazy"
                decoding="async"
                width={64}
                height={64}
                className="w-full h-full object-cover"
              />
            )}
          </div>
          <div className="flex-1 min-w-0 flex flex-col justify-center overflow-hidden">
            <h4 className="font-semibold truncate text-[var(--text-primary)]">
              {t.title}
            </h4>
            <p className="text-sm text-[var(--text-secondary)] truncate">
              {t.artist?.name}
            </p>
          </div>
        </button>
      ))}
    </div>
  );
}
