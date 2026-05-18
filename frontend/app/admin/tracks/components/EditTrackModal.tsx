'use client';

import { useState, useEffect } from 'react';
import { toast } from '@/app/admin/lib/toast';
import { X } from 'lucide-react';
import AudioUploader from '@/app/admin/components/AudioUploader';
import CoverUploader from '@/app/admin/components/CoverUploader';
import PdfUploader from '@/app/admin/components/PdfUploader';

interface Artist {
  id: string;
  name: string;
  slug: string;
}

interface Genre {
  id: string;
  name: string;
  slug: string;
}

interface Track {
  id: string;
  title: string;
  slug: string;
  duration: number;
  audioUrl: string;
  cover: string | null;
  status: string;
  artistId: string;
  genres: Array<{ genre: { id: string } }>;
  sheetMusic?: {
    pdfUrl: string;
    instrument: string;
    difficulty: string;
    price: number | null;
    isPublicDomain: boolean;
  } | null;
}

interface EditTrackModalProps {
  isOpen: boolean;
  track: Track | null;
  onClose: () => void;
  onSubmit: (trackId: string, formData: any) => Promise<void>;
  artists: Artist[];
  genres: Genre[];
}

const inputCls =
  'w-full px-3 py-2 rounded-xl border border-gray-300 bg-white focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 outline-none';

export default function EditTrackModal({
  isOpen,
  track,
  onClose,
  onSubmit,
  artists,
  genres,
}: EditTrackModalProps) {
  const [formData, setFormData] = useState<any>({
    title: '',
    slug: '',
    duration: 180,
    // Файлы
    audioUrl: '',
    instrumentalUrl: '',
    cover: '',
    sheetPdfUrl: '',
    audioType: 'FULL',
    // Основное
    artistId: '',
    albumId: '',
    genreIds: [] as string[],
    releaseDate: '',
    recordingYear: '',
    recordingPlace: '',
    originalComposer: '',
    contentType: 'ORIGINAL',
    // Метаданные
    era: '',
    mood: '',
    instruments: '',
    difficulty: '',
    tempo: '',
    bpm: '',
    key: '',
    // Текст
    lyrics: '',
    // Монетизация
    price: '',
    instrumentalPrice: '',
    isForSale: false,
    isFree: false,
    allowDonations: true,
    allowExclusive: false,
    // Статус (только админ может ставить любой)
    status: 'PUBLISHED',
    // Ноты дополнительно
    hasSheetMusic: false,
    sheetInstrument: 'Фортепиано',
    sheetDifficulty: 'BEGINNER',
    sheetPrice: '',
    isPublicDomain: false,
  });
  const [regions, setRegions] = useState<{ id: string; name: string }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingFull, setLoadingFull] = useState(false);

  // Загружаем регионы (для dropdown "Место записи")
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

  // При открытии модалки подгружаем полные данные трека с V2-полями
  useEffect(() => {
    if (!track || !isOpen) return;
    setLoadingFull(true);
    const token = typeof window !== 'undefined' ? localStorage.getItem('sonatum_token') : null;
    fetch(`/api/admin/tracks/${track.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((j) => {
        const d = j.success ? j.data : track;
        setFormData((prev: any) => ({
          ...prev,
          title: d.title || '',
          slug: d.slug || '',
          duration: d.duration || 180,
          audioUrl: d.audioUrl || '',
          instrumentalUrl: d.instrumentalUrl || '',
          cover: d.cover || '',
          audioType: d.audioType || 'FULL',
          artistId: d.artistId || track.artistId || '',
          albumId: d.albumId || '',
          genreIds: (d.genres || track.genres || []).map((g: any) => g.genre?.id || g.genreId).filter(Boolean),
          releaseDate: d.releaseDate ? new Date(d.releaseDate).toISOString().slice(0, 10) : '',
          recordingYear: d.recordingYear ? String(d.recordingYear) : '',
          recordingPlace: d.recordingPlace || '',
          originalComposer: d.originalComposer || '',
          contentType: d.contentType || 'ORIGINAL',
          era: d.era || '',
          mood: d.mood || '',
          instruments: Array.isArray(d.instruments) ? d.instruments.join(', ') : (d.instruments || ''),
          difficulty: d.difficulty || '',
          tempo: d.tempo || '',
          bpm: d.bpm ? String(d.bpm) : '',
          key: d.key || '',
          lyrics: d.lyrics || '',
          price: d.price ? String(d.price) : '',
          instrumentalPrice: d.instrumentalPrice ? String(d.instrumentalPrice) : '',
          isForSale: !!d.isForSale,
          isFree: !!d.isFree,
          allowDonations: d.allowDonations ?? true,
          allowExclusive: !!d.allowExclusive,
          status: d.status || 'PUBLISHED',
          hasSheetMusic: !!d.sheetMusic,
          sheetPdfUrl: d.sheetMusic?.pdfUrl || '',
          sheetInstrument: d.sheetMusic?.instrument || 'Фортепиано',
          sheetDifficulty: d.sheetMusic?.difficulty || 'BEGINNER',
          sheetPrice: d.sheetMusic?.price ? String(d.sheetMusic.price) : '',
          isPublicDomain: !!d.sheetMusic?.isPublicDomain,
        }));
      })
      .catch(() => {})
      .finally(() => setLoadingFull(false));
  }, [track, isOpen]);

  const generateSlug = (title: string) => {
    const map: Record<string, string> = {
      'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
      'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
      'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
      'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch',
      'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
    };
    return title
      .toLowerCase()
      .split('')
      .map((c) => map[c] || c)
      .join('')
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .trim();
  };

  const set = (k: string, v: any) => setFormData((p: any) => ({ ...p, [k]: v }));
  const toggleGenre = (id: string) =>
    setFormData((p: any) => ({
      ...p,
      genreIds: p.genreIds.includes(id) ? p.genreIds.filter((g: string) => g !== id) : [...p.genreIds, id],
    }));

  const handleSubmit = async () => {
    if (!track || !formData.title || !formData.artistId) {
      toast('Заполните название и артиста', 'error');
      return;
    }
    setIsSubmitting(true);
    try {
      const payload = {
        ...formData,
        sheetPdfUrl: formData.hasSheetMusic ? formData.sheetPdfUrl || '' : '',
        instruments: formData.instruments
          ? formData.instruments.split(',').map((s: string) => s.trim()).filter(Boolean)
          : null,
      };
      await onSubmit(track.id, payload);
      onClose();
    } catch (e) {
      console.error('Error updating track:', e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedArtist = artists.find((a) => a.id === formData.artistId);

  if (!isOpen || !track) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200 shrink-0">
          <h2 className="text-xl font-semibold text-gray-900">Редактировать трек</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-900">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body — прокручиваемая область */}
        <div className="overflow-y-auto px-5 py-5 space-y-6 flex-1">
          {loadingFull && (
            <div className="text-sm text-gray-500">Загрузка данных трека…</div>
          )}

          {/* ФАЙЛЫ */}
          <section className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-700">Файлы</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Основное аудио *</label>
              <AudioUploader
                artistSlug={selectedArtist?.slug || 'unknown'}
                trackSlug={formData.slug || 'untitled'}
                onUploadComplete={(audioUrl, duration) => {
                  set('audioUrl', audioUrl);
                  set('duration', Math.round(duration));
                }}
                currentAudioUrl={formData.audioUrl}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">URL минусовки</label>
              <input
                value={formData.instrumentalUrl}
                onChange={(e) => set('instrumentalUrl', e.target.value)}
                placeholder="/audio/tracks/.../track-instr.mp3"
                className={inputCls}
              />
              <p className="text-xs text-gray-500 mt-1">
                Загрузка отдельной минусовки через интерфейс автора /author/upload; здесь — путь.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Обложка трека</label>
              <CoverUploader
                artistSlug={selectedArtist?.slug || 'unknown'}
                trackSlug={formData.slug || 'untitled'}
                onUploadComplete={(coverUrl) => set('cover', coverUrl)}
                currentCoverUrl={formData.cover}
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="checkbox"
                checked={formData.hasSheetMusic}
                onChange={(e) => set('hasSheetMusic', e.target.checked)}
                className="accent-black"
              />
              Прикрепить ноты (PDF)
            </label>
            {formData.hasSheetMusic && (
              <div className="space-y-3 pl-5 border-l-2 border-gray-200">
                <PdfUploader
                  titleSlug={formData.slug || 'untitled'}
                  onUploadComplete={(pdfUrl) => set('sheetPdfUrl', pdfUrl)}
                  currentPdfUrl={formData.sheetPdfUrl}
                />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Инструмент</label>
                    <input value={formData.sheetInstrument} onChange={(e) => set('sheetInstrument', e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Сложность нот</label>
                    <select value={formData.sheetDifficulty} onChange={(e) => set('sheetDifficulty', e.target.value)} className={inputCls}>
                      <option value="BEGINNER">Начальный</option>
                      <option value="INTERMEDIATE">Средний</option>
                      <option value="ADVANCED">Продвинутый</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Цена нот (₽)</label>
                    <input type="number" value={formData.sheetPrice} onChange={(e) => set('sheetPrice', e.target.value)} className={inputCls} placeholder="0 = бесплатно" />
                  </div>
                  <label className="flex items-center gap-2 text-sm pt-6">
                    <input type="checkbox" checked={formData.isPublicDomain} onChange={(e) => set('isPublicDomain', e.target.checked)} className="accent-black" />
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
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Название *</label>
              <input
                value={formData.title}
                onChange={(e) => {
                  set('title', e.target.value);
                  set('slug', generateSlug(e.target.value));
                }}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Slug (URL)</label>
              <input value={formData.slug} onChange={(e) => set('slug', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Артист *</label>
              <select value={formData.artistId} onChange={(e) => set('artistId', e.target.value)} className={inputCls}>
                <option value="">Выберите артиста</option>
                {artists.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Год записи</label>
                <input type="number" value={formData.recordingYear} onChange={(e) => set('recordingYear', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Место записи</label>
                <select value={formData.recordingPlace} onChange={(e) => set('recordingPlace', e.target.value)} className={inputCls}>
                  <option value="">— не указано —</option>
                  {formData.recordingPlace && !regions.some((r) => r.name === formData.recordingPlace) && (
                    <option value={formData.recordingPlace}>{formData.recordingPlace}</option>
                  )}
                  {regions.map((r) => (
                    <option key={r.id} value={r.name}>{r.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Автор оригинала (для кавера)</label>
              <input value={formData.originalComposer} onChange={(e) => set('originalComposer', e.target.value)} placeholder="оставьте пустым, если оригинал" className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Жанры</label>
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 border border-gray-300 rounded-xl">
                {genres.map((g) => (
                  <label key={g.id} className="flex items-center gap-2 cursor-pointer text-sm">
                    <input type="checkbox" checked={formData.genreIds.includes(g.id)} onChange={() => toggleGenre(g.id)} className="accent-black" />
                    <span>{g.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </section>

          {/* МЕТАДАННЫЕ */}
          <section className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-700">Метаданные</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Эпоха</label>
                <input value={formData.era} onChange={(e) => set('era', e.target.value)} placeholder="Барокко, XX век…" className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Настроение</label>
                <input value={formData.mood} onChange={(e) => set('mood', e.target.value)} placeholder="лирическое, торжественное…" className={inputCls} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Инструменты (через запятую)</label>
              <input value={formData.instruments} onChange={(e) => set('instruments', e.target.value)} placeholder="фортепиано, скрипка, виолончель" className={inputCls} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Сложность</label>
                <select value={formData.difficulty} onChange={(e) => set('difficulty', e.target.value)} className={inputCls}>
                  <option value="">—</option>
                  <option value="BEGINNER">Начальный</option>
                  <option value="INTERMEDIATE">Средний</option>
                  <option value="ADVANCED">Продвинутый</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Темп</label>
                <input value={formData.tempo} onChange={(e) => set('tempo', e.target.value)} placeholder="Allegro, 120 BPM" className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">BPM</label>
                <input type="number" value={formData.bpm} onChange={(e) => set('bpm', e.target.value)} className={inputCls} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Тональность</label>
              <input value={formData.key} onChange={(e) => set('key', e.target.value)} placeholder="C, G♭, Am…" className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Дата релиза</label>
              <input type="date" value={formData.releaseDate} onChange={(e) => set('releaseDate', e.target.value)} className={inputCls} />
            </div>
          </section>

          {/* ТЕКСТ */}
          <section className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-700">Текст произведения</h3>
            <textarea value={formData.lyrics} onChange={(e) => set('lyrics', e.target.value)} rows={5} placeholder="Полный текст (для Premium)" className={`${inputCls} resize-none`} />
          </section>

          {/* МОНЕТИЗАЦИЯ */}
          <section className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-700">Монетизация</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Цена основной версии (₽)</label>
                <input type="number" min="0" value={formData.price} onChange={(e) => set('price', e.target.value)} placeholder="не продаётся" className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Цена минусовки (₽)</label>
                <input type="number" min="0" value={formData.instrumentalPrice} onChange={(e) => set('instrumentalPrice', e.target.value)} placeholder="нет минусовки" className={inputCls} />
              </div>
            </div>
            <div className="flex gap-5 flex-wrap pt-1">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={formData.isForSale} onChange={(e) => set('isForSale', e.target.checked)} className="accent-black" />
                Продаётся
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={formData.isFree} onChange={(e) => set('isFree', e.target.checked)} className="accent-black" />
                Бесплатно
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={formData.allowDonations} onChange={(e) => set('allowDonations', e.target.checked)} className="accent-black" />
                Принимать донаты
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={formData.allowExclusive} onChange={(e) => set('allowExclusive', e.target.checked)} className="accent-black" />
                Эксклюзивная лицензия
              </label>
            </div>
          </section>

          {/* СТАТУС МОДЕРАЦИИ — только админ */}
          <section className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-700">Статус модерации</h3>
            <select value={formData.status} onChange={(e) => set('status', e.target.value)} className={inputCls}>
              <option value="PUBLISHED">Опубликован</option>
              <option value="PENDING">На модерации</option>
              <option value="DRAFT">Черновик</option>
              <option value="REJECTED">Отклонён</option>
              <option value="ARCHIVED">В архиве</option>
            </select>
          </section>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-5 border-t border-gray-200 shrink-0">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors">
            Отмена
          </button>
          <button
            onClick={handleSubmit}
            disabled={!formData.title || !formData.artistId || isSubmitting}
            className="flex-1 px-4 py-3 bg-black text-white rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {isSubmitting ? 'Сохранение…' : 'Сохранить изменения'}
          </button>
        </div>
      </div>
    </div>
  );
}
