'use client';

import { useEffect, useState } from 'react';
import { authStorage } from '@/app/lib/auth';
import Portal from '@/app/components/Portal';

import { toast } from '@/app/components/Toast';
type Author = {
  id: string;
  email: string;
  name: string;
  artistName: string | null;
  balance: number;
};

export default function AdminPayoutsPage() {
  const [q, setQ] = useState('');
  const [authors, setAuthors] = useState<Author[]>([]);
  const [loading, setLoading] = useState(false);
  const [forceFor, setForceFor] = useState<Author | null>(null);

  const auth = () => ({ Authorization: `Bearer ${authStorage.getToken() || ''}` });

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => {
      fetch(`/api/admin/authors-search?q=${encodeURIComponent(q)}`, { headers: auth() })
        .then((r) => r.json())
        .then((j) => { if (j.success) setAuthors(j.data || []); })
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="space-y-6">
      <section
        className="relative rounded-3xl overflow-hidden p-7 md:p-10 flex items-end justify-between gap-4 flex-wrap"
        style={{ background: 'linear-gradient(135deg, #1d4cb8 0%, #2f9e8f 55%, #e6e6e6 100%)' }}>
        <div className="relative z-10 max-w-xl">
          <div className="text-xs uppercase tracking-widest font-semibold mb-2 text-white/90">Финансы</div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">Выплаты авторам</h1>
          <p className="text-sm md:text-base text-white/90 mt-2 max-w-lg">
            Список авторов с балансами. Принудительный запуск выплаты при сбоях или особых случаях — с обязательным комментарием.
          </p>
        </div>
      </section>

      <div className="apple-card p-4 md:p-5">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Поиск по имени, email, артисту…"
          className="w-full p-3 rounded-xl border border-[var(--border)] bg-white text-sm"
        />
      </div>

      {loading ? (
        <div className="apple-card p-10 text-center text-[var(--text-secondary)]">Загрузка…</div>
      ) : authors.length === 0 ? (
        <div className="apple-card p-10 text-center text-[var(--text-secondary)]">Никого не найдено</div>
      ) : (
        <div className="apple-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-[var(--text-secondary)] border-b border-[var(--border)]">
                <th className="text-left py-2.5 px-4">Автор</th>
                <th className="text-right py-2.5 px-4">Баланс</th>
                <th className="text-right py-2.5 px-4"></th>
              </tr>
            </thead>
            <tbody>
              {authors.map((a) => (
                <tr key={a.id} className="border-b border-[var(--border)] last:border-0 hover:bg-black/[0.02]">
                  <td className="py-3 px-4">
                    <div className="font-medium">{a.artistName || a.name || a.email}</div>
                    <div className="text-xs text-[var(--text-secondary)]">{a.email}</div>
                  </td>
                  <td className="py-3 px-4 text-right tabular-nums font-semibold">{a.balance.toLocaleString('ru-RU')} ₽</td>
                  <td className="py-3 px-4 text-right">
                    <button onClick={() => setForceFor(a)}
                      disabled={a.balance <= 0}
                      className="text-xs px-3 py-1.5 rounded-full bg-[var(--text-primary)] text-white disabled:opacity-30">
                      Выплатить принудительно
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {forceFor && <ForceModal author={forceFor} onClose={() => setForceFor(null)} onDone={() => { setForceFor(null); setQ(q); }} />}
    </div>
  );
}

function ForceModal({ author, onClose, onDone }: { author: Author; onClose: () => void; onDone: () => void }) {
  const [amount, setAmount] = useState(String(Math.floor(author.balance)));
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [confirmStep, setConfirmStep] = useState(false);

  const submit = async () => {
    setErr('');
    const a = Number(amount);
    if (!a || a <= 0 || a > author.balance) { setErr('Сумма от 1 до баланса автора'); return; }
    if (!comment.trim()) { setErr('Комментарий обязателен'); return; }
    if (!confirmStep) { setConfirmStep(true); return; }
    setBusy(true);
    try {
      const r = await fetch('/api/admin/force-payout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStorage.getToken() || ''}` },
        body: JSON.stringify({ authorId: author.id, amount: a, comment: comment.trim() }),
      });
      const j = await r.json();
      if (j.success) { toast.error('Выплата отправлена'); onDone(); }
      else setErr(j.error || 'Ошибка');
    } finally { setBusy(false); }
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/45 backdrop-blur-md" onClick={() => !busy && onClose()}>
        <div className="apple-card max-w-md w-full p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <h3 className="text-xl font-bold mb-2">Принудительная выплата</h3>
          <p className="text-sm text-[var(--text-secondary)] mb-4">
            {author.artistName || author.name || author.email} · баланс <b>{author.balance.toLocaleString('ru-RU')} ₽</b>
          </p>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">Сумма (₽)</label>
              <input type="number" min={1} max={author.balance} value={amount}
                onChange={(e) => { setAmount(e.target.value); setConfirmStep(false); }}
                className="w-full p-3 rounded-xl border border-[var(--border)] bg-white text-sm tabular-nums" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Причина / комментарий *</label>
              <textarea value={comment} onChange={(e) => { setComment(e.target.value); setConfirmStep(false); }} rows={3}
                placeholder="Например: «Сбой штатного flow от 25.05, выплата по тикету #123»"
                className="w-full p-3 rounded-xl border border-[var(--border)] bg-white text-sm" />
            </div>
            {err && <div className="apple-card p-3 bg-[var(--hover)] text-sm">{err}</div>}
            {confirmStep && (
              <div className="apple-card p-3 bg-[var(--hover)] text-sm">
                ⚠️ Подтвердите принудительную выплату {Number(amount).toLocaleString('ru-RU')} ₽ для <b>{author.email}</b>. Действие необратимо.
              </div>
            )}
            <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border)]">
              <button onClick={onClose} disabled={busy} className="px-5 py-2.5 rounded-full bg-[var(--hover)] text-sm">Отмена</button>
              <button onClick={submit} disabled={busy || !comment.trim() || !amount}
                className="px-6 py-2.5 rounded-full bg-[var(--text-primary)] text-white text-sm font-semibold disabled:opacity-40">
                {busy ? 'Отправляем…' : confirmStep ? 'Подтвердить выплату' : 'Далее'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
}
