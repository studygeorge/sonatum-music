'use client';

import { useEffect, useState, useRef } from 'react';
import { authStorage } from '@/app/lib/auth';
import { usePlayer } from '@/app/context/PlayerContext';

type Upload = {
  id: string;
  title: string;
  artistName: string | null;
  audioUrl: string;
  duration: number | null;
  coverUrl: string | null;
  fileSize: number | null;
  createdAt: string;
};

function formatDuration(s: number | null) {
  if (!s) return '—';
  const m = Math.floor(s / 60), ss = s % 60;
  return `${m}:${ss.toString().padStart(2, '0')}`;
}

function formatSize(b: number | null) {
  if (!b) return '';
  const mb = b / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} МБ` : `${(b / 1024).toFixed(0)} КБ`;
}

// Получение реальной длительности из загруженного файла через Audio API
async function getAudioDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const a = document.createElement('audio');
    a.preload = 'metadata';
    a.onloadedmetadata = () => resolve(Math.round(a.duration) || 0);
    a.onerror = () => resolve(0);
    a.src = URL.createObjectURL(file);
  });
}

export default function PersonalUploadsTab({ user }: { user: any }) {
  const { playTrack } = usePlayer();
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState('');
  const [artistName, setArtistName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<File | null>(null);

  // Используем серверный флаг из /api/auth/me — он уже учитывает status=ACTIVE и endDate.
  // Fallback на старую логику для совместимости со закэшированными user-объектами.
  const isPremium = !!user?.isPremium
    || (user?.subscription?.status === 'ACTIVE'
        && (user?.subscription?.tier === 'PREMIUM' || user?.subscription?.tier === 'STUDENT'));

  const token = () => authStorage.getToken() || '';

  const load = () => {
    setLoading(true);
    fetch('/api/users/me/uploads', { headers: { Authorization: `Bearer ${token()}` } })
      .then((r) => r.json())
      .then((j) => { if (j.success) setUploads(j.data || []); })
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!picked) { setError('Выберите файл'); return; }
    if (!title.trim()) { setError('Укажите название'); return; }
    setError(null);
    setBanner(null);
    setUploading(true);
    try {
      // 1) Загружаем файл через existing /api/upload/audio
      const fd = new FormData();
      fd.append('file', picked);
      fd.append('slug', 'personal-' + Date.now());
      const upRes = await fetch('/api/upload/audio', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}` },
        body: fd,
      });
      const upJson = await upRes.json();
      if (!upRes.ok || !upJson?.success) {
        setError(upJson?.error || 'Не удалось загрузить файл');
        return;
      }
      const audioUrl = upJson.data?.audioUrl || upJson.data?.url || upJson.audioUrl || upJson.url;
      if (!audioUrl) { setError('Сервер не вернул ссылку на файл'); return; }

      // 2) Извлекаем реальную длительность
      const duration = await getAudioDuration(picked);

      // 3) Создаём запись
      const r = await fetch('/api/users/me/uploads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({
          title: title.trim(),
          artistName: artistName.trim() || undefined,
          audioUrl,
          duration,
          fileSize: picked.size,
        }),
      });
      const j = await r.json();
      if (j.success) {
        setBanner('Загружено');
        setTitle(''); setArtistName(''); setPicked(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        load();
      } else {
        setError(j.error || 'Не удалось сохранить');
      }
    } catch (e: any) {
      setError(e?.message || 'Ошибка сети');
    } finally {
      setUploading(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Удалить эту загрузку?')) return;
    try {
      const r = await fetch(`/api/users/me/uploads?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token()}` },
      });
      const j = await r.json();
      if (j.success) load();
    } catch {}
  };

  if (!isPremium) {
    return (
      <div className="apple-card p-10 text-center animate-fadeInUp">
        <div className="text-xs uppercase tracking-widest font-bold text-[var(--text-secondary)] mb-2">Только для Premium</div>
        <h2 className="text-2xl font-bold mb-2">Загрузка своей музыки</h2>
        <p className="text-sm text-[var(--text-secondary)] max-w-md mx-auto mb-5">
          Premium-подписчики могут загружать собственные аудиофайлы — например, чтобы слушать редкие записи через наш плеер.
          <br />
          Это <b>личная библиотека</b>: загрузки видны только вам, в каталог не попадают. Лимит — 50 файлов.
        </p>
        <a
          href="/profile?tab=subscription"
          className="inline-block px-6 py-3 rounded-full bg-[var(--text-primary)] text-white text-sm font-semibold hover:opacity-90">
          Подключить Premium
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeInUp">
      <div>
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Мои загрузки</h2>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Личные аудиофайлы — только для вас, в каталог не попадают. Лимит: 50 файлов.
        </p>
      </div>

      {banner && <div className="apple-card p-3 text-sm">{banner}</div>}
      {error && <div className="apple-card p-3 text-sm border border-black">{error}</div>}

      <form onSubmit={submit} className="apple-card p-5 md:p-6 space-y-3">
        <h3 className="font-bold text-base">Добавить файл</h3>
        <div>
          <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5 block">Аудио (MP3, WAV, FLAC, OGG)</span>
          <input ref={fileInputRef} type="file" accept="audio/*" onChange={(e) => setPicked(e.target.files?.[0] || null)}
            className="block w-full text-sm text-[var(--text-secondary)] file:mr-3 file:px-4 file:py-2 file:rounded-full file:border-0 file:bg-[var(--text-primary)] file:text-white file:font-semibold file:text-xs hover:file:opacity-90 cursor-pointer" />
          {picked && (
            <div className="text-xs text-[var(--text-secondary)] mt-1.5">
              {picked.name} · {formatSize(picked.size)}
            </div>
          )}
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5 block">Название</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} required
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[var(--border)] focus:border-black focus:outline-none text-sm" />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5 block">Исполнитель (необязательно)</span>
            <input value={artistName} onChange={(e) => setArtistName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[var(--border)] focus:border-black focus:outline-none text-sm" />
          </label>
        </div>
        <button type="submit" disabled={uploading || !picked}
          className="px-5 py-2.5 rounded-full bg-[var(--text-primary)] text-white text-sm font-medium disabled:opacity-60">
          {uploading ? 'Загружаем…' : 'Загрузить'}
        </button>
      </form>

      <section className="apple-card p-5 md:p-6">
        <h3 className="font-bold text-base mb-3">
          Ваши файлы <span className="text-sm text-[var(--text-secondary)] font-normal">· {uploads.length}/50</span>
        </h3>
        {loading ? (
          <p className="text-sm text-[var(--text-secondary)]">Загрузка…</p>
        ) : uploads.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)]">Пока ничего не загружено.</p>
        ) : (
          <ol className="space-y-1.5">
            {uploads.map((u, i) => (
              <li key={u.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-black/[0.03]">
                <span className="text-sm font-semibold text-[var(--text-secondary)] w-6 tabular-nums">{i + 1}</span>
                <button
                  onClick={() => playTrack({ id: u.id, title: u.title, audioUrl: u.audioUrl, cover: u.coverUrl, artist: { name: u.artistName } } as any)}
                  className="w-10 h-10 rounded-lg bg-black/[0.06] flex items-center justify-center text-sm hover:bg-black/[0.1]" title="Слушать"><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg></button>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{u.title}</div>
                  <div className="text-xs text-[var(--text-secondary)] truncate">{u.artistName || '—'}</div>
                </div>
                <div className="text-xs text-[var(--text-secondary)] tabular-nums">{formatDuration(u.duration)}</div>
                <button onClick={() => remove(u.id)}
                  className="px-2.5 py-1.5 rounded-full bg-white border border-[var(--border)] text-xs font-semibold hover:bg-gray-100">
                  Удалить
                </button>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
