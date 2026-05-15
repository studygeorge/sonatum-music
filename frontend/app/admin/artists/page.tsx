'use client';

import { useEffect, useState, useRef } from 'react';
import { adminApi } from '@/app/lib/adminApi';
import { Search, Mic2, CheckCircle, Plus, Edit2, Trash2, Eye, RefreshCw, Loader } from 'lucide-react';

// Импорт модальных компонентов
import CreateArtistModal from './components/CreateArtistModal';
import EditArtistModal from './components/EditArtistModal';
import ViewTracksModal from './components/ViewTracksModal';
import DeleteConfirmModal from './components/DeleteConfirmModal';

interface Artist {
  id: string;
  name: string;
  slug: string;
  bio: string | null;
  avatar: string | null;
  verified: boolean;
  createdAt: string;
  _count: {
    tracks: number;
    followers: number;
  };
}

export default function ArtistsPage() {
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // Состояния модальных окон
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewTracksModal, setShowViewTracksModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedArtist, setSelectedArtist] = useState<Artist | null>(null);

  // Множественный выбор
  const [selectedArtists, setSelectedArtists] = useState<Set<string>>(new Set());

  // Ref для отслеживания скролла
  const observerTarget = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadInitialArtists();
  }, [search]);

  // Intersection Observer для бесконечной прокрутки
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          loadMoreArtists();
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
  }, [hasMore, loadingMore, loading, page, search]);

  const loadInitialArtists = async () => {
    setLoading(true);
    setPage(1);
    setArtists([]);
    setHasMore(true);
    
    try {
      const response = await adminApi.artists.getAll({
        page: 1,
        limit: 20,
        search: search || undefined,
      });

      if (response.success && response.data) {
        const data = response.data as any;
        const fetchedArtists = data.artists || [];
        setArtists(fetchedArtists);
        
        const totalPages = data.pagination?.totalPages || 1;
        setHasMore(totalPages > 1);
        setPage(2);
      }
    } catch (error) {
      console.error('Error loading artists:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMoreArtists = async () => {
    if (!hasMore || loadingMore) return;

    setLoadingMore(true);
    
    try {
      const response = await adminApi.artists.getAll({
        page,
        limit: 20,
        search: search || undefined,
      });

      if (response.success && response.data) {
        const data = response.data as any;
        const fetchedArtists = data.artists || [];
        
        if (fetchedArtists.length === 0) {
          setHasMore(false);
        } else {
          setArtists(prev => [...prev, ...fetchedArtists]);
          setPage(prev => prev + 1);
          
          const totalPages = data.pagination?.totalPages || 1;
          setHasMore(page < totalPages);
        }
      }
    } catch (error) {
      console.error('Error loading more artists:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  // Создание артиста
  const handleCreateArtist = async (formData: any) => {
    const response = await adminApi.artists.create(formData);

    if (response.success) {
      alert('Артист успешно создан');
      await loadInitialArtists();
    } else {
      alert('Ошибка создания артиста: ' + response.error);
    }
  };

  // Обновление артиста
  const handleUpdateArtist = async (artistId: string, formData: any) => {
    const response = await adminApi.artists.update(artistId, formData);

    if (response.success) {
      alert('Артист успешно обновлён');
      await loadInitialArtists();
    } else {
      alert('Ошибка обновления артиста: ' + response.error);
    }
  };

  // Выбор артистов
  const toggleSelectArtist = (artistId: string) => {
    setSelectedArtists(prev => {
      const newSet = new Set(prev);
      if (newSet.has(artistId)) {
        newSet.delete(artistId);
      } else {
        newSet.add(artistId);
      }
      return newSet;
    });
  };

  const selectAllArtists = () => {
    if (selectedArtists.size === artists.length) {
      setSelectedArtists(new Set());
    } else {
      setSelectedArtists(new Set(artists.map(a => a.id)));
    }
  };

  // Удаление артиста
  const handleDeleteSingle = async (artistId: string) => {
    setSelectedArtists(new Set([artistId]));
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    try {
      const idsToDelete = Array.from(selectedArtists);
      
      let successCount = 0;
      let failCount = 0;

      for (const id of idsToDelete) {
        const response = await adminApi.artists.delete(id);
        if (response.success) {
          successCount++;
        } else {
          failCount++;
          console.error(`Failed to delete artist ${id}:`, response.error);
        }
      }

      alert(`Удалено: ${successCount} артистов${failCount > 0 ? `\nОшибок: ${failCount}` : ''}`);
      setSelectedArtists(new Set());
      setShowDeleteConfirm(false);
      await loadInitialArtists();
    } catch (error) {
      console.error('Error deleting artists:', error);
      alert('Произошла ошибка при удалении артистов');
    }
  };

  const openEditModal = (artist: Artist) => {
    setSelectedArtist(artist);
    setShowEditModal(true);
  };

  const openViewTracksModal = (artist: Artist) => {
    setSelectedArtist(artist);
    setShowViewTracksModal(true);
  };

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            Управление артистами
          </h1>
          <p className="text-gray-600">
            Модерация и управление артистами
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Добавить артиста
        </button>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <div className="flex gap-4 flex-1">
            <div className="flex-1 relative max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setSelectedArtists(new Set());
                }}
                placeholder="Поиск артистов..."
                className="w-full pl-11 pr-4 py-2 rounded-xl border border-gray-300 focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 outline-none text-sm"
              />
            </div>

            <button
              onClick={() => {
                loadInitialArtists();
                setSelectedArtists(new Set());
              }}
              className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors text-sm"
            >
              <RefreshCw className="w-4 h-4" />
              Обновить
            </button>
          </div>

          {selectedArtists.size > 0 && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600">
                Выбрано: {selectedArtists.size} / {artists.length}
              </span>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors text-sm"
              >
                <Trash2 className="w-4 h-4" />
                Удалить выбранных
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
        ) : artists.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center">
            <Mic2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">Артисты не найдены</p>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedArtists.size === artists.length && artists.length > 0}
                  onChange={selectAllArtists}
                  className="w-4 h-4 rounded border-gray-300"
                />
                <span className="text-sm font-medium text-gray-700">
                  Выбрать всех загруженных артистов ({artists.length})
                </span>
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {artists.map((artist) => (
                <div key={artist.id} className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-4 mb-4">
                    <input
                      type="checkbox"
                      checked={selectedArtists.has(artist.id)}
                      onChange={() => toggleSelectArtist(artist.id)}
                      className="w-5 h-5 rounded border-gray-300 cursor-pointer mt-1"
                    />

                    <div className="w-20 h-20 rounded-full bg-gray-200 flex-shrink-0 overflow-hidden">
                      {artist.avatar ? (
                        <img 
                          src={artist.avatar} 
                          alt={artist.name} 
                          className="w-full h-full object-cover" 
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Mic2 className="w-10 h-10 text-gray-400" />
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-lg font-semibold text-gray-900 truncate">
                          {artist.name}
                        </h3>
                        {artist.verified && (
                          <CheckCircle className="w-5 h-5 text-blue-500 flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-sm text-gray-600">@{artist.slug}</p>
                    </div>
                  </div>

                  {artist.bio && (
                    <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                      {artist.bio}
                    </p>
                  )}

                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="text-center p-3 bg-gray-50 rounded-xl">
                      <p className="text-2xl font-bold text-gray-900">{artist._count.tracks}</p>
                      <p className="text-xs text-gray-600">Треков</p>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded-xl">
                      <p className="text-2xl font-bold text-gray-900">{artist._count.followers}</p>
                      <p className="text-xs text-gray-600">Подписчиков</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mb-3">
                    <button
                      onClick={() => openViewTracksModal(artist)}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                      title="Просмотр треков"
                    >
                      <Eye className="w-4 h-4" />
                      Треки
                    </button>

                    <button
                      onClick={() => openEditModal(artist)}
                      className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Редактировать"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleDeleteSingle(artist.id)}
                      className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                      title="Удалить"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <p className="text-xs text-gray-500 text-center">
                    Создан: {new Date(artist.createdAt).toLocaleDateString('ru-RU')}
                  </p>
                </div>
              ))}
            </div>

            {/* Индикатор загрузки и триггер для intersection observer */}
            <div ref={observerTarget} className="py-8">
              {loadingMore && (
                <div className="flex flex-col items-center justify-center gap-3">
                  <Loader className="w-8 h-8 text-gray-400 animate-spin" />
                  <p className="text-sm text-gray-600">Загрузка артистов...</p>
                </div>
              )}
              {!hasMore && artists.length > 0 && (
                <div className="text-center">
                  <p className="text-sm text-gray-600">Все артисты загружены ({artists.length})</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Модальные окна */}
      <CreateArtistModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateArtist}
      />

      <EditArtistModal
        isOpen={showEditModal}
        artist={selectedArtist}
        onClose={() => {
          setShowEditModal(false);
          setSelectedArtist(null);
        }}
        onSubmit={handleUpdateArtist}
      />

      <ViewTracksModal
        isOpen={showViewTracksModal}
        artist={selectedArtist}
        onClose={() => {
          setShowViewTracksModal(false);
          setSelectedArtist(null);
        }}
      />

      <DeleteConfirmModal
        isOpen={showDeleteConfirm}
        count={selectedArtists.size}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
