'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { authStorage } from '@/app/lib/auth';
import { usePlayer } from '@/app/context/PlayerContext';

type Playlist = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  cover: string | null;
  scope: string;
  ownerUserId: string | null;
  isPublic: boolean;
  trackCount: number;
  duration: number;
  canEdit: boolean;
  tracks: Array<{
    position: number;
    track: {
      id: string;
      title: string;
      slug: string;
      duration: number | null;
      cover: string | null;
      audioUrl: string | null;
      artist: { id: string; name: string | null; slug: string | null; avatar: string | null } | null;
    };
  }>;
};

const SCOPE_LABEL: Record<string, string> = {
  CORP: 'Корпоративный',
  TEACHER: 'Личный',
  METHOD: 'Методический',
};

function formatDuration(s: number | null) {
  if (!s) return '—';
  const m = Math.floor(s / 60), ss = s % 60;
  return `${m}:${ss.toString().padStart(2, '0')}`;
}

export default function EduPlaylistDetail() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [pl, setPl] = useState<Playlist | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);

  // add track
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  const { playTrack, currentTrack, isPlaying, togglePlay } = usePlayer();

  const token = () => authStorage.getToken() || '';

  // Запускает плейлист с указанной позиции:
  // 1) Прописывает очередь в localStorage (поле sonatum:queue), которое PlayerContext
  //    использует для авто-перехода по 'ended' →  следующий трек.
  // 2) Запускает текущий трек.
  // Если кликнули по тому же треку, который сейчас играет — пауза/возобновление.
  const playFromIndex = (idx: number) => {
    if (!pl) return;
    const target = pl.tracks[idx];
    if (!target || !target.track.audioUrl) return;
    if (currentTrack?.id === target.track.id) {
      togglePlay();
      return;
    }
    try {
      const queue = pl.tracks
        .filter(r => r.track.audioUrl)
        .map(r => ({
          id: r.track.id,
          title: r.track.title,
          slug: r.track.slug,
          audioUrl: r.track.audioUrl,
          cover: r.track.cover,
          duration: r.track.duration,
          artist: r.track.artist,
        }));
      // Реальный индекс цели в отфильтрованной очереди
      const realIdx = queue.findIndex(t => t.id === target.track.id);
      localStorage.setItem('sonatum:queue', JSON.stringify(queue));
      localStorage.setItem('sonatum:queueIndex', String(realIdx >= 0 ? realIdx : 0));
    } catch {}
    playTrack(target.track as any);
  };

  const load = () => {
    setLoading(true);
    fetch(`/api/edu/playlists/${params.id}`, { headers: { Authorization: `Bearer ${token()}` } })
      .then((r) => r.json())
      .then((j) => {
        if (j.success) {
          setPl(j.data);
          setTitle(j.data.title);
          setDescription(j.data.description || '');
          setIsPublic(j.data.isPublic);
        } else {
          setError(j.error || 'Ошибка');
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [params.id]);

  const saveMeta = async () => {
    try {
      const r = await fetch(`/api/edu/playlists/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ title, description, isPublic }),
      });
      const j = await r.json();
      if (j.success) { setEditing(false); load(); }
      else setError(j.error || 'Ошибка');
    } catch (e: any) { setError(e?.message || 'Ошибка'); }
  };

  const searchTracks = (q: string) => {
    setSearch(q);
  };

  // Debounced live search
  useEffect(() => {
    const q = search.trim();
    if (!q) { setSearchResults([]); setSearching(false); return; }
    setSearching(true);
    const handle = setTimeout(async () => {
      try {
        const r = await fetch(`/api/catalog?search=${encodeURIComponent(q)}&limit=12`, {
          headers: { Authorization: `Bearer ${token()}` },
        });
        const j = await r.json();
        const data = j?.data?.tracks || [];
        setSearchResults(Array.isArray(data) ? data : []);
      } catch { setSearchResults([]); }
      finally { setSearching(false); }
    }, 250);
    return () => clearTimeout(handle);
  }, [search]);

  const addTrack = async (trackId: string) => {
    try {
      const r = await fetch(`/api/edu/playlists/${params.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ trackId }),
      });
      const j = await r.json();
      if (j.success) { setSearch(''); setSearchResults([]); load(); }
      else setError(j.error || 'Не удалось добавить');
    } catch (e: any) { setError(e?.message || 'Ошибка'); }
  };

  const removeTrack = async (trackId: string) => {
    if (!confirm('Убрать трек из плейлиста?')) return;
    try {
      const r = await fetch(`/api/edu/playlists/${params.id}?trackId=${encodeURIComponent(trackId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token()}` },
      });
      const j = await r.json();
      if (j.success) load();
      else setError(j.error || 'Ошибка');
    } catch (e: any) { setError(e?.message || 'Ошибка'); }
  };

  if (loading) return <div className="apple-card p-10 text-center text-sm text-[var(--text-secondary)]">Загрузка…</div>;
  if (!pl) return <div className="apple-card p-10 text-center"><h2 className="text-xl font-bold">Плейлист не найден</h2><Link href="/edu/playlists" className="text-sm underline mt-3 inline-block">Назад</Link></div>;

  return (
    <div className="space-y-6 animate-fadeInUp">
      <section
        className="relative rounded-3xl overflow-hidden p-7 md:p-10 text-white"
        style={{ background: 'linear-gradient(135deg, #1d4cb8 0%, #2f9e8f 55%, #e6e6e6 100%)' }}>
        <div className="relative z-10 max-w-2xl">
          <Link href="/edu/playlists" className="text-xs uppercase tracking-widest font-semibold opacity-90 hover:opacity-100">
            ← Все плейлисты
          </Link>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white mt-2">{pl.title}</h1>
          <div className="text-sm md:text-base text-white/85 mt-2">
            {SCOPE_LABEL[pl.scope] || pl.scope} · {pl.trackCount} треков
            {!pl.isPublic && ' · скрыт'}
          </div>
        </div>
      </section>

      {error && <div className="apple-card p-4 text-sm border border-black">{error}</div>}

      {pl.description && !editing && (
        <section className="apple-card p-5">
          <p className="text-sm text-[var(--text-primary)]">{pl.description}</p>
        </section>
      )}

      {pl.canEdit && (
        <section className="apple-card p-6 md:p-8">
          {!editing ? (
            <div className="flex flex-wrap gap-2 items-center">
              <button onClick={() => setEditing(true)} className="px-4 py-2 rounded-full bg-[var(--text-primary)] text-white text-xs font-semibold">
                Изменить название / описание
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <label className="block">
                <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5 block">Название</span>
                <input value={title} onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[var(--border)] focus:border-black focus:outline-none text-sm" />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5 block">Описание</span>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[var(--border)] focus:border-black focus:outline-none text-sm resize-none" />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
                Виден другим участникам учреждения
              </label>
              <div className="flex gap-2">
                <button onClick={saveMeta} className="px-5 py-2.5 rounded-full bg-[var(--text-primary)] text-white text-sm font-medium">Сохранить</button>
                <button onClick={() => setEditing(false)} className="px-5 py-2.5 rounded-full bg-white border border-[var(--border)] text-black text-sm font-medium">Отмена</button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Поиск и добавление треков */}
      {pl.canEdit && (
        <section className="apple-card p-6 md:p-8">
          <h2 className="text-lg font-bold tracking-tight mb-1">Добавить треки</h2>
          <p className="text-xs text-[var(--text-secondary)] mb-3">Найдите трек по названию или исполнителю.</p>
          <input
            value={search}
            onChange={(e) => searchTracks(e.target.value)}
            placeholder="Например: «Прелюдия» или «Чайковский»"
            className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[var(--border)] focus:border-black focus:outline-none text-sm"
          />
          {search.trim() && searching && (
            <p className="mt-3 text-xs text-[var(--text-secondary)]">Поиск…</p>
          )}
          {search.trim() && !searching && searchResults.length === 0 && (
            <p className="mt-3 text-xs text-[var(--text-secondary)]">Ничего не найдено. Попробуйте другой запрос.</p>
          )}
          {searchResults.length > 0 && (
            <div className="mt-3 space-y-2 max-h-80 overflow-y-auto">
              {searchResults.map((t: any) => (
                <div key={t.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-black/[0.03]">
                  {t.cover ? <img src={t.cover} alt="" className="w-9 h-9 rounded-md object-cover" /> : <div className="w-9 h-9 rounded-md bg-black/[0.06] flex items-center justify-center"><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg></div>}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">{t.title}</div>
                    <div className="text-xs text-[var(--text-secondary)] truncate">{t.artist?.name || '—'}</div>
                  </div>
                  <button onClick={() => addTrack(t.id)} className="px-3 py-1.5 rounded-full bg-[var(--text-primary)] text-white text-xs font-semibold">
                    + Добавить
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Треки в плейлисте */}
      <section className="apple-card p-6 md:p-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold tracking-tight">Треки</h2>
          {pl.tracks.length > 0 && (
            <button
              onClick={() => playFromIndex(0)}
              className="px-4 py-2 rounded-full bg-[var(--text-primary)] text-white text-xs font-semibold hover:opacity-90">
              <span className="inline-flex items-center gap-1.5"><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>Слушать плейлист</span>
            </button>
          )}
        </div>
        {pl.tracks.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)]">Пока треков нет.</p>
        ) : (
          <ol className="space-y-1.5">
            {pl.tracks.map((row, idx) => {
              const hasAudio = !!row.track.audioUrl;
              const isCurrent = currentTrack?.id === row.track.id;
              return (
                <li key={row.track.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-black/[0.03]">
                  <span className="text-sm font-semibold text-[var(--text-secondary)] w-6 tabular-nums">{row.position}</span>
                  {hasAudio ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); playFromIndex(idx); }}
                      title={isCurrent && isPlaying ? 'Пауза' : 'Слушать'}
                      className="relative group w-10 h-10 rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0">
                      {row.track.cover ? (
                        <img src={row.track.cover} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-black/[0.06] flex items-center justify-center"><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg></div>
                      )}
                      <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity text-white text-base">
                        {isCurrent && isPlaying ? (<svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h4v16H6zm8 0h4v16h-4z" /></svg>) : (<svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>)}
                      </span>
                    </button>
                  ) : row.track.cover ? (
                    <img src={row.track.cover} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-black/[0.06] flex items-center justify-center flex-shrink-0"><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg></div>
                  )}
                  <Link href={`/tracks/${row.track.slug}`} className="flex-1 min-w-0 hover:opacity-80 transition-opacity">
                    <div className="font-semibold text-sm truncate">{row.track.title}</div>
                    <div className="text-xs text-[var(--text-secondary)] truncate">{row.track.artist?.name || '—'}</div>
                  </Link>
                  <div className="text-xs text-[var(--text-secondary)] tabular-nums">{formatDuration(row.track.duration)}</div>
                  {pl.canEdit && (
                    <button
                      onClick={() => removeTrack(row.track.id)}
                      className="ml-2 px-2.5 py-1.5 rounded-full bg-white border border-[var(--border)] text-[var(--text-primary)] text-xs font-semibold hover:bg-gray-100">
                      Убрать
                    </button>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
