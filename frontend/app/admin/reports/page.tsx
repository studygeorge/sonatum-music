'use client';

import { useEffect, useState } from 'react';
import { authStorage } from '@/app/lib/auth';

type Report = {
  id: string;
  targetType: 'TRACK' | 'COMMENT' | 'USER';
  targetId: string;
  reason: 'COPYRIGHT' | 'INAPPROPRIATE' | 'METADATA' | 'TECHNICAL' | 'OTHER';
  details: string | null;
  status: 'PENDING' | 'RESOLVED' | 'REJECTED';
  createdAt: string;
  reporter?: { id: string; username?: string; firstName?: string; lastName?: string } | null;
  track?: { id: string; title: string; slug?: string } | null;
  comment?: { id: string; content: string } | null;
  reportedUser?: { id: string; username?: string } | null;
};

const REASON_LABEL: Record<string, string> = {
  COPYRIGHT: 'Авторские права',
  INAPPROPRIATE: 'Неприемлемый контент',
  METADATA: 'Неверные метаданные',
  TECHNICAL: 'Технические проблемы',
  OTHER: 'Другое',
};

const TARGET_LABEL: Record<string, string> = {
  TRACK: 'Трек',
  COMMENT: 'Комментарий',
  USER: 'Пользователь',
};

const STATUS_TABS: { value: string; label: string }[] = [
  { value: 'PENDING', label: 'Новые' },
  { value: 'RESOLVED', label: 'Решённые' },
  { value: 'REJECTED', label: 'Отклонённые' },
];

function reporterName(r: Report): string {
  const u = r.reporter;
  if (!u) return 'Аноним';
  const fn = `${u.firstName || ''} ${u.lastName || ''}`.trim();
  return fn || u.username || 'Пользователь';
}

export default function AdminReportsPage() {
  const [items, setItems] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState('PENDING');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      const token = authStorage.getToken();
      const res = await fetch(`/api/admin/reports?status=${filterStatus}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success) setItems(json.data);
      else setErr(json.error || 'Ошибка');
    } catch (e: any) {
      setErr(e?.message || 'Сеть недоступна');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus]);

  const setStatus = async (id: string, status: string) => {
    setBusyId(id);
    try {
      const token = authStorage.getToken();
      await fetch('/api/admin/reports', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id, status }),
      });
      setItems((prev) => prev.filter((x) => x.id !== id));
    } finally {
      setBusyId(null);
    }
  };

  const targetText = (r: Report) => {
    if (r.targetType === 'TRACK') return r.track?.title || `Трек ${r.targetId}`;
    if (r.targetType === 'COMMENT') return r.comment?.content ? `«${r.comment.content}»` : `Комментарий ${r.targetId}`;
    if (r.targetType === 'USER') return r.reportedUser?.username ? `@${r.reportedUser.username}` : `Пользователь ${r.targetId}`;
    return r.targetId;
  };

  const targetHref = (r: Report) => {
    if (r.targetType === 'TRACK' && (r.track?.slug || r.track?.id)) return `/tracks/${r.track?.slug || r.track?.id}`;
    if (r.targetType === 'USER' && r.reportedUser?.username) return `/users/${r.reportedUser.username}`;
    return null;
  };

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-6">Жалобы</h1>

      {/* Вкладки статусов */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {STATUS_TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setFilterStatus(t.value)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              filterStatus === t.value
                ? 'bg-[var(--text-primary)] text-white'
                : 'bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--hover)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16 text-[var(--text-secondary)]">Загрузка…</div>
      ) : err ? (
        <div className="apple-card p-4 bg-red-50 border-red-200 text-sm text-red-600">{err}</div>
      ) : items.length === 0 ? (
        <div className="apple-card p-10 text-center text-[var(--text-secondary)]">Жалоб нет.</div>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((r) => {
            const href = targetHref(r);
            return (
              <div key={r.id} className="apple-card p-4 md:p-5">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[var(--hover)] text-[var(--text-secondary)]">
                        {TARGET_LABEL[r.targetType] || r.targetType}
                      </span>
                      <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                        {REASON_LABEL[r.reason] || r.reason}
                      </span>
                      <span className="text-xs text-[var(--text-secondary)]">
                        {new Date(r.createdAt).toLocaleString('ru-RU')}
                      </span>
                    </div>
                    <div className="text-sm font-semibold break-words">
                      {href ? (
                        <a href={href} target="_blank" rel="noopener noreferrer" className="hover:underline">
                          {targetText(r)}
                        </a>
                      ) : (
                        targetText(r)
                      )}
                    </div>
                    {r.details && (
                      <p className="text-sm text-[var(--text-secondary)] mt-1 break-words">{r.details}</p>
                    )}
                    <p className="text-xs text-[var(--text-secondary)] mt-2">
                      От: {reporterName(r)}
                    </p>
                  </div>

                  {r.status === 'PENDING' && (
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => setStatus(r.id, 'RESOLVED')}
                        disabled={busyId === r.id}
                        className="px-4 py-2 rounded-full bg-[var(--text-primary)] text-white text-xs font-semibold hover:opacity-90 disabled:opacity-50"
                      >
                        Решено
                      </button>
                      <button
                        onClick={() => setStatus(r.id, 'REJECTED')}
                        disabled={busyId === r.id}
                        className="px-4 py-2 rounded-full bg-[var(--hover)] text-[var(--text-primary)] text-xs font-semibold hover:bg-gray-200 disabled:opacity-50"
                      >
                        Отклонить
                      </button>
                    </div>
                  )}
                  {r.status !== 'PENDING' && (
                    <button
                      onClick={() => setStatus(r.id, 'PENDING')}
                      disabled={busyId === r.id}
                      className="px-4 py-2 rounded-full bg-[var(--hover)] text-[var(--text-primary)] text-xs font-semibold hover:bg-gray-200 disabled:opacity-50 shrink-0"
                    >
                      Вернуть в работу
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
