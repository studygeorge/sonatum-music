'use client';

import { useEffect, useState } from 'react';
import { X, Music, ExternalLink } from 'lucide-react';
import { adminApi } from '@/app/lib/adminApi';

interface Artist {
  id: string;
  name: string;
  slug: string;
}

interface Track {
  id: string;
  title: string;
  slug: string;
  duration: number;
  cover: string | null;
  status: string;
  createdAt: string;
  artistId: string;
  _count: {
    likedBy: number;
    purchases: number;
  };
}

interface ViewTracksModalProps {
  isOpen: boolean;
  artist: Artist | null;
  onClose: () => void;
}

export default function ViewTracksModal({
  isOpen,
  artist,
  onClose
}: ViewTracksModalProps) {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && artist) {
      loadTracks();
    } else {
      setTracks([]);
    }
  }, [isOpen, artist]);

  const loadTracks = async () => {
    if (!artist) return;

    setLoading(true);
    try {
      console.log('[VIEW TRACKS MODAL] Loading tracks for artist:', {
        id: artist.id,
        name: artist.name,
        slug: artist.slug
      });

      const response = await adminApi.tracks.getAll({
        artistId: artist.id,
        limit: 100
      });

      console.log('[VIEW TRACKS MODAL] API Response:', response);

      if (response.success && response.data) {
        const data = response.data as any;
        const fetchedTracks = data.tracks || [];
        
        console.log('[VIEW TRACKS MODAL] Fetched tracks:', {
          count: fetchedTracks.length,
          tracks: fetchedTracks.map((t: Track) => ({
            id: t.id,
            title: t.title,
            artistId: t.artistId
          }))
        });

        // Фильтруем на клиенте для дополнительной проверки
        const filteredTracks = fetchedTracks.filter((t: Track) => t.artistId === artist.id);
        
        console.log('[VIEW TRACKS MODAL] After filtering:', {
          before: fetchedTracks.length,
          after: filteredTracks.length
        });

        setTracks(filteredTracks);
      } else {
        console.error('[VIEW TRACKS MODAL] API Error:', response.error);
        setTracks([]);
      }
    } catch (error) {
      console.error('[VIEW TRACKS MODAL] Exception:', error);
      setTracks([]);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isOpen || !artist) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">
              Треки артиста
            </h2>
            <p className="text-gray-600 mt-1">{artist.name}</p>
            <p className="text-xs text-gray-500 mt-1">ID: {artist.id}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-12 h-12 border-4 border-gray-300 border-t-gray-900 rounded-full animate-spin mb-4"></div>
              <p className="text-gray-600">Загрузка треков...</p>
            </div>
          ) : tracks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Music className="w-16 h-16 text-gray-300 mb-4" />
              <p className="text-gray-600">У артиста пока нет треков</p>
            </div>
          ) : (
            <div className="space-y-3">
              {tracks.map((track) => (
                <div key={track.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                  <div className="w-16 h-16 rounded-lg bg-gray-200 flex-shrink-0 overflow-hidden">
                    {track.cover ? (
                      <img 
                        src={track.cover.startsWith('http') ? track.cover : `https://sonatum-music.ru${track.cover}`}
                        alt={track.title} 
                        className="w-full h-full object-cover" 
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Music className="w-6 h-6 text-gray-400" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-gray-900 truncate">
                      {track.title}
                    </h4>
                    <div className="flex items-center gap-3 text-sm text-gray-600 mt-1">
                      <span>{formatDuration(track.duration)}</span>
                      <span>•</span>
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        track.status === 'PUBLISHED' ? 'bg-[var(--background)] text-[var(--text-secondary)] border border-[var(--border)]' :
                        track.status === 'PENDING' ? 'bg-[var(--background)] text-[var(--text-secondary)] border border-[var(--border)]' :
                        'bg-[var(--background)] text-[var(--text-secondary)] border border-[var(--border)]'
                      }`}>
                        {track.status}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <div className="text-center">
                      <p className="font-medium text-gray-900">{track._count.likedBy}</p>
                      <p className="text-xs">лайков</p>
                    </div>
                    <div className="text-center">
                      <p className="font-medium text-gray-900">{track._count.purchases}</p>
                      <p className="text-xs">покупок</p>
                    </div>
                  </div>

                  <a
                    href={`/admin/tracks?trackId=${track.id}`}
                    className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-lg transition-colors"
                    title="Открыть в треках"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-6 border-t bg-gray-50">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-gray-600">
              Всего треков: {tracks.length}
            </p>
            <button
              onClick={loadTracks}
              className="text-sm text-blue-600 hover:text-blue-700 underline"
            >
              Обновить
            </button>
          </div>
          <button
            onClick={onClose}
            className="w-full px-4 py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}