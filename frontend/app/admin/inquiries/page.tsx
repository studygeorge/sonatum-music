'use client';

import { useEffect, useState } from 'react';
import { authStorage } from '@/app/lib/auth';

type Inquiry = {
  id: string;
  type: 'B2B' | 'ARTIST' | 'COPYRIGHT' | 'OTHER';
  email: string | null;
  payload: Record<string, any>;
  status: 'NEW' | 'IN_PROGRESS' | 'DONE' | 'SPAM';
  createdAt: string;
};

const TYPE_LABEL: Record<string, string> = {
  B2B: 'Бизнес',
  ARTIST: 'Артист',
  COPYRIGHT: 'Правообладатель',
  OTHER: 'Прочее',
};

const STATUS_LABEL: Record<string, string> = {
  NEW: 'Новая',
  IN_PROGRESS: 'В работе',
  DONE: 'Закрыта',
  SPAM: 'Спам',
};

export default function AdminInquiriesPage() {
  const [items, setItems] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('NEW');
  const [open, setOpen] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      const params = new URLSearchParams();
      if (filterType) params.set('type', filterType);
      if (filterStatus) params.set('status', filterStatus);
      const token = authStorage.getToken();
      const res = await fetch(`/api/inquiries?${params.toString()}`, {
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
  }, [filterType, filterStatus]);

  const setStatus = async (id: string, status: string) => {
    const token = authStorage.getToken();
    await fetch('/api/inquiries', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id, status }),
    });
    load();
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Заявки</h1>
        <p className="text-[13px] text-[var(--text-secondary)] mt-1">
          Бизнес, артисты, правообладатели — поступают через формы на сайте
        </p>
      </header>

      {/* Фильтры */}
      <div className="flex flex-wrap gap-2">
        <FilterPill
          options={[
            { v: '',          label: 'Все типы' },
            { v: 'B2B',       label: 'Бизнес' },
            { v: 'ARTIST',    label: 'Артисты' },
            { v: 'COPYRIGHT', label: 'Правообладатели' },
          ]}
          value={filterType}
          onChange={setFilterType}
        />
        <FilterPill
          options={[
            { v: 'NEW',         label: 'Новые' },
            { v: 'IN_PROGRESS', label: 'В работе' },
            { v: 'DONE',        label: 'Закрытые' },
            { v: '',            label: 'Все' },
          ]}
          value={filterStatus}
          onChange={setFilterStatus}
        />
      </div>

      {loading && <div className="text-[13px] text-[var(--text-secondary)] py-10 text-center">Загрузка…</div>}
      {err && <div className="text-[13px] text-red-500 py-4">{err}</div>}

      {!loading && !err && items.length === 0 && (
        <div className="apple-card p-10 text-center text-[13px] text-[var(--text-secondary)]">
          Заявок нет
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="apple-card overflow-hidden">
          <ul className="divide-y divide-[var(--border)]">
            {items.map(it => (
              <li key={it.id}>
                <button
                  onClick={() => setOpen(open === it.id ? null : it.id)}
                  className="w-full flex items-center gap-4 px-5 py-3 text-left hover:bg-[var(--hover)] transition-colors"
                >
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] w-32 shrink-0">
                    {TYPE_LABEL[it.type]}
                  </span>
                  <span className="text-[13px] flex-1 min-w-0 truncate">
                    {it.email || it.payload?.contact || '—'}
                  </span>
                  <span className="text-[11px] uppercase tracking-wider text-[var(--text-secondary)] shrink-0 w-24 text-right">
                    {STATUS_LABEL[it.status]}
                  </span>
                  <span className="text-[11px] text-[var(--text-secondary)] tabular-nums shrink-0">
                    {new Date(it.createdAt).toLocaleString('ru-RU', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </button>

                {open === it.id && (
                  <div className="px-5 pb-4 bg-[var(--background)]">
                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-[13px] mb-3">
                      {Object.entries(it.payload || {}).map(([k, v]) => (
                        <div key={k} className="flex gap-2">
                          <dt className="text-[var(--text-secondary)] capitalize min-w-[110px]">{k}:</dt>
                          <dd className="font-medium break-words">{String(v)}</dd>
                        </div>
                      ))}
                    </dl>
                    <div className="flex flex-wrap gap-2 text-[12px]">
                      <ActionBtn onClick={() => setStatus(it.id, 'IN_PROGRESS')} disabled={it.status === 'IN_PROGRESS'}>В работе</ActionBtn>
                      <ActionBtn onClick={() => setStatus(it.id, 'DONE')} disabled={it.status === 'DONE'}>Закрыть</ActionBtn>
                      <ActionBtn onClick={() => setStatus(it.id, 'SPAM')} disabled={it.status === 'SPAM'}>Спам</ActionBtn>
                      {it.email && (
                        <a
                          href={`mailto:${it.email}`}
                          className="px-3 py-1.5 rounded-lg bg-[var(--text-primary)] text-white font-medium hover:opacity-90 transition-opacity"
                        >
                          Написать на почту
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function FilterPill({
  options,
  value,
  onChange,
}: {
  options: { v: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex border border-[var(--border)] rounded-lg overflow-hidden bg-white">
      {options.map(o => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          className={`px-3 py-1.5 text-[12px] font-medium transition-colors ${
            value === o.v
              ? 'bg-[var(--text-primary)] text-white'
              : 'text-[var(--text-secondary)] hover:bg-[var(--hover)]'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function ActionBtn({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-3 py-1.5 rounded-lg border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--hover)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed font-medium"
    >
      {children}
    </button>
  );
}
