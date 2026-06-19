'use client';

import { useEffect, useState } from 'react';
import { authStorage } from '@/app/lib/auth';
import Portal from '@/app/components/Portal';

type Registry = {
  id: string;
  tbankRegistryId: number | null;
  status: string;
  totalGross: number;
  totalNet: number;
  totalTax: number;
  paymentCount: number;
  receiptsCount: number;
  errorsCount: number;
  comment: string | null;
  createdAt: string;
  paidAt: string | null;
  finalizedAt: string | null;
};

const STATUS_LABEL: Record<string, { l: string; c: string }> = {
  DRAFT:     { l: 'Черновик',   c: 'bg-[var(--hover)] text-[var(--text-secondary)]' },
  CREATED:   { l: 'Создан',     c: 'bg-[var(--hover)] text-[var(--text-primary)] border border-[var(--text-primary)]' },
  ACCEPTED:  { l: 'Подписан',   c: 'bg-[var(--hover)] text-[var(--text-primary)] border border-[var(--text-primary)]' },
  SENT:      { l: 'Отправлен',  c: 'bg-[var(--hover)] text-[var(--text-primary)] border border-[var(--text-primary)]' },
  IN_PROGRESS: { l: 'В пути',   c: 'bg-[var(--hover)] text-[var(--text-primary)] border border-[var(--text-primary)]' },
  EXECUTED:  { l: 'Исполнен',   c: 'bg-[var(--text-primary)] text-white' },
  PART_EXEC: { l: 'Частично',   c: 'bg-white text-[var(--text-primary)] border border-[var(--text-primary)]' },
  REJECTED:  { l: 'Отклонён',   c: 'bg-white text-[var(--text-primary)] border border-[var(--text-primary)]' },
  ERROR:     { l: 'Ошибка',     c: 'bg-white text-[var(--text-primary)] border border-[var(--text-primary)]' },
  CANCELLED: { l: 'Отменён',    c: 'bg-[var(--hover)] text-[var(--text-secondary)]' },
};

const fmt = (n: number) => n.toLocaleString('ru-RU', { maximumFractionDigits: 0 });

export default function AdminRegistriesPage() {
  const [items, setItems] = useState<Registry[]>([]);
  const [summary, setSummary] = useState<Record<string, { count: number; gross: number }>>({});
  const [filter, setFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<Registry | null>(null);

  const auth = () => ({ Authorization: `Bearer ${authStorage.getToken() || ''}` });

  const load = () => {
    setLoading(true);
    const q = filter ? `?status=${filter}` : '';
    fetch(`/api/admin/finance/registries${q}`, { headers: auth() })
      .then((r) => r.json())
      .then((j) => {
        if (j.success) {
          setItems(j.data || []);
          setSummary(j.summary || {});
        }
      })
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [filter]);

  const totalAll = Object.values(summary).reduce((a, b) => a + b.count, 0);

  return (
    <div className="space-y-6">
      <section
        className="relative rounded-3xl overflow-hidden p-7 md:p-10 flex items-end justify-between gap-4 flex-wrap"
        style={{ background: 'linear-gradient(135deg, #1d4cb8 0%, #2f9e8f 55%, #e6e6e6 100%)' }}>
        <div className="relative z-10 max-w-xl">
          <div className="text-xs uppercase tracking-widest font-semibold mb-2 text-white/90">Финансы</div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">Реестры выплат</h1>
          <p className="text-sm md:text-base text-white/90 mt-2 max-w-lg">
            Журнал отправленных в Т-Банк платёжных реестров с детализацией каждого платежа и чеками ФНС.
          </p>
        </div>
      </section>

      {/* Сводка */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button onClick={() => setFilter('')}
          className={`apple-card p-4 text-left ${filter === '' ? 'ring-2 ring-[var(--text-primary)]' : ''}`}>
          <div className="text-[11px] uppercase tracking-widest font-bold text-[var(--text-secondary)]">Всего</div>
          <div className="text-2xl font-black mt-1 tabular-nums">{totalAll}</div>
        </button>
        {['EXECUTED', 'IN_PROGRESS', 'ERROR'].map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={`apple-card p-4 text-left ${filter === s ? 'ring-2 ring-[var(--text-primary)]' : ''}`}>
            <div className="text-[11px] uppercase tracking-widest font-bold text-[var(--text-secondary)]">{STATUS_LABEL[s].l}</div>
            <div className="text-2xl font-black mt-1 tabular-nums">{summary[s]?.count ?? 0}</div>
            <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">{fmt(summary[s]?.gross ?? 0)} ₽</div>
          </button>
        ))}
      </div>

      <div className="flex gap-2 overflow-x-auto">
        <FilterPill v="" cur={filter} onClick={setFilter}>Все</FilterPill>
        {(['DRAFT', 'CREATED', 'ACCEPTED', 'IN_PROGRESS', 'EXECUTED', 'PART_EXEC', 'REJECTED', 'ERROR'] as const).map((s) => (
          <FilterPill key={s} v={s} cur={filter} onClick={setFilter}>{STATUS_LABEL[s]?.l || s}</FilterPill>
        ))}
      </div>

      {loading ? (
        <div className="apple-card p-10 text-center text-[var(--text-secondary)]">Загрузка…</div>
      ) : items.length === 0 ? (
        <div className="apple-card p-10 text-center text-[var(--text-secondary)]">Реестров нет</div>
      ) : (
        <div className="apple-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-[var(--text-secondary)] border-b border-[var(--border)]">
                  <th className="text-left py-2.5 px-4">Дата</th>
                  <th className="text-left py-2.5 px-4">ID</th>
                  <th className="text-left py-2.5 px-4">Статус</th>
                  <th className="text-right py-2.5 px-4">Брутто</th>
                  <th className="text-right py-2.5 px-4">Нетто</th>
                  <th className="text-right py-2.5 px-4">НПД</th>
                  <th className="text-right py-2.5 px-4">Платежей</th>
                  <th className="text-right py-2.5 px-4">Чеков</th>
                  <th className="text-right py-2.5 px-4"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => {
                  const sl = STATUS_LABEL[r.status] || { l: r.status, c: 'bg-[var(--hover)]' };
                  return (
                    <tr key={r.id} className="border-b border-[var(--border)] last:border-0 hover:bg-black/[0.02]">
                      <td className="py-3 px-4 text-xs text-[var(--text-secondary)] whitespace-nowrap">
                        {new Date(r.createdAt).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                      <td className="py-3 px-4 text-xs">
                        <div className="font-mono">{r.tbankRegistryId || '—'}</div>
                        <div className="text-[10px] text-[var(--text-secondary)] font-mono">{r.id.slice(0, 12)}…</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${sl.c}`}>{sl.l}</span>
                        {r.errorsCount > 0 && <div className="text-[10px] text-[var(--text-primary)] mt-1">{r.errorsCount} с ошибками</div>}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums font-semibold">{fmt(r.totalGross)} ₽</td>
                      <td className="py-3 px-4 text-right tabular-nums">{fmt(r.totalNet)} ₽</td>
                      <td className="py-3 px-4 text-right tabular-nums text-[var(--text-secondary)]">{r.totalTax ? fmt(r.totalTax) : '—'}</td>
                      <td className="py-3 px-4 text-right tabular-nums">{r.paymentCount}</td>
                      <td className="py-3 px-4 text-right tabular-nums">
                        {r.receiptsCount}/{r.paymentCount}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button onClick={() => setDetail(r)}
                          className="text-xs px-3 py-1.5 rounded-full bg-[var(--hover)] hover:bg-gray-200">
                          Открыть
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {detail && <DetailModal registryId={detail.id} onClose={() => setDetail(null)} />}
    </div>
  );
}

function FilterPill({ v, cur, onClick, children }: { v: string; cur: string; onClick: (v: string) => void; children: any }) {
  return (
    <button onClick={() => onClick(v)}
      className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
        cur === v ? 'bg-[var(--text-primary)] text-white' : 'bg-[var(--hover)] text-[var(--text-primary)]'
      }`}>
      {children}
    </button>
  );
}

function DetailModal({ registryId, onClose }: { registryId: string; onClose: () => void }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/admin/finance/registries?id=${encodeURIComponent(registryId)}`, {
      headers: { Authorization: `Bearer ${authStorage.getToken() || ''}` },
    })
      .then((r) => r.json())
      .then((j) => { if (j.success) setData(j.data); })
      .finally(() => setLoading(false));
  }, [registryId]);

  return (
    <Portal>
      <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/45 backdrop-blur-md" onClick={onClose}>
        <div className="apple-card max-w-3xl w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
          {loading || !data ? (
            <div className="p-10 text-center text-[var(--text-secondary)]">Загрузка…</div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-xl font-bold mb-1">Реестр #{data.registry.tbankRegistryId || data.registry.id.slice(0, 8)}</h3>
                  <div className="text-xs text-[var(--text-secondary)] font-mono">{data.registry.id}</div>
                  {data.registry.correlationId && (
                    <div className="text-[10px] text-[var(--text-secondary)] font-mono mt-1">correlationId: {data.registry.correlationId}</div>
                  )}
                </div>
                <button onClick={onClose} className="text-2xl leading-none"></button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <Mini label="Статус" value={STATUS_LABEL[data.registry.status]?.l || data.registry.status} />
                <Mini label="Платежей" value={data.registry.paymentCount} />
                <Mini label="Брутто" value={`${fmt(data.registry.totalGross)} ₽`} />
                <Mini label="Нетто" value={`${fmt(data.registry.totalNet)} ₽`} />
              </div>

              {data.registry.lastError && (
                <div className="apple-card p-3 bg-[var(--hover)] text-xs mb-4">
                  <b>Ошибка:</b> <pre className="whitespace-pre-wrap font-mono text-[11px] mt-1">{JSON.stringify(data.registry.lastError, null, 2)}</pre>
                </div>
              )}

              <h4 className="font-semibold mb-2">Платежи</h4>
              <div className="space-y-2">
                {data.payments.map((p: any) => {
                  const sl = STATUS_LABEL[p.status] || { l: p.status, c: 'bg-[var(--hover)]' };
                  return (
                    <div key={p.id} className="p-3 rounded-xl border border-[var(--border)] bg-white">
                      <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                        <div className="font-medium text-sm">{p.user.name || p.user.email}</div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${sl.c}`}>{sl.l}</span>
                      </div>
                      <div className="text-xs text-[var(--text-secondary)]">{p.user.email}</div>
                      <div className="flex items-baseline gap-3 mt-1 text-sm">
                        <span className="font-semibold tabular-nums">{fmt(p.gross)} ₽</span>
                        <span className="text-xs text-[var(--text-secondary)]">→ {fmt(p.net)} ₽</span>
                        {p.taxHolding && <span className="text-xs text-[var(--text-secondary)]">(удержано {fmt(p.tax)} ₽)</span>}
                      </div>
                      {p.adminComment && (
                        <div className="text-[11px] mt-1.5 p-2 rounded-md bg-[var(--hover)]">
                          <b>Админ:</b> {p.adminComment}
                        </div>
                      )}
                      {p.error && (
                        <div className="text-[11px] mt-1.5 p-2 rounded-md bg-[var(--hover)]">
                          <b>Ошибка:</b> {typeof p.error === 'string' ? p.error : JSON.stringify(p.error)}
                        </div>
                      )}
                      {p.receiptUrl && (
                        <a href={p.receiptUrl} target="_blank" rel="noopener noreferrer"
                          className="inline-block text-xs underline mt-2">
                          Скачать чек ФНС
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </Portal>
  );
}

function Mini({ label, value }: { label: string; value: any }) {
  return (
    <div className="p-3 rounded-xl bg-[var(--hover)]">
      <div className="text-[10px] uppercase tracking-wider font-bold text-[var(--text-secondary)]">{label}</div>
      <div className="text-lg font-bold mt-0.5 tabular-nums">{value}</div>
    </div>
  );
}
