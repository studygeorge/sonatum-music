'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, X } from 'lucide-react';

type Sheet = {
  id: string;
  title: string;
  instrument: string;
  difficulty: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  pdfUrl: string;
  isPublicDomain: boolean;
  composer?: { name?: string; slug?: string } | null;
  track?: { title?: string; slug?: string; cover?: string | null } | null;
  createdAt?: string;
};

type SortKey = 'composer' | 'title' | 'recent';

const SORT_LABEL: Record<SortKey, string> = {
  composer: 'Композитор (А–Я)',
  title: 'Название (А–Я)',
  recent: 'Сначала новые',
};

export default function SheetMusicArchive() {
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [activeComposer, setActiveComposer] = useState<string | null>(null);
  const [activeInstrument, setActiveInstrument] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>('composer');
  const [filtersOpen, setFiltersOpen] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/sheets');
        const json = await res.json();
        if (cancelled) return;
        if (json.success && Array.isArray(json.data)) setSheets(json.data);
        else setError(json.error || 'Не удалось загрузить архив');
      } catch {
        if (!cancelled) setError('Сеть недоступна');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Уникальные композиторы и инструменты для фасетов
  const composers = useMemo(() => {
    const m = new Map<string, number>();
    sheets.forEach(s => {
      const n = s.composer?.name;
      if (n) m.set(n, (m.get(n) || 0) + 1);
    });
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0], 'ru'));
  }, [sheets]);

  const instruments = useMemo(() => {
    const m = new Map<string, number>();
    sheets.forEach(s => {
      if (s.instrument) m.set(s.instrument, (m.get(s.instrument) || 0) + 1);
    });
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0], 'ru'));
  }, [sheets]);

  const filtered = useMemo(() => {
    let r = sheets;
    if (query) {
      const q = query.toLowerCase();
      r = r.filter(
        s =>
          s.title.toLowerCase().includes(q) ||
          s.composer?.name?.toLowerCase().includes(q) ||
          s.instrument.toLowerCase().includes(q)
      );
    }
    if (activeComposer) r = r.filter(s => s.composer?.name === activeComposer);
    if (activeInstrument) r = r.filter(s => s.instrument === activeInstrument);

    const sorted = [...r];
    if (sort === 'composer') {
      sorted.sort((a, b) =>
        (a.composer?.name || '').localeCompare(b.composer?.name || '', 'ru') ||
        a.title.localeCompare(b.title, 'ru')
      );
    } else if (sort === 'title') {
      sorted.sort((a, b) => a.title.localeCompare(b.title, 'ru'));
    } else if (sort === 'recent') {
      sorted.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    }
    return sorted;
  }, [sheets, query, activeComposer, activeInstrument, sort]);

  const hasActiveFilters = !!(query || activeComposer || activeInstrument);

  const reset = () => {
    setQuery('');
    setActiveComposer(null);
    setActiveInstrument(null);
  };

  return (
    <main className="min-h-screen pt-10 md:pt-14 pb-24 px-6 md:px-12 max-w-[1600px] mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl lg:text-5xl font-bold tracking-tight mb-3">Нотный архив</h1>
        <p className="text-lg text-[var(--text-secondary)]">
          Партитуры классической и духовной музыки в PDF
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar filters */}
        <aside className="lg:w-64 shrink-0">
          <div className="lg:sticky lg:top-24 space-y-6">
            {/* Поиск */}
            <div className="relative">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Поиск..."
                className="w-full pl-11 pr-10 py-3 rounded-2xl bg-white/70 backdrop-blur-md border border-[var(--border)] outline-none focus:ring-2 focus:ring-[var(--accent)] text-sm"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full hover:bg-[var(--hover)] flex items-center justify-center text-[var(--text-secondary)]"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Сортировка */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-2">
                Сортировка
              </label>
              <select
                value={sort}
                onChange={e => setSort(e.target.value as SortKey)}
                className="w-full px-4 py-2.5 rounded-xl bg-white/70 border border-[var(--border)] outline-none focus:ring-2 focus:ring-[var(--accent)] text-sm cursor-pointer"
              >
                {(Object.keys(SORT_LABEL) as SortKey[]).map(k => (
                  <option key={k} value={k}>
                    {SORT_LABEL[k]}
                  </option>
                ))}
              </select>
            </div>

            {/* Композиторы */}
            {composers.length > 0 && (
              <FacetGroup
                title="Композитор"
                items={composers}
                active={activeComposer}
                onPick={n => setActiveComposer(activeComposer === n ? null : n)}
              />
            )}

            {/* Инструменты */}
            {instruments.length > 0 && (
              <FacetGroup
                title="Инструмент"
                items={instruments}
                active={activeInstrument}
                onPick={n => setActiveInstrument(activeInstrument === n ? null : n)}
              />
            )}

            {hasActiveFilters && (
              <button
                onClick={reset}
                className="w-full text-sm font-semibold text-[var(--accent)] hover:underline py-2"
              >
                Сбросить фильтры
              </button>
            )}
          </div>
        </aside>

        {/* Grid */}
        <section className="flex-1 min-w-0">
          {!loading && !error && (
            <div className="text-sm text-[var(--text-secondary)] mb-4">
              Найдено: <strong className="text-[var(--text-primary)]">{filtered.length}</strong>
              {hasActiveFilters && ` из ${sheets.length}`}
            </div>
          )}

          {loading && (
            <div className="text-center py-20 text-[var(--text-secondary)]">Загрузка архива…</div>
          )}

          {!loading && error && (
            <div className="text-center py-20 text-[var(--text-secondary)]">{error}</div>
          )}

          {!loading && !error && filtered.length === 0 && (
            <div className="text-center py-20 text-[var(--text-secondary)]">
              {hasActiveFilters ? 'Ничего не нашлось — попробуйте сбросить фильтры' : 'В архиве пока нет нот'}
            </div>
          )}

          {!loading && !error && filtered.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4">
              {filtered.map(sheet => (
                <SheetCard key={sheet.id} sheet={sheet} />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function FacetGroup({
  title,
  items,
  active,
  onPick,
}: {
  title: string;
  items: [string, number][];
  active: string | null;
  onPick: (name: string) => void;
}) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-2">
        {title}
      </div>
      <div className="flex flex-col gap-0.5">
        {items.map(([name, count]) => (
          <button
            key={name}
            onClick={() => onPick(name)}
            className={`flex items-center justify-between text-left text-sm px-3 py-2 rounded-lg transition-colors ${
              active === name
                ? 'bg-[var(--text-primary)] text-white'
                : 'hover:bg-[var(--hover)] text-[var(--text-primary)]'
            }`}
          >
            <span className="truncate">{name}</span>
            <span className={`text-xs shrink-0 ml-2 ${active === name ? 'opacity-70' : 'opacity-50'}`}>
              {count}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function SheetCard({ sheet }: { sheet: Sheet }) {
  const cover = sheet.track?.cover;
  return (
    <Link href={`/sheets/${sheet.id}`} className="group block">
      <div className="apple-card hover-scale p-0 overflow-hidden h-full flex flex-col">
        {/* Обложка фиксированной формы и единого размера */}
        <div className="aspect-[3/4] bg-gray-100 overflow-hidden relative">
          {cover ? (
            <img
              src={cover}
              alt={sheet.title}
              loading="lazy"
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-[#0039a6]/10 to-[#2f9e8f]/10" />
          )}
        </div>

        <div className="p-3 flex flex-col flex-grow">
          <h3 className="font-semibold text-sm text-[var(--text-primary)] leading-tight line-clamp-2 mb-1">
            {sheet.title}
          </h3>
          {sheet.composer?.name && (
            <p className="text-xs text-[var(--text-secondary)] truncate">
              {sheet.composer.name}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
