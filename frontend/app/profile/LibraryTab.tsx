'use client';

import { useEffect, useState, useCallback } from 'react';
import { authStorage } from '@/app/lib/auth';
import { usePlayer } from '@/context/PlayerContext';

type Track = {
  id: string;
  title: string;
  cover?: string | null;
  audioUrl?: string;
  artist?: { name?: string } | null;
};


export default function LibraryTab() {
  const { playTrack } = usePlayer();
  const [liked, setLiked] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);

  const auth = () => ({
    Authorization: `Bearer ${authStorage.getToken() || ''}`,
  });

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const a = await fetch('/api/likes', { headers: auth() }).then(r => r.json()).catch(() => null);
      if (a?.success) setLiked(a.data || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const removeLike = async (trackId: string) => {
    const prev = liked;
    setLiked(l => l.filter(t => t.id !== trackId));
    try {
      await fetch(`/api/likes/${trackId}`, { method: 'DELETE', headers: auth() });
    } catch {
      setLiked(prev);
    }
  };

  return (
    <div className="space-y-8 animate-fadeInUp">

      {/* Лайки */}
      <section>
        <div className="flex items-end justify-between mb-3">
          <h2 className="text-2xl font-bold tracking-tight">Мои треки</h2>
          <span className="text-sm text-[var(--text-secondary)] tabular-nums">
            {liked.length}
          </span>
        </div>
        {loading ? (
          <div className="text-sm text-[var(--text-secondary)] py-6 text-center">
            Загрузка…
          </div>
        ) : liked.length === 0 ? (
          <div className="apple-card p-6 text-sm text-center text-[var(--text-secondary)]">
            Лайкните трек в плеере (♥) — он появится здесь
          </div>
        ) : (
          <div className="apple-card overflow-hidden">
            {liked.map(t => (
              <TrackRow
                key={t.id}
                track={t}
                onPlay={() => playTrack(t as any)}
                onRemove={() => removeLike(t.id)}
              />
            ))}
          </div>
        )}
      </section>

    </div>
  );
}

function TrackRow({
  track,
  onPlay,
  onRemove,
}: {
  track: Track;
  onPlay: () => void;
  onRemove?: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-3 h-14 hover:bg-[var(--hover)] transition-colors group">
      <button onClick={onPlay} className="flex items-center gap-3 flex-1 min-w-0 text-left">
        <div className="w-10 h-10 rounded-md bg-gray-100 overflow-hidden shrink-0 relative">
          {track.cover && (
            <img src={track.cover} alt="" className="absolute inset-0 w-full h-full object-cover" />
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity">
            ▶
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold truncate">{track.title}</div>
          <div className="text-xs text-[var(--text-secondary)] truncate">
            {track.artist?.name}
          </div>
        </div>
      </button>
      {onRemove && (
        <button
          onClick={onRemove}
          title="Убрать из моих"
          className="text-[var(--text-secondary)] hover:text-red-500 transition-colors p-2 opacity-0 group-hover:opacity-100"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  );
}
