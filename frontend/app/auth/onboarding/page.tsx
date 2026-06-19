'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { authStorage } from '@/app/lib/auth';

export const dynamic = 'force-dynamic';

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-sm text-[var(--text-secondary)]">Загрузка…</div>}>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const router = useRouter();
  const params = useSearchParams();
  const [user, setUser] = useState<any>(null);

  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [regionId, setRegionId] = useState('');
  const [regions, setRegions] = useState<Array<{ id: string; name: string }>>([]);

  const [role, setRole] = useState<'USER' | 'ARTIST'>('USER');

  // Artist fields
  const [artistName, setArtistName] = useState('');
  const [authorType, setAuthorType] = useState<'COMPOSER' | 'PERFORMER' | 'BOTH'>('BOTH');
  const [isCollective, setIsCollective] = useState(false);
  const [agreedLicense, setAgreedLicense] = useState(false);

  const [agreedTerms, setAgreedTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const needEmail = params?.get('email') === '1';
  const needName  = params?.get('name')  === '1';

  useEffect(() => {
    const u = authStorage.getUser();
    if (!u) { router.replace('/login'); return; }
    setUser(u);
    setEmail(u.email && !u.email.endsWith('@vk.sonatum-music.ru') ? u.email : '');
    setFirstName(u.firstName || '');
    setLastName(u.lastName || '');
    setRegionId(u.regionId || '');
    if (u.role === 'ARTIST') setRole('ARTIST');

    // Загружаем регионы
    fetch('/api/regions').then(r => r.json()).then(j => {
      if (j.success) setRegions((j.data || []).map((r: any) => ({ id: r.id, name: r.name })));
    }).catch(() => {});
  }, [router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    if (!agreedTerms) { setErr('Необходимо принять оферту'); return; }
    if (needEmail && !email.trim()) { setErr('Введите email'); return; }
    if (needName && !firstName.trim()) { setErr('Введите имя'); return; }
    if (!regionId) { setErr('Выберите регион'); return; }
    if (role === 'ARTIST') {
      if (!artistName.trim()) { setErr('Укажите название артиста / коллектива'); return; }
      if (!agreedLicense) { setErr('Необходимо принять лицензионный договор'); return; }
    }
    setBusy(true);
    try {
      const r = await fetch('/api/auth/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStorage.getToken()}` },
        body: JSON.stringify({
          email: email.trim(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          regionId,
          agreedTerms: true,
          role,
          agreedLicense,
          artistData: role === 'ARTIST'
            ? { name: artistName.trim(), authorType, isCollective }
            : undefined,
        }),
      });
      const j = await r.json();
      if (!j.success) { setErr(j.error || 'Ошибка'); return; }
      const updated = { ...user, email: email || user.email, firstName, lastName, regionId, role };
      authStorage.setUser(updated);
      // При VK-онбординге email подтверждение не требуется — сразу в кабинет
      window.location.replace(role === 'ARTIST' ? '/author' : '/profile');
    } finally { setBusy(false); }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--background)]">
      <div className="apple-card w-full max-w-md p-8">
        <h1 className="text-2xl font-bold tracking-tight mb-2">Добро пожаловать в Сонатум</h1>
        <p className="text-sm text-[var(--text-secondary)] mb-6">
          Завершите создание аккаунта — это займёт несколько секунд.
        </p>

        <form onSubmit={submit} className="space-y-3">
          {/* Выбор роли */}
          <div>
            <label className="block text-sm font-medium mb-2">Кто вы?</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRole('USER')}
                className={`px-4 py-3 rounded-xl border text-sm font-medium text-left transition-colors ${
                  role === 'USER'
                    ? 'border-[var(--text-primary)] bg-[var(--text-primary)] text-white'
                    : 'border-[var(--border)] bg-white hover:bg-[var(--hover)]'
                }`}>
                <div className="font-semibold">Слушатель</div>
                <div className="text-[10px] opacity-80 mt-0.5">Слушаю музыку</div>
              </button>
              <button
                type="button"
                onClick={() => setRole('ARTIST')}
                className={`px-4 py-3 rounded-xl border text-sm font-medium text-left transition-colors ${
                  role === 'ARTIST'
                    ? 'border-[var(--text-primary)] bg-[var(--text-primary)] text-white'
                    : 'border-[var(--border)] bg-white hover:bg-[var(--hover)]'
                }`}>
                <div className="font-semibold">Автор</div>
                <div className="text-[10px] opacity-80 mt-0.5">Публикую треки</div>
              </button>
            </div>
          </div>

          {needEmail && (
            <div>
              <label className="block text-sm font-medium mb-1">Email *</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="example@mail.ru"
                className="w-full p-3 rounded-xl border border-[var(--border)] bg-white text-sm"
              />
              <p className="text-[11px] text-[var(--text-secondary)] mt-1">
                На него будут приходить уведомления о новых релизах любимых авторов и чеки.
              </p>
              <p className="text-[11px] mt-1" style={{ color: '#9ca3af', lineHeight: 1.4 }}>
                Адреса @gmail.com не принимаются — наши письма туда часто не доходят. Используйте Яндекс, Mail.ru или другой сервис.
              </p>
            </div>
          )}

          {needName && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm font-medium mb-1">Имя *</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  className="w-full p-3 rounded-xl border border-[var(--border)] bg-white text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Фамилия</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full p-3 rounded-xl border border-[var(--border)] bg-white text-sm"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Регион *</label>
            <select
              value={regionId}
              onChange={(e) => setRegionId(e.target.value)}
              required
              className="w-full p-3 rounded-xl border border-[var(--border)] bg-white text-sm">
              <option value="">— выберите регион —</option>
              {regions.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>

          {/* Артист-блок */}
          {role === 'ARTIST' && (
            <div className="space-y-3 pt-2 mt-2 border-t border-[var(--border)]">
              <div>
                <label className="block text-sm font-medium mb-1">Название артиста / коллектива *</label>
                <input
                  type="text"
                  value={artistName}
                  onChange={(e) => setArtistName(e.target.value)}
                  required
                  placeholder="Имя на сцене"
                  className="w-full p-3 rounded-xl border border-[var(--border)] bg-white text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Тип автора</label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { v: 'COMPOSER',  l: 'Композитор' },
                    { v: 'PERFORMER', l: 'Исполнитель' },
                    { v: 'BOTH',      l: 'И то и то' },
                  ] as const).map((o) => (
                    <button
                      key={o.v}
                      type="button"
                      onClick={() => setAuthorType(o.v)}
                      className={`px-2 py-2 rounded-xl border text-xs font-medium transition-colors ${
                        authorType === o.v
                          ? 'border-[var(--text-primary)] bg-[var(--text-primary)] text-white'
                          : 'border-[var(--border)] bg-white hover:bg-[var(--hover)]'
                      }`}>
                      {o.l}
                    </button>
                  ))}
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isCollective}
                  onChange={(e) => setIsCollective(e.target.checked)}
                  className="w-4 h-4 accent-[var(--text-primary)]"
                />
                <span className="text-sm">Это коллектив (группа, оркестр, ансамбль)</span>
              </label>
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreedLicense}
                  onChange={(e) => setAgreedLicense(e.target.checked)}
                  required
                  className="mt-0.5 w-4 h-4 accent-[var(--text-primary)] flex-shrink-0"
                />
                <span className="text-[12px] text-[var(--text-secondary)] leading-snug">
                  Я принимаю{' '}
                  <Link href="/legal/copyright" target="_blank" className="underline">
                    лицензионный договор с автором
                  </Link>
                  {' '}и подтверждаю, что обладаю правами на публикуемые материалы.
                </span>
              </label>
            </div>
          )}

          <label className="flex items-start gap-2.5 cursor-pointer pt-2">
            <input
              type="checkbox"
              checked={agreedTerms}
              onChange={(e) => setAgreedTerms(e.target.checked)}
              required
              className="mt-0.5 w-4 h-4 accent-[var(--text-primary)] flex-shrink-0"
            />
            <span className="text-[12px] text-[var(--text-secondary)] leading-snug">
              Я принимаю{' '}
              <Link href="/legal/terms" target="_blank" className="underline">условия оферты</Link>,{' '}
              <Link href="/legal/privacy" target="_blank" className="underline">политику конфиденциальности</Link>
              {' '}и согласен на обработку персональных данных.
            </span>
          </label>

          {err && <div className="apple-card p-3 bg-[var(--hover)] text-sm">{err}</div>}

          <button type="submit" disabled={busy || !agreedTerms} className="apple-button w-full">
            {busy ? 'Сохраняем…' : 'Завершить и перейти в аккаунт'}
          </button>
        </form>
      </div>
    </div>
  );
}
