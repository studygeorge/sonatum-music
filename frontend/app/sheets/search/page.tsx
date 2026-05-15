'use client';
import { useState, useEffect } from 'react';
import { api } from '@/app/lib/api';
import Link from 'next/link';

export default function SheetSearchPage() {
  const [filters, setFilters] = useState<any>(null);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [params, setParams] = useState({
    q: '',
    instrument: '',
    difficulty: '',
    genreId: '',
    regionId: '',
    page: 1,
  });

  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });

  useEffect(() => {
    api.getSheetsFilters().then(res => {
      if (res.success) setFilters(res.data);
    });
  }, []);

  useEffect(() => {
    setLoading(true);
    // Debounce search ideally, but for now just call
    const timer = setTimeout(() => {
      api.getSheetsSearch(params).then(res => {
        if (res.success) {
          setResults((res.data as any).data || []);
          setPagination((res.data as any).pagination);
        }
        setLoading(false);
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [params]);

  const updateParam = (key: string, value: any) => {
    setParams(p => ({ ...p, [key]: value, page: 1 }));
  };

  return (
    <main className="min-h-screen pt-32 pb-32 px-6">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-8">
        
        {/* Sidebar Filters */}
        <aside className="w-full md:w-64 flex-shrink-0 space-y-6">
          <h2 className="text-xl font-bold text-[#1c1c1e] mb-4">Фильтры</h2>
          
          <div>
            <label className="block text-[12px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Название / Автор</label>
            <input 
              type="text" 
              value={params.q}
              onChange={e => updateParam('q', e.target.value)}
              placeholder="Поиск нот..."
              className="w-full bg-black/5 rounded-xl px-4 py-2 text-[14px] outline-none border border-transparent focus:border-[var(--border)] transition-colors"
            />
          </div>

          {filters && (
            <>
              <div>
                <label className="block text-[12px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Инструмент</label>
                <select 
                  value={params.instrument} 
                  onChange={e => updateParam('instrument', e.target.value)}
                  className="w-full bg-black/5 rounded-xl px-4 py-2 text-[14px] outline-none border border-transparent focus:border-[var(--border)]"
                >
                  <option value="">Любой</option>
                  {filters.instruments?.map((i: string) => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-[12px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Сложность</label>
                <select 
                  value={params.difficulty} 
                  onChange={e => updateParam('difficulty', e.target.value)}
                  className="w-full bg-black/5 rounded-xl px-4 py-2 text-[14px] outline-none border border-transparent focus:border-[var(--border)]"
                >
                  <option value="">Любая</option>
                  {filters.difficulties?.map((d: any) => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-[12px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Жанр / Эпоха</label>
                <select 
                  value={params.genreId} 
                  onChange={e => updateParam('genreId', e.target.value)}
                  className="w-full bg-black/5 rounded-xl px-4 py-2 text-[14px] outline-none border border-transparent focus:border-[var(--border)]"
                >
                  <option value="">Все жанры</option>
                  {filters.genres?.map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-[12px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Регион композитора</label>
                <select 
                  value={params.regionId} 
                  onChange={e => updateParam('regionId', e.target.value)}
                  className="w-full bg-black/5 rounded-xl px-4 py-2 text-[14px] outline-none border border-transparent focus:border-[var(--border)]"
                >
                  <option value="">Все регионы</option>
                  {filters.regions?.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
            </>
          )}
        </aside>

        {/* Results Grid */}
        <div className="flex-1">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-black text-[#1c1c1e]">Нотный архив</h1>
            {!loading && <span className="text-[var(--text-secondary)] font-medium">Найдено: {pagination.total}</span>}
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="animate-pulse bg-black/5 rounded-2xl h-48"></div>
              ))}
            </div>
          ) : results.length === 0 ? (
            <div className="text-center py-20 bg-black/5 rounded-3xl">
              <p className="text-lg font-medium text-[var(--text-secondary)]">По вашему запросу ничего не найдено</p>
              <button 
                onClick={() => setParams({ q: '', instrument: '', difficulty: '', genreId: '', regionId: '', page: 1 })}
                className="mt-4 px-6 py-2 bg-white rounded-full text-[14px] font-bold shadow hover:shadow-md transition-shadow"
              >
                Сбросить фильтры
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {results.map(sheet => (
                <Link href={sheet.trackId ? `/tracks/${sheet.track?.slug || sheet.trackId}` : `/sheets/${sheet.id}`} key={sheet.id} className="group block bg-white rounded-2xl p-5 shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-black/5 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] hover:-translate-y-1 transition-all">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-bold text-[#1c1c1e] text-lg leading-tight group-hover:text-[var(--color-primary)] transition-colors line-clamp-2" title={sheet.title}>{sheet.title}</h3>
                      <p className="text-[13px] text-[var(--text-secondary)] mt-1">{sheet.composer?.name || 'Неизвестный автор'}</p>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-2 mt-auto">
                    <span className="px-2.5 py-1 bg-black/5 rounded-md text-[11px] font-semibold text-[#1c1c1e]">{sheet.instrument}</span>
                    <span className="px-2.5 py-1 bg-blue-50 text-blue-600 rounded-md text-[11px] font-semibold">{sheet.difficulty === 'BEGINNER' ? 'Начальный' : sheet.difficulty === 'INTERMEDIATE' ? 'Средний' : 'Проф.'}</span>
                    {sheet.isPublicDomain && <span className="px-2.5 py-1 bg-green-50 text-green-600 rounded-md text-[11px] font-semibold">Public Domain</span>}
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Pagination */}
          {!loading && pagination.totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-12">
              <button 
                disabled={params.page === 1}
                onClick={() => setParams(p => ({ ...p, page: p.page - 1 }))}
                className="w-10 h-10 rounded-full flex items-center justify-center border border-[var(--border)] disabled:opacity-30 hover:bg-black/5 transition-colors"
              >
                ←
              </button>
              <div className="flex items-center text-[14px] font-semibold text-[#1c1c1e] px-2">
                {params.page} из {pagination.totalPages}
              </div>
              <button 
                disabled={params.page === pagination.totalPages}
                onClick={() => setParams(p => ({ ...p, page: p.page + 1 }))}
                className="w-10 h-10 rounded-full flex items-center justify-center border border-[var(--border)] disabled:opacity-30 hover:bg-black/5 transition-colors"
              >
                →
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
