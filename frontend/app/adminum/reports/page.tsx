'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/app/lib/api';
import { authStorage } from '@/app/lib/auth';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function AdminReportsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'OPEN' | 'RESOLVED' | 'DISMISSED' | 'PENDING'>('PENDING');

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
    if (user) fetchReports();
  }, [user, filter]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const res = await api.getAdminReports(filter);
      if (res.success) {
        setReports(res.data);
      }
    } finally {
      setLoading(false);
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
            <h1 className="text-2xl font-bold">Жалобы (Reports)</h1>
            <p className="text-[var(--text-secondary)] text-sm mt-1">
              Модерация пользовательского контента и нарушений.
            </p>
          </div>
          <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
            {(['PENDING', 'RESOLVED', 'DISMISSED'] as const).map(status => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition ${filter === status ? 'bg-white shadow text-black' : 'text-gray-500 hover:text-gray-800'}`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {reports.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-[var(--border)] border-dashed">
            <p className="text-gray-500">В категории «{filter}» нет жалоб.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {reports.map((report) => (
              <div key={report.id} className="bg-white p-6 rounded-2xl border border-[var(--border)] shadow-sm flex flex-col md:flex-row gap-6">
                
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="bg-red-100 text-red-800 text-xs font-bold px-2 py-0.5 rounded uppercase">
                      {report.targetType}
                    </span>
                    <span className="text-xs text-gray-500">{new Date(report.createdAt).toLocaleString()}</span>
                    <span className="text-xs text-gray-500 truncate ml-auto">ID: {report.targetId}</span>
                  </div>
                  
                  <p className="text-sm font-semibold mb-1">Причина жалобы:</p>
                  <p className="text-sm text-gray-800 bg-gray-50 p-3 rounded-lg border border-gray-100">{report.reason}</p>
                  
                  {report.details && (
                    <div className="mt-3">
                      <p className="text-xs font-semibold text-gray-500 mb-1">Дополнительные детали:</p>
                      <p className="text-xs text-gray-600">{report.details}</p>
                    </div>
                  )}
                  
                  <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-3">
                    <span className="text-xs text-gray-500">Подал жалобу:</span>
                    <span className="text-sm font-medium">{report.reporter?.username}</span>
                  </div>
                </div>

                <div className="md:w-64 md:border-l md:border-gray-100 md:pl-6 flex flex-col gap-2">
                  <p className="text-xs font-semibold text-gray-500 mb-1">Действия модератора:</p>
                  <button className="apple-button w-full text-sm bg-blue-600 hover:bg-blue-700 py-2 border-none">
                    Пометить как Resolved
                  </button>
                  <button className="apple-button-secondary w-full text-sm py-2">
                    Пометить как Dismissed
                  </button>
                  <div className="my-2 border-t border-gray-100"></div>
                  {/* Shortcut links based on targetType */}
                  {report.targetType === 'SHEET' && (
                    <Link href={`/sheets/${report.targetId}`} target="_blank" className="text-xs text-center text-blue-600 hover:underline">
                      Смотреть ноты ↗
                    </Link>
                  )}
                  {report.targetType === 'TRACK' && (
                    <Link href={`/tracks/${report.targetId}`} target="_blank" className="text-xs text-center text-blue-600 hover:underline">
                      Слушать трек ↗
                    </Link>
                  )}
                </div>

              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
