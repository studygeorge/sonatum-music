'use client';

import { useState } from 'react';
import { authStorage } from '@/app/lib/auth';

import Portal from "@/app/components/Portal";
export default function DonateButton({
  artistSlug,
  collectiveSlug,
  recipientName,
  variant = 'primary',
}: {
  artistSlug?: string;
  collectiveSlug?: string;
  recipientName: string;
  variant?: 'primary' | 'secondary';
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState<number>(100);
  const [customAmount, setCustomAmount] = useState('');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const openModal = () => {
    setError('');
    const u = authStorage.getUser?.();
    if (u?.email) setEmail(u.email);
    setOpen(true);
  };

  const submit = async () => {
    setError('');
    const finalAmount = customAmount ? parseInt(customAmount) : amount;
    if (!finalAmount || finalAmount < 10) {
      setError('Минимум 10 ₽');
      return;
    }
    if (!email.trim()) {
      setError('Укажите email');
      return;
    }
    setSubmitting(true);
    try {
      const token = authStorage.getToken();
      const r = await fetch('/api/donations/init', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          artistSlug,
          collectiveSlug,
          amount: finalAmount,
          message: message.trim() || undefined,
          email: email.trim(),
        }),
      });
      const j = await r.json();
      if (!j.success) {
        setError(j.error || 'Ошибка');
        return;
      }
      if (j.paymentUrl) window.location.href = j.paymentUrl;
    } catch (e: any) {
      setError(e?.message || 'Ошибка сети');
    } finally {
      setSubmitting(false);
    }
  };

  const btnClass =
    variant === 'primary'
      ? 'px-5 py-2.5 rounded-full bg-[var(--text-primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity'
      : 'px-5 py-2.5 rounded-full bg-[var(--hover)] text-[var(--text-primary)] text-sm font-medium hover:bg-[var(--border)] transition-colors';

  return (
    <>
      <button onClick={openModal} className={btnClass}>
        Поддержать
      </button>
      {open && (
<Portal>
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/45 backdrop-blur-md"
          onClick={() => !submitting && setOpen(false)}>
          <div
            className="apple-card max-w-sm w-full p-6 shadow-2xl animate-fadeInUp"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold tracking-tight">Поддержать</h3>
                <p className="text-xs text-[var(--text-secondary)] mt-1">{recipientName}</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-2xl leading-none">
                
              </button>
            </div>
            <p className="text-xs text-[var(--text-secondary)] mb-4">
              Автору поступит 90% от суммы. Комиссия платформы: 10%.
            </p>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {[50, 100, 500].map((v) => (
                <button
                  key={v}
                  onClick={() => { setAmount(v); setCustomAmount(''); }}
                  className={`py-2 rounded-xl font-semibold text-sm transition-colors ${
                    !customAmount && amount === v
                      ? 'bg-[var(--text-primary)] text-white'
                      : 'bg-[var(--hover)] text-[var(--text-primary)]'
                  }`}>
                  {v} ₽
                </button>
              ))}
            </div>
            <div className="mb-3">
              <label className="block text-xs font-medium mb-1">Своя сумма</label>
              <input
                type="number"
                min={10}
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                placeholder="100"
                className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-white outline-none focus:ring-2 focus:ring-[var(--accent)] text-sm tabular-nums"
              />
            </div>
            <div className="mb-3">
              <label className="block text-xs font-medium mb-1">Email *</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-white outline-none focus:ring-2 focus:ring-[var(--accent)] text-sm"
              />
            </div>
            <div className="mb-4">
              <label className="block text-xs font-medium mb-1">Сообщение автору</label>
              <textarea
                rows={2}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Опционально"
                className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-white outline-none focus:ring-2 focus:ring-[var(--accent)] text-sm resize-none"
              />
            </div>
            {error && (
              <div className="apple-card p-3 bg-red-50 border-red-200 text-sm text-red-600 mb-3">
                {error}
              </div>
            )}

            <button
              onClick={submit}
              disabled={submitting}
              className="w-full px-6 py-3 rounded-full bg-[var(--text-primary)] text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity">
              {submitting ? 'Загрузка…' : `Перейти к оплате ${customAmount || amount} ₽`}
            </button>
            <p className="text-[10px] text-center text-[var(--text-secondary)] mt-3">
              Платёж добровольный и не возвращается.
            </p>
          </div>
        </div>
</Portal>
      )}
    </>
  );
}
