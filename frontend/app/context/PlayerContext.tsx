'use client';

import React, { createContext, useContext, useState, useRef, useEffect, ReactNode } from 'react';
import { Track } from '../types';
import { api } from '@/app/lib/api';

export type QueueContext = {
  // Список треков плейлиста/альбома/региона. Если не передан — играем "из общего" (рандом).
  tracks?: Track[];
  // Индекс начального трека в tracks (если есть). Если -1 — найдём по id.
  index?: number;
  // Источник — для отладки/UI
  source?: string;
};

interface PlayerContextType {
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isCollapsed: boolean;
  shuffleMode: boolean;
  setIsCollapsed: (v: boolean) => void;
  playTrack: (track: Track, ctx?: QueueContext) => void;
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
  const [shuffleMode, setShuffleMode] = useState(false);
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
    } else {
      // Первый заход / нет истории — подгружаем случайный трек, чтобы плеер
      // был «готов к нажатию Play». Сам не запускаем — autoplay запрещён.
      fetch('/api/tracks/random?limit=1')
        .then((r) => r.json())
        .then((j) => {
          const tr = j?.data?.[0];
          if (tr?.audioUrl) {
            setCurrentTrack(tr);
            audio.src = tr.audioUrl;
            audio.preload = 'metadata';
            persistTrack(tr);
          }
        })
        .catch(() => {});
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
      // Авто-переход: если есть очередь — следующий по плейлисту (с закольцовкой),
      // иначе — случайный трек из общего пула.
      try {
        const rawQ = localStorage.getItem('sonatum:queue');
        const rawI = localStorage.getItem('sonatum:queueIndex');
        if (rawQ && rawI != null) {
          const q = JSON.parse(rawQ);
          if (Array.isArray(q) && q.length > 0) {
            let next = parseInt(rawI, 10) + 1;
            if (next >= q.length) next = 0; // закольцовка
            const tr = q[next];
            if (tr?.audioUrl) {
              localStorage.setItem('sonatum:queueIndex', String(next));
              audio.src = tr.audioUrl;
              persistTrack(tr);
              setCurrentTrack(tr);
              audio.play().then(() => setIsPlaying(true)).catch(() => {});
              return;
            }
          }
        }
        // Нет очереди — fetch random
        fetch('/api/tracks/random?limit=1')
          .then((r) => r.json())
          .then((j) => {
            const tr = j?.data?.[0];
            if (tr?.audioUrl) {
              audio.src = tr.audioUrl;
              persistTrack(tr);
              setCurrentTrack(tr);
              audio.play().then(() => setIsPlaying(true)).catch(() => {});
            }
          }).catch(() => {});
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

  const playTrack = (track: Track, ctx?: QueueContext) => {
    if (!audioRef.current) return;

    setCurrentTrack(track);
    persistTrack(track);
    audioRef.current.src = track.audioUrl;
    audioRef.current.volume = volume;
    persistPosition(0);
    setCurrentTime(0);

    // Сохраняем очередь, если передана. Иначе — снимаем очередь (next будет рандомным).
    try {
      if (ctx?.tracks && ctx.tracks.length > 0) {
        let idx = ctx.index ?? -1;
        if (idx < 0 || idx >= ctx.tracks.length || ctx.tracks[idx]?.id !== (track as any).id) {
          idx = ctx.tracks.findIndex((t) => (t as any).id === (track as any).id);
          if (idx < 0) idx = 0;
        }
        localStorage.setItem('sonatum:queue', JSON.stringify(ctx.tracks));
        localStorage.setItem('sonatum:queueIndex', String(idx));
        localStorage.setItem('sonatum:queueSource', ctx.source || '');
      } else {
        // Одиночный трек — очищаем очередь, чтобы next был случайным
        localStorage.removeItem('sonatum:queue');
        localStorage.removeItem('sonatum:queueIndex');
        localStorage.setItem('sonatum:queueSource', 'random');
      }
    } catch {}

    audioRef.current.play()
      .then(() => setIsPlaying(true))
      .catch(error => {
        console.error('[PLAYER] Playback error:', error);
        setIsPlaying(false);
      });

    // Запись в историю прослушиваний (без авторизации — игнорируем)
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('sonatum_token') : null;
      if (token && (track as any).id) {
        fetch('/api/users/me/history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ trackId: (track as any).id, durationSec: (track as any).duration }),
        }).catch(() => {});
      }
    } catch {}
  };

  // Подгружаем случайный трек (если играем НЕ из плейлиста)
  const playRandomNext = async () => {
    try {
      const curId = (currentTrack as any)?.id;
      const r = await fetch(`/api/tracks/random?limit=1${curId ? `&exclude=${encodeURIComponent(curId)}` : ''}`);
      const j = await r.json();
      const tr = j?.data?.[0];
      if (tr?.audioUrl) {
        playTrack(tr); // без ctx → останется в random-режиме
      }
    } catch (e) {
      console.error('[PLAYER] random fetch error:', e);
    }
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

  // Есть ли активная очередь (плейлист/альбом/регион)?
  const hasActiveQueue = (): boolean => {
    try {
      const q = localStorage.getItem('sonatum:queue');
      if (!q) return false;
      const arr = JSON.parse(q);
      return Array.isArray(arr) && arr.length > 0;
    } catch { return false; }
  };

  // Переходим к треку из очереди (localStorage). delta: +1 next, -1 previous.
  // Возвращает true если переход состоялся.
  const jumpInQueue = (delta: 1 | -1): boolean => {
    if (!audioRef.current) return false;
    try {
      const rawQ = localStorage.getItem('sonatum:queue');
      const rawI = localStorage.getItem('sonatum:queueIndex');
      if (!rawQ || rawI == null) return false;
      const q = JSON.parse(rawQ);
      if (!Array.isArray(q) || q.length === 0) return false;
      const curIdx = parseInt(rawI, 10);
      let target = curIdx + delta;
      // Закольцовываем плейлист: после последнего → первый, перед первым → последний
      if (target >= q.length) target = 0;
      if (target < 0) target = q.length - 1;
      const tr = q[target];
      if (!tr || !tr.audioUrl) return false;
      localStorage.setItem('sonatum:queueIndex', String(target));
      audioRef.current.src = tr.audioUrl;
      persistTrack(tr);
      setCurrentTrack(tr);
      persistPosition(0);
      setCurrentTime(0);
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
      return true;
    } catch (e) {
      console.error('[PLAYER] jumpInQueue error:', e);
      return false;
    }
  };

  const skipNext = () => {
    // Сначала пробуем перейти внутри активной очереди (плейлиста)
    if (hasActiveQueue() && jumpInQueue(1)) return;
    // Иначе — берём случайный трек
    playRandomNext();
  };

  const skipPrevious = () => {
    // Если воспроизведение идёт >3 сек — просто перематываем на начало
    if (audioRef.current && audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0;
      setCurrentTime(0);
      persistPosition(0);
      return;
    }
    // Если плейлист — переходим назад. Иначе — нечего "назад", оставляем как есть.
    if (hasActiveQueue()) {
      jumpInQueue(-1);
      return;
    }
    // Без плейлиста — previous эквивалентен «новому случайному»
    playRandomNext();
  };

  const toggleShuffle = async () => {
    try {
      const rawQ = localStorage.getItem('sonatum:queue');
      if (rawQ) {
        // Есть очередь (плейлист) — перемешиваем её, оставляя текущий трек первым
        const q = JSON.parse(rawQ);
        if (Array.isArray(q) && q.length > 1) {
          const curIdx = parseInt(localStorage.getItem('sonatum:queueIndex') || '0', 10);
          const cur = q[curIdx];
          const rest = q.filter((_: any, i: number) => i !== curIdx);
          for (let i = rest.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [rest[i], rest[j]] = [rest[j], rest[i]];
          }
          const shuffled = [cur, ...rest];
          localStorage.setItem('sonatum:queue', JSON.stringify(shuffled));
          localStorage.setItem('sonatum:queueIndex', '0');
          setShuffleMode((m) => !m);
          console.log('[PLAYER] Queue shuffled locally');
        }
      } else {
        // Нет очереди — играем случайный трек прямо сейчас
        setShuffleMode(true);
        await playRandomNext();
      }
      // И серверная очередь (если есть)
      api.shuffleQueue?.().catch(() => {});
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
        shuffleMode,
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
