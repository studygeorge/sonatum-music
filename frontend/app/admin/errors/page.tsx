'use client';

import { useEffect, useState } from 'react';
import { authStorage } from '@/app/lib/auth';
import Portal from '@/app/components/Portal';

type Item = {
  id: string; level: string; message: string; stack: string | null;
  url: string | null; method: string | null; userId: string | null;
  context: any; createdAt: string;
};

const LEVEL_COLOR: Record<string, string> = {
  ERROR: 'bg-[var(--text-primary)] text-white',
  WARN:  'bg-[var(--hover)] text-[var(--text-primary)] border border-[var(--text-primary)]',
  FATAL: 'bg-white text-[var(--text-primary)] border-2 border-[var(--text-primary)]',
};

export default function AdminErrorsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [level, setLevel] = useState('');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<Item | null>(null);

  const auth = () => ({ Authorization: `Bearer ${authStorage.getToken() || ''}` });

  const load = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (level) params.set('level', level);
    if (q) params.set('q', q);
    fetch(`/api/admin/errors?${params}`, { headers: auth() })
      .then((r) => r.json())
      .then((j) => { if (j.success) { setItems(j.data); setSummary(j.summary || {}); } })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [level, q]);

  const cleanup = async () => {
    if (!confirm('Удалить ошибки старше 30 дней?')) return;
    await fetch('/api/admin/errors?days=30', { method: 'DELETE', headers: auth() });
    load();
  };

  return (
    <div className="space-y-6">
      <section
        className="relative rounded-3xl overflow-hidden p-7 md:p-10 flex items-end justify-between gap-4 flex-wrap"
        style={{ background: 'linear-gradient(135deg, #1d4cb8 0%, #2f9e8f 55%, #e6e6e6 100%)' }}>
        <div className="relative z-10 max-w-xl">
          <div className="text-xs uppercase tracking-widest font-semibold mb-2 text-white/90">Мониторинг</div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">Журнал ошибок</h1>
          <p className="text-sm md:text-base text-white/90 mt-2 max-w-lg">
            Серверные ошибки, записанные через logError(). Используйте для разбора инцидентов.
          </p>
        </div>
        <button onClick={cleanup} className="px-4 py-2 rounded-full bg-white text-[#1c1c1e] text-sm font-semibold">
          Очистить &gt;30 дней
        </button>
      </section>

      <div className="grid grid-cols-3 gap-3">
        {(['ERROR', 'WARN', 'FATAL'] as const).map((l) => (
          <button key={l} onClick={() => setLevel(l === level ? '' : l)}
            className={`apple-card p-4 text-left ${level === l ? 'ring-2 ring-[var(--text-primary)]' : ''}`}>
            <div className="text-[11px] uppercase tracking-widest font-bold text-[var(--text-secondary)]">{l}</div>
            <div className="text-2xl font-black mt-1 tabular-nums">{summary[l] || 0}</div>
          </button>
        ))}
      </div>

      <div className="flex gap-2 flex-wrap">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Поиск по сообщению, URL, контексту…"
          className="flex-1 min-w-[200px] px-4 py-2.5 rounded-full border border-[var(--border)] bg-white text-sm"
        />
        <button onClick={() => { setLevel(''); setQ(''); }}
          className="px-4 py-2 rounded-full bg-[var(--hover)] text-sm">
          Сбросить фильтры
        </button>
      </div>

      {loading ? (
        <div className="apple-card p-10 text-center text-[var(--text-secondary)]">Загрузка…</div>
      ) : items.length === 0 ? (
        <div className="apple-card p-10 text-center text-[var(--text-secondary)]">Ошибок нет 🎉</div>
      ) : (
        <div className="apple-card overflow-hidden">
          {items.map((it) => (
            <button key={it.id} onClick={() => setDetail(it)}
              className="w-full text-left p-3 border-b border-[var(--border)] last:border-0 hover:bg-[var(--hover)]">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${LEVEL_COLOR[it.level] || 'bg-[var(--hover)]'}`}>{it.level}</span>
                {it.context?.scope && <span className="text-[11px] font-mono text-[var(--text-secondary)]">{it.context.scope}</span>}
                <span className="text-[11px] text-[var(--text-secondary)] ml-auto">
                  {new Date(it.createdAt).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })}
                </span>
              </div>
              <div className="font-mono text-sm truncate">{it.message}</div>
              {it.url && <div className="text-[11px] text-[var(--text-secondary)] truncate mt-0.5">{it.method} {it.url}</div>}
            </button>
          ))}
        </div>
      )}

      {detail && (
        <Portal>
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/45 backdrop-blur-md" onClick={() => setDetail(null)}>
            <div className="apple-card max-w-3xl w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${LEVEL_COLOR[detail.level] || ''}`}>{detail.level}</span>
                <button onClick={() => setDetail(null)} className="text-2xl"></button>
              </div>
              <div className="font-mono text-sm mb-3 break-all">{detail.message}</div>
              <div className="grid grid-cols-2 gap-2 text-xs mb-4">
                <Kv k="Когда" v={new Date(detail.createdAt).toLocaleString('ru-RU')} />
                <Kv k="Scope" v={detail.context?.scope || '—'} />
                <Kv k="URL" v={detail.url || '—'} />
                <Kv k="Method" v={detail.method || '—'} />
                <Kv k="User ID" v={detail.userId || '—'} />
                <Kv k="ID лога" v={detail.id} />
              </div>
              {detail.context && Object.keys(detail.context).length > 0 && (
                <details className="mb-3" open>
                  <summary className="cursor-pointer font-bold text-sm">Контекст</summary>
                  <pre className="text-[11px] font-mono p-3 mt-1 rounded-xl bg-[var(--hover)] overflow-x-auto whitespace-pre-wrap">{JSON.stringify(detail.context, null, 2)}</pre>
                </details>
              )}
              {detail.stack && (
                <details>
                  <summary className="cursor-pointer font-bold text-sm">Stack trace</summary>
                  <pre className="text-[11px] font-mono p-3 mt-1 rounded-xl bg-[var(--hover)] overflow-x-auto whitespace-pre-wrap">{detail.stack}</pre>
                </details>
              )}
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}

function Kv({ k, v }: { k: string; v: string }) {
  return (
    <div className="p-2 rounded-lg bg-[var(--hover)]">
      <div className="text-[9px] uppercase tracking-wider text-[var(--text-secondary)]">{k}</div>
      <div className="font-mono text-[11px] truncate">{v}</div>
    </div>
  );
}
