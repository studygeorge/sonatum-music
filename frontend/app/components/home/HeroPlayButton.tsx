'use client';

import { usePlayer } from '@/context/PlayerContext';
import { ShimmerButton } from '@/app/components/ShimmerButton';

const QUEUE_KEY = 'sonatum:queue';
const QUEUE_INDEX_KEY = 'sonatum:queueIndex';

type Track = {
  id: string;
  title: string;
  audioUrl?: string;
  cover?: string | null;
  duration?: number;
  artist?: { id?: string; name?: string; slug?: string; avatar?: string | null } | null;
};

export default function HeroPlayButton({ tracks }: { tracks: Track[] }) {
  const { playTrack } = usePlayer();

  const onPlay = () => {
    if (!tracks || tracks.length === 0) return;
    // Дедуп по id, потом shuffle (Fisher–Yates).
    const seen = new Set<string>();
    const dedup = tracks.filter(t => {
      if (!t?.id || seen.has(t.id)) return false;
      seen.add(t.id);
      return !!t.audioUrl;
    });
    const shuffled = [...dedup];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    if (shuffled.length === 0) return;

    try {
      localStorage.setItem(QUEUE_KEY, JSON.stringify(shuffled));
      localStorage.setItem(QUEUE_INDEX_KEY, '0');
    } catch {}

    playTrack(shuffled[0] as any);
  };

  return (
    <ShimmerButton
      shimmerColor="#f0d080"
      shimmerDuration="2.5s"
      background="rgba(255,255,255,0.18)"
      borderRadius="980px"
      className="px-6 py-2.5 text-sm font-semibold backdrop-blur-md border-white/30 cursor-pointer"
      onClick={onPlay}
    >
      <span className="inline-flex items-center gap-2">
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M8 5v14l11-7z" />
        </svg>
        Слушать сейчас
      </span>
    </ShimmerButton>
  );
}
