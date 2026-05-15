'use client';

import { Play, Pause, SkipBack, SkipForward, Volume2 } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { useState, useRef, useEffect } from 'react';

export default function Header() {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    togglePlay,
    seek,
    setVolume,
    skipNext,
    skipPrevious,
  } = usePlayer();

  const [isDraggingTime, setIsDraggingTime] = useState(false);
  const [isDraggingVolume, setIsDraggingVolume] = useState(false);
  const timeSliderRef = useRef<HTMLDivElement>(null);
  const volumeSliderRef = useRef<HTMLDivElement>(null);

  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleTimeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingTime(true);
    updateTimeFromMouse(e);
  };

  const handleVolumeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingVolume(true);
    updateVolumeFromMouse(e);
  };

  const updateTimeFromMouse = (e: React.MouseEvent | MouseEvent) => {
    if (!timeSliderRef.current || isNaN(duration) || duration === 0) return;
    
    const rect = timeSliderRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const percentage = x / rect.width;
    const newTime = percentage * duration;
    
    seek(newTime);
  };

  const updateVolumeFromMouse = (e: React.MouseEvent | MouseEvent) => {
    if (!volumeSliderRef.current) return;
    
    const rect = volumeSliderRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const newVolume = x / rect.width;
    
    setVolume(newVolume);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingTime) {
        updateTimeFromMouse(e);
      }
      if (isDraggingVolume) {
        updateVolumeFromMouse(e);
      }
    };

    const handleMouseUp = () => {
      setIsDraggingTime(false);
      setIsDraggingVolume(false);
    };

    if (isDraggingTime || isDraggingVolume) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingTime, isDraggingVolume, duration]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <>
      <style jsx>{`
        /* Player Container */
        .player-container {
          background: rgba(255, 255, 255, 0.2);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.3);
          border-radius: 16px;
          padding: 12px 16px;
          display: flex;
          align-items: center;
          gap: 16px;
          box-shadow: 
            0 4px 12px rgba(0, 0, 0, 0.05),
            inset 0 1px 0 rgba(255, 255, 255, 0.4);
        }

        /* Track Info */
        .track-info {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 200px;
        }

        .track-cover {
          width: 48px;
          height: 48px;
          border-radius: 8px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          flex-shrink: 0;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          overflow: hidden;
        }

        .track-cover img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .track-details {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }

        .track-title {
          font-size: 14px;
          font-weight: 600;
          color: #1d1d1f;
          line-height: 1.2;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .track-artist {
          font-size: 12px;
          color: #86868b;
          line-height: 1.2;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* Controls */
        .player-controls {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .control-button {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.9);
          border: 1px solid rgba(0, 0, 0, 0.06);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
          color: #1d1d1f;
        }

        .control-button:hover {
          background: rgba(255, 255, 255, 1);
          transform: scale(1.05);
        }

        .control-button:active {
          transform: scale(0.95);
        }

        .control-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .play-button {
          width: 40px;
          height: 40px;
          background: #1d1d1f;
          color: white;
        }

        .play-button:hover {
          background: #2d2d2f;
        }

        /* Progress Bar */
        .progress-container {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 200px;
        }

        .time-display {
          font-size: 11px;
          color: #86868b;
          font-weight: 500;
          min-width: 40px;
          text-align: center;
        }

        .progress-bar {
          flex: 1;
          height: 6px;
          background: rgba(255, 255, 255, 0.4);
          border-radius: 3px;
          cursor: pointer;
          position: relative;
          user-select: none;
        }

        .progress-fill {
          position: absolute;
          top: 0;
          left: 0;
          height: 100%;
          background: linear-gradient(90deg, #1d1d1f 0%, #4a4a4a 100%);
          border-radius: 3px;
          pointer-events: none;
          transition: width 0.1s linear;
        }

        .progress-thumb {
          position: absolute;
          top: 50%;
          transform: translate(-50%, -50%);
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #1d1d1f;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
          opacity: 0;
          transition: opacity 0.2s;
          pointer-events: none;
        }

        .progress-bar:hover .progress-thumb {
          opacity: 1;
        }

        /* Volume Control */
        .volume-control {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .volume-slider {
          width: 80px;
          height: 4px;
          background: rgba(255, 255, 255, 0.4);
          border-radius: 2px;
          cursor: pointer;
          position: relative;
          user-select: none;
        }

        .volume-fill {
          position: absolute;
          top: 0;
          left: 0;
          height: 100%;
          background: #1d1d1f;
          border-radius: 2px;
          pointer-events: none;
        }

        .volume-thumb {
          position: absolute;
          top: 50%;
          transform: translate(-50%, -50%);
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #1d1d1f;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
          opacity: 0;
          transition: opacity 0.2s;
          pointer-events: none;
        }

        .volume-slider:hover .volume-thumb {
          opacity: 1;
        }

        /* Responsive */
        @media (max-width: 1024px) {
          .player-container {
            flex-wrap: wrap;
          }
          
          .progress-container {
            width: 100%;
            order: 3;
          }
        }

        @media (max-width: 768px) {
          .track-info {
            min-width: auto;
          }

          .volume-control {
            display: none;
          }

          .progress-container {
            min-width: auto;
          }
        }
      `}</style>

      <header className="sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="player-container">
            {/* Track Info */}
            <div className="track-info">
              <div className="track-cover">
                {currentTrack?.cover && (
                  <img src={currentTrack.cover} alt={currentTrack.title} />
                )}
              </div>
              <div className="track-details">
                <div className="track-title">
                  {currentTrack?.title || 'Выберите трек'}
                </div>
                <div className="track-artist">
                  {currentTrack?.artist?.name || 'Артист'}
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="player-controls">
              <button 
                className="control-button" 
                onClick={skipPrevious}
                disabled={!currentTrack}
              >
                <SkipBack size={16} />
              </button>
              <button 
                className="control-button play-button" 
                onClick={togglePlay}
                disabled={!currentTrack}
              >
                {isPlaying ? <Pause size={18} /> : <Play size={18} />}
              </button>
              <button 
                className="control-button" 
                onClick={skipNext}
                disabled={!currentTrack}
              >
                <SkipForward size={16} />
              </button>
            </div>

            {/* Progress Bar */}
            <div className="progress-container">
              <span className="time-display">{formatTime(currentTime)}</span>
              <div 
                ref={timeSliderRef}
                className="progress-bar"
                onMouseDown={handleTimeMouseDown}
              >
                <div 
                  className="progress-fill" 
                  style={{ width: `${progress}%` }}
                />
                <div 
                  className="progress-thumb"
                  style={{ left: `${progress}%` }}
                />
              </div>
              <span className="time-display">{formatTime(duration)}</span>
            </div>

            {/* Volume */}
            <div className="volume-control">
              <Volume2 size={18} color="#86868b" />
              <div
                ref={volumeSliderRef}
                className="volume-slider"
                onMouseDown={handleVolumeMouseDown}
              >
                <div 
                  className="volume-fill"
                  style={{ width: `${volume * 100}%` }}
                />
                <div 
                  className="volume-thumb"
                  style={{ left: `${volume * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
