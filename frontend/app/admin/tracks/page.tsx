'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { toast } from '@/app/admin/lib/toast';
import { adminApi } from '@/app/lib/adminApi';
import { Search, CheckCircle, XCircle, ChevronLeft, ChevronRight, Music, Plus, X, Play, Pause, Volume2, VolumeX, RefreshCw, Edit2, Trash2, Loader } from 'lucide-react';

// Импорт модальных компонентов
import CreateTrackModal from './components/CreateTrackModal';
import EditTrackModal from './components/EditTrackModal';
import RejectTrackModal from './components/RejectTrackModal';
import DeleteConfirmModal from './components/DeleteConfirmModal';
import ArtistDetailDrawer from '../components/ArtistDetailDrawer';
import { ruStatus } from '@/app/admin/lib/labels';

interface Track {
  id: string;
  title: string;
  slug: string;
  duration: number;
  audioUrl: string;
  cover: string | null;
  status: string;
  createdAt: string;
  artistId: string;
  artist: {
    id: string;
    name: string;
    slug: string;
    verified: boolean;
    user: {
      email: string;
      username: string | null;
    };
  };
  album: {
    title: string;
  } | null;
  genres: Array<{
    genre: {
      id: string;
      name: string;
      slug: string;
      color: string;
    };
  }>;
  _count: {
    purchases: number;
    likedBy: number;
  };
  metadata?: any;
}

interface Artist {
  id: string;
  name: string;
  slug: string;
}

interface Genre {
  id: string;
  name: string;
  slug: string;
}

export default function TracksPage() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  
  // Состояния модальных окон
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);

  // Drawer профиля артиста (открывается по клику на имя)
  const [artistDrawerId, setArtistDrawerId] = useState<string | null>(null);

  // Множественный выбор
  const [selectedTracks, setSelectedTracks] = useState<Set<string>>(new Set());
  
  // Состояние плеера
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [artists, setArtists] = useState<Artist[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);

  // Ref для отслеживания скролла
  const observerTarget = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadInitialTracks();
  }, [statusFilter]);

  useEffect(() => {
    loadArtistsAndGenres();
  }, []);

  useEffect(() => {
    const audio = new Audio();
    audio.volume = volume;
    
    audio.addEventListener('timeupdate', () => {
      setCurrentTime(audio.currentTime);
    });

    audio.addEventListener('loadedmetadata', () => {
      setDuration(audio.duration);
    });

    audio.addEventListener('ended', () => {
      setPlayingTrackId(null);
      setCurrentTime(0);
    });

    audioRef.current = audio;

    return () => {
      audio.pause();
      audio.src = '';
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // Intersection Observer для бесконечной прокрутки
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          loadMoreTracks();
        }
      },
      { threshold: 0.1 }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [hasMore, loadingMore, loading, page, statusFilter]);

  const loadInitialTracks = async () => {
    setLoading(true);
    setPage(1);
    setTracks([]);
    setHasMore(true);
    
    try {
      const response = await adminApi.tracks.getAll({
        page: 1,
        limit: 20,
        status: statusFilter || undefined,
      });

      if (response.success && response.data) {
        const data = response.data as any;
        const fetchedTracks = data.tracks || [];
        setTracks(fetchedTracks);
        
        const totalPages = data.pagination?.totalPages || 1;
        setHasMore(totalPages > 1);
        setPage(2);
      }
    } catch (error) {
      console.error('Error loading tracks:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMoreTracks = async () => {
    if (!hasMore || loadingMore) return;

    setLoadingMore(true);
    
    try {
      const response = await adminApi.tracks.getAll({
        page,
        limit: 20,
        status: statusFilter || undefined,
      });

      if (response.success && response.data) {
        const data = response.data as any;
        const fetchedTracks = data.tracks || [];
        
        if (fetchedTracks.length === 0) {
          setHasMore(false);
        } else {
          setTracks(prev => [...prev, ...fetchedTracks]);
          setPage(prev => prev + 1);
          
          const totalPages = data.pagination?.totalPages || 1;
          setHasMore(page < totalPages);
        }
      }
    } catch (error) {
      console.error('Error loading more tracks:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  const loadArtistsAndGenres = async () => {
    try {
      const [artistsRes, genresRes] = await Promise.all([
        adminApi.artists.getAll({ limit: 1000 }),
        adminApi.genres.getAll({ limit: 1000 })
      ]);

      if (artistsRes.success && artistsRes.data) {
        const data = artistsRes.data as any;
        setArtists(data.artists || []);
      }

      if (genresRes.success && genresRes.data) {
        const data = genresRes.data as any;
        setGenres(data.genres || []);
      }
    } catch (error) {
      console.error('Error loading artists/genres:', error);
    }
  };

  // Управление плеером
  const togglePlay = (track: Track) => {
    if (!audioRef.current) return;

    if (playingTrackId === track.id) {
      audioRef.current.pause();
      setPlayingTrackId(null);
      return;
    }

    if (!track.audioUrl) {
      toast(
        `У трека "${track.title}" не привязан аудиофайл (audioUrl пустой).\n\n` +
        `Откройте трек на редактирование (карандашик) и укажите правильный URL,\n` +
        `или удалите запись и попросите автора перезагрузить.`
      );
      return;
    }

    const audioUrl = track.audioUrl.startsWith('http')
      ? track.audioUrl
      : `${window.location.origin}${track.audioUrl}`;

    console.log('[PLAYER] Attempting to play:', audioUrl);

    audioRef.current.src = audioUrl;
    audioRef.current.play().catch(err => {
      console.error('[PLAYER] Error playing audio:', err);
      toast(`Не удалось воспроизвести трек.\nURL: ${audioUrl}\n\nОшибка: ${err?.message || err}`, 'error');
    });
    setPlayingTrackId(track.id);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value);
    setVolume(vol);
    if (isMuted) {
      setIsMuted(false);
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  // Создание трека
  const handleCreateTrack = async (formData: any) => {
    const response = await adminApi.tracks.create(formData);

    if (response.success) {
      toast('Трек успешно создан', 'success');
      await loadInitialTracks();
    } else {
      toast('Ошибка создания трека: ' + response.error, 'error');
    }
  };

  // Обновление трека
  const handleUpdateTrack = async (trackId: string, formData: any) => {
    const response = await adminApi.tracks.update(trackId, formData);

    if (response.success) {
      toast('Трек успешно обновлён', 'success');
      await loadInitialTracks();
    } else {
      toast('Ошибка обновления трека: ' + response.error, 'error');
    }
  };

  // Одобрение трека
  const handleApprove = async (trackId: string) => {

    try {
      const response = await adminApi.tracks.approve(trackId);
      
      if (response.success) {
        toast('Трек успешно одобрен', 'success');
        loadInitialTracks();
      } else {
        toast('Ошибка: ' + response.error, 'error');
      }
    } catch (error) {
      console.error('Error approving track:', error);
      toast('Произошла ошибка при одобрении трека', 'error');
    }
  };

  // Отклонение трека
  const handleReject = async (trackId: string, reason: string) => {
    const response = await adminApi.tracks.reject(trackId, reason);

    if (response.success) {
      toast('Трек отклонён');
      loadInitialTracks();
    } else {
      toast('Ошибка: ' + response.error, 'error');
    }
  };

  // Одобрение/отклонение ПРАВОК для опубликованного трека
  // (metadata.pendingChanges, не сам status)
  const callPending = async (trackId: string, action: 'approve' | 'reject') => {
    const token = localStorage.getItem('sonatum_token');
    const r = await fetch(`/api/admin/tracks/${trackId}/${action}-pending`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
    const j = await r.json().catch(() => ({}));
    return j;
  };
  const handleApprovePending = async (trackId: string) => {
    const j = await callPending(trackId, 'approve');
    if (j.success) {
      toast('Правки применены к публикации', 'success');
      loadInitialTracks();
    } else {
      toast(j.error || 'Ошибка применения правок', 'error');
    }
  };
  const handleRejectPending = async (trackId: string) => {
    const j = await callPending(trackId, 'reject');
    if (j.success) {
      toast('Правки отклонены', 'success');
      loadInitialTracks();
    } else {
      toast(j.error || 'Ошибка отклонения правок', 'error');
    }
  };

  // Выбор треков
  const toggleSelectTrack = (trackId: string) => {
    setSelectedTracks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(trackId)) {
        newSet.delete(trackId);
      } else {
        newSet.add(trackId);
      }
      return newSet;
    });
  };

  const selectAllTracks = () => {
    if (selectedTracks.size === tracks.length) {
      setSelectedTracks(new Set());
    } else {
      setSelectedTracks(new Set(tracks.map(t => t.id)));
    }
  };

  // Удаление трека
  const handleDeleteSingle = async (trackId: string) => {
    setSelectedTracks(new Set([trackId]));
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    try {
      const idsToDelete = Array.from(selectedTracks);
      
      let successCount = 0;
      let failCount = 0;

      for (const id of idsToDelete) {
        const response = await adminApi.tracks.delete(id);
        if (response.success) {
          successCount++;
        } else {
          failCount++;
          console.error(`Failed to delete track ${id}:`, response.error);
        }
      }

      toast(`Удалено: ${successCount} треков${failCount > 0 ? `\nОшибок: ${failCount}` : ''}`, 'success');
      setSelectedTracks(new Set());
      setShowDeleteConfirm(false);
      await loadInitialTracks();
    } catch (error) {
      console.error('Error deleting tracks:', error);
      toast('Произошла ошибка при удалении треков', 'error');
    }
  };

  const openEditModal = (track: Track) => {
    setSelectedTrack(track);
    setShowEditModal(true);
  };

  const openRejectModal = (track: Track) => {
    setSelectedTrack(track);
    setShowRejectModal(true);
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            Управление треками
          </h1>
          <p className="text-gray-600">
            Модерация и управление музыкальными треками
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Добавить трек
        </button>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <div className="flex gap-4">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setSelectedTracks(new Set());
              }}
              className="px-4 py-2 rounded-xl border border-gray-300 focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 outline-none text-sm"
            >
              <option value="">Все статусы</option>
              <option value="PENDING">На модерации</option>
              <option value="PUBLISHED">Опубликованные</option>
              <option value="REJECTED">Отклонённые</option>
            </select>

            <button
              onClick={() => {
                loadInitialTracks();
                setSelectedTracks(new Set());
              }}
              className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors text-sm"
            >
              <RefreshCw className="w-4 h-4" />
              Обновить
            </button>
          </div>

          {selectedTracks.size > 0 && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600">
                Выбрано: {selectedTracks.size} / {tracks.length}
              </span>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-xl hover:bg-gray-800 transition-colors text-sm"
              >
                <Trash2 className="w-4 h-4" />
                Удалить выбранные
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="bg-white rounded-2xl p-12 text-center">
            <div className="w-12 h-12 border-4 border-gray-300 border-t-gray-900 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Загрузка...</p>
          </div>
        ) : tracks.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center">
            <Music className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">Треки не найдены</p>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedTracks.size === tracks.length && tracks.length > 0}
                  onChange={selectAllTracks}
                  className="w-4 h-4 rounded border-gray-300"
                />
                <span className="text-sm font-medium text-gray-700">
                  Выбрать все загруженные треки ({tracks.length})
                </span>
              </label>
            </div>

            {tracks.map((track) => (
              <div key={track.id} className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start gap-6">
                  <div className="flex items-center gap-4">
                    <input
                      type="checkbox"
                      checked={selectedTracks.has(track.id)}
                      onChange={() => toggleSelectTrack(track.id)}
                      className="w-5 h-5 rounded border-gray-300 cursor-pointer"
                    />

                    <div className="w-24 h-24 rounded-xl bg-gray-200 flex-shrink-0 overflow-hidden relative group">
                      {track.cover ? (
                        <img 
                          src={track.cover.startsWith('http') ? track.cover : `https://sonatum-music.ru${track.cover}`} 
                          alt={track.title} 
                          className="w-full h-full object-cover" 
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Music className="w-10 h-10 text-gray-400" />
                        </div>
                      )}
                      
                      <button
                        onClick={() => togglePlay(track)}
                        className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        {playingTrackId === track.id ? (
                          <Pause className="w-10 h-10 text-white" fill="white" />
                        ) : (
                          <Play className="w-10 h-10 text-white" fill="white" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div>
                        <h3 className="text-xl font-semibold text-gray-900 mb-1">
                          {track.title}
                        </h3>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <button
                            type="button"
                            onClick={() => setArtistDrawerId(track.artist.id)}
                            className="font-medium text-gray-900 underline decoration-gray-400 hover:decoration-black underline-offset-2 transition-colors"
                            title="Открыть профиль артиста"
                          >
                            {track.artist.name}
                          </button>
                          {track.artist.verified && (
                            <CheckCircle className="w-4 h-4 text-black" />
                          )}
                          {track.artist.user?.email && (
                            <span className="text-xs text-gray-400">· {track.artist.user.email}</span>
                          )}
                          {track.album && (
                            <>
                              <span>•</span>
                              <span>{track.album.title}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* PUBLISHED + pendingChanges → отдельный бейдж '"'"'На модерации'"'"' */}
                        {track.status === 'PUBLISHED' && track.metadata?.hasPendingChanges && (
                          <span className="px-3 py-1 rounded-full text-sm font-medium whitespace-nowrap bg-gray-700 text-white">
                            На модерации
                          </span>
                        )}
                        <span className={`px-3 py-1 rounded-full text-sm font-medium whitespace-nowrap ${
                          track.status === 'PUBLISHED' ? 'bg-black text-white' :
                          track.status === 'PENDING' ? 'bg-gray-700 text-white' :
                          track.status === 'REJECTED' ? 'bg-white text-black border-2 border-black' :
                          'bg-gray-200 text-gray-900'
                        }`}>
                          {ruStatus(track.status)}
                        </span>

                        <button
                          onClick={() => openEditModal(track)}
                          className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                          title="Редактировать"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => handleDeleteSingle(track.id)}
                          className="p-2 text-gray-700 hover:text-black hover:bg-gray-100 rounded-lg transition-colors"
                          title="Удалить"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {playingTrackId === track.id && (
                      <div className="bg-gray-50 rounded-lg p-3 mb-3">
                        <div className="flex items-center gap-3 mb-2">
                          <button
                            onClick={() => togglePlay(track)}
                            className="p-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
                          >
                            {playingTrackId === track.id ? (
                              <Pause className="w-4 h-4" />
                            ) : (
                              <Play className="w-4 h-4" />
                            )}
                          </button>

                          <div className="flex-1">
                            <input
                              type="range"
                              min="0"
                              max={duration || 0}
                              value={currentTime}
                              onChange={handleSeek}
                              className="w-full h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer slider"
                            />
                          </div>

                          <span className="text-sm text-gray-600 font-mono whitespace-nowrap">
                            {formatTime(currentTime)} / {formatTime(duration)}
                          </span>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={toggleMute}
                              className="p-1 text-gray-600 hover:text-gray-900"
                            >
                              {isMuted ? (
                                <VolumeX className="w-5 h-5" />
                              ) : (
                                <Volume2 className="w-5 h-5" />
                              )}
                            </button>
                            <input
                              type="range"
                              min="0"
                              max="1"
                              step="0.01"
                              value={volume}
                              onChange={handleVolumeChange}
                              className="w-20 h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {track.genres.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {track.genres.map((g) => (
                          <span
                            key={g.genre.id}
                            className="px-2 py-1 rounded-lg text-xs font-medium"
                            style={{ 
                              backgroundColor: `${g.genre.color}20`, 
                              color: g.genre.color 
                            }}
                          >
                            {g.genre.name}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mb-4">
                      <span>Длительность: {formatDuration(track.duration)}</span>
                      <span>Лайков: {track._count.likedBy}</span>
                      <span>Покупок: {track._count.purchases}</span>
                      <span>Дата: {new Date(track.createdAt).toLocaleDateString('ru-RU')}</span>
                    </div>

                    {track.status === 'PENDING' && (
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleApprove(track.id)}
                          className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-xl hover:bg-gray-800 transition-colors text-sm"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Одобрить
                        </button>
                        <button
                          onClick={() => openRejectModal(track)}
                          className="flex items-center gap-2 px-4 py-2 bg-white text-black border-2 border-black rounded-xl hover:bg-gray-100 transition-colors text-sm"
                        >
                          <XCircle className="w-4 h-4" />
                          Отклонить
                        </button>
                      </div>
                    )}

                    {/* Опубликованный трек с правками — детальный diff + действия */}
                    {track.status === 'PUBLISHED' && track.metadata?.hasPendingChanges && (
                      <PendingChangesPanel
                        track={track}
                        onApprove={() => handleApprovePending(track.id)}
                        onReject={() => handleRejectPending(track.id)}
                      />
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* Индикатор загрузки и триггер для intersection observer */}
            <div ref={observerTarget} className="py-8">
              {loadingMore && (
                <div className="flex flex-col items-center justify-center gap-3">
                  <Loader className="w-8 h-8 text-gray-400 animate-spin" />
                  <p className="text-sm text-gray-600">Загрузка треков...</p>
                </div>
              )}
              {!hasMore && tracks.length > 0 && (
                <div className="text-center">
                  <p className="text-sm text-gray-600">Все треки загружены ({tracks.length})</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Модальные окна */}
      <CreateTrackModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateTrack}
        artists={artists}
        genres={genres}
      />

      <EditTrackModal
        isOpen={showEditModal}
        track={selectedTrack}
        onClose={() => {
          setShowEditModal(false);
          setSelectedTrack(null);
        }}
        onSubmit={handleUpdateTrack}
        artists={artists}
        genres={genres}
      />

      <RejectTrackModal
        isOpen={showRejectModal}
        track={selectedTrack}
        onClose={() => {
          setShowRejectModal(false);
          setSelectedTrack(null);
        }}
        onSubmit={handleReject}
      />

      <DeleteConfirmModal
        isOpen={showDeleteConfirm}
        count={selectedTracks.size}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={confirmDelete}
      />

      {/* Drawer: профиль артиста (открывается по клику на имя) */}
      <ArtistDetailDrawer
        artistId={artistDrawerId}
        onClose={() => setArtistDrawerId(null)}
      />

      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #111827;
          cursor: pointer;
        }

        .slider::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #111827;
          cursor: pointer;
          border: none;
        }
      `}</style>
    </div>
  );
}


// ----------------------------------------------------------------------------
// Панель с детальным diff правок опубликованного трека:
// показывает каждое изменённое поле (старое значение → новое значение),
// для файлов (cover, audioUrl, instrumentalUrl, sheetUrl) — кликабельные
// ссылки, для PDF — превью в iframe.
// ----------------------------------------------------------------------------

const FIELD_LABEL: Record<string, string> = {
  title: "Название",
  lyrics: "Текст",
  cover: "Обложка",
  price: "Цена основной (₽)",
  instrumentalPrice: "Цена минусовки (₽)",
  isForSale: "Продаётся",
  isFree: "Бесплатно",
  bpm: "BPM",
  key: "Тональность",
  releaseDate: "Дата релиза",
  audioUrl: "Основной аудиофайл",
  instrumentalUrl: "Минусовка",
  audioType: "Тип аудио",
  sheetUrl: "Ноты (PDF)",
  sheetInstrument: "Инструмент нот",
  sheetDifficulty: "Сложность нот",
  sheetPrice: "Цена нот (₽)",
  sheetIsPublicDomain: "Ноты — общественное достояние",
  era: "Эпоха",
  mood: "Настроение",
  instruments: "Инструменты",
  difficulty: "Сложность",
  tempo: "Темп",
  recordingYear: "Год записи",
  recordingPlace: "Место записи",
  originalComposer: "Автор оригинала",
  contentType: "Тип контента",
  allowDonations: "Принимать донаты",
  allowExclusive: "Эксклюзивная лицензия",
};

// Переводы значений enum-ов
const VALUE_LABELS: Record<string, Record<string, string>> = {
  audioType: {
    FULL: "Полная",
    INSTRUMENTAL: "Минусовка",
    BOTH: "Полная + минусовка",
  },
  difficulty: {
    BEGINNER: "Начальный",
    INTERMEDIATE: "Средний",
    ADVANCED: "Продвинутый",
  },
  sheetDifficulty: {
    BEGINNER: "Начальный",
    INTERMEDIATE: "Средний",
    ADVANCED: "Продвинутый",
  },
  contentType: {
    ORIGINAL: "Оригинал",
    COVER: "Кавер",
    SHEET_ONLY: "Только ноты",
  },
};

function fmtValue(v: any, field?: string): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "да" : "нет";
  if (Array.isArray(v)) return v.length ? v.join(", ") : "—";
  if (typeof v === "object") return JSON.stringify(v);
  const s = String(v);
  // Переводим enum-значения если есть словарь для этого поля
  if (field && VALUE_LABELS[field] && VALUE_LABELS[field][s]) {
    return VALUE_LABELS[field][s];
  }
  // Даты в ISO → русский формат
  if (field === "releaseDate" && /^\d{4}-\d{2}-\d{2}/.test(s)) {
    try { return new Date(s).toLocaleDateString("ru-RU"); } catch {}
  }
  return s;
}

function isFileField(k: string) {
  return ["cover", "audioUrl", "instrumentalUrl", "sheetUrl"].includes(k);
}

function PendingChangesPanel({
  track,
  onApprove,
  onReject,
}: {
  track: any;
  onApprove: () => void;
  onReject: () => void;
}) {
  const [showPdf, setShowPdf] = useState(false);
  const pc = track.metadata?.pendingChanges || {};
  const keys = Object.keys(pc);

  return (
    <div className="mt-3 pt-3 border-t border-gray-200 space-y-3">
      <div className="text-sm font-medium text-gray-900">
        Автор внёс правки в опубликованный трек
      </div>

      {keys.length === 0 ? (
        <div className="text-xs text-gray-500">Нет данных о правках</div>
      ) : (
        <div className="bg-gray-50 border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-xs text-gray-500 uppercase">
              <tr>
                <th className="text-left px-3 py-2">Поле</th>
                <th className="text-left px-3 py-2">Было</th>
                <th className="text-left px-3 py-2">Станет</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => {
                const newVal = pc[k];
                const oldVal =
                  k === "sheetUrl"
                    ? track.sheetMusic?.pdfUrl ?? null
                    : track[k] ?? null;
                const file = isFileField(k);
                return (
                  <tr key={k} className="border-t border-gray-200">
                    <td className="px-3 py-2 align-top font-medium text-gray-900">
                      {FIELD_LABEL[k] || k}
                    </td>
                    <td className="px-3 py-2 align-top text-gray-700">
                      {file && oldVal ? (
                        <a href={String(oldVal)} target="_blank" rel="noreferrer" className="underline text-gray-700 hover:text-black break-all">
                          открыть текущий
                        </a>
                      ) : (
                        <span className="break-all">{fmtValue(oldVal, k)}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 align-top text-gray-900">
                      {file && newVal ? (
                        <div className="space-y-1">
                          <a href={String(newVal)} target="_blank" rel="noreferrer" className="underline font-medium text-gray-900 hover:text-black break-all">
                            открыть новый
                          </a>
                          {k === "sheetUrl" && (
                            <button
                              onClick={() => setShowPdf((v) => !v)}
                              className="block text-xs text-gray-500 underline hover:text-black">
                              {showPdf ? "скрыть превью" : "показать превью PDF"}
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="break-all">{fmtValue(newVal, k)}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Превью PDF для нот */}
      {showPdf && pc.sheetUrl && (
        <div className="bg-white border border-gray-300 rounded-xl overflow-hidden">
          <div className="px-3 py-2 bg-gray-100 border-b border-gray-200 text-xs text-gray-700 flex items-center justify-between">
            <span>Превью нот · {pc.sheetUrl}</span>
            <a href={pc.sheetUrl} target="_blank" rel="noreferrer" className="underline">скачать</a>
          </div>
          <iframe src={pc.sheetUrl} className="w-full h-[600px]" />
        </div>
      )}

      <div className="flex gap-3 pt-1 flex-wrap">
        <button
          onClick={onApprove}
          className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-xl hover:bg-gray-800 transition-colors text-sm">
          <CheckCircle className="w-4 h-4" />
          Одобрить правки
        </button>
        <button
          onClick={onReject}
          className="flex items-center gap-2 px-4 py-2 bg-white text-black border-2 border-black rounded-xl hover:bg-gray-100 transition-colors text-sm">
          <XCircle className="w-4 h-4" />
          Отклонить правки
        </button>
      </div>
    </div>
  );
}

