'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, ApiResponse, RegisterResponse } from '@/app/lib/api';
import { authStorage } from '@/app/lib/auth';
import dynamic from 'next/dynamic';
import { ShimmerButton } from '@/app/components/ShimmerButton';
import { ShineBorder } from '@/app/components/ShineBorder';

const Grainient = dynamic(() => import('@/app/components/Grainient'), { ssr: false });

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) { setError('Пароли не совпадают'); return; }
    if (password.length < 6) { setError('Пароль должен содержать минимум 6 символов'); return; }
    setLoading(true);
    try {
      const response: ApiResponse<RegisterResponse> = await api.register(email, password, username, firstName, lastName);
      if (response.success && response.data) {
        const rd = response.data as any;
        const token = rd.data?.token ?? rd.token;
        const user = rd.data?.user ?? rd.user;
        if (!token) { setError('Ошибка: токен не получен от сервера'); return; }
        if (!user) { setError('Ошибка: данные пользователя не получены'); return; }
        authStorage.setToken(token);
        authStorage.setUser(user);
        setTimeout(() => router.push('/profile'), 150);
      } else {
        setError(response.error || 'Ошибка регистрации');
      }
    } catch {
      setError('Произошла ошибка. Попробуйте снова.');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-white/80 backdrop-blur text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all text-sm";
  const labelClass = "block text-sm font-medium text-[var(--text-primary)] mb-1.5";

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 py-6 overflow-hidden">
      {/* Grainient animated background */}
      <div className="absolute inset-0 -z-10">
        <Grainient
          color1="#c7d2fe"
          color2="#f0f4ff"
          color3="#e0e7ff"
          grainAmount={0.07}
          timeSpeed={0.18}
          saturation={0.7}
          contrast={1.1}
          zoom={0.85}
        />
      </div>

      <div className="w-full max-w-sm animate-fadeInUp">
        {/* Brand heading — no icon */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-[var(--text-primary)] tracking-tight">Создать аккаунт</h1>
          <p className="text-[var(--text-secondary)] text-sm mt-1">Присоединитесь к Sonatum Music</p>
        </div>

        {/* Card with ShineBorder */}
        <div className="relative apple-card p-7 overflow-hidden">
          <ShineBorder shineColor={['#A07CFE', '#818cf8', '#c7d2fe']} duration={10} borderWidth={1.5} />

          {error && (
            <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-3.5 mb-5">
              <svg className="w-4 h-4 text-red-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Имя</label>
                <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} className={inputClass} placeholder="Иван" autoComplete="given-name" />
              </div>
              <div>
                <label className={labelClass}>Фамилия</label>
                <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} className={inputClass} placeholder="Иванов" autoComplete="family-name" />
              </div>
            </div>

            <div>
              <label className={labelClass}>Имя пользователя</label>
              <input type="text" value={username} onChange={e => setUsername(e.target.value)} className={inputClass} placeholder="username" required autoComplete="username" />
            </div>

            <div>
              <label className={labelClass}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputClass} placeholder="your@email.com" required autoComplete="email" />
            </div>

            <div>
              <label className={labelClass}>Пароль</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                  className={`${inputClass} pr-12`} placeholder="••••••••" required minLength={6} autoComplete="new-password" />
                <button type="button" onClick={() => setShowPassword(v => !v)} tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors p-1">
                  {showPassword
                    ? <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                    : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  }
                </button>
              </div>
              {password && (
                <div className="flex gap-1 mt-2">
                  {[4, 7, 10].map((t, i) => (
                    <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${password.length >= t ? i === 0 ? 'bg-red-400' : i === 1 ? 'bg-yellow-400' : 'bg-green-400' : 'bg-gray-200'}`} />
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className={labelClass}>Подтвердите пароль</label>
              <input type={showPassword ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                className={`${inputClass} ${confirmPassword && confirmPassword !== password ? 'ring-2 ring-red-400 border-transparent' : ''}`}
                placeholder="••••••••" required minLength={6} autoComplete="new-password" />
              {confirmPassword && confirmPassword !== password && <p className="text-red-500 text-xs mt-1">Пароли не совпадают</p>}
            </div>

            <ShimmerButton
              type="submit"
              disabled={loading}
              shimmerColor="#a5b4fc"
              shimmerDuration="2.5s"
              background="rgba(29,29,31,1)"
              borderRadius="14px"
              className="w-full mt-1 py-3.5 text-sm font-semibold tracking-tight disabled:opacity-60"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>
                  Создаём аккаунт...
                </span>
              ) : 'Зарегистрироваться'}
            </ShimmerButton>
          </form>
        </div>

        <p className="text-center mt-5 text-sm text-[var(--text-secondary)]">
          Уже есть аккаунт?{' '}
          <Link href="/login" className="text-indigo-500 font-medium hover:underline">Войти</Link>
        </p>
      </div>
    </div>
  );
}
