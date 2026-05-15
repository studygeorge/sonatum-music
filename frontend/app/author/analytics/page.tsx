'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { authStorage } from '@/app/lib/auth';

type AnalyticsData = {
  hasArtist: boolean;
  totals?: {
    totalPlays: number;
    followersTotal: number;
    tracksPublished: number;
    totalSales: number;
  };
  topTracks?: { id: string; title: string; slug: string; cover: string | null; playCount: number; likeCount: number; purchaseCount: number }[];
  geography?: { region: string; plays: number }[];
};

const fmt = (n: number) => n.toLocaleString('ru-RU');

export default function AuthorAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/author/analytics', {
      headers: { Authorization: `Bearer ${authStorage.getToken() || ''}` },
    })
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setData(j.data);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-sm text-[var(--text-secondary)] py-10 text-center">Загрузка…</div>;
  }
  if (!data) return null;

  return (
    <div className="space-y-6 animate-fadeInUp">
      <section
        className="relative rounded-3xl overflow-hidden p-7 md:p-10 text-white"
        style={{ background: 'linear-gradient(135deg, #1d4cb8 0%, #d52b1e 55%, #e6e6e6 100%)' }}
      >
        <div className="relative z-10 max-w-2xl">
          <div className="text-xs uppercase tracking-widest font-semibold mb-2 opacity-90">
            Аналитика
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">Статистика творчества</h1>
          <p className="text-sm md:text-base text-white/85 mt-2">
            Прослушивания, подписчики, география и популярные треки.
          </p>
        </div>
      </section>

      {!data.hasArtist ? (
        <div className="apple-card p-10 text-center text-[var(--text-secondary)]">
          У вас ещё нет профиля артиста. <Link href="/artists/join" className="text-[var(--accent)] hover:underline">Создать</Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="Прослушиваний" value={fmt(data.totals!.totalPlays)} />
            <Stat label="Подписчиков" value={fmt(data.totals!.followersTotal)} />
            <Stat label="Опубликовано" value={fmt(data.totals!.tracksPublished)} />
            <Stat label="Продаж лицензий" value={fmt(data.totals!.totalSales)} />
          </div>

          <section className="apple-card p-5 md:p-6">
            <h2 className="text-lg font-bold tracking-tight mb-4">Топ треков</h2>
            {data.topTracks!.length === 0 ? (
              <div className="text-sm text-[var(--text-secondary)] py-4 text-center">
                Загрузите треки, чтобы здесь появилась статистика.
              </div>
            ) : (
              <div className="space-y-2">
                {data.topTracks!.map((t, i) => (
                  <div key={t.id} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-[var(--hover)]">
                    <div className="w-6 text-center font-bold text-[var(--text-secondary)] text-sm shrink-0">{i + 1}</div>
                    <div className="w-11 h-11 rounded-lg bg-gray-100 overflow-hidden shrink-0">
                      {t.cover && <img src={t.cover} alt="" className="w-full h-full object-cover" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <Link href={`/tracks/${t.slug}`} className="font-medium text-sm hover:underline truncate block">
                        {t.title}
                      </Link>
                      <div className="text-xs text-[var(--text-secondary)] tabular-nums">
                        {fmt(t.playCount)} прослушиваний · {fmt(t.likeCount)} лайков · {fmt(t.purchaseCount)} продаж
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {data.geography && data.geography.length > 0 && (
            <section className="apple-card p-5 md:p-6">
              <h2 className="text-lg font-bold tracking-tight mb-4">География слушателей (30 дней)</h2>
              <div className="space-y-2">
                {data.geography.map((g) => {
                  const max = data.geography![0]?.plays || 1;
                  const pct = Math.round((g.plays / max) * 100);
                  return (
                    <div key={g.region} className="px-3 py-2 rounded-xl hover:bg-[var(--hover)]">
                      <div className="flex justify-between items-baseline mb-1">
                        <span className="font-medium text-sm">{g.region}</span>
                        <span className="text-xs text-[var(--text-secondary)] tabular-nums">{fmt(g.plays)}</span>
                      </div>
                      <div className="h-1.5 bg-[var(--border)] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[var(--text-primary)]"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="apple-card p-4">
      <div className="text-xs text-[var(--text-secondary)] mb-1">{label}</div>
      <div className="text-2xl font-black tabular-nums tracking-tight">{value}</div>
    </div>
  );
}
