'use client';

import { useEffect, useState } from 'react';
import { authStorage } from '@/app/lib/auth';
import Portal from '@/app/components/Portal';

import { toast } from '@/app/components/Toast';
type Verification = {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  institution: string;
  documentUrl: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  adminNote: string | null;
  expiresAt: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

// Палитра интерфейса — ч/б. Цвета (синий/красный) — только в градиентах брендинга.
const STATUS_LABEL: Record<string, { l: string; c: string }> = {
  PENDING:  { l: 'На проверке',  c: 'bg-[var(--hover)] text-[var(--text-primary)] border border-[var(--text-primary)]' },
  APPROVED: { l: 'Одобрено',     c: 'bg-[var(--text-primary)] text-white' },
  REJECTED: { l: 'Отклонено',    c: 'bg-white text-[var(--text-primary)] border border-[var(--text-primary)]' },
  EXPIRED:  { l: 'Истекло',      c: 'bg-[var(--hover)] text-[var(--text-secondary)]' },
};

export default function AdminStudentVerificationsPage() {
  const [filter, setFilter] = useState<'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED'>('PENDING');
  const [items, setItems] = useState<Verification[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [rejectFor, setRejectFor] = useState<Verification | null>(null);
  const [rejectNote, setRejectNote] = useState('');

  const auth = () => ({ Authorization: `Bearer ${authStorage.getToken() || ''}` });

  const load = () => {
    setLoading(true);
    fetch(`/api/admin/student-verifications?status=${filter}`, { headers: auth() })
      .then((r) => r.json())
      .then((j) => { if (j.success) setItems(j.data || []); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filter]);

  const decide = async (id: string, status: 'APPROVED' | 'REJECTED', note?: string) => {
    setBusy(id);
    try {
      const r = await fetch('/api/admin/student-verifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...auth() },
        body: JSON.stringify({ id, status, adminNote: note || null }),
      });
      const j = await r.json();
      if (j.success) {
        setItems((arr) => arr.filter((x) => x.id !== id));
        setRejectFor(null); setRejectNote('');
      } else {
        toast.error(j.error || 'Ошибка');
      }
    } finally { setBusy(null); }
  };

  return (
    <div className="space-y-6">
      <section
        className="relative rounded-3xl overflow-hidden p-7 md:p-10 flex items-end justify-between gap-4 flex-wrap"
        style={{ background: 'linear-gradient(135deg, #1d4cb8 0%, #2f9e8f 55%, #e6e6e6 100%)' }}>
        <div className="relative z-10 max-w-xl">
          <div className="text-xs uppercase tracking-widest font-semibold mb-2 text-white/90">
            Модерация
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">
            Студенческие заявки
          </h1>
          <p className="text-sm md:text-base text-white/90 mt-2">
            После одобрения пользователю становится доступен тариф STUDENT — 149 ₽/мес вместо 299 ₽ Premium.
            Статус действует 1 год, затем нужна новая верификация.
          </p>
        </div>
      </section>

      <div className="flex gap-2 overflow-x-auto">
        {(['PENDING', 'APPROVED', 'REJECTED', 'EXPIRED'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              filter === s ? 'bg-[var(--text-primary)] text-white' : 'bg-[var(--hover)] text-[var(--text-primary)]'
            }`}>
            {STATUS_LABEL[s].l}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="apple-card p-10 text-center text-[var(--text-secondary)]">Загрузка…</div>
      ) : items.length === 0 ? (
        <div className="apple-card p-10 text-center text-[var(--text-secondary)]">
          {filter === 'PENDING' ? 'Новых заявок нет' : 'Список пуст'}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((v) => (
            <div key={v.id} className="apple-card p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-semibold">{v.userName || v.userEmail}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${STATUS_LABEL[v.status].c}`}>
                      {STATUS_LABEL[v.status].l}
                    </span>
                  </div>
                  <div className="text-sm text-[var(--text-secondary)]">{v.userEmail}</div>
                  <div className="mt-3 grid sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
                    <div><span className="text-[var(--text-secondary)]">Учреждение:</span> <b>{v.institution}</b></div>
                    <div>
                      <span className="text-[var(--text-secondary)]">Документ:</span>{' '}
                      <a href={v.documentUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                        Открыть
                      </a>
                    </div>
                    <div>
                      <span className="text-[var(--text-secondary)]">Подано:</span>{' '}
                      {new Date(v.createdAt).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })}
                    </div>
                    {v.expiresAt && (
                      <div>
                        <span className="text-[var(--text-secondary)]">Действует до:</span>{' '}
                        {new Date(v.expiresAt).toLocaleDateString('ru-RU')}
                      </div>
                    )}
                  </div>
                  {v.adminNote && (
                    <div className="mt-3 p-3 rounded-xl bg-[var(--hover)] text-sm text-[var(--text-primary)]">
                      <b>Комментарий:</b> {v.adminNote}
                    </div>
                  )}
                </div>

                {v.status === 'PENDING' && (
                  <div className="flex flex-col gap-2 shrink-0">
                    <button
                      onClick={() => decide(v.id, 'APPROVED')}
                      disabled={busy === v.id}
                      className="px-5 py-2 rounded-full bg-[var(--text-primary)] text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
                      {busy === v.id ? '…' : '✓ Одобрить'}
                    </button>
                    <button
                      onClick={() => { setRejectFor(v); setRejectNote(''); }}
                      disabled={busy === v.id}
                      className="px-5 py-2 rounded-full bg-white border border-[var(--text-primary)] text-[var(--text-primary)] text-sm font-semibold hover:bg-[var(--hover)] transition-colors disabled:opacity-50">
                      ✕ Отклонить
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal отклонения */}
      {rejectFor && (
        <Portal>
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/45 backdrop-blur-md"
          onClick={() => !busy && setRejectFor(null)}>
          <div className="apple-card max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-3">Отклонить заявку?</h3>
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              Укажите причину. Текст придёт пользователю в письме.
            </p>
            <textarea
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              placeholder="Скан нечитаем / документ просрочен / не виден срок действия и т.п."
              rows={4}
              maxLength={500}
              autoFocus
              className="w-full p-3 rounded-xl border border-[var(--border)] bg-white text-sm mb-4"
            />
            <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border)]">
              <button
                onClick={() => setRejectFor(null)}
                disabled={!!busy}
                className="px-5 py-2.5 rounded-full bg-[var(--hover)] text-sm font-medium">
                Отмена
              </button>
              <button
                onClick={() => decide(rejectFor.id, 'REJECTED', rejectNote.trim() || undefined)}
                disabled={!!busy || !rejectNote.trim()}
                className="px-6 py-2.5 rounded-full bg-[var(--text-primary)] text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
                {busy ? 'Отклоняем…' : 'Отклонить'}
              </button>
            </div>
          </div>
        </div>
        </Portal>
      )}
    </div>
  );
}
