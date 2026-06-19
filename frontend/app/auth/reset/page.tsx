'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

export default function ResetByCodePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-sm text-[var(--text-secondary)]">Загрузка…</div>}>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const params = useSearchParams();
  const router = useRouter();
  const [step, setStep] = useState<'request' | 'code'>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const e = params?.get('email');
    if (e) { setEmail(e); setStep('code'); }
  }, [params]);

  const requestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(''); setMsg(''); setBusy(true);
    try {
      const r = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const j = await r.json();
      if (j.success) {
        setMsg('Если такой аккаунт существует — на почту отправлен 6-значный код.');
        setStep('code');
      } else {
        setErr(j.error || 'Ошибка');
      }
    } finally { setBusy(false); }
  };

  const resetByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(''); setMsg('');
    if (password.length < 8) { setErr('Пароль ≥ 8 символов'); return; }
    if (password !== password2) { setErr('Пароли не совпадают'); return; }
    setBusy(true);
    try {
      const r = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), code: code.trim(), password }),
      });
      const j = await r.json();
      if (j.success) {
        setMsg('Пароль изменён. Перенаправляем на вход…');
        setTimeout(() => router.push('/login'), 1500);
      } else {
        setErr(j.error || 'Ошибка');
      }
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--background)]">
      <div className="apple-card w-full max-w-md p-8">
        <h1 className="text-2xl font-bold tracking-tight mb-2">Восстановление пароля</h1>

        {step === 'request' ? (
          <>
            <p className="text-sm text-[var(--text-secondary)] mb-6">
              Введите email — мы пришлём 6-значный код для смены пароля.
            </p>
            <form onSubmit={requestCode} className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  autoFocus
                  className="w-full p-3 rounded-xl border border-[var(--border)] bg-white text-sm"
                />
              </div>
              {err && <div className="apple-card p-3 bg-red-50 border-red-200 text-sm text-red-600">{err}</div>}
              {msg && <div className="apple-card p-3 bg-emerald-50 border-emerald-200 text-sm text-emerald-700">{msg}</div>}
              <button type="submit" disabled={busy || !email} className="apple-button w-full">
                {busy ? 'Отправляем…' : 'Получить код'}
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="text-sm text-[var(--text-secondary)] mb-6">
              Введите 6-значный код из письма и новый пароль.
            </p>
            <form onSubmit={resetByCode} className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
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
              <div>
                <label className="block text-sm font-medium mb-1">Новый пароль</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full p-3 rounded-xl border border-[var(--border)] bg-white text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Повторите пароль</label>
                <input
                  type="password"
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  required
                  className="w-full p-3 rounded-xl border border-[var(--border)] bg-white text-sm"
                />
              </div>
              {err && <div className="apple-card p-3 bg-red-50 border-red-200 text-sm text-red-600">{err}</div>}
              {msg && <div className="apple-card p-3 bg-emerald-50 border-emerald-200 text-sm text-emerald-700">{msg}</div>}
              <button type="submit" disabled={busy || code.length !== 6} className="apple-button w-full">
                {busy ? 'Сохраняем…' : 'Установить пароль'}
              </button>
            </form>
          </>
        )}

        <div className="mt-6 pt-4 border-t border-[var(--border)] text-center">
          <Link href="/login" className="text-sm text-[var(--text-secondary)] hover:underline">
            Назад к входу
          </Link>
        </div>
      </div>
    </div>
  );
}
