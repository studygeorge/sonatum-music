'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { authStorage } from '@/app/lib/auth';

type Ctx = {
  myRole: string | null;
  institution: any | null;
  stats?: { totalMembers: number; teachers: number; students: number };
};

const NAV_ADMIN = [
  { href: '/edu', label: 'Обзор' },
  { href: '/edu/users', label: 'Пользователи' },
  { href: '/edu/playlists', label: 'Плейлисты' },
  { href: '/edu/stats', label: 'Статистика' },
  { href: '/edu/documents', label: 'Документы' },
  { href: '/edu/settings', label: 'Настройки' },
];

const NAV_TEACHER = [
  { href: '/edu', label: 'Обзор' },
  { href: '/edu/playlists', label: 'Учебные плейлисты' },
];

const NAV_STUDENT = [
  { href: '/edu', label: 'Обзор' },
  { href: '/edu/playlists', label: 'Учебные плейлисты' },
];

export default function EduLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [ctx, setCtx] = useState<Ctx | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsLogin, setNeedsLogin] = useState(false);

  useEffect(() => {
    const token = authStorage.getToken();
    if (!token) {
      setNeedsLogin(true);
      setLoading(false);
      return;
    }
    fetch('/api/edu/me', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setCtx(j);
        else setNeedsLogin(true);
      })
      .catch(() => setNeedsLogin(true))
      .finally(() => setLoading(false));
  }, []);

  // loading state — компактный, без подмены layout
  if (needsLogin) {
    return (
      <main className="min-h-screen pt-14 pb-24 px-6 max-w-2xl mx-auto">
        <div className="apple-card p-10 text-center animate-fadeInUp">
          <h1 className="text-3xl font-bold tracking-tight mb-3">Войдите в аккаунт</h1>
          <p className="text-[var(--text-secondary)] mb-6">
            Кабинет учебного заведения доступен только администраторам, преподавателям и учащимся подключённых организаций.
          </p>
          <Link
            href="/login"
            className="px-6 py-3 rounded-full bg-[var(--text-primary)] text-white font-medium inline-block">
            Войти
          </Link>
        </div>
      </main>
    );
  }
  if (!ctx?.institution || !ctx.myRole) {
    return (
      <main className="min-h-screen pt-14 pb-24 px-6 max-w-2xl mx-auto">
        <div className="apple-card p-10 text-center animate-fadeInUp">
          <h1 className="text-3xl font-bold tracking-tight mb-3">Нет привязки</h1>
          <p className="text-[var(--text-secondary)] mb-6">
            Ваш аккаунт не привязан к учебному заведению. Если ваше учреждение уже подключено к «Сонатум» — попросите администратора добавить вас в раздел «Пользователи».
          </p>
          <Link
            href="/b2b/education"
            className="px-6 py-3 rounded-full bg-[var(--text-primary)] text-white font-medium inline-block">
            Подключить учреждение
          </Link>
        </div>
      </main>
    );
  }

  const nav =
    ctx.myRole === 'ADMIN' ? NAV_ADMIN : ctx.myRole === 'TEACHER' ? NAV_TEACHER : NAV_STUDENT;
  const isActive = (href: string) => {
    if (href === '/edu') return pathname === '/edu';
    return pathname?.startsWith(href);
  };

  return (
    <main className="min-h-screen pt-6 md:pt-10 pb-24 px-4 md:px-8 max-w-7xl mx-auto">
      <div className="grid md:grid-cols-[280px_1fr] gap-6 md:gap-8 items-start">
        <aside className="md:self-start space-y-4">
          <div className="apple-card p-5">
            <div className="text-xs text-[var(--text-secondary)] uppercase tracking-widest mb-1">
              {ctx.myRole === 'ADMIN' ? 'Администратор' : ctx.myRole === 'TEACHER' ? 'Преподаватель' : 'Учащийся'}
            </div>
            <div className="font-bold leading-snug">
              {ctx.institution.shortName || ctx.institution.fullName}
            </div>
            <div className="text-xs text-[var(--text-secondary)] mt-2">
              Статус:{' '}
              <span className={ctx.institution.status === 'ACTIVE' ? 'text-green-700' : ''}>
                {ctx.institution.status === 'ACTIVE'
                  ? 'Активно'
                  : ctx.institution.status === 'APPROVED'
                  ? 'Ожидает оплаты'
                  : ctx.institution.status}
              </span>
            </div>
            {ctx.institution.expiresAt && (
              <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                до{' '}
                {new Date(ctx.institution.expiresAt).toLocaleDateString('ru-RU', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                })}
              </div>
            )}
          </div>
          <nav className="apple-card p-2">
            {nav.map((item) => (
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
        <div className="min-w-0">{children}</div>
      </div>
    </main>
  );
}
