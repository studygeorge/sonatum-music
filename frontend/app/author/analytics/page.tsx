'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { authStorage } from '@/app/lib/auth';

type Data = {
  artist: { id: string; name: string; followers: number };
  kpi: {
    plays: { now: number; prev: number };
    listeners: { now: number; prev: number };
    newFollowers: { now: number; prev: number };
    sales: { now: number; prev: number };
    revenue: { now: number; prev: number };
  };
  monthly: { month: string; plays: number; revenue: number }[];
  topPlays: { id: string; title: string; slug: string; cover: string | null; plays: number }[];
  topRevenue: { id: string; title: string; slug: string; cover: string | null; revenue: number; sales: number }[];
  geo: { name: string; slug: string; listeners: number; plays: number }[];
};

const fmt = (n: number) => n.toLocaleString('ru-RU', { maximumFractionDigits: 0 });
const trend = (now: number, prev: number) => {
  if (prev === 0) return now > 0 ? 100 : 0;
  return Math.round(((now - prev) / prev) * 100);
};

export default function AuthorAnalyticsPage() {
  const [d, setD] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/author/analytics', { headers: { Authorization: `Bearer ${authStorage.getToken() || ''}` } })
      .then((r) => r.json())
      .then((j) => { if (j.success) setD(j.data); })
      .finally(() => setLoading(false));
  }, []);

  if (loading || !d) {
    return <div className="apple-card p-10 text-center text-[var(--text-secondary)]">Загрузка…</div>;
  }

  const maxPlays = Math.max(1, ...d.monthly.map(m => m.plays));
  const maxRevenue = Math.max(1, ...d.monthly.map(m => m.revenue));
  const maxGeo = Math.max(1, ...d.geo.map(g => g.listeners));

  return (
    <div className="space-y-6">
      <section
        className="relative rounded-3xl overflow-hidden p-7 md:p-10 flex items-end justify-between gap-4 flex-wrap"
        style={{ background: 'linear-gradient(135deg, #1d4cb8 0%, #2f9e8f 55%, #e6e6e6 100%)' }}>
        <div className="relative z-10 max-w-xl">
          <div className="text-xs uppercase tracking-widest font-semibold mb-2 text-white/90">Аналитика</div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">{d.artist.name}</h1>
          <p className="text-sm md:text-base text-white/90 mt-2">
            {fmt(d.artist.followers)} подписчиков · сравнение с предыдущим периодом 30 дней
          </p>
        </div>
      </section>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <Kpi label="Прослушивания" now={d.kpi.plays.now} prev={d.kpi.plays.prev} />
        <Kpi label="Уникальные слушатели" now={d.kpi.listeners.now} prev={d.kpi.listeners.prev} />
        <Kpi label="Новые подписчики" now={d.kpi.newFollowers.now} prev={d.kpi.newFollowers.prev} />
        <Kpi label="Продажи лицензий" now={d.kpi.sales.now} prev={d.kpi.sales.prev} />
        <Kpi label="Доход" now={d.kpi.revenue.now} prev={d.kpi.revenue.prev} unit="₽" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="apple-card p-5">
          <h2 className="font-bold mb-3">Прослушивания · 12 мес</h2>
          <div className="space-y-1.5">
            {d.monthly.map((m) => (
              <div key={m.month} className="flex items-center gap-2">
                <div className="text-[10px] text-[var(--text-secondary)] w-14 tabular-nums">{m.month}</div>
                <div className="flex-1 h-4 bg-[var(--hover)] rounded overflow-hidden">
                  <div style={{ width: `${(m.plays / maxPlays) * 100}%`, background: '#1c1c1e', height: '100%' }} />
                </div>
                <div className="text-[11px] tabular-nums w-12 text-right">{fmt(m.plays)}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="apple-card p-5">
          <h2 className="font-bold mb-3">Доход · 12 мес</h2>
          <div className="space-y-1.5">
            {d.monthly.map((m) => (
              <div key={m.month} className="flex items-center gap-2">
                <div className="text-[10px] text-[var(--text-secondary)] w-14 tabular-nums">{m.month}</div>
                <div className="flex-1 h-4 bg-[var(--hover)] rounded overflow-hidden">
                  <div style={{ width: `${(m.revenue / maxRevenue) * 100}%`, background: '#1d4cb8', height: '100%' }} />
                </div>
                <div className="text-[11px] tabular-nums w-16 text-right">{fmt(m.revenue)} ₽</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="apple-card p-5">
          <h2 className="font-bold mb-3">Топ-5 треков · по плеям</h2>
          {d.topPlays.length === 0 ? (
            <div className="py-4 text-center text-sm text-[var(--text-secondary)]">Нет данных</div>
          ) : (
            <div className="space-y-2">
              {d.topPlays.map((t, i) => (
                <Link key={t.id} href={`/tracks/${t.slug || t.id}`} className="flex items-center gap-3 p-2 -mx-2 rounded-xl hover:bg-[var(--hover)]">
                  <div className="text-base font-black w-6 text-[var(--text-secondary)] text-center">{i + 1}</div>
                  <div className="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden">
                    {t.cover && <img src={t.cover} alt="" className="w-full h-full object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{t.title}</div>
                  </div>
                  <div className="text-sm tabular-nums font-semibold">{fmt(t.plays)}</div>
                </Link>
              ))}
            </div>
          )}
        </div>
        <div className="apple-card p-5">
          <h2 className="font-bold mb-3">Топ-5 треков · по доходу</h2>
          {d.topRevenue.length === 0 ? (
            <div className="py-4 text-center text-sm text-[var(--text-secondary)]">Нет продаж за 30 дней</div>
          ) : (
            <div className="space-y-2">
              {d.topRevenue.map((t, i) => (
                <Link key={t.id} href={`/tracks/${t.slug || t.id}`} className="flex items-center gap-3 p-2 -mx-2 rounded-xl hover:bg-[var(--hover)]">
                  <div className="text-base font-black w-6 text-[var(--text-secondary)] text-center">{i + 1}</div>
                  <div className="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden">
                    {t.cover && <img src={t.cover} alt="" className="w-full h-full object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{t.title}</div>
                    <div className="text-[11px] text-[var(--text-secondary)]">{t.sales} продаж</div>
                  </div>
                  <div className="text-sm tabular-nums font-semibold">{fmt(t.revenue)} ₽</div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="apple-card p-5">
        <h2 className="font-bold mb-3">География слушателей · 30 дней</h2>
        {d.geo.length === 0 ? (
          <div className="py-4 text-center text-sm text-[var(--text-secondary)]">
            Пока никто не слушал из определённого региона. Регион ставится в профиле пользователя.
          </div>
        ) : (
          <div className="space-y-2">
            {d.geo.map((g) => (
              <Link key={g.slug} href={`/map/${g.slug}`} className="flex items-center gap-3 p-2 -mx-2 rounded-xl hover:bg-[var(--hover)]">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{g.name}</div>
                  <div className="text-[11px] text-[var(--text-secondary)]">{g.plays} плеев</div>
                </div>
                <div className="w-40 h-3 bg-[var(--hover)] rounded overflow-hidden">
                  <div style={{ width: `${(g.listeners / maxGeo) * 100}%`, background: '#2f9e8f', height: '100%' }} />
                </div>
                <div className="text-sm tabular-nums font-semibold w-12 text-right">{g.listeners}</div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, now, prev, unit = '' }: { label: string; now: number; prev: number; unit?: string }) {
  const t = trend(now, prev);
  const up = t > 0; const down = t < 0;
  return (
    <div className="apple-card p-4">
      <div className="text-[10px] uppercase tracking-widest font-bold text-[var(--text-secondary)]">{label}</div>
      <div className="text-2xl font-black mt-1 tabular-nums">{fmt(now)}{unit ? ` ${unit}` : ''}</div>
      <div className="text-[11px] mt-1 flex items-center gap-1">
        {prev === 0 && now === 0 ? (
          <span className="text-[var(--text-secondary)]">нет данных</span>
        ) : (
          <>
            <span style={{ color: up ? '#1c1c1e' : down ? '#1c1c1e' : '#86868b' }}>
              {up ? '▲' : down ? '▼' : '–'} {Math.abs(t)}%
            </span>
            <span className="text-[var(--text-secondary)]">vs прошл. 30 дн</span>
          </>
        )}
      </div>
    </div>
  );
}
