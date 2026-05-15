'use client';

import TrackRow from '../catalog/TrackRow';
import { Track } from '@/app/types';

interface PopularTracksSectionProps {
  tracks: Track[];
  loading: boolean;
  onPlay: (track: Track) => void;
  onLike: (track: Track) => void;
}

export default function PopularTracksSection({ tracks, loading, onPlay, onLike }: PopularTracksSectionProps) {
  return (
    <section className="mb-16">
      <div className="mb-6">
        <h2 className="text-3xl font-semibold text-gray-900">
          Популярные треки
        </h2>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="apple-card p-6 animate-pulse">
              <div className="h-16"></div>
            </div>
          ))}
        </div>
      ) : Array.isArray(tracks) && tracks.length > 0 ? (
        <div className="liquid-glass rounded-3xl p-4">
          <div className="space-y-2">
            {tracks.map((track, index) => (
              <div
                key={track.id}
                className="animate-fadeInUp"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <TrackRow
                  track={track}
                  index={index}
                  onPlay={() => onPlay(track)}
                  onLike={() => onLike(track)}
                />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="liquid-glass rounded-3xl p-12 text-center">
          <p className="text-gray-600 text-lg">Треки появятся здесь</p>
        </div>
      )}
    </section>
  );
}
