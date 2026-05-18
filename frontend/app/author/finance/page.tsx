'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { authStorage } from '@/app/lib/auth';
import PayoutSetupModal from '@/app/components/PayoutSetupModal';

// Простой inline-баннер вместо alert
function showBanner(msg: string) {
  if (typeof document === 'undefined') return;
  const el = document.createElement('div');
  el.textContent = msg;
  el.style.cssText = 'position:fixed;right:1rem;bottom:1rem;z-index:9999;padding:.75rem 1rem;border-radius:.75rem;background:#000;color:#fff;font-size:.875rem;font-weight:500;box-shadow:0 8px 24px rgba(0,0,0,.15);max-width:24rem;word-break:break-word;';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

type Fin = {
  balance: number;
  availableForWithdrawal: number;
  totals: { totalLicenseEarned: number; totalDonations: number; totalLicenseCount: number };
  breakdown: { licenseCode: string; licenseName: string; sales: number; earned: number }[];
  recentLicenses: {
    id: string;
    price: number;
    artistAmount: number;
    commissionPct: number;
    licenseCode: string;
    licenseName: string;
    trackTitle: string;
    trackSlug: string;
    status: string;
    buyerCompany?: string;
    paidAt: string | null;
    createdAt: string;
  }[];
  recentDonations: {
    id: string;
    amount: number;
    donorNickname: string | null;
    message: string | null;
    status: string;
    paidAt: string | null;
    createdAt: string;
  }[];
  payout: {
    enabled: boolean;
    tin: string | null;
    sbpPhone: string | null;
    selfEmployedVerifiedAt: string | null;
  };
};

const STATUS_LABEL: Record<string, { l: string; c: string }> = {
  PAID: { l: 'Оплачено', c: 'bg-black text-white' },
  PENDING: { l: 'Ожидает оплаты', c: 'bg-gray-700 text-white' },
  AWAITING_MANAGER: { l: 'У менеджера', c: 'bg-gray-200 text-gray-900 border border-gray-300' },
  EXCLUSIVE_REQUESTED: { l: 'Запрос эксклюзива', c: 'bg-gray-200 text-gray-900 border border-gray-300' },
  REJECTED: { l: 'Отклонено', c: 'bg-white text-black border-2 border-black' },
  FULFILLED: { l: 'Выполнено', c: 'bg-black text-white' },
};

const fmtAmount = (n: number) => Math.round(n).toLocaleString('ru-RU');
const fmtDate = (d: string | null) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' });
};

export default function FinancePage() {
  const [fin, setFin] = useState<Fin | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPayoutSetup, setShowPayoutSetup] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);

  useEffect(() => {
    fetch('/api/author/finance', {
      headers: { Authorization: `Bearer ${authStorage.getToken() || ''}` },
    })
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setFin(j.data);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center text-[var(--text-secondary)] py-20">Загрузка…</div>;
  if (!fin) return null;

  return (
    <div className="space-y-6 animate-fadeInUp">
      <section
        className="relative rounded-3xl overflow-hidden p-7 md:p-10 text-white bg-gray-900">
        <div className="relative z-10 max-w-2xl">
          <div className="text-xs uppercase tracking-widest font-semibold mb-2 opacity-90">
            Финансы
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">Баланс и выплаты</h1>
          <p className="text-sm md:text-base text-white/85 mt-2">
            Доходы по типам лицензий, донаты, история транзакций.
          </p>
        </div>
      </section>
      {/* Главные показатели */}
      <div className="grid sm:grid-cols-3 gap-3">
        <div className="apple-card p-5 bg-[var(--text-primary)] text-white">
          <div className="text-xs mb-1.5 text-white/70">Текущий баланс</div>
          <div className="text-2xl md:text-3xl font-black tabular-nums tracking-tight">{fmtAmount(fin.balance)} ₽</div>
          {fin.payout.enabled && fin.balance>= 100 && (
            <button onClick={() => setWithdrawOpen(true)} className="mt-3 px-4 py-1.5 rounded-full bg-white text-[var(--text-primary)] text-xs font-semibold hover:opacity-90">
              Вывести через СБП
            </button>
          )}
        </div>
        <BigStat
          label="Доступно к выводу"
          value={`${fmtAmount(fin.availableForWithdrawal)} ₽`}
          sub={fin.payout.enabled ? null : 'Подключите выплаты'}
        />
        <BigStat label="Всего заработано" value={`${fmtAmount(fin.totals.totalLicenseEarned + fin.totals.totalDonations)} ₽`} />
      </div>
      {!fin.payout.enabled && (
        <section className="apple-card p-5 md:p-6 bg-gray-50 border border-gray-300">
          <div className="flex items-start gap-3">
            <div className="text-2xl"></div>
            <div className="flex-1">
              <h3 className="font-semibold mb-1">Выплаты не подключены</h3>
              <p className="text-sm text-[var(--text-secondary)] mb-3">
                Деньги от продаж и донатов накапливаются на балансе, но вывести их можно только после
                подтверждения статуса самозанятого и указания реквизитов СБП.
              </p>
              <button
                onClick={() => setShowPayoutSetup(true)}
                className="px-5 py-2.5 rounded-full bg-[var(--text-primary)] text-white font-medium hover:opacity-90 transition-opacity">
                Подключить выплаты
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Разбивка по лицензиям */}
      {fin.breakdown.length> 0 && (
        <section className="apple-card p-5 md:p-6">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-lg font-bold tracking-tight">Доходы за 30 дней по типам</h2>
            <span className="text-xs text-[var(--text-secondary)]">после комиссии платформы</span>
          </div>
          <div className="space-y-2">
            {fin.breakdown.map((b) => (
              <div key={b.licenseCode} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-[var(--hover)]">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{b.licenseName}</div>
                  <div className="text-xs text-[var(--text-secondary)]">{b.sales} продаж</div>
                </div>
                <div className="font-bold tabular-nums">{fmtAmount(b.earned)} ₽</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Последние продажи лицензий */}
      <section className="apple-card p-5 md:p-6">
        <h2 className="text-lg font-bold tracking-tight mb-4">Последние продажи лицензий</h2>
        {fin.recentLicenses.length === 0 ? (
          <div className="text-sm text-[var(--text-secondary)] py-4 text-center">
            Пока продаж нет.
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {fin.recentLicenses.map((r) => {
              const s = STATUS_LABEL[r.status] || STATUS_LABEL.PENDING;
              return (
                <div key={r.id} className="flex items-center gap-3 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link href={`/tracks/${r.trackSlug}`} className="font-medium text-sm hover:underline truncate">
                        {r.trackTitle}
                      </Link>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full ${s.c}`}>{s.l}</span>
                    </div>
                    <div className="text-xs text-[var(--text-secondary)] mt-0.5">
                      {r.licenseName} · комиссия {r.commissionPct}%
                      {r.buyerCompany && ` · ${r.buyerCompany}`}
                      <span className="ml-2 text-[var(--text-secondary)]">{fmtDate(r.paidAt || r.createdAt)}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-bold text-sm tabular-nums">+{fmtAmount(r.artistAmount)} ₽</div>
                    <div className="text-xs text-[var(--text-secondary)] tabular-nums">из {fmtAmount(r.price)} ₽</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
      {/* Донаты */}
      {fin.recentDonations.length> 0 && (
        <section className="apple-card p-5 md:p-6">
          <h2 className="text-lg font-bold tracking-tight mb-4">Донаты</h2>
          <div className="divide-y divide-[var(--border)]">
            {fin.recentDonations.map((d) => {
              const s = STATUS_LABEL[d.status] || STATUS_LABEL.PENDING;
              return (
                <div key={d.id} className="py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{d.donorNickname || 'Аноним'}</span>
                        <span className={`text-[11px] px-2 py-0.5 rounded-full ${s.c}`}>{s.l}</span>
                        <span className="text-xs text-[var(--text-secondary)]">{fmtDate(d.paidAt || d.createdAt)}</span>
                      </div>
                      {d.message && (
                        <p className="text-sm text-[var(--text-secondary)] mt-1 italic">«{d.message}»</p>
                      )}
                    </div>
                    <div className="font-bold text-gray-900 tabular-nums shrink-0">+{fmtAmount(d.amount)} ₽</div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    {showPayoutSetup && (
      <PayoutSetupModal
        onClose={() => setShowPayoutSetup(false)}
        onDone={() => { setShowPayoutSetup(false); window.location.reload(); }}
      />
    )}
    {withdrawOpen && fin && (
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md" onClick={() => !withdrawing && setWithdrawOpen(false)}>
        <div className="apple-card max-w-sm w-full p-6 shadow-2xl animate-fadeInUp" onClick={(e) => e.stopPropagation()}>
          <h3 className="text-xl font-bold tracking-tight mb-2">Вывод средств</h3>
          <p className="text-sm text-[var(--text-secondary)] mb-3">
            Доступно: <strong>{fmtAmount(fin.balance)} ₽</strong>. Перевод поступит через СБП в течение 1-3 рабочих дней.
          </p>
          <input
            type="number"
            min={100}
            max={fin.balance}
            value={withdrawAmount}
            onChange={(e) => setWithdrawAmount(e.target.value)}
            placeholder={String(Math.floor(fin.balance))}
            className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-white text-sm tabular-nums mb-4"
          />
          <div className="flex justify-end gap-2">
            <button onClick={() => setWithdrawOpen(false)} className="px-5 py-2.5 rounded-full bg-[var(--hover)] text-sm font-medium">Отмена</button>
            <button
              onClick={async () => {
                setWithdrawing(true);
                try {
                  const r = await fetch('/api/author/payout/withdraw', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStorage.getToken() || ''}` },
                    body: JSON.stringify({ amount: Number(withdrawAmount) }),
                  });
                  const j = await r.json();
                  if (j.success) { showBanner(j.message); window.location.reload(); }
                  else showBanner(j.error || 'Ошибка');
                } finally {
                  setWithdrawing(false);
                  setWithdrawOpen(false);
                }
              }}
              disabled={withdrawing || !withdrawAmount || Number(withdrawAmount) < 100}
              className="px-6 py-2.5 rounded-full bg-[var(--text-primary)] text-white text-sm font-medium disabled:opacity-40">
              {withdrawing ? 'Отправляем…' : 'Вывести'}
            </button>
          </div>
        </div>
      </div>
    )}
    </div>
  );
}

function BigStat({ label, value, sub, accent }: { label: string; value: string; sub?: string | null; accent?: boolean }) {
  return (
    <div className={`apple-card p-5 ${accent ? 'bg-[var(--text-primary)] text-white' : ''}`}>
      <div className={`text-xs mb-1.5 ${accent ? 'text-white/70' : 'text-[var(--text-secondary)]'}`}>{label}</div>
      <div className="text-2xl md:text-3xl font-black tabular-nums tracking-tight">{value}</div>
      {sub && (
        <div className={`text-xs mt-1.5 ${accent ? 'text-white/70' : 'text-[var(--text-secondary)]'}`}>{sub}</div>
      )}
    </div>
  );
}
