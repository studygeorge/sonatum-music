'use client';

import { useEffect, useState } from 'react';
import { adminApi } from '@/app/lib/adminApi';
import { Search, Edit, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { ruStatus, ruRole, ROLE_LABEL, STATUS_LABEL } from '@/app/admin/lib/labels';

interface User {
  id: string;
  email: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  avatar: string | null;
  role: string;
  status: string;
  createdAt: string;
  lastLoginAt: string | null;
  _count: {
    playlists: number;
    purchases: number;
    likedTracks: number;
  };
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    loadUsers();
  }, [page, roleFilter, statusFilter]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const response = await adminApi.users.getAll({
        page,
        limit: 20,
        search: search || undefined,
        role: roleFilter || undefined,
        status: statusFilter || undefined,
      });

      console.log('[USERS] Response:', response);

      if (response.success && response.data) {
        const data = response.data as any;
        setUsers(data.users || []);
        setTotalPages(data.pagination?.totalPages || 1);
      }
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPage(1);
    loadUsers();
  };

  const handleEdit = (user: User) => {
    setSelectedUser(user);
    setShowEditModal(true);
  };

  const handleUpdateUser = async (updates: { role?: string; status?: string }) => {
    if (!selectedUser) return;

    try {
      const response = await adminApi.users.update(selectedUser.id, updates);
      
      if (response.success) {
        setShowEditModal(false);
        loadUsers();
      }
    } catch (error) {
      console.error('Error updating user:', error);
    }
  };

  const handleDelete = async (userId: string) => {

    try {
      const response = await adminApi.users.delete(userId);
      
      if (response.success) {
        loadUsers();
      }
    } catch (error) {
      console.error('Error deleting user:', error);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-gray-900 mb-2">
          Управление пользователями
        </h1>
        <p className="text-gray-600">
          Всего пользователей: {users.length}
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Поиск по email, имени..."
                className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-300 focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 outline-none"
              />
            </div>
          </div>
          
          <select
            value={roleFilter}
            onChange={(e) => {setRoleFilter(e.target.value); setPage(1);}}
            className="px-4 py-3 rounded-xl border border-gray-300 focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 outline-none"
          >
            <option value="">Все роли</option>
            <option value="USER">{ROLE_LABEL.USER}</option>
            <option value="ARTIST">{ROLE_LABEL.ARTIST}</option>
            <option value="ADMIN">{ROLE_LABEL.ADMIN}</option>
            <option value="SUPER_ADMIN">{ROLE_LABEL.SUPER_ADMIN}</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => {setStatusFilter(e.target.value); setPage(1);}}
            className="px-4 py-3 rounded-xl border border-gray-300 focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 outline-none"
          >
            <option value="">Все статусы</option>
            <option value="ACTIVE">{STATUS_LABEL.ACTIVE}</option>
            <option value="SUSPENDED">{STATUS_LABEL.SUSPENDED}</option>
            <option value="DELETED">{STATUS_LABEL.DELETED}</option>
          </select>
        </div>

        <button
          onClick={handleSearch}
          className="mt-4 px-6 py-2 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors"
        >
          Поиск
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 border-4 border-gray-300 border-t-gray-900 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Загрузка...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-600">Пользователи не найдены</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Пользователь</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Email</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Роль</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Статус</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Активность</th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-gray-900">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                            {user.avatar ? (
                              <img src={user.avatar} alt="" className="w-10 h-10 rounded-full" />
                            ) : (
                              <span className="text-gray-600 font-medium">
                                {(user.firstName?.[0] || user.email[0]).toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">
                              {user.firstName && user.lastName 
                                ? `${user.firstName} ${user.lastName}`
                                : user.username || 'Без имени'}
                            </p>
                            <p className="text-sm text-gray-500">
                              {user._count.playlists} плейлистов · {user._count.likedTracks} лайков
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{user.email}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          user.role === 'SUPER_ADMIN' || user.role === 'ADMIN' ? 'bg-black text-white' :
                          user.role === 'ARTIST' ? 'bg-gray-700 text-white' :
                          'bg-gray-100 text-gray-900'
                        }`}>
                          {ruRole(user.role)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          user.status === 'ACTIVE' ? 'bg-black text-white' :
                          user.status === 'SUSPENDED' ? 'bg-white text-black border-2 border-black' :
                          'bg-gray-200 text-gray-500'
                        }`}>
                          {ruStatus(user.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {user.lastLoginAt 
                          ? new Date(user.lastLoginAt).toLocaleDateString('ru-RU')
                          : 'Никогда'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEdit(user)}
                            className="p-2 text-gray-700 hover:bg-gray-100 hover:text-black rounded-lg transition-colors"
                            title="Редактировать"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(user.id)}
                            className="p-2 text-gray-700 hover:bg-gray-100 hover:text-black rounded-lg transition-colors"
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
          </>
        )}
      </div>

      {/* Edit Modal */}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              Редактировать пользователя
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Роль
                </label>
                <select
                  defaultValue={selectedUser.role}
                  onChange={(e) => handleUpdateUser({ role: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 outline-none"
                >
                  <option value="USER">{ROLE_LABEL.USER}</option>
                  <option value="ARTIST">{ROLE_LABEL.ARTIST}</option>
                  <option value="ADMIN">{ROLE_LABEL.ADMIN}</option>
                  <option value="SUPER_ADMIN">{ROLE_LABEL.SUPER_ADMIN}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Статус
                </label>
                <select
                  defaultValue={selectedUser.status}
                  onChange={(e) => handleUpdateUser({ status: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 outline-none"
                >
                  <option value="ACTIVE">{STATUS_LABEL.ACTIVE}</option>
                  <option value="SUSPENDED">{STATUS_LABEL.SUSPENDED}</option>
                  <option value="DELETED">{STATUS_LABEL.DELETED}</option>
                </select>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowEditModal(false)}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
