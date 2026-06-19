'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { authStorage } from '@/app/lib/auth';
import PayoutSetupModal from '@/app/components/PayoutSetupModal';

import Portal from "@/app/components/Portal";
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
  authorType?: 'COMPOSER' | 'PERFORMER' | 'BOTH';
  split?: {
    composer: { originalSales: number; originalEarn: number; total: number };
    performer: { coverSales: number; coverEarn: number; originalSales: number; originalEarn: number; total: number };
    donations: number;
    note: string | null;
  };
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

  // Новое: статус самозанятого + история выплат
  const [se, setSe] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);

  const loadAll = () => {
    setLoading(true);
    Promise.all([
      fetch('/api/author/finance', { headers: { Authorization: `Bearer ${authStorage.getToken() || ''}` } }).then(r => r.json()).catch(() => null),
      fetch('/api/author/payout/self-employed', { headers: { Authorization: `Bearer ${authStorage.getToken() || ''}` } }).then(r => r.json()).catch(() => null),
      fetch('/api/author/payout/withdraw', { headers: { Authorization: `Bearer ${authStorage.getToken() || ''}` } }).then(r => r.json()).catch(() => null),
    ]).then(([f, s, h]) => {
      if (f?.success) setFin(f.data);
      if (s?.success) setSe(s.data.selfEmployed);
      if (h?.success) setHistory(h.data || []);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { loadAll(); }, []);

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
            Доходы по типам лицензий, история транзакций.
          </p>
        </div>
      </section>
      {/* Главные показатели */}
      {(() => {
        const isActive = se?.status === 'ACTIVE';
        const taxHolding = !!se?.cardHolder;
        const netRate = taxHolding ? 0.94 : 1;
        const balance = Number(fin.balance || 0);
        const netAvailable = Math.floor(balance * netRate);
        return (
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="apple-card p-5 bg-[var(--text-primary)] text-white">
              <div className="text-xs mb-1.5 text-white/70">Баланс (брутто)</div>
              <div className="text-2xl md:text-3xl font-black tabular-nums tracking-tight">{fmtAmount(balance)} ₽</div>
              {isActive && balance >= 1000 ? (
                <button onClick={() => setWithdrawOpen(true)} className="mt-3 px-4 py-1.5 rounded-full bg-white text-[var(--text-primary)] text-xs font-semibold hover:opacity-90">
                  Запросить выплату
                </button>
              ) : (
                <a href="/author/payout" className="mt-3 inline-block px-4 py-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white text-xs font-semibold">
                  {se?.status === 'NOT_REGISTERED' || !se ? 'Подключить выплаты' : 'Открыть выплаты'}
                </a>
              )}
            </div>
            <div className="apple-card p-5">
              <div className="text-xs mb-1.5 text-[var(--text-secondary)]">К получению на карту</div>
              <div className="text-2xl md:text-3xl font-black tabular-nums tracking-tight">{fmtAmount(netAvailable)} ₽</div>
              <div className="text-[11px] text-[var(--text-secondary)] mt-1">
                {taxHolding
                  ? 'после удержания НПД 6% Т-Банком'
                  : se?.status === 'ACTIVE'
                    ? 'налог НПД 6% платите сами в «Мой налог»'
                    : 'после подключения выплат'}
              </div>
            </div>
            <BigStat label="Всего заработано" value={`${fmtAmount(fin.totals.totalLicenseEarned)} ₽`} />
          </div>
        );
      })()}

      {/* Статус самозанятого */}
      {se && se.status !== 'ACTIVE' && (
        <section className="apple-card p-5 md:p-6">
          <div className="flex items-start gap-3 flex-wrap">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold mb-1">
                {se.status === 'NOT_REGISTERED' || !se.method ? 'Выплаты не подключены' :
                 se.status === 'DRAFT' ? 'Ожидаем подтверждение Т-Банка' :
                 se.status === 'SUSPENDED' ? 'Статус самозанятого приостановлен' :
                 se.status === 'REJECTED' ? 'Заявка отклонена' : 'Проверяем статус'}
              </h3>
              <p className="text-sm text-[var(--text-secondary)] mb-3">
                {se.status === 'DRAFT'
                  ? 'Т-Банк отправил SMS-ссылку — перейдите по ней и подтвердите в «Мой налог».'
                  : 'Деньги накапливаются на балансе. Для вывода подтвердите статус самозанятого.'}
              </p>
              <a href="/author/payout" className="inline-block px-5 py-2.5 rounded-full bg-[var(--text-primary)] text-white font-medium hover:opacity-90">
                Открыть «Выплаты»
              </a>
            </div>
          </div>
        </section>
      )}

      {/* === Авторские vs Исполнительские (ТЗ) === */}
      {fin.split && (fin.split.composer.total > 0 || fin.split.performer.total > 0) && (
        <section className="apple-card p-5 md:p-6">
          <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
            <h2 className="text-lg font-bold tracking-tight">Структура дохода за 30 дней</h2>
            <span className="text-xs text-[var(--text-secondary)]">после комиссии платформы</span>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {/* Авторские (за сочинение музыки) */}
            <div className="rounded-2xl border border-[var(--border)] p-4 bg-white">
              <div className="text-xs uppercase tracking-widest font-bold text-[var(--text-secondary)] mb-1">
                Авторские
              </div>
              <div className="text-2xl font-black tabular-nums mb-3">{fmtAmount(fin.split.composer.total)} ₽</div>
              <ul className="space-y-1 text-sm">
                <li className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">Продажа оригиналов</span>
                  <span className="tabular-nums">{fmtAmount(fin.split.composer.originalEarn)} ₽</span>
                </li>
                {/* TODO: роялти за стриминг — добавится когда будет распределение пула Premium */}
              </ul>
              {fin.split.composer.originalSales > 0 && (
                <div className="text-[11px] text-[var(--text-secondary)] mt-1">
                  {fin.split.composer.originalSales} продаж
                </div>
              )}
            </div>

            {/* Исполнительские (за запись и исполнение) */}
            <div className="rounded-2xl border border-[var(--border)] p-4 bg-white">
              <div className="text-xs uppercase tracking-widest font-bold text-[var(--text-secondary)] mb-1">
                Исполнительские
              </div>
              <div className="text-2xl font-black tabular-nums mb-3">{fmtAmount(fin.split.performer.total)} ₽</div>
              <ul className="space-y-1 text-sm">
                {fin.split.performer.originalEarn > 0 && (
                  <li className="flex justify-between">
                    <span className="text-[var(--text-secondary)]">Продажа оригиналов (исп. часть)</span>
                    <span className="tabular-nums">{fmtAmount(fin.split.performer.originalEarn)} ₽</span>
                  </li>
                )}
                <li className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">Продажа каверов</span>
                  <span className="tabular-nums">{fmtAmount(fin.split.performer.coverEarn)} ₽</span>
                </li>
              </ul>
              {(fin.split.performer.coverSales + fin.split.performer.originalSales) > 0 && (
                <div className="text-[11px] text-[var(--text-secondary)] mt-1">
                  {fin.split.performer.coverSales + fin.split.performer.originalSales} продаж
                </div>
              )}
            </div>
          </div>

          {fin.split.note && (
            <div className="mt-3 text-xs text-[var(--text-secondary)] rounded-xl p-3 bg-[var(--hover)] leading-snug">
              ⓘ {fin.split.note}
            </div>
          )}
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
      {/* История выплат */}
      {history.length > 0 && (
        <section className="apple-card p-5 md:p-6">
          <h2 className="text-lg font-bold mb-3">История выплат</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-[var(--text-secondary)] border-b border-[var(--border)]">
                  <th className="text-left py-2 pr-3">Дата</th>
                  <th className="text-right py-2 px-3">Брутто</th>
                  <th className="text-right py-2 px-3">Налог</th>
                  <th className="text-right py-2 px-3">К получению</th>
                  <th className="text-left py-2 px-3">Статус</th>
                  <th className="text-left py-2 pl-3">Чек ФНС</th>
                </tr>
              </thead>
              <tbody>
                {history.map((p) => {
                  const sLabel =
                    p.status === 'EXECUTED' ? { l: 'Выплачено', c: 'bg-[var(--text-primary)] text-white' }
                    : p.status === 'IN_PROGRESS' ? { l: 'В пути', c: 'bg-[var(--hover)] text-[var(--text-primary)]' }
                    : p.status === 'ERROR' || p.status === 'REJECTED' ? { l: 'Ошибка', c: 'bg-white border border-[var(--text-primary)] text-[var(--text-primary)]' }
                    : { l: p.status, c: 'bg-[var(--hover)] text-[var(--text-secondary)]' };
                  return (
                    <tr key={p.id} className="border-b border-[var(--border)] last:border-0 hover:bg-black/[0.02]">
                      <td className="py-3 pr-3 text-xs text-[var(--text-secondary)] whitespace-nowrap">{fmtDate(p.paidAt || p.createdAt)}</td>
                      <td className="py-3 px-3 text-right tabular-nums font-medium">{fmtAmount(p.gross)} ₽</td>
                      <td className="py-3 px-3 text-right tabular-nums text-[var(--text-secondary)]">{p.tax ? `−${fmtAmount(p.tax)} ₽` : '—'}</td>
                      <td className="py-3 px-3 text-right tabular-nums font-semibold">{fmtAmount(p.net)} ₽</td>
                      <td className="py-3 px-3"><span className={`text-[10px] px-2 py-0.5 rounded-full ${sLabel.c}`}>{sLabel.l}</span></td>
                      <td className="py-3 pl-3">
                        {p.receiptUrl ? (
                          <a href={p.receiptUrl} target="_blank" rel="noopener noreferrer" className="text-xs underline">Скачать</a>
                        ) : <span className="text-xs text-[var(--text-secondary)]">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
<Portal>
      <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/45 backdrop-blur-md" onClick={() => !withdrawing && setWithdrawOpen(false)}>
        <div className="apple-card max-w-sm w-full p-6 shadow-2xl animate-fadeInUp" onClick={(e) => e.stopPropagation()}>
          <h3 className="text-xl font-bold tracking-tight mb-2">Запросить выплату</h3>
          <p className="text-sm text-[var(--text-secondary)] mb-3">
            На балансе: <strong>{fmtAmount(fin.balance)} ₽</strong>. Минимум — 1 000 ₽.
          </p>
          <input
            type="number"
            min={1000}
            max={fin.balance}
            value={withdrawAmount}
            onChange={(e) => setWithdrawAmount(e.target.value)}
            placeholder={String(Math.floor(fin.balance))}
            className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-white text-sm tabular-nums mb-3"
          />
          {(() => {
            const a = Number(withdrawAmount || 0);
            const taxHolding = !!se?.cardHolder;
            const tax = taxHolding ? Math.round(a * 0.06 * 100) / 100 : 0;
            const net = a - tax;
            if (!a) return null;
            return (
              <div className="text-xs text-[var(--text-secondary)] mb-4 p-3 rounded-xl bg-[var(--hover)]">
                {taxHolding ? (
                  <>
                    Брутто: <b>{fmtAmount(a)} ₽</b><br/>
                    НПД 6% (удержит Т-Банк): <b>−{fmtAmount(tax)} ₽</b><br/>
                    К получению: <b>{fmtAmount(net)} ₽</b>
                  </>
                ) : (
                  <>
                    Брутто к переводу: <b>{fmtAmount(a)} ₽</b><br/>
                    Налог НПД 6% оплатите самостоятельно через «Мой налог».
                  </>
                )}
              </div>
            );
          })()}
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
              disabled={withdrawing || !withdrawAmount || Number(withdrawAmount) < 1000}
              className="px-6 py-2.5 rounded-full bg-[var(--text-primary)] text-white text-sm font-medium disabled:opacity-40">
              {withdrawing ? 'Отправляем…' : 'Вывести'}
            </button>
          </div>
        </div>
      </div>
</Portal>
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
