'use client';

import { usePlayer } from '@/context/PlayerContext';

type Track = {
  id: string;
  title: string;
  cover?: string | null;
  duration?: number;
  playCount?: number;
  audioUrl?: string;
  artist?: { id?: string; name?: string; slug?: string; avatar?: string | null } | null;
};

function fmt(sec?: number) {
  if (!sec) return '';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function ChartRow({ track, rank }: { track: Track; rank: number }) {
  const { playTrack, currentTrack, isPlaying } = usePlayer();
  const isNow = currentTrack?.id === track.id && isPlaying;
  return (
    <button
      onClick={() => playTrack(track as any)}
      className="w-full flex items-center gap-4 p-3 md:p-4 rounded-2xl hover:bg-[var(--hover)] transition-colors text-left group"
    >
      <div className="w-10 md:w-12 text-center font-bold text-[var(--text-secondary)] text-lg tabular-nums shrink-0">
        {rank}
      </div>
      <div className="w-12 h-12 bg-gray-100 rounded-lg overflow-hidden shrink-0 relative">
        {track.cover && (
          <img
            src={track.cover}
            alt={track.title}
            loading="lazy"
            className="w-full h-full object-cover"
          />
        )}
        <div
          className={`absolute inset-0 flex items-center justify-center bg-black/40 transition-opacity ${
            isNow ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
        >
          <span className="text-white font-bold">{isNow ? '❚❚' : '▶'}</span>
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-[var(--text-primary)] truncate">
          {track.title}
        </div>
        <div className="text-sm text-[var(--text-secondary)] truncate">
          {track.artist?.name}
        </div>
      </div>
      <div className="hidden sm:flex items-center gap-6 text-sm text-[var(--text-secondary)] tabular-nums shrink-0">
        <span className="hidden md:inline">
          {(track.playCount || 0).toLocaleString('ru-RU')} прослушиваний
        </span>
        <span>{fmt(track.duration)}</span>
      </div>
    </button>
  );
}
