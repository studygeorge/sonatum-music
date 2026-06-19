'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { authStorage } from '@/app/lib/auth';
import { usePlayer } from '@/app/context/PlayerContext';

import { toast } from '@/app/components/Toast';
export default function PublicPlaylistPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [pl, setPl] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [me, setMe] = useState<any>(null);
  const { playTrack } = usePlayer();

  // Добавление треков (только для владельца)
  const [addOpen, setAddOpen] = useState(false);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Record<string, boolean>>({});

  const reloadPlaylist = async () => {
    const token = authStorage.getToken();
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const p = await fetch(`/api/playlists/${id}`, { headers }).then(r => r.json()).catch(() => null);
    if (p?.success) setPl(p.data);
  };

  useEffect(() => {
    if (!addOpen) return;
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await fetch(`/api/tracks/search?q=${encodeURIComponent(q)}&limit=20`);
        const j = await r.json();
        if (j.success) setResults(j.data || []);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q, addOpen]);

  const addTrack = async (t: any) => {
    const token = authStorage.getToken();
    if (!token || !pl?.id || addingId) return;
    setAddingId(t.id);
    try {
      const r = await fetch(`/api/playlists/${pl.id}/tracks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ trackId: t.id }),
      });
      const j = await r.json();
      if (j.success || /already/i.test(j.error || '')) {
        setAddedIds((s) => ({ ...s, [t.id]: true }));
        reloadPlaylist();
      } else {
        toast.error(j.error || 'Не удалось добавить');
      }
    } finally {
      setAddingId(null);
    }
  };

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    const token = authStorage.getToken();
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    Promise.all([
      fetch(`/api/playlists/${id}`, { headers }).then(r => r.json()).catch(() => null),
      token ? fetch('/api/users/me/saved-playlists', { headers }).then(r => r.json()).catch(() => null) : Promise.resolve(null),
      token ? fetch('/api/auth/me', { headers }).then(r => r.json()).catch(() => null) : Promise.resolve(null),
    ]).then(([p, s, m]) => {
      if (p?.success) setPl(p.data);
      if (s?.success) {
        const exists = (s.data || []).some((x: any) => x.playlist?.id === p?.data?.id);
        setSaved(exists);
      }
      if (m?.success) setMe(m.data);
    }).finally(() => setLoading(false));
  }, [id]);

  const toggleSave = async () => {
    const token = authStorage.getToken();
    if (!token) {
      toast.error('Войдите, чтобы сохранять плейлисты');
      return;
    }
    if (!pl?.id) return;
    setBusy(true);
    try {
      if (saved) {
        await fetch(`/api/users/me/saved-playlists?playlistId=${pl.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
        setSaved(false);
      } else {
        const r = await fetch('/api/users/me/saved-playlists', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ playlistId: pl.id }),
        });
        const j = await r.json();
        if (j.success) setSaved(true);
        else toast.error(j.error || 'Не удалось сохранить');
      }
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="max-w-4xl mx-auto px-4 py-10 text-center text-[var(--text-secondary)]">Загрузка…</div>;
  }
  if (!pl) {
    return <div className="max-w-4xl mx-auto px-4 py-10 text-center text-[var(--text-secondary)]">Плейлист не найден или скрыт.</div>;
  }

  const isOwner = me?.id && pl.user?.id === me.id;
  const tracks = (pl.tracks || []).map((pt: any) => pt.track).filter(Boolean);

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-6 py-8 space-y-6">
      <section className="apple-card p-6 md:p-8 flex flex-col sm:flex-row gap-5">
        <div className="w-32 h-32 md:w-44 md:h-44 rounded-2xl bg-gray-100 overflow-hidden shrink-0">
          {pl.cover && <img src={pl.cover} alt="" className="w-full h-full object-cover" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs uppercase tracking-widest font-semibold text-[var(--text-secondary)] mb-1">
            Плейлист {pl.isPublic ? '· публичный' : '· скрытый'}
          </div>
          <h1 className="text-2xl md:text-4xl font-black tracking-tight">{pl.title}</h1>
          {pl.description && (
            <p className="text-sm text-[var(--text-secondary)] mt-2">{pl.description}</p>
          )}
          <div className="text-xs text-[var(--text-secondary)] mt-3">
            от{' '}
            <Link href={`/users/${pl.user?.username || pl.user?.id}`} className="underline">
              @{pl.user?.username || 'автор'}
            </Link>
            {' · '}
            {tracks.length} треков
          </div>
          <div className="flex gap-2 mt-4 flex-wrap">
            {tracks.length > 0 && (
              <button
                onClick={() => playTrack(tracks[0] as any, { tracks: tracks as any, index: 0, source: `playlist:${pl.id}` })}
                className="px-5 py-2.5 rounded-full bg-[var(--text-primary)] text-white font-semibold text-sm inline-flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
                Воспроизвести
              </button>
            )}
            {isOwner && (
              <button
                onClick={() => { setAddOpen(true); setAddedIds({}); setQ(''); setResults([]); }}
                className="px-5 py-2.5 rounded-full bg-white border border-[var(--text-primary)] text-[var(--text-primary)] font-semibold text-sm hover:bg-[var(--hover)] flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v14M5 12h14" /></svg>
                Добавить треки
              </button>
            )}
            {!isOwner && (
              <button
                onClick={toggleSave}
                disabled={busy}
                className={`px-5 py-2.5 rounded-full font-semibold text-sm transition-colors disabled:opacity-50 ${
                  saved
                    ? 'bg-[var(--hover)] text-[var(--text-primary)] hover:bg-gray-200'
                    : 'bg-white border border-[var(--text-primary)] text-[var(--text-primary)] hover:bg-[var(--hover)]'
                }`}>
                {busy ? '…' : saved ? (
                  <span className="inline-flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                    Сохранён
                  </span>
                ) : 'Сохранить'}
              </button>
            )}
          </div>
        </div>
      </section>

      {tracks.length === 0 ? (
        <div className="apple-card p-10 text-center text-[var(--text-secondary)]">
          Плейлист пуст.
          {isOwner && (
            <div className="mt-4">
              <button
                onClick={() => { setAddOpen(true); setAddedIds({}); setQ(''); setResults([]); }}
                className="px-5 py-2.5 rounded-full bg-[var(--text-primary)] text-white font-semibold text-sm inline-flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v14M5 12h14" /></svg>
                Добавить треки
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="apple-card overflow-hidden">
          {tracks.map((t: any, i: number) => (
            <button
              key={t.id}
              onClick={() => playTrack(t, { tracks: tracks as any, index: i, source: `playlist:${pl.id}` })}
              className="w-full flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--hover)] text-left">
              <div className="w-8 text-center text-xs text-[var(--text-secondary)] tabular-nums">{i + 1}</div>
              <div className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden shrink-0">
                {t.cover && <img src={t.cover} alt="" className="w-full h-full object-cover" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{t.title}</div>
                <div className="text-xs text-[var(--text-secondary)] truncate">{t.artist?.name}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {addOpen && (
        <div
          className="fixed inset-0 z-[1200] flex items-center justify-center p-4 bg-black/45 backdrop-blur-md"
          onClick={() => setAddOpen(false)}>
          <div
            className="apple-card w-full max-w-md p-5 shadow-2xl animate-fadeInUp"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold tracking-tight">Добавить треки</h3>
              <button onClick={() => setAddOpen(false)} aria-label="Закрыть" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] p-1">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Поиск трека или артиста…"
              className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-white text-sm mb-3"
            />
            <div className="max-h-72 overflow-y-auto rounded-xl border border-[var(--border)]">
              {searching ? (
                <div className="p-4 text-center text-xs text-[var(--text-secondary)]">Поиск…</div>
              ) : results.length === 0 ? (
                <div className="p-4 text-center text-xs text-[var(--text-secondary)]">Начните вводить название трека</div>
              ) : (
                results.map((t: any) => (
                  <div key={t.id} className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border)] last:border-0">
                    <div className="w-9 h-9 rounded-md bg-gray-100 overflow-hidden shrink-0">
                      {t.cover && <img src={t.cover} alt="" className="w-full h-full object-cover" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{t.title}</div>
                      <div className="text-[11px] text-[var(--text-secondary)] truncate">{t.artist?.name || ''}</div>
                    </div>
                    <button
                      onClick={() => addTrack(t)}
                      disabled={addingId === t.id || addedIds[t.id]}
                      aria-label="Добавить в плейлист"
                      className="p-1.5 rounded-full shrink-0 disabled:opacity-100 bg-[var(--hover)] hover:bg-gray-200 text-[var(--text-primary)]">
                      {addedIds[t.id] ? (
                        <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                      ) : addingId === t.id ? (
                        <span className="block w-4 h-4 text-center text-xs leading-4 text-[var(--text-secondary)]">…</span>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v14M5 12h14" /></svg>
                      )}
                    </button>
                  </div>
                ))
              )}
            </div>
            <p className="text-[11px] text-[var(--text-secondary)] mt-3 text-center">
              Добавлять треки в плейлист может только его владелец.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
