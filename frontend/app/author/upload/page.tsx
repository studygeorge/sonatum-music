'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { authStorage } from '@/app/lib/auth';

type ContentType = 'ORIGINAL' | 'COVER' | 'SHEET_ONLY';

type LicenseDef = {
  code: string;
  name: string;
  shortName: string;
  audience: string;
  description: string;
  defaultPrice: number;
  commissionPct: number;
  isB2B: boolean;
  requiresManager: boolean;
};

const GENRES = [
  'Академическая', 'Народная (фолк)', 'Духовная', 'Современная классика',
  'Джаз', 'Авторская песня', 'Романс', 'Камерная', 'Хоровая', 'Симфоническая',
  'Оперная', 'Балетная', 'Этно', 'Электроника', 'Кроссовер',
];

const INSTRUMENTS = [
  // Струнные
  'Скрипка', 'Альт', 'Виолончель', 'Контрабас', 'Гитара', 'Арфа',
  // Клавишные
  'Фортепиано', 'Рояль', 'Орган', 'Клавесин', 'Синтезатор',
  // Духовые деревянные
  'Флейта', 'Гобой', 'Кларнет', 'Фагот', 'Саксофон',
  // Духовые медные
  'Труба', 'Валторна', 'Тромбон', 'Туба',
  // Ударные
  'Барабаны', 'Литавры', 'Ксилофон', 'Вибрафон', 'Маримба',
  // Народные
  'Балалайка', 'Домра', 'Гусли', 'Баян', 'Аккордеон', 'Гармонь', 'Жалейка', 'Свирель',
  // Вокал
  'Сопрано', 'Меццо-сопрано', 'Альт (голос)', 'Тенор', 'Баритон', 'Бас', 'Хор',
];

const ERAS = [
  'Средневековье', 'Возрождение', 'Барокко', 'Классицизм', 'Романтизм',
  'XX век', 'Современность',
];

const MOODS = [
  'Светлое', 'Грустное', 'Торжественное', 'Молитвенное', 'Энергичное',
  'Спокойное', 'Драматичное', 'Лирическое',
];

const DIFFICULTIES = [
  { v: 'BEGINNER', l: 'Начальный' },
  { v: 'INTERMEDIATE', l: 'Средний' },
  { v: 'ADVANCED', l: 'Продвинутый' },
  { v: 'EXPERT', l: 'Экспертный' },
];

const TEMPOS = ['Adagio (медленно)', 'Andante (умеренно)', 'Moderato', 'Allegro (быстро)', 'Presto (очень быстро)'];

const slugify = (s: string) =>
  s.toLowerCase()
    .replace(/[^a-z0-9а-яё\s-]/gi, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

export default function UploadWizardPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [regions, setRegions] = useState<{ id: string; name: string }[]>([]);
  const [artistSlug, setArtistSlug] = useState('');
  const [licenses, setLicenses] = useState<LicenseDef[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Шаг 1 — тип контента + файл + базовые поля
  const [contentType, setContentType] = useState<ContentType>('ORIGINAL');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [rightsConfirmed, setRightsConfirmed] = useState(false);

  // Шаг 2 — метаданные
  const [originalComposer, setOriginalComposer] = useState(''); // для кавера
  const [recordingPlace, setRecordingPlace] = useState('');
  const [genre, setGenre] = useState('');
  const [era, setEra] = useState('');
  const [region, setRegion] = useState('');
  const [mood, setMood] = useState('');
  const [instruments, setInstruments] = useState<string[]>([]);
  const [difficulty, setDifficulty] = useState('');
  const [tempo, setTempo] = useState('');

  // Шаг 3 — текст, ноты, монетизация
  const [lyrics, setLyrics] = useState('');
  const [sheetPdfFile, setSheetPdfFile] = useState<File | null>(null);
  const [minusAudioFile, setMinusAudioFile] = useState<File | null>(null);
  const [minusPrice, setMinusPrice] = useState<number>(499);
  const [allowDonations, setAllowDonations] = useState(true);
  const [allowExclusive, setAllowExclusive] = useState(false);
  const [selectedLicenses, setSelectedLicenses] = useState<Record<string, { selected: boolean; price: number }>>({});

  useEffect(() => {
    // Загрузка регионов для select
    fetch('/api/map/regions')
      .then((r) => r.json())
      .then((j) => {
        if (j?.success && Array.isArray(j.data)) {
          setRegions(j.data.map((x: any) => ({ id: x.id, name: x.name })).sort((a: any, b: any) => a.name.localeCompare(b.name, 'ru')));
        }
      })
      .catch(() => {});

    // Load author slug + license catalog
    Promise.all([
      fetch('/api/author/me', {
        headers: { Authorization: `Bearer ${authStorage.getToken() || ''}` },
      }).then((r) => r.json()),
      fetch('/api/licenses').then((r) => r.json()),
    ]).then(([me, lic]) => {
      if (me?.data?.artist?.slug) setArtistSlug(me.data.artist.slug);
      if (lic?.data) {
        setLicenses(lic.data);
        const initial: Record<string, { selected: boolean; price: number }> = {};
        lic.data.forEach((l: LicenseDef) => {
          initial[l.code] = {
            selected: l.code === 'PERSONAL', // По умолчанию включаем личную лицензию
            price: l.defaultPrice,
          };
        });
        setSelectedLicenses(initial);
      }
    });
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!rightsConfirmed) {
      setError('Подтвердите согласие с правами');
      return;
    }
    if (!title.trim()) {
      setError('Введите название');
      return;
    }
    if (contentType !== 'SHEET_ONLY' && !audioFile) {
      setError('Загрузите аудиофайл');
      return;
    }
    if (contentType === 'SHEET_ONLY' && !sheetPdfFile) {
      setError('Загрузите PDF с нотами');
      return;
    }
    if (contentType === 'COVER' && !originalComposer.trim()) {
      setError('Укажите автора оригинала');
      return;
    }
    if (!artistSlug) {
      setError('Профиль автора не найден');
      return;
    }

    setSubmitting(true);
    try {
      const trackSlug = `${slugify(title.trim())}-${Date.now().toString(36)}`;
      const token = authStorage.getToken() || '';

      // 1. Upload audio (если есть)
      let audioUrl = '';
      let duration = 0;
      if (audioFile) {
        const fd = new FormData();
        fd.append('file', audioFile);
        fd.append('artistSlug', artistSlug);
        fd.append('trackSlug', trackSlug);
        const ar = await fetch('/api/upload/audio', {
          method: 'POST',
          body: fd,
        });
        const aj = await ar.json();
        if (!aj.success) throw new Error(aj.error || 'Ошибка загрузки аудио');
        audioUrl = aj.url || aj.audioUrl || aj.data?.url || '';
        duration = aj.duration || aj.data?.duration || 180;
      }

      // 2. Upload cover (если есть)
      let coverUrl = '';
      if (coverFile) {
        const fd = new FormData();
        fd.append('file', coverFile);
        fd.append('artistSlug', artistSlug);
        fd.append('trackSlug', trackSlug);
        const cr = await fetch('/api/upload/cover', {
          method: 'POST',
          body: fd,
        });
        const cj = await cr.json();
        if (cj.success) coverUrl = cj.url || cj.coverUrl || cj.data?.url || '';
      }

      // 3. Upload sheet PDF (если есть)
      let sheetUrl = '';
      if (sheetPdfFile) {
        const fd = new FormData();
        fd.append('file', sheetPdfFile);
        fd.append('artistSlug', artistSlug);
        fd.append('trackSlug', trackSlug);
        const sr = await fetch('/api/upload/pdf', {
          method: 'POST',
          body: fd,
        });
        const sj = await sr.json();
        if (sj.success) sheetUrl = sj.url || sj.pdfUrl || sj.data?.url || '';
      }

      // 4. Upload minus audio (если есть)
      let minusUrl = '';
      if (minusAudioFile) {
        const fd = new FormData();
        fd.append('file', minusAudioFile);
        fd.append('artistSlug', artistSlug);
        fd.append('trackSlug', `${trackSlug}-minus`);
        const mr = await fetch('/api/upload/audio', {
          method: 'POST',
          body: fd,
        });
        const mj = await mr.json();
        if (mj.success) minusUrl = mj.url || mj.data?.url || '';
      }

      // 5. Создаём Track
      const trackPayload: any = {
        title: title.trim(),
        duration: duration || 180,
        audioUrl,
        cover: coverUrl || undefined,
        lyrics: lyrics.trim() || undefined,
        releaseDate: new Date().toISOString(),
        isForSale: Object.values(selectedLicenses).some((v) => v.selected),
        isFree: false,
        price: selectedLicenses.PERSONAL?.selected
          ? selectedLicenses.PERSONAL.price
          : undefined,
      };
      const tr = await fetch('/api/tracks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(trackPayload),
      });
      const tj = await tr.json();
      if (!tj.success) throw new Error(tj.error || 'Ошибка создания трека');
      const trackId = tj.data?.id || tj.track?.id;

      if (!trackId) throw new Error('ID трека не получен');

      // 6. Расширенные поля трека (raw SQL через отдельный эндпоинт)
      await fetch(`/api/tracks/${trackId}/metadata`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          contentType,
          originalComposer: contentType === 'COVER' ? originalComposer : null,
          recordingYear: year,
          recordingPlace: recordingPlace || null,
          era: era || null,
          mood: mood || null,
          instruments: instruments.length > 0 ? instruments : null,
          difficulty: difficulty || null,
          tempo: tempo || null,
          hasMinus: !!minusUrl,
          minusAudioUrl: minusUrl || null,
          minusPrice: minusUrl ? minusPrice : null,
          rightsConfirmed,
          allowDonations,
          allowExclusive,
          sheetUrl: sheetUrl || null,
          region: region || null,
        }),
      }).catch(() => {}); // не блокируем основное создание

      // 7. Лицензии
      const licsList = Object.entries(selectedLicenses)
        .filter(([_, v]) => v.selected)
        .map(([code, v]) => ({ code, price: v.price }));
      if (licsList.length> 0) {
        await fetch(`/api/tracks/${trackId}/licenses`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ licenses: licsList }),
        });
      }

      router.push('/author/tracks?uploaded=1');
    } catch (err: any) {
      setError(err?.message || 'Ошибка загрузки');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeInUp">
      <section
        className="relative rounded-3xl overflow-hidden p-7 md:p-10 text-white"
        style={{
          background: 'linear-gradient(135deg, #1d4cb8 0%, #d52b1e 55%, #e6e6e6 100%)',
        }}>
        <div className="relative z-10 max-w-2xl">
          <div className="text-xs uppercase tracking-widest font-semibold mb-2 opacity-90">
            Новая публикация
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">Загрузить трек</h1>
          <p className="text-sm md:text-base text-white/85 max-w-xl mt-3">
            3 шага: тип и файл  метаданные  текст, ноты и лицензии.
          </p>
        </div>
      </section>
      {/* Прогресс */}
      <div className="flex items-center justify-center gap-3">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-3">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                step>= s ? 'bg-[var(--text-primary)] text-white' : 'bg-[var(--border)] text-[var(--text-secondary)]'
              }`}>
              {s}
            </div>
            {s < 3 && (
              <div className={`w-10 h-px transition-colors ${step> s ? 'bg-[var(--text-primary)]' : 'bg-[var(--border)]'}`} />
            )}
          </div>
        ))}
      </div>
      <form onSubmit={submit} className="space-y-5">
        {error && (
          <div className="apple-card p-4 bg-red-50 border-red-200 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Шаг 1 */}
        {step === 1 && (
          <section className="apple-card p-6 md:p-8 space-y-5">
            <h2 className="text-xl font-bold tracking-tight">Шаг 1. Тип контента и файл</h2>
            <div>
              <label className="block text-sm font-medium mb-2">Тип контента *</label>
              <div className="grid md:grid-cols-3 gap-3">
                <ContentTypeCard
                  active={contentType === 'ORIGINAL'}
                  onClick={() => setContentType('ORIGINAL')}
                  title="Оригинал"
                  desc="Я автор или обладатель смежных прав. Можно продавать."
                />
                <ContentTypeCard
                  active={contentType === 'COVER'}
                  onClick={() => setContentType('COVER')}
                  title="Кавер"
                  desc="Исполнение чужого произведения. Указываю автора оригинала."
                />
                <ContentTypeCard
                  active={contentType === 'SHEET_ONLY'}
                  onClick={() => setContentType('SHEET_ONLY')}
                  title="Только ноты"
                  desc="PDF с нотами без аудиофайла."
                />
              </div>
            </div>
            {contentType !== 'SHEET_ONLY' && (
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Аудиофайл * <span className="text-[var(--text-secondary)] font-normal">MP3 / WAV / FLAC до 200 МБ</span>
                </label>
                <input
                  type="file"
                  accept="audio/*"
                  onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
                  className="block w-full text-sm file:mr-3 file:px-4 file:py-2 file:rounded-full file:border-0 file:bg-[var(--text-primary)] file:text-white file:font-medium hover:file:opacity-90"
                />
                {audioFile && (
                  <p className="text-xs text-[var(--text-secondary)] mt-1">
                    {audioFile.name} · {(audioFile.size / 1024 / 1024).toFixed(1)} МБ
                  </p>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1.5">
                Обложка <span className="text-[var(--text-secondary)] font-normal">опционально</span>
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setCoverFile(e.target.files?.[0] || null)}
                className="block w-full text-sm file:mr-3 file:px-4 file:py-2 file:rounded-full file:border-0 file:bg-[var(--hover)] hover:file:bg-[var(--border)] file:font-medium"
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1.5">Название *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-white outline-none focus:ring-2 focus:ring-[var(--accent)] text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  {contentType === 'COVER' ? 'Год записи *' : 'Год создания *'}
                </label>
                <input
                  type="number"
                  min={1500}
                  max={new Date().getFullYear()}
                  value={year}
                  onChange={(e) => setYear(parseInt(e.target.value) || new Date().getFullYear())}
                  className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-white outline-none focus:ring-2 focus:ring-[var(--accent)] text-sm tabular-nums"
                />
              </div>
            </div>
            {contentType === 'COVER' && (
              <div>
                <label className="block text-sm font-medium mb-1.5">Автор оригинала *</label>
                <input
                  type="text"
                  value={originalComposer}
                  onChange={(e) => setOriginalComposer(e.target.value)}
                  placeholder="Например, П. И. Чайковский"
                  className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-white outline-none focus:ring-2 focus:ring-[var(--accent)] text-sm"
                />
              </div>
            )}

            <label className="flex items-start gap-3 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={rightsConfirmed}
                onChange={(e) => setRightsConfirmed(e.target.checked)}
                className="mt-1 accent-[var(--text-primary)]"
              />
              <span className="text-[var(--text-secondary)]">
                {contentType === 'COVER'
                  ? 'Я подтверждаю, что исполнение данного произведения не нарушает авторские права третьих лиц, и несу ответственность за этот кавер.'
                  : 'Я подтверждаю, что обладаю необходимыми правами (авторскими и/или смежными) для размещения и продажи данного произведения. Несу ответственность за нарушение прав третьих лиц.'}
              </span>
            </label>
            <div className="flex justify-end pt-3 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={!rightsConfirmed || !title.trim() || (contentType !== 'SHEET_ONLY' && !audioFile) || (contentType === 'COVER' && !originalComposer.trim())}
                className="px-8 py-3 rounded-full bg-[var(--text-primary)] text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity">
                Дальше
              </button>
            </div>
          </section>
        )}

        {/* Шаг 2 */}
        {step === 2 && (
          <section className="apple-card p-6 md:p-8 space-y-5">
            <h2 className="text-xl font-bold tracking-tight">Шаг 2. Метаданные</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1.5">Жанр *</label>
                <select
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-white outline-none focus:ring-2 focus:ring-[var(--accent)] text-sm"
                >
                  <option value="">Выберите жанр</option>
                  {GENRES.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Эпоха</label>
                <select
                  value={era}
                  onChange={(e) => setEra(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-white outline-none focus:ring-2 focus:ring-[var(--accent)] text-sm">
                  <option value="">Не указана</option>
                  {ERAS.map((e) => (
                    <option key={e} value={e}>{e}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Регион происхождения</label>
                <select
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-white outline-none focus:ring-2 focus:ring-[var(--accent)] text-sm"
                >
                  <option value="">Не указан</option>
                  {regions.map((r) => (
                    <option key={r.id} value={r.name}>{r.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Настроение</label>
                <select
                  value={mood}
                  onChange={(e) => setMood(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-white outline-none focus:ring-2 focus:ring-[var(--accent)] text-sm">
                  <option value="">Не указано</option>
                  {MOODS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium mb-1.5">Инструменты</label>
                <div className="flex flex-wrap gap-2 p-3 rounded-xl border border-[var(--border)] bg-white max-h-48 overflow-y-auto">
                  {INSTRUMENTS.map((inst) => {
                    const selected = instruments.includes(inst);
                    return (
                      <button
                        key={inst}
                        type="button"
                        onClick={() => {
                          if (selected) setInstruments(instruments.filter((x) => x !== inst));
                          else setInstruments([...instruments, inst]);
                        }}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                          selected
                            ? 'bg-[var(--text-primary)] text-white'
                            : 'bg-[var(--hover)] text-[var(--text-primary)] hover:bg-[var(--border)]'
                        }`}
                      >
                        {inst}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                  Выбрано: {instruments.length}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Темп</label>
                <select
                  value={tempo}
                  onChange={(e) => setTempo(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-white outline-none focus:ring-2 focus:ring-[var(--accent)] text-sm">
                  <option value="">Не указан</option>
                  {TEMPOS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Сложность</label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-white outline-none focus:ring-2 focus:ring-[var(--accent)] text-sm">
                  <option value="">Не указана</option>
                  {DIFFICULTIES.map((d) => (
                    <option key={d.v} value={d.v}>{d.l}</option>
                  ))}
                </select>
              </div>
              {contentType === 'COVER' && (
                <div>
                  <label className="block text-sm font-medium mb-1.5">Место записи</label>
                  <input
                    type="text"
                    value={recordingPlace}
                    onChange={(e) => setRecordingPlace(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-white outline-none focus:ring-2 focus:ring-[var(--accent)] text-sm"
                  />
                </div>
              )}
            </div>
            <div className="flex justify-between pt-3 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-6 py-3 rounded-full bg-[var(--hover)] text-[var(--text-primary)] font-medium hover:bg-[var(--border)] transition-colors">
                Назад
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="px-8 py-3 rounded-full bg-[var(--text-primary)] text-white font-medium hover:opacity-90 transition-opacity">
                Дальше
              </button>
            </div>
          </section>
        )}

        {/* Шаг 3 */}
        {step === 3 && (
          <section className="apple-card p-6 md:p-8 space-y-6">
            <h2 className="text-xl font-bold tracking-tight">Шаг 3. Текст, ноты и лицензии</h2>
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Текст произведения <span className="text-[var(--text-secondary)] font-normal">опционально, доступ Premium</span>
              </label>
              <textarea
                value={lyrics}
                onChange={(e) => setLyrics(e.target.value)}
                rows={5}
                className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-white outline-none focus:ring-2 focus:ring-[var(--accent)] text-sm resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Ноты PDF <span className="text-[var(--text-secondary)] font-normal">опционально, доступ Premium</span>
              </label>
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => setSheetPdfFile(e.target.files?.[0] || null)}
                className="block w-full text-sm file:mr-3 file:px-4 file:py-2 file:rounded-full file:border-0 file:bg-[var(--hover)] hover:file:bg-[var(--border)] file:font-medium"
              />
              {sheetPdfFile && (
                <p className="text-xs text-[var(--text-secondary)] mt-1">{sheetPdfFile.name}</p>
              )}
            </div>
            {contentType !== 'SHEET_ONLY' && (
              <div className="apple-card p-4 bg-[var(--hover)]">
                <label className="block text-sm font-medium mb-1.5">
                  Минусовка <span className="text-[var(--text-secondary)] font-normal">опционально, продаётся отдельно</span>
                </label>
                <input
                  type="file"
                  accept="audio/*"
                  onChange={(e) => setMinusAudioFile(e.target.files?.[0] || null)}
                  className="block w-full text-sm file:mr-3 file:px-4 file:py-2 file:rounded-full file:border-0 file:bg-[var(--text-primary)] file:text-white file:font-medium"
                />
                {minusAudioFile && (
                  <div className="mt-3 flex items-center gap-3">
                    <span className="text-xs text-[var(--text-secondary)]">{minusAudioFile.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[var(--text-secondary)]">Цена</span>
                      <input
                        type="number"
                        min={199}
                        max={2990}
                        value={minusPrice}
                        onChange={(e) => setMinusPrice(parseInt(e.target.value) || 499)}
                        className="w-24 px-3 py-1.5 rounded-lg border border-[var(--border)] bg-white text-sm tabular-nums"
                      />
                      <span className="text-xs text-[var(--text-secondary)]">₽</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Лицензии */}
            <div className="pt-3 border-t border-[var(--border)]">
              <h3 className="text-base font-semibold mb-2">Лицензии и монетизация</h3>
              <p className="text-xs text-[var(--text-secondary)] mb-4">
                Выберите типы лицензий и цены. Комиссия платформы: 10% (обычные) / 20% (B2B) / 0% (донаты, эксклюзив).
              </p>
              <div className="space-y-2">
                {licenses.map((l) => {
                  const sel = selectedLicenses[l.code];
                  if (!sel) return null;
                  return (
                    <div
                      key={l.code}
                      className={`px-4 py-3 rounded-xl border transition-colors ${
                        sel.selected ? 'border-[var(--text-primary)] bg-[var(--hover)]' : 'border-[var(--border)]'
                      }`}>
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={sel.selected}
                          onChange={(e) =>
                            setSelectedLicenses({
                              ...selectedLicenses,
                              [l.code]: { ...sel, selected: e.target.checked },
                            })
                          }
                          className="mt-1 accent-[var(--text-primary)]"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2 flex-wrap">
                            <span className="font-semibold text-sm">{l.shortName || l.name}</span>
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--border)] text-[var(--text-secondary)]">
                              комиссия {l.commissionPct}%
                            </span>
                            {l.isB2B && (
                              <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                                B2B
                              </span>
                            )}
                            {l.requiresManager && (
                              <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                                через менеджера
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[var(--text-secondary)] mt-0.5">{l.description}</p>
                          {sel.selected && l.code !== 'EXCLUSIVE' && (
                            <div className="mt-2 flex items-center gap-2">
                              <span className="text-xs text-[var(--text-secondary)]">Цена</span>
                              <input
                                type="number"
                                min={0}
                                value={sel.price}
                                onChange={(e) =>
                                  setSelectedLicenses({
                                    ...selectedLicenses,
                                    [l.code]: { ...sel, price: parseInt(e.target.value) || 0 },
                                  })
                                }
                                className="w-28 px-3 py-1.5 rounded-lg border border-[var(--border)] bg-white text-sm tabular-nums"
                              />
                              <span className="text-xs text-[var(--text-secondary)]">₽</span>
                            </div>
                          )}
                        </div>
                      </label>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 grid sm:grid-cols-2 gap-2">
                <label className="flex items-center gap-3 cursor-pointer px-4 py-3 rounded-xl border border-[var(--border)]">
                  <input
                    type="checkbox"
                    checked={allowDonations}
                    onChange={(e) => setAllowDonations(e.target.checked)}
                    className="accent-[var(--text-primary)]"
                  />
                  <span className="text-sm">Принимать донаты <span className="text-xs text-[var(--text-secondary)]">(комиссия 0%)</span></span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer px-4 py-3 rounded-xl border border-[var(--border)]">
                  <input
                    type="checkbox"
                    checked={allowExclusive}
                    onChange={(e) => setAllowExclusive(e.target.checked)}
                    className="accent-[var(--text-primary)]"
                  />
                  <span className="text-sm">Запросы на эксклюзив <span className="text-xs text-[var(--text-secondary)]">(вне платформы)</span></span>
                </label>
              </div>
            </div>
            <div className="flex justify-between pt-3 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-6 py-3 rounded-full bg-[var(--hover)] text-[var(--text-primary)] font-medium hover:bg-[var(--border)] transition-colors">
                Назад
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-8 py-3 rounded-full bg-[var(--text-primary)] text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity">
                {submitting ? 'Загружаем…' : 'Отправить на модерацию'}
              </button>
            </div>
          </section>
        )}
      </form>
    </div>
  );
}

function ContentTypeCard({
  active,
  onClick,
  title,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left p-4 rounded-2xl border-2 transition-all ${
        active ? 'border-[var(--text-primary)] bg-[var(--hover)]' : 'border-[var(--border)] hover:bg-[var(--hover)]'
      }`}>
      <div className="font-semibold mb-1">{title}</div>
      <div className="text-xs text-[var(--text-secondary)] leading-snug">{desc}</div>
    </button>
  );
}
