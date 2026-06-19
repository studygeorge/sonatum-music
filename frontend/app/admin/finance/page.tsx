'use client';

import { useEffect, useState } from 'react';
import { authStorage } from '@/app/lib/auth';

type Data = {
  period: { from: string; to: string };
  revenue: { total: number; licenses: number; subscriptions: number; donations: number };
  platform: { total: number; licenses: number; subscriptions30pct: number; donations: number };
  authorsAccrued: { total: number; licenses: number; subscriptionPool70pct: number; donations: number; manualB2b: number };
  payouts: { executedGross: number; executedNet: number; taxHeld: number; count: number };
  currentBalances: number;
  counts: { licenses: number; subscriptions: number; donations: number; manualB2b: number };
  monthly: { month: string; license: number; subscription: number; donation: number }[];
};

const fmt = (n: number) => n.toLocaleString('ru-RU', { maximumFractionDigits: 0 });

export default function AdminFinanceDashboard() {
  const [data, setData] = useState<Data | null>(null);
  const [from, setFrom] = useState(() => new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    fetch(`/api/admin/finance/dashboard?from=${from}&to=${to}`, {
      headers: { Authorization: `Bearer ${authStorage.getToken() || ''}` },
    })
      .then((r) => r.json())
      .then((j) => { if (j.success) setData(j.data); })
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [from, to]);

  if (loading || !data) {
    return <div className="apple-card p-10 text-center text-[var(--text-secondary)]">Загрузка…</div>;
  }

  const maxMonth = Math.max(1, ...data.monthly.map(m => m.license + m.subscription + m.donation));

  return (
    <div className="space-y-6">
      <section
        className="relative rounded-3xl overflow-hidden p-7 md:p-10 flex items-end justify-between gap-4 flex-wrap"
        style={{ background: 'linear-gradient(135deg, #1d4cb8 0%, #2f9e8f 55%, #e6e6e6 100%)' }}>
        <div className="relative z-10 max-w-xl">
          <div className="text-xs uppercase tracking-widest font-semibold mb-2 text-white/90">Финансы платформы</div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">Дашборд</h1>
          <p className="text-sm md:text-base text-white/90 mt-2 max-w-lg">
            Выручка, доход платформы, начисления авторам и выплаты — за выбранный период.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap relative z-10">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            className="px-3 py-2 rounded-full bg-white text-[#1c1c1e] text-sm" />
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            className="px-3 py-2 rounded-full bg-white text-[#1c1c1e] text-sm" />
        </div>
      </section>

      {/* Главные показатели */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Выручка от пользователей" value={`${fmt(data.revenue.total)} ₽`} sub="лицензии + подписки + донаты" />
        <StatCard label="Доход платформы" value={`${fmt(data.platform.total)} ₽`} sub={`${pct(data.platform.total, data.revenue.total)}% от выручки`} />
        <StatCard label="Начислено авторам" value={`${fmt(data.authorsAccrued.total)} ₽`} sub="брутто (до налога)" />
        <StatCard label="Балансы авторов" value={`${fmt(data.currentBalances)} ₽`} sub="доступно к выплате" />
      </div>

      {/* Детализация */}
      <div className="grid md:grid-cols-3 gap-4">
        <DetailCard
          title="Выручка"
          rows={[
            ['Лицензии', `${fmt(data.revenue.licenses)} ₽`, data.counts.licenses + ' шт'],
            ['Подписки Premium', `${fmt(data.revenue.subscriptions)} ₽`, data.counts.subscriptions + ' шт'],
            ['Донаты', `${fmt(data.revenue.donations)} ₽`, data.counts.donations + ' шт'],
          ]}
          total={`${fmt(data.revenue.total)} ₽`}
        />
        <DetailCard
          title="Доход платформы"
          rows={[
            ['Комиссии лицензий', `${fmt(data.platform.licenses)} ₽`, '10–20%'],
            ['30% от подписок', `${fmt(data.platform.subscriptions30pct)} ₽`, ''],
            ['10% от донатов', `${fmt(data.platform.donations)} ₽`, ''],
          ]}
          total={`${fmt(data.platform.total)} ₽`}
        />
        <DetailCard
          title="Начислено авторам"
          rows={[
            ['Лицензии (80–90%)', `${fmt(data.authorsAccrued.licenses)} ₽`, ''],
            ['Пул подписок (70%)', `${fmt(data.authorsAccrued.subscriptionPool70pct)} ₽`, ''],
            ['Донаты (90%)', `${fmt(data.authorsAccrued.donations)} ₽`, ''],
            ['B2B вручную', `${fmt(data.authorsAccrued.manualB2b)} ₽`, data.counts.manualB2b + ' шт'],
          ]}
          total={`${fmt(data.authorsAccrued.total)} ₽`}
        />
      </div>

      {/* Выплаты */}
      <div className="apple-card p-6">
        <h2 className="text-lg font-bold mb-4">Выплаты за период</h2>
        <div className="grid sm:grid-cols-4 gap-3">
          <SmallStat label="Кол-во" value={data.payouts.count} />
          <SmallStat label="Брутто" value={`${fmt(data.payouts.executedGross)} ₽`} />
          <SmallStat label="НПД 6% (удержано)" value={`${fmt(data.payouts.taxHeld)} ₽`} />
          <SmallStat label="На карты (нетто)" value={`${fmt(data.payouts.executedNet)} ₽`} />
        </div>
      </div>

      {/* Помесячный график */}
      <div className="apple-card p-6">
        <h2 className="text-lg font-bold mb-4">Выручка по месяцам (12 мес)</h2>
        <div className="space-y-2">
          {data.monthly.map((m) => {
            const total = m.license + m.subscription + m.donation;
            const w = (total / maxMonth) * 100;
            return (
              <div key={m.month} className="flex items-center gap-3">
                <div className="text-xs text-[var(--text-secondary)] w-16 tabular-nums">{m.month}</div>
                <div className="flex-1 h-6 bg-[var(--hover)] rounded-md overflow-hidden flex">
                  {total > 0 && (
                    <>
                      <div style={{ width: `${(m.license / total) * w}%`, background: '#1c1c1e' }} title={`Лицензии: ${fmt(m.license)}`} />
                      <div style={{ width: `${(m.subscription / total) * w}%`, background: '#1d4cb8' }} title={`Подписки: ${fmt(m.subscription)}`} />
                      <div style={{ width: `${(m.donation / total) * w}%`, background: '#2f9e8f' }} title={`Донаты: ${fmt(m.donation)}`} />
                    </>
                  )}
                </div>
                <div className="text-xs tabular-nums font-medium w-24 text-right">{fmt(total)} ₽</div>
              </div>
            );
          })}
        </div>
        <div className="flex gap-4 mt-4 text-xs">
          <Legend color="#1c1c1e" label="Лицензии" />
          <Legend color="#1d4cb8" label="Подписки" />
          <Legend color="#2f9e8f" label="Донаты" />
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="apple-card p-5">
      <div className="text-[11px] uppercase tracking-widest font-bold text-[var(--text-secondary)]">{label}</div>
      <div className="text-2xl font-black mt-2 tabular-nums">{value}</div>
      <div className="text-[11px] text-[var(--text-secondary)] mt-1">{sub}</div>
    </div>
  );
}
function SmallStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-widest font-bold text-[var(--text-secondary)]">{label}</div>
      <div className="text-xl font-black mt-1 tabular-nums">{value}</div>
    </div>
  );
}
function DetailCard({ title, rows, total }: { title: string; rows: [string, string, string][]; total: string }) {
  return (
    <div className="apple-card p-5">
      <h3 className="font-bold mb-3">{title}</h3>
      <table className="w-full text-sm">
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-[var(--border)] last:border-0">
              <td className="py-2 text-[var(--text-secondary)]">{r[0]}</td>
              <td className="py-2 text-right tabular-nums">{r[1]}</td>
              <td className="py-2 text-right text-xs text-[var(--text-secondary)] w-16">{r[2]}</td>
            </tr>
          ))}
          <tr className="border-t-2 border-[var(--text-primary)]">
            <td className="pt-2 font-bold">Итого</td>
            <td className="pt-2 text-right font-bold tabular-nums">{total}</td>
            <td></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div style={{ background: color }} className="w-3 h-3 rounded-sm" />
      <span className="text-[var(--text-secondary)]">{label}</span>
    </div>
  );
}
function pct(part: number, whole: number): number {
  if (!whole) return 0;
  return Math.round((part / whole) * 100);
}
