'use client';

import { usePlayer } from '../context/PlayerContext';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { api } from '../lib/api';
import { usePathname } from 'next/navigation';
import AddToPlaylistButton from './AddToPlaylistButton';

export default function Player() {
  const pname = usePathname();
  if (pname?.startsWith('/admin') || pname?.startsWith('/adminum')) return null;
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    isCollapsed,
    setIsCollapsed,
    togglePlay,
    seek,
    setVolume,
    skipNext,
    shuffleMode,
    skipPrevious,
    toggleShuffle,
  } = usePlayer();

  const [isDraggingTime, setIsDraggingTime] = useState(false);
  const [isDraggingVolume, setIsDraggingVolume] = useState(false);
  const [localProgress, setLocalProgress] = useState(0);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [liked, setLiked] = useState(false);

  useEffect(() => {
    if (!currentTrack?.id) { setLiked(false); return; }
    let cancelled = false;
    fetch(`/api/likes/${currentTrack.id}`, {
      headers: { Authorization: `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('sonatum_token') || '' : ''}` },
    })
      .then(r => r.json())
      .then(j => { if (!cancelled) setLiked(!!j?.liked); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [currentTrack?.id]);

  const toggleLike = async () => {
    if (!currentTrack?.id) return;
    const token = typeof window !== 'undefined' ? localStorage.getItem('sonatum_token') : null;
    if (!token) { window.location.href = '/(auth)/login'; return; }
    const wasLiked = liked;
    setLiked(!wasLiked);
    try {
      await fetch(`/api/likes/${currentTrack.id}`, {
        method: wasLiked ? 'DELETE' : 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      setLiked(wasLiked);
    }
  };


  useEffect(() => {
    setIsMounted(true);
  }, []);

  const desktopTimeSliderRef = useRef<HTMLDivElement>(null);
  const mobileTimeSliderRef = useRef<HTMLDivElement>(null);
  const volumeSliderRef = useRef<HTMLDivElement>(null);

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const calculatePercentage = (clientX: number, rect: DOMRect) => {
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    return x / rect.width;
  };

  const handleTimePointerDown = (e: React.PointerEvent<HTMLDivElement>, ref: React.RefObject<HTMLDivElement>) => {
    if (!ref.current || isNaN(duration) || duration === 0) return;
    const rect = ref.current.getBoundingClientRect();
    const percentage = calculatePercentage(e.clientX, rect);
    setIsDraggingTime(true);
    setLocalProgress(percentage * 100);
    seek(percentage * duration);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      moveEvent.preventDefault();
      const movePercentage = calculatePercentage(moveEvent.clientX, rect);
      setLocalProgress(movePercentage * 100);
    };
    const handlePointerUp = (upEvent: PointerEvent) => {
      const endPercentage = calculatePercentage(upEvent.clientX, rect);
      setLocalProgress(endPercentage * 100);
      seek(endPercentage * duration);
      setIsDraggingTime(false);
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
    };
    document.addEventListener('pointermove', handlePointerMove, { passive: false });
    document.addEventListener('pointerup', handlePointerUp);
  };

  const updateVolumeFromPointer = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
    if (!volumeSliderRef.current) return;
    let clientX = 0;
    if ('touches' in e && (e as React.TouchEvent).touches.length > 0) {
      clientX = (e as React.TouchEvent).touches[0].clientX;
    } else {
      clientX = (e as React.MouseEvent | MouseEvent).clientX;
    }
    const rect = volumeSliderRef.current.getBoundingClientRect();
    setVolume(calculatePercentage(clientX, rect));
  };

  const handleVolumeMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDraggingVolume(true);
    updateVolumeFromPointer(e);
  };

  const handleSwipeStart = (e: React.TouchEvent | React.MouseEvent) => {
    const y = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setTouchStartY(y);
  };

  const handleSwipeEnd = (e: React.TouchEvent | React.MouseEvent) => {
    if (touchStartY === null) return;
    const y = 'changedTouches' in e ? e.changedTouches[0].clientY : e.clientY;
    const deltaY = y - touchStartY;
    if (deltaY < -40) setIsCollapsed(true);
    else if (deltaY > 40) setIsCollapsed(false);
    setTouchStartY(null);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => { if (isDraggingVolume) updateVolumeFromPointer(e); };
    const handleTouchMove = (e: TouchEvent) => { if (isDraggingVolume && !isCollapsed) updateVolumeFromPointer(e); };
    const handleEnd = () => setIsDraggingVolume(false);
    if (isDraggingVolume) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleEnd);
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('touchend', handleEnd);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleEnd);
    };
  }, [isDraggingVolume, duration, isCollapsed]);

  // Auto-expand or auto-collapse when track selection changes
  useEffect(() => {
    if (currentTrack) {
      setIsCollapsed(false);
    } else {
      setIsCollapsed(true);
    }
  }, [currentTrack?.id, setIsCollapsed]);

  const track = currentTrack || {
    id: '', slug: '',
    title: 'Выберите трек для воспроизведения',
    artist: { id: '', slug: '', name: 'Sonatum Music' },
    cover: null,
  };

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;
  const displayProgress = isDraggingTime ? localProgress : progressPercentage;

  return (
    <div
      className={`fixed z-[100] ${isMounted ? 'transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]' : ''}
        left-0 right-0 px-6 md:px-12
        ${isCollapsed ? 'top-0 -translate-y-[calc(100%-28px)]' : 'top-2 md:top-4 translate-y-0'}`}
    >
      <div className="max-w-7xl mx-auto">
        <div className={`liquid-glass-strong border border-[var(--border)] overflow-hidden transition-all duration-500 rounded-[2rem] ${isCollapsed ? 'shadow-sm' : 'shadow-2xl'}`}>

          <div className="transition-all duration-500 origin-top overflow-hidden">
            <div className="px-4 py-2.5 md:px-6 md:py-3 cursor-default">

              {/* ═══════════════════════════════════════════
                  MOBILE — two-row, hidden on md+
              ═══════════════════════════════════════════ */}
              <div className="flex flex-col md:hidden gap-2">

                {/* Row 1: title + artist, centered, no cover */}
                <div className="flex flex-col items-center text-center min-w-0 px-4">
                  <p className="font-semibold text-[var(--text-primary)] truncate w-full text-[12.5px] leading-snug">
                    {track.id
                      ? <Link href={`/tracks/${track.slug || track.id}`} className="active:opacity-60">{track.title}</Link>
                      : track.title}
                  </p>
                  <p className="text-[var(--text-secondary)] truncate w-full text-[10.5px] leading-tight">
                    {track.artist?.id
                      ? <Link href={`/artist/${track.artist?.slug || track.artist?.id}`} className="active:opacity-60">{track.artist?.name || 'Sonatum'}</Link>
                      : (track.artist?.name || 'Sonatum')}
                  </p>
                </div>

                {/* Row 2: controls (φ38%) + progress bar (φ62%) */}
                <div className="flex items-center gap-2.5">
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={currentTrack ? skipPrevious : undefined}
                      className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors p-1.5 active:scale-90">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" />
                      </svg>
                    </button>
                    <button onClick={togglePlay}
                      className="w-10 h-10 rounded-full bg-[var(--text-primary)] text-white flex items-center justify-center shadow-md transition-transform active:scale-90 flex-shrink-0">
                      {isPlaying
                        ? <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg>
                        : <svg className="w-4 h-4 translate-x-[1.5px]" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                      }
                    </button>
                    <button onClick={currentTrack ? skipNext : undefined}
                      className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors p-1.5 active:scale-90">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M16 18h2V6h-2v12zM6 18l8.5-6L6 6v12z" />
                      </svg>
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <div
                      ref={mobileTimeSliderRef}
                      className="flex-1 h-5 flex items-center cursor-pointer relative touch-none"
                      onPointerDown={(e) => handleTimePointerDown(e, mobileTimeSliderRef)}
                    >
                      <div className="w-full h-[3px] bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-[var(--text-primary)] rounded-full transition-none"
                          style={{ width: `${displayProgress}%` }} />
                      </div>
                    </div>
                    <span className="text-[9px] text-[var(--text-secondary)] font-mono flex-shrink-0 w-7 text-right tabular-nums">
                      {formatTime(isDraggingTime ? (localProgress / 100) * duration : currentTime)}
                    </span>
                  </div>
                  <button onClick={toggleLike} title={liked ? "Убрать из моих" : "Добавить в мои"} disabled={!currentTrack}
                    className={`transition-all p-1.5 active:scale-90 flex-shrink-0 ${liked ? "text-red-500" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"} ${!currentTrack ? "opacity-50 cursor-not-allowed" : ""}`}>
                    <svg className="w-5 h-5" fill={liked ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M4.318 6.318a4.5 4.5 0 016.364 0L12 7.636l1.318-1.318a4.5 4.5 0 116.364 6.364L12 20.364l-7.682-7.682a4.5 4.5 0 010-6.364z" />
                    </svg>
                  </button>
                  <AddToPlaylistButton className="w-5 h-5 p-1.5 box-content flex-shrink-0" />
                </div>

              </div>

              {/* ═══════════════════════════════════════════
                  DESKTOP — 3 balanced flex-1 columns
                  [cover+title] | [prev play next + bar] | [shuffle + add | vol]
                  Hidden on mobile
              ═══════════════════════════════════════════ */}
              <div className="hidden md:flex md:flex-row md:items-center gap-4">

                {/* Left: cover + title */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-11 h-11 rounded-[0.75rem] bg-[var(--text-primary)] flex-shrink-0 text-white overflow-hidden shadow-sm opacity-90">
                    {track.cover
                      ? <img src={track.cover} alt="Cover" className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center"><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg></div>
                    }
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-semibold text-[var(--text-primary)] truncate text-[13px] tracking-tight hover:text-[var(--accent)] transition-colors leading-snug">
                      {track.id
                        ? <Link href={`/tracks/${track.slug || track.id}`}>{track.title}</Link>
                        : track.title
                      }
                    </h4>
                    <p className="text-[11px] text-[var(--text-secondary)] truncate hover:text-[var(--text-primary)] transition-colors">
                      {track.artist?.id
                        ? <Link href={`/artist/${track.artist?.slug || track.artist?.id}`}>{track.artist?.name || 'Неизвестный исполнитель'}</Link>
                        : (track.artist?.name || 'Неизвестный исполнитель')
                      }
                    </p>
                  </div>
                </div>

                {/* Center: prev/play/next + progress bar */}
                <div className="flex flex-col flex-1 max-w-lg items-center justify-center">
                  <div className="flex items-center justify-center gap-4 mb-2">
                    <button onClick={currentTrack ? skipPrevious : undefined}
                      className={`text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors ${!currentTrack && 'opacity-50 cursor-not-allowed'}`}>
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
                      </svg>
                    </button>
                    <button
                      onClick={currentTrack ? togglePlay : undefined}
                      className={`w-11 h-11 rounded-full bg-[var(--text-primary)] text-white flex items-center justify-center shadow-md transition-transform ${currentTrack ? 'hover:scale-105 active:scale-95' : 'opacity-50 cursor-not-allowed'}`}
                    >
                      {isPlaying && currentTrack
                        ? <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg>
                        : <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" style={{marginLeft:'2px'}}><path d="M8 5v14l11-7z"/></svg>
                      }
                    </button>
                    <button onClick={currentTrack ? skipNext : undefined}
                      className={`text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors ${!currentTrack && 'opacity-50 cursor-not-allowed'}`}>
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M16 18h2V6h-2v12zM6 18l8.5-6L6 6v12z" />
                      </svg>
                    </button>
                  </div>
                  <div className="flex items-center gap-2 w-full">
                    <span className="text-[10px] text-[var(--text-secondary)] w-8 text-right font-mono tabular-nums">
                      {formatTime(isDraggingTime ? (localProgress / 100) * duration : currentTime)}
                    </span>
                    <div
                      ref={desktopTimeSliderRef}
                      className="flex-1 h-3 flex items-center cursor-pointer group relative touch-none"
                      onPointerDown={(e) => handleTimePointerDown(e, desktopTimeSliderRef)}
                    >
                      <div className="w-full h-[3px] bg-gray-200 rounded-full overflow-hidden relative">
                        <div className="absolute left-0 top-0 bottom-0 bg-[var(--text-primary)] rounded-full transition-none"
                          style={{ width: `${displayProgress}%` }} />
                      </div>
                      <div className="absolute w-3 h-3 bg-white shadow-md border border-gray-200 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"
                        style={{ left: `calc(${displayProgress}% - 6px)` }} />
                    </div>
                    <span className="text-[10px] text-[var(--text-secondary)] w-8 font-mono tabular-nums">
                      {formatTime(duration)}
                    </span>
                  </div>
                </div>

                {/* Right: shuffle + add | volume */}
                <div className="hidden lg:flex items-center justify-end gap-2.5 flex-1">
                  {/* Shuffle */}
                  <button onClick={toggleShuffle} title="Случайное воспроизведение"
                    className={`transition-colors p-1 ${shuffleMode ? 'text-[#1d4cb8]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'} ${!currentTrack && 'opacity-50 cursor-not-allowed'}`}>
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/>
                    </svg>
                  </button>
                  {/* Like */}
                  <button onClick={toggleLike} title={liked ? 'Убрать из моих аудио' : 'Добавить в мои аудио'}
                    className={`transition-all p-1 ${liked ? 'text-red-500 scale-110' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:scale-110'} ${!currentTrack && 'opacity-50 cursor-not-allowed'}`}>
                    <svg className="w-4 h-4" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4.318 6.318a4.5 4.5 0 016.364 0L12 7.636l1.318-1.318a4.5 4.5 0 116.364 6.364L12 20.364l-7.682-7.682a4.5 4.5 0 010-6.364z" />
                    </svg>
                  </button>
                  {/* Add to playlist */}
                  <AddToPlaylistButton className="w-4 h-4 p-1 box-content" />
                  {/* Thin divider */}
                  <div className="w-px h-4 bg-[var(--border)] opacity-40 flex-shrink-0" />
                  {/* Volume icon */}
                  <svg className="w-4 h-4 text-[var(--text-secondary)] flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                  </svg>
                  {/* Volume slider */}
                  <div
                    ref={volumeSliderRef}
                    className="w-22 h-4 flex items-center cursor-pointer group relative"
                    style={{ width: '88px' }}
                    onMouseDown={handleVolumeMouseDown}
                    onTouchStart={handleVolumeMouseDown}
                  >
                    <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden relative">
                      <div className="absolute left-0 top-0 bottom-0 bg-[var(--text-primary)] rounded-full transition-none"
                        style={{ width: `${volume * 100}%` }} />
                    </div>
                    <div className="absolute w-3 h-3 bg-white shadow-md border border-[var(--border)] rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"
                      style={{ left: `calc(${volume * 100}% - 6px)` }} />
                  </div>
                </div>

              </div>

            </div>
          </div>

          {/* Шторка handle */}
          <div
            className="w-full h-7 flex items-end pb-2 justify-center cursor-pointer active:bg-black/5 transition-colors group"
            onClick={() => setIsCollapsed(!isCollapsed)}
            onTouchStart={handleSwipeStart}
            onTouchEnd={handleSwipeEnd}
            onMouseDown={handleSwipeStart}
            onMouseUp={handleSwipeEnd}
          >
            <div className="flex items-center justify-center w-full h-full">
              <div className="w-16 h-1.5 bg-gray-300 group-hover:bg-gray-400 rounded-full transition-colors" />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
