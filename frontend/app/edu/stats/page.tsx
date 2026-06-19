'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { authStorage } from '@/app/lib/auth';

type Stats = {
  days: number;
  totalPlays: number;
  uniqueListeners: number;
  topTracks: Array<{
    id: string;
    title: string;
    slug: string;
    cover: string | null;
    artist: { name: string | null; slug: string | null };
    plays: number;
  }>;
  byWeekday: number[];
  byDay: Array<{ day: string; c: number }>;
};

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const PERIODS = [
  { days: 7, label: '7 дней' },
  { days: 30, label: '30 дней' },
  { days: 90, label: '90 дней' },
  { days: 365, label: 'Год' },
];

export default function EduStatsPage() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const token = () => authStorage.getToken() || '';

  useEffect(() => {
    setLoading(true);
    fetch(`/api/edu/stats?days=${days}`, { headers: { Authorization: `Bearer ${token()}` } })
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setData(j.data);
      })
      .finally(() => setLoading(false));
  }, [days]);

  const maxWeekday = Math.max(1, ...(data?.byWeekday || [0]));
  const maxDay = Math.max(1, ...((data?.byDay || []).map((d) => d.c)));

  const downloadCsv = () => {
    const url = `/api/edu/stats/export?days=${days}&token=${encodeURIComponent(token())}`;
    window.location.href = url;
  };

  return (
    <div className="space-y-6 animate-fadeInUp">
      <section
        className="relative rounded-3xl overflow-hidden p-7 md:p-10 text-white"
        style={{ background: 'linear-gradient(135deg, #1d4cb8 0%, #2f9e8f 55%, #e6e6e6 100%)' }}>
        <div className="relative z-10 max-w-2xl">
          <div className="text-xs uppercase tracking-widest font-semibold mb-2 opacity-90">Кабинет</div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">Статистика</h1>
          <p className="text-sm md:text-base text-white/85 mt-2">
            Активность пользователей учреждения и популярные произведения.
          </p>
        </div>
      </section>

      {/* Period selector + export */}
      <section className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 bg-black/[0.04] rounded-2xl p-1">
          {PERIODS.map((p) => (
            <button
              key={p.days}
              onClick={() => setDays(p.days)}
              className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                days === p.days ? 'bg-white shadow text-[#1c1c1e]' : 'text-[var(--text-secondary)] hover:text-[#1c1c1e]'
              }`}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <button
          onClick={downloadCsv}
          className="px-4 py-2 rounded-full bg-white border border-black text-black hover:bg-gray-100 text-xs font-semibold">
          Скачать CSV
        </button>
        <button
          onClick={() => window.print()}
          className="px-4 py-2 rounded-full bg-white border border-[var(--border)] text-black hover:bg-gray-100 text-xs font-semibold">
          Печать / PDF
        </button>
      </section>

      {loading ? (
        <div className="apple-card p-10 text-center text-sm text-[var(--text-secondary)]">Загрузка статистики…</div>
      ) : data ? (
        <>
          {/* Summary tiles */}
          <div className="grid sm:grid-cols-2 gap-3">
            <SummaryTile label="Всего прослушиваний" value={data.totalPlays.toLocaleString('ru-RU')} />
            <SummaryTile label="Уникальных слушателей" value={data.uniqueListeners.toLocaleString('ru-RU')} />
          </div>

          {/* Activity by weekday */}
          <section className="apple-card p-6 md:p-8">
            <h2 className="text-lg font-bold tracking-tight mb-1">Активность по дням недели</h2>
            <p className="text-xs text-[var(--text-secondary)] mb-5">За последние {data.days} дней</p>
            <div className="grid grid-cols-7 gap-2 items-end" style={{ minHeight: 160 }}>
              {data.byWeekday.map((c, i) => (
                <div key={i} className="flex flex-col items-center gap-1.5">
                  <div className="text-[10px] font-semibold text-[var(--text-secondary)]">{c}</div>
                  <div
                    className="w-full rounded-md bg-[var(--text-primary)] transition-all"
                    style={{ height: `${Math.max(4, (c / maxWeekday) * 140)}px` }}
                  />
                  <div className="text-[11px] font-medium text-[var(--text-secondary)]">{WEEKDAYS[i]}</div>
                </div>
              ))}
            </div>
          </section>

          {/* By day (line) */}
          {data.byDay.length > 0 && (
            <section className="apple-card p-6 md:p-8">
              <h2 className="text-lg font-bold tracking-tight mb-4">По дням</h2>
              <div className="overflow-x-auto">
                <div className="flex items-end gap-1" style={{ minHeight: 120, minWidth: data.byDay.length * 12 }}>
                  {data.byDay.map((d) => (
                    <div
                      key={d.day}
                      className="flex-1 min-w-[8px] rounded-sm bg-[var(--text-primary)]"
                      style={{ height: `${Math.max(2, (d.c / maxDay) * 100)}px` }}
                      title={`${d.day}: ${d.c}`}
                    />
                  ))}
                </div>
              </div>
              <div className="flex justify-between text-[10px] text-[var(--text-secondary)] mt-2">
                <span>{data.byDay[0]?.day}</span>
                <span>{data.byDay[data.byDay.length - 1]?.day}</span>
              </div>
            </section>
          )}

          {/* Top tracks */}
          <section className="apple-card p-6 md:p-8">
            <h2 className="text-lg font-bold tracking-tight mb-4">Самые популярные треки</h2>
            {data.topTracks.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)]">
                За выбранный период активности пользователей не зафиксировано.
              </p>
            ) : (
              <ol className="space-y-2">
                {data.topTracks.map((t, i) => (
                  <li key={t.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-black/[0.03]">
                    <span className="text-base font-bold text-[var(--text-secondary)] w-7">#{i + 1}</span>
                    {t.cover ? (
                      <img src={t.cover} alt="" className="w-11 h-11 rounded-lg object-cover" />
                    ) : (
                      <div className="w-11 h-11 rounded-lg bg-black/5 flex items-center justify-center text-xs text-[var(--text-secondary)]">♪</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <Link href={`/tracks/${t.slug}`} className="font-semibold text-sm truncate hover:underline block">
                        {t.title}
                      </Link>
                      <div className="text-xs text-[var(--text-secondary)] truncate">{t.artist.name || '—'}</div>
                    </div>
                    <div className="text-sm font-bold tabular-nums">{t.plays.toLocaleString('ru-RU')}</div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </>
      ) : (
        <div className="apple-card p-10 text-center text-sm text-[var(--text-secondary)]">Нет данных</div>
      )}
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="apple-card p-5">
      <div className="text-xs uppercase tracking-widest font-semibold text-[var(--text-secondary)] mb-1">{label}</div>
      <div className="text-3xl font-black tabular-nums">{value}</div>
    </div>
  );
}
