'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

export default function VerifyCodePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-sm text-[var(--text-secondary)]">Загрузка…</div>}>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const params = useSearchParams();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [resending, setResending] = useState(false);

  useEffect(() => {
    const e = params?.get('email');
    if (e) setEmail(e);
  }, [params]);

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setErr(''); setMsg(''); setBusy(true);
    try {
      const r = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), code: code.trim() }),
      });
      const j = await r.json();
      if (j.success) {
        setMsg(j.alreadyVerified ? 'Email уже подтверждён.' : 'Email подтверждён! Перенаправляем…');
        setTimeout(() => router.push('/profile'), 1500);
      } else {
        setErr(j.error || 'Ошибка');
      }
    } finally { setBusy(false); }
  };

  const resend = async () => {
    if (!email) { setErr('Введите email'); return; }
    setResending(true); setErr(''); setMsg('');
    try {
      const r = await fetch('/api/auth/send-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const j = await r.json();
      setMsg(j.success ? 'Код отправлен повторно. Проверьте почту.' : (j.error || 'Ошибка'));
    } finally { setResending(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--background)]">
      <div className="apple-card w-full max-w-md p-8">
        <h1 className="text-2xl font-bold tracking-tight mb-2">Подтвердите email</h1>
        <p className="text-sm text-[var(--text-secondary)] mb-6">
          Мы отправили 6-значный код на вашу почту. Введите его, чтобы активировать аккаунт.
        </p>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full p-3 rounded-xl border border-[var(--border)] bg-white text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Код из письма</label>
            <input
              type="text"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              required
              autoFocus
              className="w-full p-3 rounded-xl border border-[var(--border)] bg-white text-2xl text-center tracking-[0.5em] font-mono"
            />
          </div>

          {err && <div className="apple-card p-3 bg-red-50 border-red-200 text-sm text-red-600">{err}</div>}
          {msg && <div className="apple-card p-3 bg-emerald-50 border-emerald-200 text-sm text-emerald-700">{msg}</div>}

          <button
            type="submit"
            disabled={busy || code.length !== 6}
            className="apple-button w-full">
            {busy ? 'Проверяем…' : 'Подтвердить'}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-[var(--border)] flex items-center justify-between gap-3">
          <button onClick={resend} disabled={resending} className="text-sm text-[var(--text-secondary)] hover:underline disabled:opacity-50">
            {resending ? 'Отправляем…' : 'Отправить код ещё раз'}
          </button>
          <Link href="/login" className="text-sm text-[var(--text-secondary)] hover:underline">
            Назад к входу
          </Link>
        </div>
      </div>
    </div>
  );
}
