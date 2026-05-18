'use client';

import { useEffect, useState } from 'react';
import { toast } from '@/app/admin/lib/toast';
import { adminApi } from '@/app/lib/adminApi';
import { Search, ChevronLeft, ChevronRight, Plus, Edit2, Trash2, Music2 } from 'lucide-react';
import CreateGenreModal from './components/CreateGenreModal';
import EditGenreModal from './components/EditGenreModal';
import DeleteConfirmModal from './components/DeleteConfirmModal';

interface Genre {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  _count: {
    tracks: number;
  };
}

export default function GenresPage() {
  const [genres, setGenres] = useState<Genre[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedGenre, setSelectedGenre] = useState<Genre | null>(null);

  useEffect(() => {
    loadGenres();
  }, [page]);

  const loadGenres = async () => {
    setLoading(true);
    try {
      const response = await adminApi.genres.getAll({
        page,
        limit: 20,
        search: search || undefined,
      });

      console.log('[GENRES] Response:', response);

      if (response.success && response.data) {
        const data = response.data as any;
        setGenres(data.genres || []);
        setTotalPages(data.pagination?.totalPages || 1);
      }
    } catch (error) {
      console.error('Error loading genres:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPage(1);
    loadGenres();
  };

  const handleCreate = async (data: any) => {
    const result = await adminApi.genres.create(data);
    if (result.success) {
      loadGenres();
    } else {
      toast(result.error || 'Ошибка создания жанра', 'error');
      throw new Error(result.error);
    }
  };

  const handleUpdate = async (id: string, data: any) => {
    const result = await adminApi.genres.update(id, data);
    if (result.success) {
      loadGenres();
    } else {
      toast(result.error || 'Ошибка обновления жанра', 'error');
      throw new Error(result.error);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!selectedGenre) return;

    console.log('[GENRES PAGE] Deleting genre:', selectedGenre.id, selectedGenre.name);

    try {
      const result = await adminApi.genres.delete(selectedGenre.id);
      
      console.log('[GENRES PAGE] Delete result:', result);

      if (result.success) {
        console.log('[GENRES PAGE] Delete successful');
        setShowDeleteModal(false);
        setSelectedGenre(null);
        loadGenres();
      } else {
        console.error('[GENRES PAGE] Delete failed:', result.error);
        toast(result.error || 'Ошибка удаления жанра', 'error');
      }
    } catch (error: any) {
      console.error('[GENRES PAGE] Delete exception:', error);
      toast('Произошла ошибка при удалении жанра', 'error');
    }
  };

  const openEditModal = (genre: Genre) => {
    setSelectedGenre(genre);
    setShowEditModal(true);
  };

  const openDeleteModal = (genre: Genre) => {
    setSelectedGenre(genre);
    setShowDeleteModal(true);
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            Управление жанрами
          </h1>
          <p className="text-gray-600">
            Всего жанров: {genres.length}
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors shadow-sm"
        >
          <Plus className="w-5 h-5" />
          Добавить жанр
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Поиск по названию, slug или описанию..."
              className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-300 focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 outline-none"
            />
          </div>
          <button
            onClick={handleSearch}
            className="px-6 py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors"
          >
            Поиск
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 border-4 border-gray-300 border-t-gray-900 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Загрузка...</p>
          </div>
        ) : genres.length === 0 ? (
          <div className="p-12 text-center">
            <Music2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">Жанры не найдены</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Жанр</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Slug</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Описание</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Треки</th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-gray-900">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {genres.map((genre) => (
                    <tr key={genre.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {genre.color && (
                            <div
                              className="w-4 h-4 rounded border border-gray-300 flex-shrink-0"
                              style={{ backgroundColor: genre.color }}
                            />
                          )}
                          <p className="font-medium text-gray-900">{genre.name}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-600 font-mono">/{genre.slug}</span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-600 max-w-md truncate">
                          {genre.description || '—'}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          <Music2 className="w-3.5 h-3.5" />
                          {genre._count.tracks}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEditModal(genre)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Редактировать"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openDeleteModal(genre)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Удалить"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  Страница {page} из {totalPages}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modals */}
      <CreateGenreModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreate}
      />

      <EditGenreModal
        isOpen={showEditModal}
        genre={selectedGenre}
        onClose={() => {
          setShowEditModal(false);
          setSelectedGenre(null);
        }}
        onSubmit={handleUpdate}
      />

      <DeleteConfirmModal
        isOpen={showDeleteModal}
        genreName={selectedGenre?.name || ''}
        trackCount={selectedGenre?._count.tracks || 0}
        onClose={() => {
          setShowDeleteModal(false);
          setSelectedGenre(null);
        }}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
