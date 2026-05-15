'use client';

import React, { createContext, useContext, useState, useRef, useEffect, ReactNode } from 'react';
import { Track } from '../types';
import { api } from '@/app/lib/api';

interface PlayerContextType {
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isCollapsed: boolean;
  setIsCollapsed: (v: boolean) => void;
  playTrack: (track: Track) => void;
  togglePlay: () => void;
  pause: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  skipNext: () => void;
  skipPrevious: () => void;
  toggleShuffle: () => Promise<void>;
  dislikeTrack: () => Promise<void>;
  playSimilar: () => Promise<void>;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

// localStorage keys for player state persistence
const LS_TRACK = 'sonatum:player:track';
const LS_POSITION = 'sonatum:player:position';
const LS_VOLUME = 'sonatum:player:volume';

function loadPersisted(): { track: Track | null; position: number; volume: number } {
  if (typeof window === 'undefined') return { track: null, position: 0, volume: 1 };
  try {
    const trackRaw = localStorage.getItem(LS_TRACK);
    const track = trackRaw ? (JSON.parse(trackRaw) as Track) : null;
    const position = parseFloat(localStorage.getItem(LS_POSITION) || '0') || 0;
    const volRaw = parseFloat(localStorage.getItem(LS_VOLUME) || '1');
    const volume = Number.isFinite(volRaw) ? Math.max(0, Math.min(1, volRaw)) : 1;
    return { track, position, volume };
  } catch {
    return { track: null, position: 0, volume: 1 };
  }
}

function persistTrack(track: Track | null) {
  try {
    if (track) localStorage.setItem(LS_TRACK, JSON.stringify(track));
    else localStorage.removeItem(LS_TRACK);
  } catch {}
}
function persistPosition(t: number) {
  try { localStorage.setItem(LS_POSITION, String(t)); } catch {}
}
function persistVolume(v: number) {
  try { localStorage.setItem(LS_VOLUME, String(v)); } catch {}
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(1);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastSavedRef = useRef<number>(0);

  // Init audio + restore persisted state on mount
  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;

    const persisted = loadPersisted();
    audio.volume = persisted.volume;
    setVolumeState(persisted.volume);

    if (persisted.track && persisted.track.audioUrl) {
      // Восстанавливаем трек в режиме PAUSED — браузеры запрещают autoplay,
      // и пользователь явно ожидает что после reload сначала тишина.
      setCurrentTrack(persisted.track);
      audio.src = persisted.track.audioUrl;
      audio.preload = 'metadata';
      const restorePos = () => {
        if (persisted.position > 0 && persisted.position < (audio.duration || Infinity)) {
          audio.currentTime = persisted.position;
          setCurrentTime(persisted.position);
        }
      };
      // currentTime можно ставить только когда метаданные загружены.
      audio.addEventListener('loadedmetadata', restorePos, { once: true });
    }

    audio.addEventListener('timeupdate', () => {
      setCurrentTime(audio.currentTime);
      // Throttle persistence — пишем не чаще 1 раза в 2 секунды.
      const now = Date.now();
      if (now - lastSavedRef.current > 2000) {
        persistPosition(audio.currentTime);
        lastSavedRef.current = now;
      }
    });

    audio.addEventListener('durationchange', () => {
      setDuration(audio.duration);
    });

    audio.addEventListener('ended', () => {
      setIsPlaying(false);
      setCurrentTime(0);
      persistPosition(0);
      // Авто-переход к следующему треку из очереди (Hero «Слушать сейчас»).
      try {
        const rawQ = localStorage.getItem('sonatum:queue');
        const rawI = localStorage.getItem('sonatum:queueIndex');
        if (rawQ && rawI != null) {
          const q = JSON.parse(rawQ);
          const next = parseInt(rawI, 10) + 1;
          if (Array.isArray(q) && q[next]) {
            localStorage.setItem('sonatum:queueIndex', String(next));
            // Имитируем playTrack без зависимости от внешнего скоупа
            const tr = q[next];
            audio.src = tr.audioUrl;
            persistTrack(tr);
            setCurrentTrack(tr);
            audio.play().then(() => setIsPlaying(true)).catch(() => {});
          }
        }
      } catch {}
    });

    audio.addEventListener('pause', () => {
      // Любая пауза — фиксируем позицию.
      persistPosition(audio.currentTime);
    });

    audio.addEventListener('error', (e) => {
      console.error('[PLAYER] Audio error:', e);
      setIsPlaying(false);
    });

    // Финально сохранить позицию перед уходом со страницы / закрытием.
    const onBeforeUnload = () => {
      if (audioRef.current) {
        persistPosition(audioRef.current.currentTime);
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    window.addEventListener('pagehide', onBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      window.removeEventListener('pagehide', onBeforeUnload);
      audio.pause();
      audio.src = '';
    };
  }, []);

  const playTrack = (track: Track) => {
    if (!audioRef.current) return;

    setCurrentTrack(track);
    persistTrack(track);
    audioRef.current.src = track.audioUrl;
    audioRef.current.volume = volume;
    persistPosition(0);
    setCurrentTime(0);

    audioRef.current.play()
      .then(() => setIsPlaying(true))
      .catch(error => {
        console.error('[PLAYER] Playback error:', error);
        setIsPlaying(false);
      });
  };

  const togglePlay = () => {
    if (!audioRef.current || !currentTrack) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      persistPosition(audioRef.current.currentTime);
    } else {
      audioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(error => console.error('[PLAYER] Play error:', error));
    }
  };

  const pause = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      persistPosition(audioRef.current.currentTime);
    }
  };

  const seek = (time: number) => {
    if (audioRef.current && !isNaN(duration)) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
      persistPosition(time);
    }
  };

  const setVolume = (newVolume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, newVolume));
    setVolumeState(clampedVolume);
    persistVolume(clampedVolume);
    if (audioRef.current) {
      audioRef.current.volume = clampedVolume;
    }
  };

  const skipNext = () => {
    console.log('[PLAYER] Skip next - TODO: implement playlist');
  };

  const skipPrevious = () => {
    console.log('[PLAYER] Skip previous - TODO: implement playlist');
  };

  const toggleShuffle = async () => {
    try {
      const res = await api.shuffleQueue();
      if (res.success) {
        console.log('[PLAYER] Queue shuffled');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const dislikeTrack = async () => {
    if (!currentTrack) return;
    try {
      console.log('[PLAYER] Disliked track, skipping...');
      skipNext();
    } catch (e) {
      console.error(e);
    }
  };

  const playSimilar = async () => {
    if (!currentTrack) return;
    try {
      console.log('[PLAYER] Generating Radar for Similar tracks...');
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <PlayerContext.Provider
      value={{
        currentTrack,
        isPlaying,
        currentTime,
        duration,
        volume,
        isCollapsed,
        setIsCollapsed,
        playTrack,
        togglePlay,
        pause,
        seek,
        setVolume,
        skipNext,
        skipPrevious,
        toggleShuffle,
        dislikeTrack,
        playSimilar,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (context === undefined) {
    throw new Error('usePlayer must be used within a PlayerProvider');
  }
  return context;
}
