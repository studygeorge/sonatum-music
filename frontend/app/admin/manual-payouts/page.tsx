'use client';

import { useEffect, useState } from 'react';
import { authStorage } from '@/app/lib/auth';
import Portal from '@/app/components/Portal';

import { toast } from '@/app/components/Toast';
type Author = { id: string; email: string; name: string; artistName: string | null; balance: number };
type Item = {
  id: string;
  author: { id: string; email: string; name: string };
  adminEmail: string;
  gross: number;
  sourceAmount: number | null;
  commissionPct: number;
  contractRef: string | null;
  comment: string;
  status: 'ACTIVE' | 'REVERSED';
  createdAt: string;
  reversedAt: string | null;
  reverseReason: string | null;
};

export default function AdminManualPayoutsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'REVERSED'>('ACTIVE');
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [reverseFor, setReverseFor] = useState<Item | null>(null);

  const auth = () => ({ Authorization: `Bearer ${authStorage.getToken() || ''}` });

  const load = () => {
    setLoading(true);
    const q = filter === 'ALL' ? '' : `?status=${filter}`;
    fetch(`/api/admin/manual-payouts${q}`, { headers: auth() })
      .then((r) => r.json())
      .then((j) => { if (j.success) setItems(j.data || []); })
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [filter]);

  const totalActive = items.filter(i => i.status === 'ACTIVE').reduce((a, b) => a + b.gross, 0);

  return (
    <div className="space-y-6">
      <section
        className="relative rounded-3xl overflow-hidden p-7 md:p-10 flex items-end justify-between gap-4 flex-wrap"
        style={{ background: 'linear-gradient(135deg, #1d4cb8 0%, #2f9e8f 55%, #e6e6e6 100%)' }}>
        <div className="relative z-10 max-w-xl">
          <div className="text-xs uppercase tracking-widest font-semibold mb-2 text-white/90">Финансы / B2B</div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">Ручные B2B-начисления</h1>
          <p className="text-sm md:text-base text-white/90 mt-2 max-w-lg">
            Начисления автору после ручной B2B-продажи: договор подписан, счёт оплачен — добавляем 80% от полученной суммы к балансу.
          </p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="px-5 py-3 rounded-full bg-white text-[#1d4cb8] font-semibold text-sm whitespace-nowrap">
          + Добавить начисление
        </button>
      </section>

      <div className="grid sm:grid-cols-3 gap-3">
        <div className="apple-card p-5">
          <div className="text-xs uppercase tracking-widest font-bold text-[var(--text-secondary)]">Активных начислений</div>
          <div className="text-3xl font-black mt-2 tabular-nums">{items.filter(i => i.status === 'ACTIVE').length}</div>
        </div>
        <div className="apple-card p-5">
          <div className="text-xs uppercase tracking-widest font-bold text-[var(--text-secondary)]">Сумма активных</div>
          <div className="text-3xl font-black mt-2 tabular-nums">{totalActive.toLocaleString('ru-RU')} ₽</div>
        </div>
        <div className="apple-card p-5">
          <div className="text-xs uppercase tracking-widest font-bold text-[var(--text-secondary)]">Отменённых</div>
          <div className="text-3xl font-black mt-2 tabular-nums">{items.filter(i => i.status === 'REVERSED').length}</div>
        </div>
      </div>

      <div className="flex gap-2">
        {(['ACTIVE', 'REVERSED', 'ALL'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              filter === f ? 'bg-[var(--text-primary)] text-white' : 'bg-[var(--hover)] text-[var(--text-primary)]'
            }`}>
            {f === 'ACTIVE' ? 'Активные' : f === 'REVERSED' ? 'Отменённые' : 'Все'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="apple-card p-10 text-center text-[var(--text-secondary)]">Загрузка…</div>
      ) : items.length === 0 ? (
        <div className="apple-card p-10 text-center text-[var(--text-secondary)]">Ничего нет</div>
      ) : (
        <div className="apple-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-[var(--text-secondary)] border-b border-[var(--border)]">
                <th className="text-left py-2.5 px-4">Дата</th>
                <th className="text-left py-2.5 px-4">Автор</th>
                <th className="text-right py-2.5 px-4">Сумма (брутто)</th>
                <th className="text-left py-2.5 px-4">Договор / комментарий</th>
                <th className="text-left py-2.5 px-4">Админ</th>
                <th className="text-right py-2.5 px-4"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className="border-b border-[var(--border)] last:border-0 hover:bg-black/[0.02]">
                  <td className="py-3 px-4 text-xs text-[var(--text-secondary)] whitespace-nowrap">
                    {new Date(it.createdAt).toLocaleDateString('ru-RU')}
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-medium">{it.author.name || it.author.email}</div>
                    <div className="text-xs text-[var(--text-secondary)]">{it.author.email}</div>
                  </td>
                  <td className="py-3 px-4 text-right tabular-nums">
                    <div className={it.status === 'REVERSED' ? 'line-through text-[var(--text-secondary)]' : 'font-semibold'}>
                      {it.gross.toLocaleString('ru-RU')} ₽
                    </div>
                    {it.sourceAmount && (
                      <div className="text-[11px] text-[var(--text-secondary)]">
                        из {it.sourceAmount.toLocaleString('ru-RU')} ₽ (комиссия {it.commissionPct}%)
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-4 text-xs max-w-[280px]">
                    {it.contractRef && <div className="font-medium truncate">{it.contractRef}</div>}
                    <div className="text-[var(--text-secondary)] truncate">{it.comment}</div>
                    {it.status === 'REVERSED' && (
                      <div className="text-[11px] mt-1 text-[var(--text-primary)]">
                        <b>Отменено:</b> {it.reverseReason}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-4 text-xs text-[var(--text-secondary)]">{it.adminEmail}</td>
                  <td className="py-3 px-4 text-right">
                    {it.status === 'ACTIVE' && (
                      <button onClick={() => setReverseFor(it)}
                        className="text-xs px-3 py-1.5 rounded-full bg-white border border-[var(--text-primary)] text-[var(--text-primary)] hover:bg-[var(--hover)]">
                        Отменить
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && <CreateModal onClose={() => setOpen(false)} onCreated={() => { setOpen(false); load(); }} />}
      {reverseFor && <ReverseModal item={reverseFor} onClose={() => setReverseFor(null)} onDone={() => { setReverseFor(null); load(); }} />}
    </div>
  );
}

function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [authorQ, setAuthorQ] = useState('');
  const [authorList, setAuthorList] = useState<Author[]>([]);
  const [author, setAuthor] = useState<Author | null>(null);
  const [sourceAmount, setSourceAmount] = useState('');
  const [commissionPct, setCommissionPct] = useState('20');
  const [gross, setGross] = useState('');
  const [contractRef, setContractRef] = useState('');
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const auth = () => ({ Authorization: `Bearer ${authStorage.getToken() || ''}` });

  useEffect(() => {
    if (author) return;
    const t = setTimeout(() => {
      fetch(`/api/admin/authors-search?q=${encodeURIComponent(authorQ)}`, { headers: auth() })
        .then((r) => r.json())
        .then((j) => { if (j.success) setAuthorList(j.data || []); });
    }, 200);
    return () => clearTimeout(t);
  }, [authorQ, author]);

  // Авторасчёт gross при изменении source/commission
  useEffect(() => {
    const src = Number(sourceAmount || 0);
    const c = Number(commissionPct || 0);
    if (src > 0 && !gross) {
      setGross(String(Math.round(src * (100 - c) / 100 * 100) / 100));
    }
  }, [sourceAmount, commissionPct]);

  const submit = async () => {
    setErr('');
    if (!author) { setErr('Выберите автора'); return; }
    if (!gross || Number(gross) <= 0) { setErr('Укажите сумму'); return; }
    if (!comment.trim()) { setErr('Опишите основание'); return; }
    setBusy(true);
    try {
      const r = await fetch('/api/admin/manual-payouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...auth() },
        body: JSON.stringify({
          authorId: author.id,
          sourceAmount: sourceAmount ? Number(sourceAmount) : null,
          commissionPct: Number(commissionPct),
          gross: Number(gross),
          contractRef: contractRef.trim() || null,
          comment: comment.trim(),
        }),
      });
      const j = await r.json();
      if (j.success) onCreated();
      else setErr(j.error || 'Ошибка');
    } finally { setBusy(false); }
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/45 backdrop-blur-md" onClick={() => !busy && onClose()}>
        <div className="apple-card max-w-lg w-full p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <h3 className="text-xl font-bold mb-4">Ручное начисление автору</h3>
          <div className="space-y-3">
            {!author ? (
              <div>
                <label className="block text-sm font-medium mb-1">Автор</label>
                <input
                  type="text"
                  value={authorQ}
                  onChange={(e) => setAuthorQ(e.target.value)}
                  placeholder="Поиск по email, имени, артисту…"
                  className="w-full p-2.5 rounded-xl border border-[var(--border)] bg-white text-sm"
                />
                <div className="max-h-44 overflow-y-auto rounded-xl border border-[var(--border)] mt-2 bg-white">
                  {authorList.length === 0 ? (
                    <div className="p-3 text-xs text-center text-[var(--text-secondary)]">Никого не нашлось</div>
                  ) : (
                    authorList.map((a) => (
                      <button key={a.id} type="button" onClick={() => setAuthor(a)}
                        className="w-full text-left px-3 py-2 hover:bg-[var(--hover)] border-b border-[var(--border)] last:border-0">
                        <div className="font-medium text-sm">{a.artistName || a.name || a.email}</div>
                        <div className="text-xs text-[var(--text-secondary)]">{a.email} · баланс {a.balance.toLocaleString('ru-RU')} ₽</div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-[var(--hover)] flex justify-between items-center">
                <div>
                  <div className="font-semibold text-sm">{author.artistName || author.name || author.email}</div>
                  <div className="text-xs text-[var(--text-secondary)]">{author.email} · баланс {author.balance.toLocaleString('ru-RU')} ₽</div>
                </div>
                <button onClick={() => { setAuthor(null); setAuthorList([]); }} className="text-xs underline">сменить</button>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs font-medium mb-1">Сумма счёта</label>
                <input type="number" min={0} value={sourceAmount}
                  onChange={(e) => { setSourceAmount(e.target.value); setGross(''); }}
                  placeholder="напр. 10000"
                  className="w-full p-2.5 rounded-xl border border-[var(--border)] bg-white text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Комиссия %</label>
                <input type="number" min={0} max={50} value={commissionPct}
                  onChange={(e) => { setCommissionPct(e.target.value); setGross(''); }}
                  className="w-full p-2.5 rounded-xl border border-[var(--border)] bg-white text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Автору (брутто)</label>
                <input type="number" min={1} value={gross}
                  onChange={(e) => setGross(e.target.value)}
                  placeholder="auto"
                  className="w-full p-2.5 rounded-xl border border-[var(--border)] bg-white text-sm font-semibold" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Договор / счёт</label>
              <input value={contractRef} onChange={(e) => setContractRef(e.target.value)}
                placeholder='напр. "Договор №42 от 25.05.2026 с ООО Ромашка"'
                className="w-full p-2.5 rounded-xl border border-[var(--border)] bg-white text-sm" />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Комментарий *</label>
              <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2}
                placeholder="За что и кому"
                className="w-full p-2.5 rounded-xl border border-[var(--border)] bg-white text-sm" />
            </div>

            {err && <div className="apple-card p-3 bg-[var(--hover)] text-sm">{err}</div>}

            <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border)]">
              <button onClick={onClose} disabled={busy} className="px-5 py-2.5 rounded-full bg-[var(--hover)] text-sm font-medium">Отмена</button>
              <button onClick={submit} disabled={busy || !author || !gross || !comment.trim()}
                className="px-6 py-2.5 rounded-full bg-[var(--text-primary)] text-white text-sm font-semibold disabled:opacity-40">
                {busy ? 'Сохраняем…' : 'Начислить'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
}

function ReverseModal({ item, onClose, onDone }: { item: Item; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!reason.trim()) return;
    setBusy(true);
    try {
      const r = await fetch('/api/admin/manual-payouts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStorage.getToken() || ''}` },
        body: JSON.stringify({ id: item.id, reverseReason: reason.trim() }),
      });
      const j = await r.json();
      if (j.success) onDone();
      else toast.error(j.error || 'Ошибка');
    } finally { setBusy(false); }
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/45 backdrop-blur-md" onClick={() => !busy && onClose()}>
        <div className="apple-card max-w-md w-full p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <h3 className="text-xl font-bold mb-2">Отменить начисление?</h3>
          <p className="text-sm text-[var(--text-secondary)] mb-4">
            С баланса автора будет списано <b>{item.gross.toLocaleString('ru-RU')} ₽</b>. Действие необратимо.
          </p>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
            placeholder="Причина отмены (обязательно)"
            autoFocus
            className="w-full p-3 rounded-xl border border-[var(--border)] bg-white text-sm mb-4" />
          <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border)]">
            <button onClick={onClose} disabled={busy} className="px-5 py-2.5 rounded-full bg-[var(--hover)] text-sm">Отмена</button>
            <button onClick={submit} disabled={busy || !reason.trim()}
              className="px-6 py-2.5 rounded-full bg-[var(--text-primary)] text-white text-sm font-semibold disabled:opacity-40">
              {busy ? 'Отменяем…' : 'Подтвердить отмену'}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
