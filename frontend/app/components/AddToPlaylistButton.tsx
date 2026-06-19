'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePlayer } from '@/context/PlayerContext';
import Portal from './Portal';

type MyPlaylist = { id: string; title: string };

const TOKEN_KEY = 'sonatum_token';
const getToken = () =>
  typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) || '' : '';

export default function AddToPlaylistButton({ className = '' }: { className?: string }) {
  const { currentTrack } = usePlayer();
  const trackId = (currentTrack as any)?.id as string | undefined;

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [playlists, setPlaylists] = useState<MyPlaylist[]>([]);
  const [added, setAdded] = useState<Record<string, boolean>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [newOpen, setNewOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [creating, setCreating] = useState(false);

  const auth = () => ({ Authorization: `Bearer ${getToken()}` });

  const loadPlaylists = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const r = await fetch('/api/playlists', { headers: auth() });
      const j = await r.json();
      const list: MyPlaylist[] = (j?.data || []).map((p: any) => ({ id: p.id, title: p.title }));
      setPlaylists(list);
    } catch {
      setErr('Не удалось загрузить плейлисты');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setAdded({});
      setNewOpen(false);
      setNewTitle('');
      loadPlaylists();
    }
  }, [open, loadPlaylists]);

  const onOpen = () => {
    if (!trackId) return;
    if (!getToken()) { setErr('not-auth'); setOpen(true); return; }
    setOpen(true);
  };

  const addTo = async (playlistId: string) => {
    if (!trackId || busyId) return;
    setBusyId(playlistId);
    setErr('');
    try {
      const r = await fetch(`/api/playlists/${playlistId}/tracks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...auth() },
        body: JSON.stringify({ trackId }),
      });
      const j = await r.json();
      // «уже в плейлисте» тоже считаем успехом — трек там есть.
      if (j.success || /already/i.test(j.error || '')) {
        setAdded((s) => ({ ...s, [playlistId]: true }));
      } else {
        setErr(j.error || 'Не удалось добавить');
      }
    } catch {
      setErr('Ошибка сети');
    } finally {
      setBusyId(null);
    }
  };

  const createAndAdd = async () => {
    if (!trackId || !newTitle.trim() || creating) return;
    setCreating(true);
    setErr('');
    try {
      const r = await fetch('/api/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...auth() },
        body: JSON.stringify({ title: newTitle.trim(), description: null, cover: null, isPublic: true }),
      });
      const j = await r.json();
      if (!j.success || !j.data?.id) { setErr(j.error || 'Не удалось создать'); return; }
      const id = j.data.id;
      await fetch(`/api/playlists/${id}/tracks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...auth() },
        body: JSON.stringify({ trackId }),
      });
      setPlaylists((p) => [{ id, title: newTitle.trim() }, ...p]);
      setAdded((s) => ({ ...s, [id]: true }));
      setNewOpen(false);
      setNewTitle('');
    } catch {
      setErr('Ошибка сети');
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <button
        onClick={onOpen}
        disabled={!trackId}
        title="Добавить в плейлист"
        aria-label="Добавить в плейлист"
        className={`transition-all hover:text-[var(--text-primary)] text-[var(--text-secondary)] ${!trackId ? 'opacity-50 cursor-not-allowed' : 'hover:scale-110'} ${className}`}>
        {/* иконка: список с плюсом */}
        <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h11M4 12h11M4 18h7M17 15v6M14 18h6" />
        </svg>
      </button>

      {open && (
        <Portal>
          <div
            className="fixed inset-0 z-[1200] flex items-center justify-center p-4 bg-black/45 backdrop-blur-md"
            onClick={() => !busyId && !creating && setOpen(false)}>
            <div
              className="apple-card w-full max-w-sm p-5 shadow-2xl animate-fadeInUp"
              onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold tracking-tight">Добавить в плейлист</h3>
                <button onClick={() => setOpen(false)} aria-label="Закрыть" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] p-1">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {currentTrack && (
                <p className="text-xs text-[var(--text-secondary)] mb-3 truncate">
                  Трек: <span className="font-medium text-[var(--text-primary)]">{(currentTrack as any).title}</span>
                </p>
              )}

              {err === 'not-auth' ? (
                <div className="text-sm text-[var(--text-secondary)] py-4 text-center">
                  Войдите в аккаунт, чтобы добавлять треки в плейлисты.
                </div>
              ) : (
                <>
                  {err && err !== 'not-auth' && (
                    <div className="apple-card p-2.5 bg-red-50 border-red-200 text-xs text-red-600 mb-3">{err}</div>
                  )}

                  <div className="max-h-60 overflow-y-auto -mx-1 px-1 space-y-1">
                    {loading ? (
                      <div className="py-6 text-center text-xs text-[var(--text-secondary)]">Загрузка…</div>
                    ) : playlists.length === 0 ? (
                      <div className="py-4 text-center text-xs text-[var(--text-secondary)]">
                        У вас пока нет плейлистов — создайте новый ниже.
                      </div>
                    ) : (
                      playlists.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => addTo(p.id)}
                          disabled={!!busyId || added[p.id]}
                          className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl hover:bg-[var(--hover)] text-left transition-colors disabled:opacity-100">
                          <span className="text-sm truncate">{p.title}</span>
                          {added[p.id] ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 shrink-0">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                              </svg>
                              добавлен
                            </span>
                          ) : busyId === p.id ? (
                            <span className="text-xs text-[var(--text-secondary)] shrink-0">…</span>
                          ) : (
                            <svg className="w-5 h-5 text-[var(--text-secondary)] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v14M5 12h14" />
                            </svg>
                          )}
                        </button>
                      ))
                    )}
                  </div>

                  <div className="mt-3 pt-3 border-t border-[var(--border)]">
                    {newOpen ? (
                      <div className="flex items-center gap-2">
                        <input
                          autoFocus
                          value={newTitle}
                          onChange={(e) => setNewTitle(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') createAndAdd(); }}
                          placeholder="Название плейлиста"
                          maxLength={100}
                          className="flex-1 px-3 py-2 rounded-xl border border-[var(--border)] bg-white text-sm"
                        />
                        <button
                          onClick={createAndAdd}
                          disabled={creating || !newTitle.trim()}
                          className="px-4 py-2 rounded-xl bg-[var(--text-primary)] text-white text-sm font-medium disabled:opacity-40 shrink-0">
                          {creating ? '…' : 'Создать'}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setNewOpen(true)}
                        className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl hover:bg-[var(--hover)] text-left text-sm font-medium transition-colors">
                        <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v14M5 12h14" />
                        </svg>
                        Новый плейлист с этим треком
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </Portal>
      )}
    </>
  );
}
