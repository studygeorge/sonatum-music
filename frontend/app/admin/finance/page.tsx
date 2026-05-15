'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { authStorage } from '@/app/lib/auth';

type FinData = {
  period: string;
  summary: {
    usersTotal: number;
    artistsTotal: number;
    activeSubs: number;
    tracksTotal: number;
    tracksPublished: number;
    revenueLicenses: number;
    commissionLicenses: number;
    payoutLicenses: number;
    revenueSubscriptions: number;
    revenueDonations: number;
    licenseSales: number;
    b2bPending: number;
    exclusivePending: number;
  };
  byLicense: { code: string; name: string; shortName: string; commissionPct: number; sales: number; revenue: number; commission: number }[];
  transactions: {
    kind: string;
    id: string;
    amount: number;
    commission: number;
    status: string;
    code: string;
    detail: string;
    buyer: string;
    company: string | null;
    subject: string;
    createdAt: string;
    paidAt: string | null;
  }[];
};

const fmtAmount = (n: number) => Math.round(n).toLocaleString('ru-RU');
const fmtDate = (d: string | null) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' });
};

const STATUS_LABEL: Record<string, { l: string; c: string }> = {
  PAID: { l: 'Оплачено', c: 'bg-green-100 text-green-700' },
  PENDING: { l: 'Ожидает', c: 'bg-amber-100 text-amber-700' },
  ACTIVE: { l: 'Активна', c: 'bg-green-100 text-green-700' },
  AWAITING_MANAGER: { l: 'У менеджера', c: 'bg-blue-100 text-blue-700' },
  EXCLUSIVE_REQUESTED: { l: 'Эксклюзив', c: 'bg-purple-100 text-purple-700' },
  REJECTED: { l: 'Отклонено', c: 'bg-red-100 text-red-700' },
};

const KIND_LABEL: Record<string, string> = {
  LICENSE: 'Лицензия',
  SUBSCRIPTION: 'Подписка',
  DONATION: 'Донат',
};

export default function AdminFinancePage() {
  const [data, setData] = useState<FinData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [tab, setTab] = useState<'ALL' | 'LICENSE' | 'SUBSCRIPTION' | 'DONATION'>('ALL');

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/finance?period=${period}`, {
      headers: { Authorization: `Bearer ${authStorage.getToken() || ''}` },
    })
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setData(j.data);
      })
      .finally(() => setLoading(false));
  }, [period]);

  if (loading) return <div className="min-h-screen pt-20 text-center text-[var(--text-secondary)]">Загрузка…</div>;
  if (!data) return <div className="min-h-screen pt-20 text-center text-[var(--text-secondary)]">Нет доступа</div>;

  const s = data.summary;
  const totalRevenue = s.revenueLicenses + s.revenueSubscriptions + s.revenueDonations;
  const totalCommission = s.commissionLicenses + s.revenueSubscriptions * 0.3; // 30% от подписок

  const txs = tab === 'ALL' ? data.transactions : data.transactions.filter((t) => t.kind === tab);

  return (
    <main className="min-h-screen pt-6 md:pt-10 pb-20 px-4 md:px-8 max-w-7xl mx-auto space-y-6">
      <section
        className="relative rounded-3xl overflow-hidden p-7 md:p-10 text-white flex items-end justify-between gap-4 flex-wrap"
        style={{ background: 'linear-gradient(135deg, #1d4cb8 0%, #d52b1e 55%, #e6e6e6 100%)' }}>
        <div className="relative z-10 max-w-2xl">
          <div className="text-xs uppercase tracking-widest font-semibold mb-2 opacity-90">
            Админ · Финансы
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">
            Финансы платформы
          </h1>
          <p className="text-sm md:text-base text-white/85 mt-2">
            Все операции, комиссия, начисления авторам, B2B-запросы.
          </p>
        </div>
        <div className="flex gap-1 bg-white/10 backdrop-blur-md rounded-full p-1 shrink-0">
          {[
            { v: '7d', l: '7 дней' },
            { v: '30d', l: '30 дней' },
            { v: '90d', l: '90 дней' },
            { v: 'all', l: 'Всё время' },
          ].map((p) => (
            <button
              key={p.v}
              onClick={() => setPeriod(p.v as any)}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
                period === p.v ? 'bg-white text-[var(--text-primary)]' : 'text-white/80 hover:text-white'
              }`}>
              {p.l}
            </button>
          ))}
        </div>
      </section>
      {/* Сводка */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Общий оборот" value={`${fmtAmount(totalRevenue)} ₽`} accent />
        <Stat label="Комиссия платформы" value={`${fmtAmount(totalCommission)} ₽`} />
        <Stat label="Начислено авторам" value={`${fmtAmount(s.payoutLicenses + s.revenueDonations)} ₽`} />
        <Stat label="Активные подписки" value={s.activeSubs} sub={`из ${s.usersTotal} пользователей`} />
      </div>
      {/* Источники дохода */}
      <section className="apple-card p-5 md:p-6">
        <h2 className="text-lg font-bold tracking-tight mb-4">Источники дохода за период</h2>
        <div className="grid sm:grid-cols-3 gap-3">
          <RevenueCard
            label="Продажи лицензий"
            amount={s.revenueLicenses}
            count={s.licenseSales}
            commission={s.commissionLicenses}
            commissionLabel="комиссия (10-20%)"
          />
          <RevenueCard
            label="Premium-подписки"
            amount={s.revenueSubscriptions}
            count={s.activeSubs}
            commission={s.revenueSubscriptions * 0.3}
            commissionLabel="комиссия 30% (пул автору 70%)"
          />
          <RevenueCard
            label="Донаты"
            amount={s.revenueDonations}
            count={0}
            commission={0}
            commissionLabel="комиссия 0% (100% автору)"
          />
        </div>
      </section>
      {/* Ожидающие действий */}
      {(s.b2bPending> 0 || s.exclusivePending> 0) && (
        <section className="apple-card p-5 md:p-6 bg-amber-50 border-amber-200">
          <h2 className="text-base font-bold mb-3">Ожидают действий менеджера</h2>
          <div className="flex gap-3 flex-wrap">
            {s.b2bPending> 0 && (
              <div className="rounded-2xl border border-[var(--border)] bg-white p-3 px-4 bg-white">
                <span className="font-bold text-lg tabular-nums">{s.b2bPending}</span>
                <span className="text-sm text-[var(--text-secondary)] ml-2">B2B-запросов</span>
              </div>
            )}
            {s.exclusivePending> 0 && (
              <div className="rounded-2xl border border-[var(--border)] bg-white p-3 px-4 bg-white">
                <span className="font-bold text-lg tabular-nums">{s.exclusivePending}</span>
                <span className="text-sm text-[var(--text-secondary)] ml-2">эксклюзивных запросов</span>
              </div>
            )}
          </div>
        </section>
      )}

      {/* По типам лицензий */}
      <section className="apple-card p-5 md:p-6 overflow-x-auto">
        <h2 className="text-lg font-bold tracking-tight mb-4">Продажи по типам лицензий</h2>
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="text-left text-[var(--text-secondary)] text-xs border-b border-[var(--border)]">
              <th className="pb-2 font-medium">Тип</th>
              <th className="pb-2 font-medium text-right">Комиссия</th>
              <th className="pb-2 font-medium text-right">Продаж</th>
              <th className="pb-2 font-medium text-right">Оборот</th>
              <th className="pb-2 font-medium text-right">Комиссия платформы</th>
            </tr>
          </thead>
          <tbody>
            {data.byLicense.map((l) => (
              <tr key={l.code} className="border-b border-[var(--border)] last:border-0">
                <td className="py-2.5">
                  <div className="font-medium">{l.shortName}</div>
                </td>
                <td className="py-2.5 text-right text-[var(--text-secondary)] tabular-nums">{l.commissionPct}%</td>
                <td className="py-2.5 text-right tabular-nums">{l.sales}</td>
                <td className="py-2.5 text-right tabular-nums font-medium">{fmtAmount(l.revenue)} ₽</td>
                <td className="py-2.5 text-right tabular-nums text-green-700">+{fmtAmount(l.commission)} ₽</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      {/* Транзакции */}
      <section className="apple-card p-5 md:p-6">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <h2 className="text-lg font-bold tracking-tight">Все операции</h2>
          <div className="flex gap-1 bg-[var(--hover)] rounded-full p-1">
            {[
              { v: 'ALL', l: 'Все' },
              { v: 'LICENSE', l: 'Лицензии' },
              { v: 'SUBSCRIPTION', l: 'Подписки' },
              { v: 'DONATION', l: 'Донаты' },
            ].map((t) => (
              <button
                key={t.v}
                onClick={() => setTab(t.v as any)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  tab === t.v ? 'bg-[var(--text-primary)] text-white' : 'text-[var(--text-primary)]'
                }`}>
                {t.l}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="text-left text-[var(--text-secondary)] text-xs border-b border-[var(--border)]">
                <th className="pb-2 font-medium">Тип</th>
                <th className="pb-2 font-medium">Объект</th>
                <th className="pb-2 font-medium">Покупатель</th>
                <th className="pb-2 font-medium">Статус</th>
                <th className="pb-2 font-medium text-right">Сумма</th>
                <th className="pb-2 font-medium text-right">Комиссия</th>
                <th className="pb-2 font-medium text-right">Дата</th>
              </tr>
            </thead>
            <tbody>
              {txs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-[var(--text-secondary)]">
                    Нет операций
                  </td>
                </tr>
              ) : (
                txs.map((t) => {
                  const st = STATUS_LABEL[t.status] || { l: t.status, c: 'bg-gray-100 text-gray-700' };
                  return (
                    <tr key={t.id} className="border-b border-[var(--border)] last:border-0">
                      <td className="py-2.5 text-xs">
                        <span className="px-2 py-0.5 rounded-full bg-[var(--hover)]">
                          {KIND_LABEL[t.kind] || t.kind}
                        </span>
                      </td>
                      <td className="py-2.5">
                        <div className="font-medium truncate max-w-[200px]">{t.subject}</div>
                        <div className="text-xs text-[var(--text-secondary)]">{t.detail}</div>
                      </td>
                      <td className="py-2.5">
                        <div className="text-xs truncate max-w-[180px]">{t.buyer}</div>
                        {t.company && <div className="text-[10px] text-[var(--text-secondary)] truncate">{t.company}</div>}
                      </td>
                      <td className="py-2.5">
                        <span className={`text-[11px] px-2 py-0.5 rounded-full ${st.c} whitespace-nowrap`}>{st.l}</span>
                      </td>
                      <td className="py-2.5 text-right font-medium tabular-nums">{fmtAmount(t.amount)} ₽</td>
                      <td className="py-2.5 text-right text-green-700 tabular-nums">
                        {t.commission> 0 ? `+${fmtAmount(t.commission)} ₽` : '—'}
                      </td>
                      <td className="py-2.5 text-right text-xs text-[var(--text-secondary)] whitespace-nowrap">
                        {fmtDate(t.paidAt || t.createdAt)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
      <div className="text-center pt-4">
        <Link href="/admin" className="text-sm text-[var(--accent)] hover:underline">
          Назад в админ-панель
        </Link>
      </div>
    </main>
  );
}

function Stat({ label, value, sub, accent }: { label: string; value: any; sub?: string; accent?: boolean }) {
  return (
    <div className={`apple-card p-5 ${accent ? 'bg-[var(--text-primary)] text-white' : ''}`}>
      <div className={`text-xs mb-1.5 ${accent ? 'text-white/70' : 'text-[var(--text-secondary)]'}`}>{label}</div>
      <div className="text-xl md:text-2xl font-black tabular-nums tracking-tight">{value}</div>
      {sub && (
        <div className={`text-[11px] mt-1 ${accent ? 'text-white/70' : 'text-[var(--text-secondary)]'}`}>{sub}</div>
      )}
    </div>
  );
}

function RevenueCard({
  label,
  amount,
  count,
  commission,
  commissionLabel,
}: {
  label: string;
  amount: number;
  count: number;
  commission: number;
  commissionLabel: string;
}) {
  return (
    <div className="apple-card p-4">
      <div className="text-xs text-[var(--text-secondary)] mb-1">{label}</div>
      <div className="text-xl font-black tabular-nums tracking-tight mb-1">{fmtAmount(amount)} ₽</div>
      {count> 0 && (
        <div className="text-[11px] text-[var(--text-secondary)] mb-2">{count} операций</div>
      )}
      <div className="text-xs text-green-700 tabular-nums">+{fmtAmount(commission)} ₽</div>
      <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">{commissionLabel}</div>
    </div>
  );
}
