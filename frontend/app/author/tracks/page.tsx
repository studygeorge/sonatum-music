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
  hasPendingChanges?: boolean;
  pendingSubmittedAt?: string | null;
};

// Монохромные статусы — никаких зелёных/красных/жёлтых.
const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: 'Черновик', cls: 'bg-gray-100 text-gray-700 border border-gray-200' },
  PENDING: { label: 'На модерации', cls: 'bg-gray-700 text-white' },
  PUBLISHED: { label: 'Опубликован', cls: 'bg-black text-white' },
  REJECTED: { label: 'Отклонён', cls: 'bg-white text-black border-2 border-black' },
  ARCHIVED: { label: 'В архиве', cls: 'bg-gray-200 text-gray-500' },
};

// Извлечь длительность аудио-файла через временный <audio>-элемент.
function getAudioDurationFromFile(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const audio = document.createElement('audio');
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      const d = audio.duration;
      if (isFinite(d) && d > 0) resolve(d); else reject(new Error('bad'));
    };
    audio.onerror = () => { URL.revokeObjectURL(url); reject(new Error('err')); };
    audio.src = url;
  });
}

function fmtDuration(s: number) {
  if (!s || s <= 0) return null;
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
                      {/* Клик на названии — переход на публичную страницу трека */}
                      <Link
                        href={`/tracks/${t.slug}`}
                        className="font-semibold truncate hover:underline">
                        {t.title}
                      </Link>
                      {/* Бейдж показываем только для не-опубликованных — для published
                         это шум, и так понятно что он живёт в каталоге. */}
                      {t.status !== 'PUBLISHED' && (
                        <span className={`text-[11px] px-2 py-0.5 rounded-full shrink-0 ${s.cls}`}>
                          {s.label}
                        </span>
                      )}
                      {/* Опубликованный трек с ожидающими правками — отдельный бейдж */}
                      {t.status === 'PUBLISHED' && t.hasPendingChanges && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full shrink-0 bg-gray-700 text-white">
                          На модерации
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-[var(--text-secondary)] mt-0.5 flex items-center gap-3 flex-wrap">
                      {fmtDuration(t.duration) && <span>{fmtDuration(t.duration)}</span>}
                      <span>{t.playCount.toLocaleString('ru-RU')} прослушиваний</span>
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

type FullTrack = Track & {
  contentType?: string | null;
  originalComposer?: string | null;
  recordingYear?: number | null;
  recordingPlace?: string | null;
  era?: string | null;
  mood?: string | null;
  instruments?: any;
  difficulty?: string | null;
  tempo?: string | null;
  hasMinus?: boolean | null;
  minusAudioUrl?: string | null;
  minusPrice?: number | null;
  allowDonations?: boolean | null;
  allowExclusive?: boolean | null;
  sheetUrl?: string | null;
  instrumentalUrl?: string | null;
};

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
  // Загружаем полные данные по треку (включая V2-поля и ноты)
  const [data, setData] = useState<FullTrack | null>(null);
  const [loading, setLoading] = useState(true);

  // Поля
  const [title, setTitle] = useState(track.title || '');
  const [lyrics, setLyrics] = useState('');
  const [price, setPrice] = useState<string>('');
  const [instrumentalPrice, setInstrumentalPrice] = useState<string>('');
  const [isForSale, setIsForSale] = useState(false);
  const [isFree, setIsFree] = useState(false);
  const [cover, setCover] = useState('');
  const [bpm, setBpm] = useState<string>('');
  const [musKey, setMusKey] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [duration, setDuration] = useState<number>(0); // длительность в секундах
  const [instrumentalUrl, setInstrumentalUrl] = useState('');
  const [sheetUrl, setSheetUrl] = useState('');
  // Параметры нот
  const [sheetInstrument, setSheetInstrument] = useState('Фортепиано');
  const [sheetDifficulty, setSheetDifficulty] = useState('BEGINNER');
  const [sheetPrice, setSheetPrice] = useState<string>('');
  const [sheetIsPublicDomain, setSheetIsPublicDomain] = useState(false);
  const [era, setEra] = useState('');
  const [mood, setMood] = useState('');
  const [instruments, setInstruments] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [tempo, setTempo] = useState('');
  const [recordingPlace, setRecordingPlace] = useState('');
  const [recordingYear, setRecordingYear] = useState<string>('');
  const [originalComposer, setOriginalComposer] = useState('');
  const [allowDonations, setAllowDonations] = useState(true);
  const [allowExclusive, setAllowExclusive] = useState(false);

  // Состояния загрузки файлов
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [uploadingMinus, setUploadingMinus] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);

  // Список регионов России для выпадающего списка "Место записи"
  const [regions, setRegions] = useState<{ id: string; name: string }[]>([]);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Список регионов — для dropdown
  useEffect(() => {
    fetch('/api/map/regions')
      .then((r) => r.json())
      .then((j) => {
        if (j.success && Array.isArray(j.data)) {
          setRegions(
            j.data
              .map((r: any) => ({ id: r.id, name: r.name }))
              .sort((a: any, b: any) => a.name.localeCompare(b.name, 'ru'))
          );
        }
      })
      .catch(() => {});
  }, []);

  // Подгрузить полные данные
  useEffect(() => {
    fetch(`/api/author/tracks/${track.id}`, {
      headers: { Authorization: `Bearer ${authStorage.getToken() || ''}` },
    })
      .then((r) => r.json())
      .then((j) => {
        if (j.success && j.data) {
          const d = j.data as FullTrack;
          setData(d);
          setTitle(d.title || '');
          setLyrics(d.lyrics || '');
          setPrice(d.price ? String(d.price) : '');
          setInstrumentalPrice(d.instrumentalPrice ? String(d.instrumentalPrice) : '');
          setIsForSale(!!d.isForSale);
          setIsFree(!!d.isFree);
          setCover(d.cover || '');
          setBpm(d.bpm ? String(d.bpm) : '');
          setMusKey(d.key || '');
          setAudioUrl(d.audioUrl || '');
          setDuration(Number(d.duration) || 0);
          setInstrumentalUrl(d.instrumentalUrl || d.minusAudioUrl || '');
          setSheetUrl(d.sheetUrl || '');
          setSheetInstrument((d as any).sheetInstrument || 'Фортепиано');
          setSheetDifficulty((d as any).sheetDifficulty || 'BEGINNER');
          setSheetPrice((d as any).sheetPrice ? String((d as any).sheetPrice) : '');
          setSheetIsPublicDomain(!!(d as any).sheetIsPublicDomain);
          setEra(d.era || '');
          setMood(d.mood || '');
          setInstruments(Array.isArray(d.instruments) ? d.instruments.join(', ') : (d.instruments || ''));
          setDifficulty(d.difficulty || '');
          setTempo(d.tempo || '');
          setRecordingPlace(d.recordingPlace || '');
          setRecordingYear(d.recordingYear ? String(d.recordingYear) : '');
          setOriginalComposer(d.originalComposer || '');
          setAllowDonations(d.allowDonations ?? true);
          setAllowExclusive(!!d.allowExclusive);
        }
      })
      .finally(() => setLoading(false));
  }, [track.id]);

  // Артист-слаг из URL аудио (для генерации имени файла при upload)
  const artistSlug = (audioUrl.match(/\/audio\/tracks\/([^/]+)\//) || [, 'unknown'])[1];
  const trackSlug = track.slug || 'track';

  const uploadFile = async (
    file: File,
    endpoint: string,
    extra: Record<string, string> = {}
  ): Promise<string | null> => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('artistSlug', artistSlug);
    fd.append('trackSlug', trackSlug);
    Object.entries(extra).forEach(([k, v]) => fd.append(k, v));
    const r = await fetch(endpoint, { method: 'POST', body: fd });
    const j = await r.json();
    if (!j.success) throw new Error(j.error || 'Ошибка загрузки');
    return j.data?.audioUrl || j.data?.coverUrl || j.data?.pdfUrl || j.data?.url || j.audioUrl || j.coverUrl || j.pdfUrl || j.url || null;
  };

  const onAudioFile = async (f: File | null) => {
    if (!f) return;
    setUploadingAudio(true);
    setError('');
    try {
      // Сначала извлекаем реальную длительность из MP3
      try {
        const d = await getAudioDurationFromFile(f);
        if (d > 0) setDuration(Math.round(d));
      } catch {}
      const url = await uploadFile(f, '/api/upload/audio');
      if (url) setAudioUrl(url);
    } catch (e: any) {
      setError(e?.message || 'Ошибка загрузки аудио');
    } finally {
      setUploadingAudio(false);
    }
  };
  const onMinusFile = async (f: File | null) => {
    if (!f) return;
    setUploadingMinus(true);
    setError('');
    try {
      const url = await uploadFile(f, '/api/upload/audio', { kind: 'instrumental' });
      if (url) setInstrumentalUrl(url);
    } catch (e: any) {
      setError(e?.message || 'Ошибка загрузки минусовки');
    } finally {
      setUploadingMinus(false);
    }
  };
  const onCoverFile = async (f: File | null) => {
    if (!f) return;
    setUploadingCover(true);
    setError('');
    try {
      const url = await uploadFile(f, '/api/upload/cover');
      if (url) setCover(url);
    } catch (e: any) {
      setError(e?.message || 'Ошибка загрузки обложки');
    } finally {
      setUploadingCover(false);
    }
  };
  const onPdfFile = async (f: File | null) => {
    if (!f) return;
    setUploadingPdf(true);
    setError('');
    try {
      const url = await uploadFile(f, '/api/upload/pdf');
      if (url) setSheetUrl(url);
    } catch (e: any) {
      setError(e?.message || 'Ошибка загрузки PDF');
    } finally {
      setUploadingPdf(false);
    }
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const payload: any = {
        title,
        lyrics,
        cover,
        price,
        instrumentalPrice,
        isForSale,
        isFree,
        bpm,
        key: musKey,
        audioUrl,
        duration, // секунд (0 если sheet-only)
        instrumentalUrl,
        sheetUrl,
        sheetInstrument,
        sheetDifficulty,
        sheetPrice,
        sheetIsPublicDomain,
        era,
        mood,
        instruments: instruments
          ? instruments.split(',').map((s) => s.trim()).filter(Boolean)
          : null,
        difficulty,
        tempo,
        recordingPlace,
        recordingYear: recordingYear ? Number(recordingYear) : null,
        originalComposer,
        allowDonations,
        allowExclusive,
      };
      const r = await fetch(`/api/author/tracks/${track.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authStorage.getToken() || ''}`,
        },
        body: JSON.stringify(payload),
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

  if (loading) {
    return (
      <div className="bg-gray-50 border-t border-gray-200 px-4 sm:px-6 py-8 text-center text-sm text-gray-500">
        Загрузка данных трека…
      </div>
    );
  }

  const inputCls = 'w-full px-3 py-2 rounded-xl border border-gray-300 bg-white focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 outline-none';

  return (
    <div className="bg-gray-50 border-t border-gray-200 px-4 sm:px-6 py-5 space-y-6">
      {track.status === 'PUBLISHED' && (
        <div className="text-xs bg-white border border-gray-200 rounded-lg p-3 text-gray-700">
          Опубликованная версия будет видна слушателям без изменений до тех пор,
          пока администратор не одобрит ваши правки. Ваши изменения сохраняются
          как «черновик правок» и не влияют на публичный трек.
        </div>
      )}
      {(data as any)?.hasPendingChanges && (
        <div className="text-xs bg-gray-100 border border-gray-300 rounded-lg p-3 text-gray-900">
          У этого трека уже есть отправленные правки, ожидающие модерации. Любые новые изменения
          заменят предыдущие.
        </div>
      )}
      {error && (
        <div className="text-sm bg-white border-2 border-black rounded-lg p-3 text-black">{error}</div>
      )}

      {/* ФАЙЛЫ */}
      <section className="space-y-3">
        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-700">Файлы</h3>

        <FileRow
          label="Основное аудио"
          currentUrl={audioUrl}
          uploading={uploadingAudio}
          accept="audio/*"
          onFile={onAudioFile}
          onClear={() => setAudioUrl('')}
        />
        <FileRow
          label="Минусовка"
          currentUrl={instrumentalUrl}
          uploading={uploadingMinus}
          accept="audio/*"
          onFile={onMinusFile}
          onClear={() => setInstrumentalUrl('')}
        />
        <FileRow
          label="Обложка"
          currentUrl={cover}
          uploading={uploadingCover}
          accept="image/*"
          onFile={onCoverFile}
          onClear={() => setCover('')}
          preview
        />
        <FileRow
          label="Ноты (PDF)"
          currentUrl={sheetUrl}
          uploading={uploadingPdf}
          accept="application/pdf"
          onFile={onPdfFile}
          onClear={() => setSheetUrl('')}
        />

        {/* Параметры нот — показываются когда PDF прикреплён */}
        {sheetUrl && (
          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
            <div className="text-xs uppercase tracking-wider font-bold text-gray-700">Параметры нот</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Инструмент</label>
                <input
                  value={sheetInstrument}
                  onChange={(e) => setSheetInstrument(e.target.value)}
                  placeholder="Фортепиано, Скрипка, Хор…"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Сложность нот</label>
                <select
                  value={sheetDifficulty}
                  onChange={(e) => setSheetDifficulty(e.target.value)}
                  className={inputCls}>
                  <option value="BEGINNER">Начальный</option>
                  <option value="INTERMEDIATE">Средний</option>
                  <option value="ADVANCED">Продвинутый</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Цена нот (₽)</label>
                <input
                  type="number"
                  min="0"
                  value={sheetPrice}
                  onChange={(e) => setSheetPrice(e.target.value)}
                  placeholder="0 = бесплатно"
                  className={inputCls}
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-900 cursor-pointer sm:mt-7">
                <input
                  type="checkbox"
                  checked={sheetIsPublicDomain}
                  onChange={(e) => setSheetIsPublicDomain(e.target.checked)}
                  className="accent-black"
                />
                Общественное достояние
              </label>
            </div>
          </div>
        )}
      </section>

      {/* ОСНОВНОЕ */}
      <section className="space-y-3">
        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-700">Основное</h3>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Название</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Год записи</label>
            <input
              type="number"
              value={recordingYear}
              onChange={(e) => setRecordingYear(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Место записи</label>
            <select
              value={recordingPlace}
              onChange={(e) => setRecordingPlace(e.target.value)}
              className={inputCls}>
              <option value="">— не указано —</option>
              {/* Если в значении уже есть что-то нестандартное (ввели вручную до dropdown), сохраняем */}
              {recordingPlace && !regions.some((r) => r.name === recordingPlace) && (
                <option value={recordingPlace}>{recordingPlace}</option>
              )}
              {regions.map((r) => (
                <option key={r.id} value={r.name}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Автор оригинала (для кавера)
          </label>
          <input
            value={originalComposer}
            onChange={(e) => setOriginalComposer(e.target.value)}
            placeholder="оставьте пустым, если это ваше оригинальное произведение"
            className={inputCls}
          />
        </div>
      </section>

      {/* МЕТАДАННЫЕ */}
      <section className="space-y-3">
        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-700">Метаданные</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Эпоха</label>
            <input value={era} onChange={(e) => setEra(e.target.value)} className={inputCls} placeholder="Барокко, XX век…" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Настроение</label>
            <input value={mood} onChange={(e) => setMood(e.target.value)} className={inputCls} placeholder="лирическое, торжественное…" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Инструменты (через запятую)</label>
          <input
            value={instruments}
            onChange={(e) => setInstruments(e.target.value)}
            className={inputCls}
            placeholder="фортепиано, скрипка, виолончель"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Сложность</label>
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className={inputCls}>
              <option value="">—</option>
              <option value="BEGINNER">Начальный</option>
              <option value="INTERMEDIATE">Средний</option>
              <option value="ADVANCED">Продвинутый</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Темп</label>
            <input value={tempo} onChange={(e) => setTempo(e.target.value)} className={inputCls} placeholder="Allegro, 120 BPM" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">BPM</label>
            <input
              type="number"
              value={bpm}
              onChange={(e) => setBpm(e.target.value)}
              className={inputCls}
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Тональность</label>
          <input value={musKey} onChange={(e) => setMusKey(e.target.value)} placeholder="C, G♭, Am…" className={inputCls} />
        </div>
      </section>

      {/* ТЕКСТ */}
      <section className="space-y-3">
        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-700">Текст произведения</h3>
        <textarea
          value={lyrics}
          onChange={(e) => setLyrics(e.target.value)}
          rows={6}
          placeholder="Полный текст произведения (для Premium-подписчиков)"
          className={`${inputCls} resize-none`}
        />
      </section>

      {/* МОНЕТИЗАЦИЯ */}
      <section className="space-y-3">
        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-700">Монетизация</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Цена основной версии (₽)</label>
            <input
              type="number"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="не продаётся"
              className={inputCls}
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
              className={inputCls}
            />
          </div>
        </div>
        <div className="flex gap-5 flex-wrap pt-1">
          <label className="flex items-center gap-2 text-sm text-gray-900 cursor-pointer">
            <input type="checkbox" checked={isForSale} onChange={(e) => setIsForSale(e.target.checked)} className="accent-black" />
            Продаётся
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-900 cursor-pointer">
            <input type="checkbox" checked={isFree} onChange={(e) => setIsFree(e.target.checked)} className="accent-black" />
            Бесплатно
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-900 cursor-pointer">
            <input type="checkbox" checked={allowDonations} onChange={(e) => setAllowDonations(e.target.checked)} className="accent-black" />
            Принимать донаты
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-900 cursor-pointer">
            <input type="checkbox" checked={allowExclusive} onChange={(e) => setAllowExclusive(e.target.checked)} className="accent-black" />
            Эксклюзивная лицензия (по запросу)
          </label>
        </div>
      </section>

      {/* НИЖНИЕ КНОПКИ */}
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

function FileRow({
  label,
  currentUrl,
  uploading,
  accept,
  onFile,
  onClear,
  preview = false,
}: {
  label: string;
  currentUrl: string;
  uploading: boolean;
  accept: string;
  onFile: (f: File | null) => void;
  onClear: () => void;
  preview?: boolean;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 flex items-center gap-3 flex-wrap">
      {preview && currentUrl && (
        <img src={currentUrl} alt="" className="w-12 h-12 rounded-lg object-cover border border-gray-200" />
      )}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-900">{label}</div>
        {currentUrl ? (
          <div className="text-xs text-gray-500 truncate" title={currentUrl}>
            {currentUrl}
          </div>
        ) : (
          <div className="text-xs text-gray-400">не загружено</div>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <label
          className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
            uploading
              ? 'bg-gray-200 text-gray-500'
              : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
          }`}>
          {uploading ? 'Загрузка…' : currentUrl ? 'Заменить' : 'Загрузить'}
          <input
            type="file"
            accept={accept}
            className="hidden"
            disabled={uploading}
            onChange={(e) => onFile(e.target.files?.[0] || null)}
          />
        </label>
        {currentUrl && !uploading && (
          <button
            type="button"
            onClick={onClear}
            title="Убрать"
            className="px-2 py-1.5 rounded-lg text-xs text-gray-500 hover:text-black hover:bg-gray-100">
            ×
          </button>
        )}
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
