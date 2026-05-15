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
  isForSale: boolean;
  isFree: boolean;
  playCount: number;
  likeCount: number;
  purchaseCount: number;
  status: string;
  createdAt: string;
  releaseDate: string | null;
};

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  DRAFT: { label: 'Черновик', color: 'bg-gray-100 text-gray-700' },
  PENDING: { label: 'На модерации', color: 'bg-amber-100 text-amber-700' },
  PUBLISHED: { label: 'Опубликовано', color: 'bg-green-100 text-green-700' },
  REJECTED: { label: 'Отклонено', color: 'bg-red-100 text-red-700' },
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
  const justUploaded = sp.get('uploaded') === '1';

  useEffect(() => {
    fetch('/api/author/tracks', {
      headers: { Authorization: `Bearer ${authStorage.getToken() || ''}` },
    })
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setTracks(j.data || []);
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = tracks.filter((t) => filter === 'ALL' || t.status === filter);

  return (
    <div className="space-y-6 animate-fadeInUp">
      {justUploaded && (
        <div className="apple-card p-4 bg-green-50 border-green-200 text-sm text-green-800">
          Трек отправлен на модерацию. После проверки он появится в каталоге.
        </div>
      )}

      <section
        className="relative rounded-3xl overflow-hidden p-7 md:p-10 text-white flex items-end justify-between gap-4"
        style={{
          background: 'linear-gradient(135deg, #1d4cb8 0%, #d52b1e 55%, #e6e6e6 100%)',
        }}>
        <div className="relative z-10 max-w-xl">
          <div className="text-xs uppercase tracking-widest font-semibold mb-2 opacity-90">
            Дискография
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">Мои треки</h1>
          <p className="text-sm md:text-base text-white/85 mt-2">
            Всего: {tracks.length}
          </p>
        </div>
        <Link
          href="/author/upload"
          className="px-5 py-3 rounded-full bg-white text-[#1d4cb8] font-semibold text-sm whitespace-nowrap shrink-0 hover:opacity-90 transition-opacity">
          + Загрузить
        </Link>
      </section>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {[
          { v: 'ALL', l: `Все · ${tracks.length}` },
          { v: 'PUBLISHED', l: `Опубликовано · ${tracks.filter(t => t.status === 'PUBLISHED').length}` },
          { v: 'PENDING', l: `На модерации · ${tracks.filter(t => t.status === 'PENDING').length}` },
          { v: 'DRAFT', l: `Черновики · ${tracks.filter(t => t.status === 'DRAFT').length}` },
          { v: 'REJECTED', l: `Отклонено · ${tracks.filter(t => t.status === 'REJECTED').length}` },
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
            return (
              <div key={t.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--hover)] transition-colors border-b border-[var(--border)] last:border-b-0">
                <div className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden shrink-0">
                  {t.cover && (
                    <img src={t.cover} alt="" className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold truncate">{t.title}</span>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full ${s.color} shrink-0`}>
                      {s.label}
                    </span>
                  </div>
                  <div className="text-xs text-[var(--text-secondary)] mt-0.5 flex items-center gap-3 flex-wrap">
                    <span>{fmtDuration(t.duration)}</span>
                    <span>· {t.playCount.toLocaleString('ru-RU')} прослушиваний</span>
                    <span>· {t.purchaseCount} продаж</span>
                    {t.price && Number(t.price)> 0 && (
                      <span>· {Number(t.price).toLocaleString('ru-RU')} ₽</span>
                    )}
                  </div>
                </div>
                <Link
                  href={`/tracks/${t.slug}`}
                  className="text-sm text-[var(--accent)] hover:underline shrink-0 hidden sm:block">
                  Открыть
                </Link>
              </div>
            );
          })}
        </div>
      )}
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
