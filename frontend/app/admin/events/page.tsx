'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { authStorage } from '@/app/lib/auth';

type Event = {
  id: string;
  authorName: string;
  authorEmail: string;
  posterUrl: string | null;
  title: string;
  startsAt: string;
  venueCity: string | null;
  venueName: string | null;
  description: string | null;
  status: string;
  rejectionReason: string | null;
  createdAt: string;
};

const STATUS_LABEL: Record<string, { l: string; c: string }> = {
  PENDING: { l: 'На модерации', c: 'bg-amber-100 text-amber-700' },
  APPROVED: { l: 'Одобрено', c: 'bg-green-100 text-green-700' },
  REJECTED: { l: 'Отклонено', c: 'bg-red-100 text-red-700' },
  DRAFT: { l: 'Черновик', c: 'bg-gray-100 text-gray-700' },
};

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

export default function AdminEventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL'>('PENDING');
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const load = () => {
    const qs = filter === 'ALL' ? '?admin=1' : `?admin=1&status=${filter}`;
    fetch(`/api/events${qs}`, {
      headers: { Authorization: `Bearer ${authStorage.getToken() || ''}` },
    })
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setEvents(j.data || []);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setLoading(true);
    load();
  }, [filter]);

  const approve = async (id: string) => {
    await fetch(`/api/events/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authStorage.getToken() || ''}`,
      },
      body: JSON.stringify({ action: 'APPROVE' }),
    });
    load();
  };

  const reject = async (id: string) => {
    await fetch(`/api/events/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authStorage.getToken() || ''}`,
      },
      body: JSON.stringify({ action: 'REJECT', reason: reason.trim() || 'Не соответствует правилам' }),
    });
    setRejecting(null);
    setReason('');
    load();
  };

  return (
    <main className="min-h-screen pt-6 md:pt-10 pb-20 px-4 md:px-8 max-w-7xl mx-auto space-y-6">
      <section
        className="relative rounded-3xl overflow-hidden p-7 md:p-10 text-white"
        style={{ background: 'linear-gradient(135deg, #1d4cb8 0%, #2f9e8f 55%, #e6e6e6 100%)' }}>
        <div className="relative z-10 max-w-2xl">
          <div className="text-xs uppercase tracking-widest font-semibold mb-2 opacity-90">
            Админ · События
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">Модерация афиши</h1>
          <p className="text-sm md:text-base text-white/85 mt-2">
            Одобрите или отклоните события от авторов.
          </p>
        </div>
      </section>
      <div className="flex gap-2 overflow-x-auto">
        {[
          { v: 'PENDING', l: 'На модерации' },
          { v: 'APPROVED', l: 'Одобренные' },
          { v: 'REJECTED', l: 'Отклонённые' },
          { v: 'ALL', l: 'Все' },
        ].map((f) => (
          <button
            key={f.v}
            onClick={() => setFilter(f.v as any)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              filter === f.v
                ? 'bg-[var(--text-primary)] text-white'
                : 'bg-[var(--hover)] text-[var(--text-primary)] hover:bg-[var(--border)]'
            }`}>
            {f.l}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="text-center text-[var(--text-secondary)] py-12">Загрузка…</div>
      ) : events.length === 0 ? (
        <div className="apple-card p-10 text-center text-[var(--text-secondary)]">Нет событий</div>
      ) : (
        <div className="space-y-3">
          {events.map((e) => {
            const s = STATUS_LABEL[e.status] || STATUS_LABEL.PENDING;
            return (
              <div key={e.id} className="rounded-2xl border border-[var(--border)] bg-white p-4 flex gap-4 flex-col sm:flex-row">
                {e.posterUrl && (
                  <div className="w-full sm:w-48 aspect-video bg-gray-100 rounded-xl overflow-hidden shrink-0">
                    <img src={e.posterUrl} alt="" className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-1 flex-wrap">
                    <h3 className="font-bold text-base flex-1">{e.title}</h3>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full ${s.c} shrink-0`}>{s.l}</span>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] mb-1">
                    {fmtDate(e.startsAt)} · {[e.venueName, e.venueCity].filter(Boolean).join(', ') || '—'}
                  </p>
                  <p className="text-xs text-[var(--text-secondary)] mb-2">
                    Автор: <strong>{e.authorName}</strong> ({e.authorEmail})
                  </p>
                  {e.description && (
                    <p className="text-sm text-[var(--text-primary)] line-clamp-3 mb-2">{e.description}</p>
                  )}
                  {e.rejectionReason && (
                    <p className="text-xs text-red-700 bg-red-50 p-2 rounded-lg mb-2">
                      Причина отказа: {e.rejectionReason}
                    </p>
                  )}

                  {e.status === 'PENDING' && (
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => approve(e.id)}
                        className="px-4 py-2 rounded-full bg-green-600 text-white text-sm font-medium hover:bg-green-700">
                         Одобрить
                      </button>
                      {rejecting === e.id ? (
                        <div className="flex gap-2 items-center flex-1">
                          <input
                            type="text"
                            value={reason}
                            onChange={(ev) => setReason(ev.target.value)}
                            placeholder="Причина отказа"
                            className="flex-1 px-3 py-2 rounded-xl border border-[var(--border)] text-sm"
                          />
                          <button
                            onClick={() => reject(e.id)}
                            className="px-4 py-2 rounded-full bg-red-600 text-white text-sm font-medium hover:bg-red-700">
                            Отклонить
                          </button>
                          <button
                            onClick={() => { setRejecting(null); setReason(''); }}
                            className="px-3 py-2 rounded-full bg-[var(--hover)] text-sm">
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setRejecting(e.id)}
                          className="px-4 py-2 rounded-full bg-[var(--hover)] text-[var(--text-primary)] text-sm font-medium hover:bg-[var(--border)]">
                          Отклонить
                        </button>
                      )}
                    </div>
                  )}
                  {e.status === 'APPROVED' && (
                    <Link
                      href={`/events/${e.id}`}
                      className="inline-block mt-2 text-xs text-[var(--accent)] hover:underline">
                      Открыть страницу 
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="text-center pt-4">
        <Link href="/admin" className="text-sm text-[var(--accent)] hover:underline">
          Назад в админ-панель
        </Link>
      </div>
    </main>
  );
}
