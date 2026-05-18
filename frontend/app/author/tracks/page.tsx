'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { authStorage } from '@/app/lib/auth';

type Track = {
  id: string;
  title: string;
  slug: string;
  cover: string | null;
  duration: number;
  audioUrl: string;
  price: any;
  instrumentalPrice?: any;
  isForSale: boolean;
  isFree: boolean;
  playCount: number;
  likeCount: number;
  purchaseCount: number;
  status: string;
  createdAt: string;
  releaseDate: string | null;
  lyrics?: string | null;
  bpm?: number | null;
  key?: string | null;
};

// Монохромные статусы — никаких зелёных/красных/жёлтых.
const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: 'Черновик', cls: 'bg-gray-100 text-gray-700 border border-gray-200' },
  PENDING: { label: 'На модерации', cls: 'bg-gray-700 text-white' },
  PUBLISHED: { label: 'Опубликован', cls: 'bg-black text-white' },
  REJECTED: { label: 'Отклонён', cls: 'bg-white text-black border-2 border-black' },
  ARCHIVED: { label: 'В архиве', cls: 'bg-gray-200 text-gray-500' },
};

function fmtDuration(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function AuthorTracksPageInner() {
  const sp = useSearchParams();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'PUBLISHED' | 'PENDING' | 'DRAFT' | 'REJECTED'>('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const justUploaded = sp.get('uploaded') === '1';

  const load = () => {
    fetch('/api/author/tracks', {
      headers: { Authorization: `Bearer ${authStorage.getToken() || ''}` },
    })
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setTracks(j.data || []);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = tracks.filter((t) => filter === 'ALL' || t.status === filter);

  const onSaved = (updated: Track) => {
    setTracks((prev) => prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)));
    setExpandedId(null);
  };
  const onDeleted = (id: string) => {
    setTracks((prev) => prev.filter((t) => t.id !== id));
    setExpandedId(null);
  };

  return (
    <div className="space-y-6 animate-fadeInUp">
      {justUploaded && (
        <div className="apple-card p-4 bg-gray-50 border border-gray-200 text-sm text-gray-900">
          Трек отправлен на модерацию. После проверки он появится в каталоге.
        </div>
      )}

      <section className="relative rounded-3xl overflow-hidden p-7 md:p-10 text-white flex items-end justify-between gap-4 bg-gray-900">
        <div className="relative z-10 max-w-xl">
          <div className="text-xs uppercase tracking-widest font-semibold mb-2 opacity-80">
            Дискография
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">Мои треки</h1>
          <p className="text-sm md:text-base text-white/75 mt-2">
            Всего: {tracks.length}
          </p>
        </div>
        <Link
          href="/author/upload"
          className="px-5 py-3 rounded-full bg-white text-gray-900 font-semibold text-sm whitespace-nowrap shrink-0 hover:bg-gray-100 transition-colors">
          + Загрузить
        </Link>
      </section>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {[
          { v: 'ALL', l: `Все · ${tracks.length}` },
          { v: 'PUBLISHED', l: `Опубликован · ${tracks.filter(t => t.status === 'PUBLISHED').length}` },
          { v: 'PENDING', l: `На модерации · ${tracks.filter(t => t.status === 'PENDING').length}` },
          { v: 'DRAFT', l: `Черновики · ${tracks.filter(t => t.status === 'DRAFT').length}` },
          { v: 'REJECTED', l: `Отклонён · ${tracks.filter(t => t.status === 'REJECTED').length}` },
        ].map((f) => (
          <button
            key={f.v}
            onClick={() => setFilter(f.v as any)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              filter === f.v
                ? 'bg-[var(--text-primary)] text-white'
                : 'bg-[var(--hover)] text-[var(--text-primary)] hover:bg-[var(--border)]'
            }`}>
            {f.l}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center text-[var(--text-secondary)] py-12">Загрузка…</div>
      ) : filtered.length === 0 ? (
        <div className="apple-card p-12 text-center">
          <h3 className="font-semibold mb-1">Пока ничего</h3>
          <p className="text-sm text-[var(--text-secondary)] mb-5">
            Загрузите первый трек, чтобы начать продавать лицензии и получать роялти.
          </p>
          <Link
            href="/author/upload"
            className="inline-block px-6 py-3 rounded-full bg-[var(--text-primary)] text-white font-medium hover:opacity-90 transition-opacity">
            Загрузить трек
          </Link>
        </div>
      ) : (
        <div className="apple-card overflow-hidden">
          {filtered.map((t) => {
            const s = STATUS_LABEL[t.status] || STATUS_LABEL.DRAFT;
            const expanded = expandedId === t.id;
            return (
              <div key={t.id} className="border-b border-[var(--border)] last:border-b-0">
                <div
                  className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                    expanded ? 'bg-[var(--hover)]' : 'hover:bg-[var(--hover)]'
                  }`}>
                  <div className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden shrink-0 flex items-center justify-center text-sm font-bold text-gray-400">
                    {t.cover ? (
                      <img src={t.cover} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span>{(t.title || '?').trim()[0]?.toUpperCase() || '?'}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold truncate">{t.title}</span>
                      {/* Бейдж показываем только для не-опубликованных — для published
                         это шум, и так понятно что он живёт в каталоге. */}
                      {t.status !== 'PUBLISHED' && (
                        <span className={`text-[11px] px-2 py-0.5 rounded-full shrink-0 ${s.cls}`}>
                          {s.label}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-[var(--text-secondary)] mt-0.5 flex items-center gap-3 flex-wrap">
                      <span>{fmtDuration(t.duration)}</span>
                      <span>· {t.playCount.toLocaleString('ru-RU')} прослушиваний</span>
                      <span>· {t.purchaseCount} продаж</span>
                      {t.price && Number(t.price) > 0 && (
                        <span>· {Number(t.price).toLocaleString('ru-RU')} ₽</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => setExpandedId(expanded ? null : t.id)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                        expanded
                          ? 'bg-black text-white hover:bg-gray-800'
                          : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                      }`}
                      title={expanded ? 'Свернуть' : 'Редактировать'}>
                      {expanded ? 'Свернуть' : 'Редактировать'}
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className={`transition-transform ${expanded ? 'rotate-180' : ''}`}>
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>
                    <Link
                      href={`/tracks/${t.slug}`}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors hidden sm:inline-block">
                      Открыть
                    </Link>
                  </div>
                </div>

                {/* Inline-форма редактирования — раскрывается под строкой,
                   ничего не перекрывает плеер и навигацию */}
                {expanded && (
                  <EditTrackInline
                    track={t}
                    onSaved={onSaved}
                    onDeleted={onDeleted}
                    onClose={() => setExpandedId(null)}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EditTrackInline({
  track,
  onSaved,
  onDeleted,
  onClose,
}: {
  track: Track;
  onSaved: (t: Track) => void;
  onDeleted: (id: string) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(track.title || '');
  const [lyrics, setLyrics] = useState(track.lyrics || '');
  const [price, setPrice] = useState<string>(track.price ? String(track.price) : '');
  const [instrumentalPrice, setInstrumentalPrice] = useState<string>(
    track.instrumentalPrice ? String(track.instrumentalPrice) : ''
  );
  const [isForSale, setIsForSale] = useState(!!track.isForSale);
  const [isFree, setIsFree] = useState(!!track.isFree);
  const [cover, setCover] = useState(track.cover || '');
  const [bpm, setBpm] = useState<string>(track.bpm ? String(track.bpm) : '');
  const [musKey, setMusKey] = useState(track.key || '');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const r = await fetch(`/api/author/tracks/${track.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authStorage.getToken() || ''}`,
        },
        body: JSON.stringify({
          title,
          lyrics,
          cover,
          price,
          instrumentalPrice,
          isForSale,
          isFree,
          bpm,
          key: musKey,
        }),
      });
      const j = await r.json();
      if (!j.success) throw new Error(j.error || 'Ошибка сохранения');
      onSaved(j.data);
    } catch (e: any) {
      setError(e?.message || 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setDeleting(true);
    try {
      const r = await fetch(`/api/author/tracks/${track.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authStorage.getToken() || ''}` },
      });
      const j = await r.json();
      if (j.success) {
        onDeleted(track.id);
      } else {
        setError(j.error || 'Не удалось удалить');
      }
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="bg-gray-50 border-t border-gray-200 px-4 sm:px-6 py-5 space-y-4">
      {track.status === 'PUBLISHED' && (
        <div className="text-xs bg-white border border-gray-200 rounded-lg p-3 text-gray-700">
          После сохранения трек будет отправлен на повторную модерацию.
        </div>
      )}
      {error && (
        <div className="text-sm bg-white border-2 border-black rounded-lg p-3 text-black">{error}</div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Название</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-white focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 outline-none"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Цена основной версии (₽)</label>
          <input
            type="number"
            min="0"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="не продаётся"
            className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-white focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Цена минусовки (₽)</label>
          <input
            type="number"
            min="0"
            value={instrumentalPrice}
            onChange={(e) => setInstrumentalPrice(e.target.value)}
            placeholder="нет минусовки"
            className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-white focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">BPM</label>
          <input
            type="number"
            value={bpm}
            onChange={(e) => setBpm(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-white focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Тональность</label>
          <input
            value={musKey}
            onChange={(e) => setMusKey(e.target.value)}
            placeholder="C, G♭, Am..."
            className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-white focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 outline-none"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">URL обложки</label>
        <input
          value={cover}
          onChange={(e) => setCover(e.target.value)}
          placeholder="/images/cover.jpg или https://..."
          className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-white focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 outline-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Текст</label>
        <textarea
          value={lyrics}
          onChange={(e) => setLyrics(e.target.value)}
          rows={5}
          className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-white focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 outline-none resize-none"
        />
      </div>

      <div className="flex gap-4 flex-wrap">
        <label className="flex items-center gap-2 text-sm text-gray-900 cursor-pointer">
          <input
            type="checkbox"
            checked={isForSale}
            onChange={(e) => setIsForSale(e.target.checked)}
            className="accent-black"
          />
          Продаётся
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-900 cursor-pointer">
          <input
            type="checkbox"
            checked={isFree}
            onChange={(e) => setIsFree(e.target.checked)}
            className="accent-black"
          />
          Бесплатно
        </label>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3 pt-3 border-t border-gray-200">
        {confirmDelete ? (
          <div className="flex items-center gap-2 text-sm flex-wrap">
            <span className="text-gray-700">Удалить трек насовсем?</span>
            <button
              onClick={remove}
              disabled={deleting}
              className="px-3 py-1.5 rounded-lg bg-black text-white text-sm font-medium hover:bg-gray-800 disabled:opacity-50">
              {deleting ? 'Удаляем…' : 'Удалить'}
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="px-3 py-1.5 rounded-lg bg-white border border-gray-300 text-gray-900 text-sm font-medium hover:bg-gray-100">
              Отмена
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="text-sm text-gray-500 hover:text-black underline underline-offset-2">
            Удалить трек
          </button>
        )}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-full bg-white border border-gray-300 text-gray-900 font-medium hover:bg-gray-100 transition-colors">
            Отмена
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="px-6 py-2 rounded-full bg-black text-white font-medium hover:bg-gray-800 transition-colors disabled:opacity-50">
            {saving ? 'Сохраняем…' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AuthorTracksPage() {
  return (
    <Suspense fallback={<div className="text-sm text-[var(--text-secondary)] py-6">Загрузка…</div>}>
      <AuthorTracksPageInner />
    </Suspense>
  );
}
