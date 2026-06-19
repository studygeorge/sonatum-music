'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { authStorage } from '@/app/lib/auth';
import { usePlayer } from '@/context/PlayerContext';
import ImageCropper from '@/app/components/ImageCropper';

import Portal from "@/app/components/Portal";
import { toast } from '@/app/components/Toast';
type Track = {
  id: string;
  title: string;
  cover?: string | null;
  audioUrl?: string;
  artist?: { name?: string } | null;
};

type SavedPlaylist = {
  id: string;
  savedAt: string;
  playlist: {
    id: string;
    title: string;
    slug: string;
    cover?: string | null;
    description?: string | null;
    trackCount: number;
    duration: number;
    owner: { id: string; username: string; avatar?: string | null };
  };
};

type MyPlaylist = {
  id: string;
  title: string;
  slug: string;
  cover?: string | null;
  isPublic: boolean;
  trackCount: number;
};


export default function LibraryTab() {
  const { playTrack } = usePlayer();
  const [liked, setLiked] = useState<Track[]>([]);
  const [saved, setSaved] = useState<SavedPlaylist[]>([]);
  const [mine, setMine] = useState<MyPlaylist[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<MyPlaylist | null>(null);

  const auth = () => ({
    Authorization: `Bearer ${authStorage.getToken() || ''}`,
  });

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [a, b, c] = await Promise.all([
        fetch('/api/likes', { headers: auth() }).then(r => r.json()).catch(() => null),
        fetch('/api/users/me/saved-playlists', { headers: auth() }).then(r => r.json()).catch(() => null),
        fetch('/api/playlists', { headers: auth() }).then(r => r.json()).catch(() => null),
      ]);
      if (a?.success) setLiked(a.data || []);
      if (b?.success) setSaved(b.data || []);
      if (c?.success) {
        setMine((c.data || []).map((p: any) => ({
          id: p.id, title: p.title, slug: p.slug, cover: p.cover,
          isPublic: p.isPublic, trackCount: p.trackCount || (p.tracks?.length || 0),
        })));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const removeSaved = async (playlistId: string) => {
    const prev = saved;
    setSaved(s => s.filter(x => x.playlist.id !== playlistId));
    try {
      await fetch(`/api/users/me/saved-playlists?playlistId=${playlistId}`, { method: 'DELETE', headers: auth() });
    } catch { setSaved(prev); }
  };

  const togglePublic = async (id: string, isPublic: boolean) => {
    setMine(list => list.map(p => p.id === id ? { ...p, isPublic } : p));
    try {
      await fetch(`/api/playlists/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...auth() },
        body: JSON.stringify({ isPublic }),
      });
    } catch {}
  };

  const deletePlaylist = async (id: string) => {
    if (!confirm('Удалить плейлист? Это действие нельзя отменить.')) return;
    const prev = mine;
    setMine(list => list.filter(p => p.id !== id));
    try {
      const r = await fetch(`/api/playlists/${id}`, { method: 'DELETE', headers: auth() });
      const j = await r.json();
      if (!j.success) {
        setMine(prev);
        toast.error(j.error || 'Не удалось удалить');
      }
    } catch {
      setMine(prev);
    }
  };

  useEffect(() => {
    load();
  }, [load]);

  const removeLike = async (trackId: string) => {
    const prev = liked;
    setLiked(l => l.filter(t => t.id !== trackId));
    try {
      await fetch(`/api/likes/${trackId}`, { method: 'DELETE', headers: auth() });
    } catch {
      setLiked(prev);
    }
  };

  return (
    <div className="space-y-8 animate-fadeInUp">

      {/* Лайки */}
      <section>
        <div className="flex items-end justify-between mb-3">
          <h2 className="text-2xl font-bold tracking-tight">Мои треки</h2>
          <span className="text-sm text-[var(--text-secondary)] tabular-nums">
            {liked.length}
          </span>
        </div>
        {loading ? (
          <div className="text-sm text-[var(--text-secondary)] py-6 text-center">
            Загрузка…
          </div>
        ) : liked.length === 0 ? (
          <div className="apple-card p-6 text-sm text-center text-[var(--text-secondary)]">
            Лайкните трек в плеере (кнопкой-сердечком) — он появится здесь
          </div>
        ) : (
          <div className="apple-card overflow-hidden">
            {liked.map((t, i) => (
              <TrackRow
                key={t.id}
                track={t}
                onPlay={() => playTrack(t as any, { tracks: liked as any, index: i, source: 'liked' })}
                onRemove={() => removeLike(t.id)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Мои плейлисты */}
      <section>
        <div className="flex items-end justify-between mb-3">
          <h2 className="text-2xl font-bold tracking-tight">Мои плейлисты</h2>
          <div className="flex items-center gap-3">
            <span className="text-sm text-[var(--text-secondary)] tabular-nums">{mine.length}</span>
            <button
              onClick={() => setCreateOpen(true)}
              className="px-4 py-1.5 rounded-full bg-[var(--text-primary)] text-white text-xs font-semibold hover:bg-gray-800 transition-colors">
              + Создать
            </button>
          </div>
        </div>
        {mine.length === 0 ? (
          <div className="apple-card p-6 text-sm text-center text-[var(--text-secondary)]">
            У вас пока нет плейлистов. Нажмите «+ Создать», чтобы добавить первый.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {mine.map((p) => (
              <div key={p.id} className="apple-card p-4 flex gap-3 items-center group">
                <Link href={`/playlists/${p.slug || p.id}`} className="w-16 h-16 rounded-lg bg-gray-100 overflow-hidden shrink-0">
                  {p.cover && <img src={p.cover} alt="" className="w-full h-full object-cover" />}
                </Link>
                <div className="flex-1 min-w-0">
                  <Link href={`/playlists/${p.slug || p.id}`} className="font-semibold text-sm truncate block">
                    {p.title}
                  </Link>
                  <div className="text-xs text-[var(--text-secondary)]">{p.trackCount} треков</div>
                  <label className="inline-flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)] mt-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={p.isPublic}
                      onChange={(e) => togglePublic(p.id, e.target.checked)}
                      className="w-3.5 h-3.5 accent-[var(--text-primary)]"
                    />
                    {p.isPublic ? 'Опубликован' : 'Скрыт'}
                  </label>
                </div>
                <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => setEditing(p)}
                    title="Редактировать"
                    className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] p-1.5 rounded-lg hover:bg-[var(--hover)]">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  </button>
                  <button
                    onClick={() => deletePlaylist(p.id)}
                    title="Удалить"
                    className="text-[var(--text-secondary)] hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {createOpen && (
        <PlaylistFormModal
          onClose={() => setCreateOpen(false)}
          onSaved={() => { setCreateOpen(false); load(); }}
        />
      )}
      {editing && (
        <PlaylistFormModal
          playlist={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}

      {/* Сохранённые чужие плейлисты */}
      <section>
        <div className="flex items-end justify-between mb-3">
          <h2 className="text-2xl font-bold tracking-tight">Сохранённые плейлисты</h2>
          <span className="text-sm text-[var(--text-secondary)] tabular-nums">{saved.length}</span>
        </div>
        {saved.length === 0 ? (
          <div className="apple-card p-6 text-sm text-center text-[var(--text-secondary)]">
            Нажмите «Сохранить» на странице любого публичного плейлиста — он появится здесь.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {saved.map((s) => (
              <div key={s.id} className="apple-card p-4 flex gap-3 items-center group">
                <Link href={`/playlists/${s.playlist.slug || s.playlist.id}`} className="w-16 h-16 rounded-lg bg-gray-100 overflow-hidden shrink-0">
                  {s.playlist.cover && <img src={s.playlist.cover} alt="" className="w-full h-full object-cover" />}
                </Link>
                <div className="flex-1 min-w-0">
                  <Link href={`/playlists/${s.playlist.slug || s.playlist.id}`} className="font-semibold text-sm truncate block">
                    {s.playlist.title}
                  </Link>
                  <div className="text-xs text-[var(--text-secondary)]">
                    {s.playlist.trackCount} треков · @{s.playlist.owner.username}
                  </div>
                </div>
                <button
                  onClick={() => removeSaved(s.playlist.id)}
                  title="Убрать из сохранённых"
                  className="text-[var(--text-secondary)] hover:text-red-500 transition-colors p-2 opacity-0 group-hover:opacity-100">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

    </div>
  );
}

function TrackRow({
  track,
  onPlay,
  onRemove,
}: {
  track: Track;
  onPlay: () => void;
  onRemove?: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-3 h-14 hover:bg-[var(--hover)] transition-colors group">
      <button onClick={onPlay} className="flex items-center gap-3 flex-1 min-w-0 text-left">
        <div className="w-10 h-10 rounded-md bg-gray-100 overflow-hidden shrink-0 relative">
          {track.cover && (
            <img src={track.cover} alt="" className="absolute inset-0 w-full h-full object-cover" />
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold truncate">{track.title}</div>
          <div className="text-xs text-[var(--text-secondary)] truncate">
            {track.artist?.name}
          </div>
        </div>
      </button>
      {onRemove && (
        <button
          onClick={onRemove}
          title="Убрать из моих"
          className="text-[var(--text-secondary)] hover:text-red-500 transition-colors p-2 opacity-0 group-hover:opacity-100"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  );
}


function PlaylistFormModal({
  playlist,
  onClose,
  onSaved,
}: {
  playlist?: MyPlaylist;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!playlist;
  const [title, setTitle] = useState(playlist?.title || '');
  const [description, setDescription] = useState('');
  const [cover, setCover] = useState(playlist?.cover || '');
  const [isPublic, setIsPublic] = useState(playlist?.isPublic ?? true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [uploading, setUploading] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  // Первый трек (обязательно при создании)
  const [firstTrack, setFirstTrack] = useState<any | null>(null);
  const [trackQuery, setTrackQuery] = useState('');
  const [trackResults, setTrackResults] = useState<any[]>([]);
  const [tracksLoading, setTracksLoading] = useState(false);

  const auth = () => ({ Authorization: `Bearer ${authStorage.getToken() || ''}` });

  // Загружаем актуальные данные плейлиста при редактировании
  useEffect(() => {
    if (playlist) {
      fetch(`/api/playlists/${playlist.id}`, { headers: auth() })
        .then(r => r.json())
        .then(j => {
          if (j.success && j.data) {
            setDescription(j.data.description || '');
            setCover(j.data.cover || '');
          }
        })
        .catch(() => {});
    }
  }, [playlist?.id]);

  // Шаг 1: пользователь выбрал файл — открываем кроп
  const onFile = (f: File | null) => {
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) { setErr('Файл больше 10 МБ'); return; }
    setErr('');
    const url = URL.createObjectURL(f);
    setCropSrc(url);
    setCropOpen(true);
  };

  // Шаг 2: получили обрезанный blob — загружаем
  const uploadCropped = async (blob: Blob) => {
    setCropOpen(false);
    if (cropSrc) { try { URL.revokeObjectURL(cropSrc); } catch {} }
    setCropSrc(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', new File([blob], 'cover.jpg', { type: 'image/jpeg' }));
      fd.append('userSlug', 'playlist');
      const r = await fetch('/api/upload/avatar', { method: 'POST', body: fd });
      const j = await r.json();
      const url = j?.data?.avatarUrl || j?.avatarUrl || j?.url;
      if (j.success && url) setCover(url);
      else setErr('Не удалось загрузить обложку');
    } catch (e: any) {
      setErr(e?.message || 'Ошибка загрузки');
    } finally {
      setUploading(false);
    }
  };

  const cancelCrop = () => {
    setCropOpen(false);
    if (cropSrc) { try { URL.revokeObjectURL(cropSrc); } catch {} }
    setCropSrc(null);
  };

  // Поиск треков (для выбора стартового)
  useEffect(() => {
    if (isEdit) return; // при редактировании не нужно
    const t = setTimeout(async () => {
      setTracksLoading(true);
      try {
        const r = await fetch(`/api/tracks/search?q=${encodeURIComponent(trackQuery)}&limit=20`);
        const j = await r.json();
        if (j.success) setTrackResults(j.data || []);
      } finally { setTracksLoading(false); }
    }, 250);
    return () => clearTimeout(t);
  }, [trackQuery, isEdit]);

  const submit = async () => {
    setErr('');
    if (!title.trim()) { setErr('Введите название'); return; }
    if (!isEdit && !firstTrack) { setErr('Выберите хотя бы один трек'); return; }
    setBusy(true);
    try {
      const url = isEdit ? `/api/playlists/${playlist!.id}` : '/api/playlists';
      const method = isEdit ? 'PATCH' : 'POST';
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...auth() },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          cover: cover || null,
          isPublic,
        }),
      });
      const j = await r.json();
      if (!j.success) { setErr(j.error || 'Ошибка'); return; }

      // Если новый плейлист — добавляем первый трек
      if (!isEdit && firstTrack) {
        const plId = j.data?.id;
        if (plId) {
          const tr = await fetch(`/api/playlists/${plId}/tracks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...auth() },
            body: JSON.stringify({ trackId: firstTrack.id }),
          });
          const tj = await tr.json();
          if (!tj.success) {
            setErr('Плейлист создан, но трек не добавился: ' + (tj.error || 'ошибка'));
            // всё равно закрываем и обновляем — плейлист уже есть
          }
        }
      }
      onSaved();
    } finally { setBusy(false); }
  };

  return (
<Portal>
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/45 backdrop-blur-md"
         onClick={() => !busy && !uploading && onClose()}>
      <div className="apple-card max-w-md w-full p-6 shadow-2xl animate-fadeInUp" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-xl font-bold tracking-tight">
            {isEdit ? 'Редактировать плейлист' : 'Новый плейлист'}
          </h3>
          <button onClick={onClose} className="text-2xl leading-none"></button>
        </div>

        <div className="space-y-3">
          {err && <div className="apple-card p-3 bg-red-50 border-red-200 text-sm text-red-600">{err}</div>}

          <div>
            <label className="block text-sm font-medium mb-1">Название *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
              className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-white text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Описание</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Что объединяет эти треки?"
              className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-white text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Обложка</label>
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 rounded-lg bg-gray-100 overflow-hidden shrink-0">
                {cover && <img src={cover} alt="" className="w-full h-full object-cover" />}
              </div>
              <label className={`px-4 py-2 rounded-full text-sm font-medium cursor-pointer ${uploading ? 'bg-gray-200 text-gray-500' : 'bg-[var(--hover)] hover:bg-gray-200'}`}>
                {uploading ? 'Загрузка…' : cover ? 'Заменить' : 'Загрузить'}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => { onFile(e.target.files?.[0] || null); e.target.value = ''; }}
                />
              </label>
              {cover && (
                <button type="button" onClick={() => setCover('')} className="text-xs text-[var(--text-secondary)] hover:text-red-500">
                  убрать
                </button>
              )}
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="w-4 h-4 accent-[var(--text-primary)]"
            />
            <span className="text-sm">Опубликован (виден другим)</span>
          </label>

          {/* Выбор первого трека — только при создании */}
          {!isEdit && (
            <div>
              <label className="block text-sm font-medium mb-1">Первый трек *</label>
              {firstTrack ? (
                <div className="flex items-center gap-2 p-2 rounded-xl border border-[var(--border)] bg-[var(--hover)]">
                  <div className="w-10 h-10 rounded-md bg-gray-100 overflow-hidden shrink-0">
                    {firstTrack.cover && <img src={firstTrack.cover} alt="" className="w-full h-full object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{firstTrack.title}</div>
                    <div className="text-xs text-[var(--text-secondary)] truncate">{firstTrack.artist?.name || ''}</div>
                  </div>
                  <button type="button" onClick={() => setFirstTrack(null)} className="text-xs text-[var(--text-secondary)] hover:text-red-500 px-2">
                    убрать
                  </button>
                </div>
              ) : (
                <>
                  <input
                    type="search"
                    value={trackQuery}
                    onChange={(e) => setTrackQuery(e.target.value)}
                    placeholder="Поиск трека или артиста…"
                    className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-white text-sm mb-2"
                  />
                  <div className="max-h-48 overflow-y-auto rounded-xl border border-[var(--border)] bg-white">
                    {tracksLoading ? (
                      <div className="p-4 text-center text-xs text-[var(--text-secondary)]">Поиск…</div>
                    ) : trackResults.length === 0 ? (
                      <div className="p-4 text-center text-xs text-[var(--text-secondary)]">Ничего не найдено</div>
                    ) : (
                      trackResults.map((t) => (
                        <button
                          type="button"
                          key={t.id}
                          onClick={() => setFirstTrack(t)}
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--hover)] text-left border-b border-[var(--border)] last:border-b-0">
                          <div className="w-8 h-8 rounded-md bg-gray-100 overflow-hidden shrink-0">
                            {t.cover && <img src={t.cover} alt="" className="w-full h-full object-cover" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium truncate">{t.title}</div>
                            <div className="text-[10px] text-[var(--text-secondary)] truncate">{t.artist?.name || ''}</div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </>
              )}
              <p className="text-[11px] text-[var(--text-secondary)] mt-1">
                В плейлисте должен быть хотя бы один трек. Добавите остальные позже из плеера.
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border)]">
            <button onClick={onClose} disabled={busy} className="px-5 py-2.5 rounded-full bg-[var(--hover)] text-sm font-medium">
              Отмена
            </button>
            <button
              onClick={submit}
              disabled={busy || !title.trim() || (!isEdit && !firstTrack)}
              className="px-6 py-2.5 rounded-full bg-[var(--text-primary)] text-white text-sm font-medium disabled:opacity-40">
              {busy ? 'Сохраняем…' : isEdit ? 'Сохранить' : 'Создать'}
            </button>
          </div>
        </div>
      </div>
    </div>
    <ImageCropper
      open={cropOpen && !!cropSrc}
      imageUrl={cropSrc || ''}
      freeAspect
      title="Кадрирование обложки"
      onCancel={cancelCrop}
      onCropped={uploadCropped}
    />
</Portal>
  );
}
