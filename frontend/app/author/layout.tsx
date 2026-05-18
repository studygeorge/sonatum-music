'use client';

import { useEffect, useState, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { authStorage } from '@/app/lib/auth';

type Me = {
  user: {
    id: string;
    email: string;
    username: string | null;
    firstName: string | null;
    role: string;
    accountKind: string;
    balance: number;
    payoutEnabled: boolean;
  };
  format: 'SOLO' | 'COLLECTIVE' | null;
  role: string | null;
  artist: { id: string; name: string; slug: string; avatar: string | null; verified: boolean } | null;
  collective: { id: string; name: string; slug: string; avatar: string | null } | null;
  stats: { tracksCount: number; totalSales: number; totalDonations: number };
};

const NAV = [
  { href: '/author', label: 'Профиль' },
  { href: '/author/tracks', label: 'Треки' },
  { href: '/author/upload', label: 'Загрузить' },
  { href: '/author/analytics', label: 'Аналитика' },
  { href: '/author/finance', label: 'Финансы' },
  { href: '/author/collabs', label: 'Коллаборации' },
  { href: '/author/events', label: 'События' },
  { href: '/author/settings', label: 'Настройки' },
];

export default function AuthorLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [notAuthor, setNotAuthor] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);

  // Загрузка/смена аватарки артиста через клик по кружку в сайдбаре
  const uploadAvatar = async (file: File | null) => {
    if (!file || !me?.artist) return;
    setAvatarUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('artistSlug', me.artist.slug || me.artist.id || 'artist');
      const ur = await fetch('/api/upload/avatar', { method: 'POST', body: fd });
      const uj = await ur.json();
      const avatarUrl = uj?.data?.avatarUrl || uj?.avatarUrl || uj?.url;
      if (!uj.success || !avatarUrl) return;
      await fetch('/api/author/me', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authStorage.getToken() || ''}`,
        },
        body: JSON.stringify({ avatar: avatarUrl }),
      });
      // Локально обновляем чтобы кружок поменялся сразу
      setMe((prev) => (prev && prev.artist
        ? { ...prev, artist: { ...prev.artist, avatar: avatarUrl } }
        : prev));
    } finally {
      setAvatarUploading(false);
    }
  };

  const load = useCallback(async () => {
    // быстрый init из кэша — рендерим sidebar моментально
    try {
      const cached = authStorage.getUser?.();
      if (cached) {
        setMe((prev) => prev || ({
          user: { id: cached.id, email: cached.email, username: cached.username, firstName: cached.firstName, role: cached.role, accountKind: cached.accountKind || 'LISTENER', balance: Number(cached.balance) || 0, payoutEnabled: false },
          format: null, role: null,
          artist: cached.artist || null,
          collective: cached.collective || null,
          stats: { tracksCount: 0, totalSales: 0, totalDonations: 0 },
        } as any));
      }
    } catch {}
    const token = authStorage.getToken();
    if (!token) {
      setNeedsLogin(true);
      setLoading(false);
      return;
    }
    try {
      const r = await fetch('/api/author/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await r.json();
      if (j.success) {
        setMe(j.data);
        if (j.data.user.role !== 'ARTIST' && j.data.user.role !== 'ADMIN' && j.data.user.role !== 'SUPER_ADMIN') {
          setNotAuthor(true);
        }
      } else {
        setNeedsLogin(true);
      }
    } catch {
      setNeedsLogin(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // loading skeleton встроен внутрь sidebar — layout не меняется

  if (needsLogin) {
    return (
      <main className="min-h-screen pt-14 pb-24 px-6 max-w-2xl mx-auto">
        <div className="apple-card p-10 text-center animate-fadeInUp">
          <h1 className="text-3xl font-bold tracking-tight mb-3">Войдите в аккаунт</h1>
          <p className="text-[var(--text-secondary)] mb-6">
            Кабинет автора доступен только авторизованным пользователям.
          </p>
          <div className="flex gap-3 justify-center">
            <Link href="/login" className="px-6 py-3 rounded-full bg-[var(--text-primary)] text-white font-medium hover:opacity-90 transition-opacity">
              Войти
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (notAuthor) {
    return (
      <main className="min-h-screen pt-14 pb-24 px-6 max-w-2xl mx-auto">
        <div className="apple-card p-10 text-center animate-fadeInUp">
          <h1 className="text-3xl font-bold tracking-tight mb-3">Сначала станьте автором</h1>
          <p className="text-[var(--text-secondary)] mb-6">
            Создайте профиль автора, чтобы загружать музыку и продавать лицензии.
          </p>
          <Link href="/artists/join" className="inline-block px-6 py-3 rounded-full bg-[var(--text-primary)] text-white font-medium hover:opacity-90 transition-opacity">
            Стать автором
          </Link>
        </div>
      </main>
    );
  }

  const displayName = me?.artist?.name || me?.collective?.name || me?.user.username || me?.user.firstName || 'Автор';
  const avatar = me?.artist?.avatar || me?.collective?.avatar;
  const initial = (displayName || 'A').charAt(0).toUpperCase();
  const isActive = (href: string) => {
    if (href === '/author') return pathname === '/author';
    return pathname?.startsWith(href);
  };

  return (
    <main className="min-h-screen pt-6 md:pt-10 pb-24 px-4 md:px-8 max-w-7xl mx-auto">
      <div className="grid md:grid-cols-[280px_1fr] gap-6 md:gap-8 items-start">
        {/* Sidebar */}
        <aside className="md:self-start space-y-4">
          <div className="apple-card p-5">
            <div className="flex items-center gap-3 mb-1">
              {/* Кликабельный кружок — открывает выбор файла */}
              <label
                className="group relative w-12 h-12 rounded-full bg-[var(--text-primary)] text-white flex items-center justify-center overflow-hidden shrink-0 cursor-pointer"
                title={avatarUploading ? 'Загрузка…' : avatar ? 'Заменить фото' : 'Загрузить фото'}>
                {avatar ? (
                  <img src={avatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="font-bold text-lg">{initial}</span>
                )}
                {/* Hover-оверлей с иконкой камеры */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                </div>
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  className="hidden"
                  disabled={avatarUploading || !me?.artist}
                  onChange={(e) => uploadAvatar(e.target.files?.[0] || null)}
                />
              </label>
              <div className="min-w-0">
                <div className="font-semibold truncate">{displayName}</div>
                <div className="text-xs text-[var(--text-secondary)] truncate">
                  {me?.format === 'SOLO' ? 'Сольный проект' : me?.format === 'COLLECTIVE' ? 'Коллектив' : 'Автор'}
                  {me?.role && ' · '}
                  {me?.role === 'COMPOSER' && 'Композитор'}
                  {me?.role === 'PERFORMER' && 'Исполнитель'}
                  {me?.role === 'BOTH' && 'Полнотворческий'}
                  {me?.role === 'AUTHORIAL' && 'Авторский'}
                  {me?.role === 'PERFORMING' && 'Исполнительский'}
                  {me?.role === 'FULL_CREATIVE' && 'Полнотворческий'}
                </div>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-[var(--border)] flex justify-between text-xs">
              <span className="text-[var(--text-secondary)]">Баланс</span>
              <span className="font-semibold tabular-nums">{Math.round(me?.user.balance || 0).toLocaleString('ru-RU')} ₽</span>
            </div>
            {!me?.user.payoutEnabled && (
              <div className="mt-2 text-[11px] text-[var(--text-secondary)] leading-snug">
                Выплаты не подключены
              </div>
            )}
          </div>
          <nav className="apple-card p-2">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isActive(item.href)
                    ? 'bg-[var(--text-primary)] text-white'
                    : 'text-[var(--text-primary)] hover:bg-[var(--hover)]'
                }`}>
                              <span>{item.label}</span>
              </Link>
            ))}
          </nav>
        </aside>
        {/* Content */}
        <div className="min-w-0">{children}</div>
      </div>
    </main>
  );
}
