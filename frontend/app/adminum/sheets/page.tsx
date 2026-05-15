'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/app/lib/api';
import { authStorage } from '@/app/lib/auth';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function AdminSheetsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [sheets, setSheets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');

  useEffect(() => {
    const cachedUser = authStorage.getUser();
    if (!cachedUser || !['ADMIN', 'MODERATOR'].includes(cachedUser.role)) {
      router.push('/');
      return;
    }
    setUser(cachedUser);
    setAuthLoading(false);
  }, [router]);

  useEffect(() => {
    if (user) fetchSheets();
  }, [user, filter]);

  const fetchSheets = async () => {
    setLoading(true);
    try {
      const res = await api.getAdminSheets(filter);
      if (res.success) {
        setSheets(res.data);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    if (!window.confirm(`Вы уверены, что хотите ${status === 'APPROVED' ? 'одобрить' : 'отклонить'} эти ноты?`)) return;
    
    // Optimistic UI
    setSheets(sheets.filter(s => s.id !== id));
    
    const res = await api.verifySheet(id, status);
    if (!res.success) {
      alert(res.error || 'Ошибка модерации');
      fetchSheets(); // rollback
    }
  };

  if (authLoading || loading) {
    return <div className="min-h-screen pt-32 text-center text-[var(--text-secondary)]">Загрузка панели модератора...</div>;
  }

  return (
    <main className="min-h-screen bg-[var(--background)]">
      <div className="border-b border-[var(--border)] bg-white sticky top-0 z-30 pt-24 pb-6">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Модерация Нотного Архива</h1>
            <p className="text-[var(--text-secondary)] text-sm mt-1">
              Проверка свежих публикаций пользователей на предмет нарушения авторских прав и спама.
            </p>
          </div>
          <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
            {(['PENDING', 'APPROVED', 'REJECTED'] as const).map(status => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition ${filter === status ? 'bg-white shadow text-black' : 'text-gray-500 hover:text-gray-800'}`}
              >
                {status === 'PENDING' ? 'Ожидают' : status === 'APPROVED' ? 'Одобрены' : 'Отклонены'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {sheets.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-[var(--border)] border-dashed">
            <p className="text-gray-500">В категории «{filter}» нет партитур.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-[var(--border)] shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-[var(--border)] text-xs text-gray-500 uppercase tracking-wider">
                  <th className="p-4 font-medium">Публикация</th>
                  <th className="p-4 font-medium">Автор</th>
                  <th className="p-4 font-medium">Дата</th>
                  <th className="p-4 font-medium text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {sheets.map(sheet => (
                  <tr key={sheet.id} className="hover:bg-gray-50 transition">
                    <td className="p-4">
                      <div className="font-medium text-[var(--text-primary)]">{sheet.title}</div>
                      <div className="text-xs text-indigo-600 mt-1">Инструмент: {sheet.instrument}</div>
                    </td>
                    <td className="p-4 text-sm text-[var(--text-secondary)]">
                      {sheet.uploader?.firstName || sheet.uploader?.username} 
                      <div className="text-xs text-gray-400">@{sheet.uploader?.username}</div>
                    </td>
                    <td className="p-4 text-sm text-[var(--text-secondary)]">
                      {new Date(sheet.createdAt).toLocaleDateString()}
                    </td>
                    <td className="p-4 text-right space-x-2">
                      <Link 
                        href={`/sheets/${sheet.id}`} 
                        target="_blank"
                        className="inline-block px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-medium rounded hover:bg-gray-200 transition"
                      >
                        Смотреть PDF
                      </Link>
                      
                      {filter === 'PENDING' && (
                         <>
                           <button 
                             onClick={() => handleVerify(sheet.id, 'APPROVED')}
                             className="px-3 py-1.5 bg-green-100 text-green-700 text-xs font-medium rounded hover:bg-green-200 transition"
                           >
                             Одобрить
                           </button>
                           <button 
                             onClick={() => handleVerify(sheet.id, 'REJECTED')}
                             className="px-3 py-1.5 bg-red-100 text-red-700 text-xs font-medium rounded hover:bg-red-200 transition"
                           >
                             Отклонить
                           </button>
                         </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
