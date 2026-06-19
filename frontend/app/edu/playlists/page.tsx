'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { authStorage } from '@/app/lib/auth';

type Pl = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  cover: string | null;
  scope: 'CORP' | 'TEACHER' | 'METHOD';
  ownerUserId: string | null;
  isPublic: boolean;
  trackCount: number;
  duration: number;
  createdAt: string;
  canEdit: boolean;
};

const SCOPE_LABEL: Record<string, string> = {
  CORP: 'Корпоративный',
  TEACHER: 'Личный преподавателя',
  METHOD: 'Методическая подборка',
};

const SCOPE_HINT: Record<string, string> = {
  CORP: 'Виден всем участникам учреждения',
  TEACHER: 'Личная подборка преподавателя',
  METHOD: 'Учебно-методический материал',
};

export default function EduPlaylistsPage() {
  const [myRole, setMyRole] = useState<'ADMIN' | 'TEACHER' | 'STUDENT' | null>(null);
  const [items, setItems] = useState<Pl[]>([]);
  const [filter, setFilter] = useState<'' | 'CORP' | 'TEACHER' | 'METHOD'>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // create form
  const [creating, setCreating] = useState(false);
  const [openCreate, setOpenCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [scope, setScope] = useState<'CORP' | 'TEACHER' | 'METHOD'>('TEACHER');
  const [isPublic, setIsPublic] = useState(true);

  const token = () => authStorage.getToken() || '';

  const load = () => {
    setLoading(true);
    fetch('/api/edu/playlists', { headers: { Authorization: `Bearer ${token()}` } })
      .then((r) => r.json())
      .then((j) => {
        if (j.success) {
          setMyRole(j.myRole);
          setItems(j.data);
          if (j.myRole !== 'ADMIN') setScope('TEACHER');
        } else {
          setError(j.error || 'Ошибка загрузки');
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const r = await fetch('/api/edu/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ title, description, scope, isPublic }),
      });
      const j = await r.json();
      if (j.success) {
        setTitle(''); setDescription(''); setOpenCreate(false);
        load();
      } else {
        setError(j.error || 'Не удалось создать');
      }
    } catch (e: any) {
      setError(e?.message || 'Ошибка сети');
    } finally {
      setCreating(false);
    }
  };

  const remove = async (pl: Pl) => {
    if (!confirm(`Удалить плейлист «${pl.title}»? Действие необратимо.`)) return;
    try {
      const r = await fetch(`/api/edu/playlists?id=${encodeURIComponent(pl.id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token()}` },
      });
      const j = await r.json();
      if (j.success) load();
      else setError(j.error || 'Ошибка удаления');
    } catch (e: any) {
      setError(e?.message || 'Ошибка');
    }
  };

  const filtered = filter ? items.filter((p) => p.scope === filter) : items;

  const groups: Record<string, Pl[]> = { CORP: [], METHOD: [], TEACHER: [] };
  filtered.forEach((p) => { groups[p.scope]?.push(p); });

  const canCreate = myRole === 'ADMIN' || myRole === 'TEACHER';

  return (
    <div className="space-y-6 animate-fadeInUp">
      <section
        className="relative rounded-3xl overflow-hidden p-7 md:p-10 text-white"
        style={{ background: 'linear-gradient(135deg, #1d4cb8 0%, #2f9e8f 55%, #e6e6e6 100%)' }}>
        <div className="relative z-10 max-w-2xl">
          <div className="text-xs uppercase tracking-widest font-semibold mb-2 opacity-90">Кабинет</div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">Плейлисты</h1>
          <p className="text-sm md:text-base text-white/85 mt-2">
            Корпоративные подборки, методические материалы и личные плейлисты преподавателей.
          </p>
        </div>
      </section>

      {error && <div className="apple-card p-4 text-sm border border-black">{error}</div>}

      <section className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 bg-black/[0.04] rounded-2xl p-1">
          {([
            ['', 'Все'],
            ['CORP', 'Корпоративные'],
            ['METHOD', 'Методические'],
            ['TEACHER', 'Личные'],
          ] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setFilter(k as any)}
              className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                filter === k ? 'bg-white shadow text-[#1c1c1e]' : 'text-[var(--text-secondary)] hover:text-[#1c1c1e]'
              }`}>
              {label}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        {canCreate && (
          <button
            onClick={() => setOpenCreate((v) => !v)}
            className="px-5 py-2 rounded-full bg-[var(--text-primary)] text-white text-sm font-medium">
            {openCreate ? 'Скрыть форму' : 'Создать плейлист'}
          </button>
        )}
      </section>

      {openCreate && canCreate && (
        <form onSubmit={create} className="apple-card p-6 md:p-8 space-y-4">
          <h2 className="text-xl font-bold tracking-tight">Новый плейлист</h2>
          <label className="block">
            <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5 block">Название</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[var(--border)] focus:border-black focus:outline-none text-sm" />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5 block">Описание (необязательно)</span>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={500}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[var(--border)] focus:border-black focus:outline-none text-sm resize-none" />
          </label>
          {myRole === 'ADMIN' ? (
            <label className="block">
              <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5 block">Тип</span>
              <div className="grid sm:grid-cols-3 gap-2">
                {(['CORP', 'METHOD', 'TEACHER'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setScope(s)}
                    className={`text-left p-3 rounded-xl border ${
                      scope === s ? 'border-black bg-black/[0.04]' : 'border-[var(--border)] bg-white hover:bg-black/[0.02]'
                    }`}>
                    <div className="text-sm font-semibold">{SCOPE_LABEL[s]}</div>
                    <div className="text-[11px] text-[var(--text-secondary)] mt-0.5 leading-snug">{SCOPE_HINT[s]}</div>
                  </button>
                ))}
              </div>
            </label>
          ) : (
            <div className="text-xs text-[var(--text-secondary)]">
              Тип: <span className="font-semibold text-[var(--text-primary)]">{SCOPE_LABEL.TEACHER}</span> — личный плейлист преподавателя.
            </div>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
            Виден другим участникам учреждения
          </label>
          <div className="flex gap-2">
            <button type="submit" disabled={creating}
              className="px-5 py-2.5 rounded-full bg-[var(--text-primary)] text-white text-sm font-medium disabled:opacity-60">
              {creating ? 'Создаём…' : 'Создать'}
            </button>
            <button type="button" onClick={() => setOpenCreate(false)}
              className="px-5 py-2.5 rounded-full bg-white border border-[var(--border)] text-black text-sm font-medium">
              Отмена
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="apple-card p-10 text-center text-sm text-[var(--text-secondary)]">Загрузка…</div>
      ) : items.length === 0 ? (
        <div className="apple-card p-10 text-center">
          <h2 className="text-xl font-bold mb-2">Пока нет плейлистов</h2>
          <p className="text-sm text-[var(--text-secondary)] max-w-md mx-auto">
            {canCreate ? 'Создайте первый плейлист по кнопке выше.' : 'Администратор или преподаватель ещё не добавили плейлистов.'}
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {(['CORP', 'METHOD', 'TEACHER'] as const).map((s) => {
            const list = groups[s];
            if (!list || list.length === 0) return null;
            return (
              <section key={s}>
                <div className="flex items-baseline justify-between mb-3">
                  <h2 className="text-lg font-bold tracking-tight">{SCOPE_LABEL[s]}</h2>
                  <span className="text-xs text-[var(--text-secondary)]">{list.length}</span>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {list.map((pl) => (
                    <div key={pl.id} className="apple-card p-4 flex flex-col">
                      <div className="flex items-start gap-3 mb-3">
                        {pl.cover ? (
                          <img src={pl.cover} alt="" className="w-14 h-14 rounded-xl object-cover" />
                        ) : (
                          <div className="w-14 h-14 rounded-xl bg-black/[0.06] flex items-center justify-center"><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg></div>
                        )}
                        <div className="flex-1 min-w-0">
                          <Link href={`/edu/playlists/${pl.id}`} className="font-semibold text-sm leading-snug hover:underline block">
                            {pl.title}
                          </Link>
                          <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                            {pl.trackCount} {pluralize(pl.trackCount, ['трек', 'трека', 'треков'])}
                            {!pl.isPublic && ' · скрыт'}
                          </div>
                        </div>
                      </div>
                      {pl.description && (
                        <p className="text-xs text-[var(--text-secondary)] line-clamp-2 mb-3 flex-1">{pl.description}</p>
                      )}
                      <div className="flex gap-2 mt-auto">
                        <Link href={`/edu/playlists/${pl.id}`} className="flex-1 text-center px-3 py-2 rounded-full bg-black/[0.04] text-[var(--text-primary)] text-xs font-semibold hover:bg-black/[0.08]">
                          Открыть
                        </Link>
                        {pl.canEdit && (
                          <button onClick={() => remove(pl)} className="px-3 py-2 rounded-full bg-white border border-[var(--border)] text-[var(--text-primary)] text-xs font-semibold hover:bg-gray-100">
                            Удалить
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function pluralize(n: number, forms: [string, string, string]) {
  const mod10 = n % 10, mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
  return forms[2];
}
