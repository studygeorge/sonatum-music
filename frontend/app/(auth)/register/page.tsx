'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, ApiResponse, RegisterResponse } from '@/app/lib/api';
import { authStorage } from '@/app/lib/auth';
import dynamic from 'next/dynamic';
import { ShimmerButton } from '@/app/components/ShimmerButton';
import VKAuthButton from '@/app/components/VKAuthButton';
import { ShineBorder } from '@/app/components/ShineBorder';

const Grainient = dynamic(() => import('@/app/components/Grainient'), { ssr: false });

type AccountRole = 'USER' | 'ARTIST' | 'EDU';
type ArtistFormat = 'SOLO' | 'COLLECTIVE';
type AuthorType = 'COMPOSER' | 'PERFORMER' | 'BOTH';
type Step = 'role' | 'artist' | 'form';
type Region = { id: string; name: string };

const ROLE_CARDS: Array<{ id: AccountRole; title: string; description: string }> = [
  { id: 'USER', title: 'Слушатель', description: 'Слушаю музыку, сохраняю в плейлисты, покупаю и поддерживаю авторов.' },
  { id: 'ARTIST', title: 'Автор / Исполнитель', description: 'Публикую свои произведения, продаю лицензии, веду профиль и события.' },
  { id: 'EDU', title: 'Учебное заведение', description: 'Школа, колледж, вуз. Корпоративный доступ преподавателям и учащимся.' },
];

const AUTHOR_TYPES: Array<{ id: AuthorType; title: string; hint: string }> = [
  { id: 'COMPOSER', title: 'Автор музыки', hint: 'Пишу и публикую собственные произведения' },
  { id: 'PERFORMER', title: 'Исполнитель', hint: 'Исполняю и записываю произведения других авторов' },
  { id: 'BOTH', title: 'И автор, и исполнитель', hint: 'Свои произведения + каверы и записи' },
];

export default function RegisterPage() {
  const router = useRouter();

  const [step, setStep] = useState<Step>('role');
  const [role, setRole] = useState<AccountRole>('USER');

  // Common
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Artist
  const [artistFormat, setArtistFormat] = useState<ArtistFormat>('SOLO');
  const [authorType, setAuthorType] = useState<AuthorType>('COMPOSER');
  const [artistName, setArtistName] = useState('');

  // Регион РФ (обязательное по ТЗ)
  const [regions, setRegions] = useState<Region[]>([]);
  const [regionId, setRegionId] = useState('');

  // Юридическое согласие (обязательное по ТЗ и закону)
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [agreedLicense, setAgreedLicense] = useState(false);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/map/regions')
      .then((r) => r.json())
      .then((j) => {
        if (j.success && Array.isArray(j.data)) {
          setRegions(j.data.map((r: any) => ({ id: r.id, name: r.name })).sort((a: Region, b: Region) => a.name.localeCompare(b.name, 'ru')));
        }
      })
      .catch(() => {});
  }, []);

  const selectRole = (r: AccountRole) => {
    setRole(r);
    if (r === 'EDU') { router.push('/b2b/education'); return; }
    setStep(r === 'ARTIST' ? 'artist' : 'form');
  };

  const submitArtistStep = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!artistName.trim()) {
      setError('Укажите сценическое имя или название коллектива');
      return;
    }
    setStep('form');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!agreedTerms) { setError('Необходимо принять условия оферты и политики конфиденциальности'); return; }
    if (role === 'ARTIST' && !agreedLicense) { setError('Необходимо принять лицензионный договор'); return; }
    if (!regionId) { setError('Выберите регион РФ'); return; }
    if (password !== confirmPassword) { setError('Пароли не совпадают'); return; }
    if (password.length < 6) { setError('Пароль должен содержать минимум 6 символов'); return; }

    setLoading(true);
    try {
      const extras = role === 'ARTIST'
        ? { role: 'ARTIST' as const, artistData: { name: artistName.trim(), authorType, isCollective: artistFormat === 'COLLECTIVE' }, regionId, agreedTerms: true }
        : { role: 'USER' as const, regionId, agreedTerms: true };

      const response: ApiResponse<RegisterResponse> = await api.register(email, password, username, firstName, lastName, extras);
      if (response.success && response.data) {
        const rd = response.data as any;
        const token = rd.data?.token ?? rd.token;
        const user = rd.data?.user ?? rd.user;
        if (!token) { setError('Ошибка: токен не получен от сервера'); return; }
        if (!user) { setError('Ошибка: данные пользователя не получены'); return; }
        authStorage.setToken(token);
        authStorage.setUser(user);
        // Сначала отправляем на страницу ввода 6-значного кода с email
        setTimeout(() => router.push(`/auth/verify-email?email=${encodeURIComponent(email.trim().toLowerCase())}`), 150);
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

  const totalSteps = role === 'ARTIST' ? 3 : 2;
  const currentStepNum = step === 'role' ? 1 : step === 'artist' ? 2 : (role === 'ARTIST' ? 3 : 2);

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 py-6 overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <Grainient color1="#c7d2fe" color2="#f0f4ff" color3="#e0e7ff" grainAmount={0.07} timeSpeed={0.18} saturation={0.7} contrast={1.1} zoom={0.85} />
      </div>

      <div className={`w-full ${step === 'role' ? 'max-w-xl' : 'max-w-sm'} animate-fadeInUp`}>
        <div className="text-center mb-4">
          <h1 className="text-2xl md:text-3xl font-bold text-[var(--text-primary)] tracking-tight">
            {step === 'role' ? 'Создать аккаунт' : step === 'artist' ? 'Кто вы как артист?' : 'Данные аккаунта'}
          </h1>
          <p className="text-[var(--text-secondary)] text-xs md:text-sm mt-1">
            Шаг {currentStepNum} из {totalSteps}
          </p>
        </div>

        {/* ШАГ 1: Выбор роли */}
        {step === 'role' && (
          <div className="relative apple-card p-6 md:p-8 overflow-hidden">
            <ShineBorder shineColor={['#A07CFE', '#818cf8', '#c7d2fe']} duration={10} borderWidth={1.5} />
            <div className="space-y-3">
              {ROLE_CARDS.map((card) => (
                <button key={card.id} type="button" onClick={() => selectRole(card.id)}
                  className="w-full text-left p-4 md:p-5 rounded-2xl bg-white/70 hover:bg-white border border-[var(--border)] hover:border-[var(--text-primary)] transition-all">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-[15px] text-[var(--text-primary)]">{card.title}</div>
                      <div className="text-[13px] text-[var(--text-secondary)] mt-1 leading-snug">{card.description}</div>
                    </div>
                    <div className="text-[var(--text-secondary)] mt-1">→</div>
                  </div>
                </button>
              ))}
            </div>
            <p className="text-center mt-6 text-sm text-[var(--text-secondary)]">
              Уже есть аккаунт? <Link href="/login" className="text-indigo-500 font-medium hover:underline">Войти</Link>
            </p>
            <div className="my-4 flex items-center gap-3 text-[10px] uppercase tracking-widest text-[var(--text-secondary)]">
              <div className="flex-1 h-px bg-[var(--border)]" />
              <span>или регистрация через</span>
              <div className="flex-1 h-px bg-[var(--border)]" />
            </div>
            <VKAuthButton />
            <p style={{ display: 'none' }}>
            </p>
          </div>
        )}

        {/* ШАГ 2 (только для ARTIST): Артист-специфика */}
        {step === 'artist' && (
          <div className="relative apple-card p-6 overflow-hidden">
            <ShineBorder shineColor={['#A07CFE', '#818cf8', '#c7d2fe']} duration={10} borderWidth={1.5} />
            <div className="flex items-center justify-between mb-5">
              <button type="button" onClick={() => setStep('role')} className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                ← Назад
              </button>
              <span className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Автор / Исполнитель</span>
            </div>

            {error && (
              <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
                <p className="text-red-600 text-xs">{error}</p>
              </div>
            )}

            <form onSubmit={submitArtistStep} className="space-y-4">
              <div>
                <div className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Формат</div>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setArtistFormat('SOLO')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      artistFormat === 'SOLO'
                        ? 'border-[var(--text-primary)] bg-[var(--text-primary)] text-white'
                        : 'border-[var(--border)] bg-white/70 text-[var(--text-primary)] hover:border-[var(--text-primary)]'
                    }`}>
                    <div className="font-semibold text-sm">Сольно</div>
                    <div className="text-[11px] opacity-80 mt-0.5">Один артист</div>
                  </button>
                  <button type="button" onClick={() => setArtistFormat('COLLECTIVE')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      artistFormat === 'COLLECTIVE'
                        ? 'border-[var(--text-primary)] bg-[var(--text-primary)] text-white'
                        : 'border-[var(--border)] bg-white/70 text-[var(--text-primary)] hover:border-[var(--text-primary)]'
                    }`}>
                    <div className="font-semibold text-sm">Коллектив</div>
                    <div className="text-[11px] opacity-80 mt-0.5">Группа / оркестр</div>
                  </button>
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Творческая роль</div>
                <div className="grid grid-cols-3 gap-2">
                  {AUTHOR_TYPES.map((t) => (
                    <button key={t.id} type="button" onClick={() => setAuthorType(t.id)}
                      title={t.hint}
                      className={`p-2.5 rounded-xl border text-center transition-all ${
                        authorType === t.id
                          ? 'border-[var(--text-primary)] bg-[var(--text-primary)] text-white'
                          : 'border-[var(--border)] bg-white/70 text-[var(--text-primary)] hover:border-[var(--text-primary)]'
                      }`}>
                      <div className="font-semibold text-xs leading-snug">
                        {t.id === 'COMPOSER' ? 'Автор' : t.id === 'PERFORMER' ? 'Исполнитель' : 'Оба'}
                      </div>
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-[var(--text-secondary)] mt-2 leading-snug">
                  {AUTHOR_TYPES.find(t => t.id === authorType)?.hint}
                </p>
              </div>

              <div>
                <label className={labelClass}>
                  {artistFormat === 'COLLECTIVE' ? 'Название коллектива' : 'Сценическое имя'}
                </label>
                <input type="text" value={artistName} onChange={e => setArtistName(e.target.value)} className={inputClass}
                  placeholder={artistFormat === 'COLLECTIVE' ? 'Оркестр Большого театра' : 'Иван Петров'} required />
              </div>

              <ShimmerButton
                type="submit"
                shimmerColor="#a5b4fc"
                shimmerDuration="2.5s"
                background="rgba(29,29,31,1)"
                borderRadius="14px"
                className="w-full mt-1 py-3.5 text-sm font-semibold tracking-tight"
              >
                Продолжить →
              </ShimmerButton>
            </form>
          </div>
        )}

        {/* ШАГ 2/3: Базовая форма */}
        {step === 'form' && (
          <div className="relative apple-card p-6 overflow-hidden">
            <ShineBorder shineColor={['#A07CFE', '#818cf8', '#c7d2fe']} duration={10} borderWidth={1.5} />

            <div className="flex items-center justify-between mb-4">
              <button type="button" onClick={() => setStep(role === 'ARTIST' ? 'artist' : 'role')}
                className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                ← Назад
              </button>
              <span className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                {role === 'ARTIST' ? `${artistFormat === 'COLLECTIVE' ? 'Коллектив' : 'Сольно'} · ${authorType === 'COMPOSER' ? 'Автор' : authorType === 'PERFORMER' ? 'Исполнитель' : 'Оба'}` : 'Слушатель'}
              </span>
            </div>

            {error && (
              <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
                <p className="text-red-600 text-xs">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-2.5">
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
                <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 4, lineHeight: 1.4 }}>
                  Не подходит для регистрации: @gmail.com — наши письма туда часто не доходят. Используйте Яндекс, Mail.ru или другой сервис.
                </p>
              </div>
              <div>
                <label className={labelClass}>Регион РФ</label>
                <select
                  value={regionId}
                  onChange={(e) => setRegionId(e.target.value)}
                  required
                  className={inputClass}
                >
                  <option value="">— Выберите регион —</option>
                  {regions.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
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
                      : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>}
                  </button>
                </div>
                {password && (
                  <div className="flex gap-1 mt-1.5">
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

              {/* Согласие с офертой и политикой — обязательно по ТЗ и по закону */}
              <label className="flex items-start gap-2.5 cursor-pointer mt-1">
                <input
                  type="checkbox"
                  checked={agreedTerms}
                  onChange={(e) => setAgreedTerms(e.target.checked)}
                  required
                  className="mt-0.5 w-4 h-4 accent-[var(--text-primary)] cursor-pointer flex-shrink-0"
                />
                <span className="text-[12px] text-[var(--text-secondary)] leading-snug">
                  Я принимаю{' '}
                  <Link href="/legal/terms" target="_blank" className="text-indigo-500 hover:underline">условия оферты</Link>,{' '}
                  <Link href="/legal/privacy" target="_blank" className="text-indigo-500 hover:underline">политику конфиденциальности</Link>
                  {' '}и согласен на обработку персональных данных.
                </span>
              </label>

              {/* Лицензионный договор — только для авторов */}
              {role === 'ARTIST' && (
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreedLicense}
                    onChange={(e) => setAgreedLicense(e.target.checked)}
                    required
                    className="mt-0.5 w-4 h-4 accent-[var(--text-primary)] cursor-pointer flex-shrink-0"
                  />
                  <span className="text-[12px] text-[var(--text-secondary)] leading-snug">
                    Я принимаю{' '}
                    <Link href="/legal/copyright" target="_blank" className="text-indigo-500 hover:underline">
                      лицензионный договор с автором
                    </Link>
                    {' '}и подтверждаю, что обладаю правами на материалы, которые буду публиковать.
                  </span>
                </label>
              )}

              <ShimmerButton
                type="submit"
                disabled={loading}
                shimmerColor="#a5b4fc"
                shimmerDuration="2.5s"
                background="rgba(29,29,31,1)"
                borderRadius="14px"
                className="w-full mt-2 py-3.5 text-sm font-semibold tracking-tight disabled:opacity-60"
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
        )}

        {step === 'role' && (
          <p className="text-center mt-3 text-[11px] text-[var(--text-secondary)]">
            Администратор Сонатум и контент-менеджеры создаются вручную и здесь не регистрируются.
          </p>
        )}
      </div>
    </div>
  );
}
