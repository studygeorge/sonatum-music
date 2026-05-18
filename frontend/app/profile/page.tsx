'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '../lib/api';
import { authStorage } from '../lib/auth';
import { ShimmerButton } from '../components/ShimmerButton';
import LibraryTab from './LibraryTab';

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('library');
  const [saving, setSaving] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  useEffect(() => {
    const token = authStorage.getToken();
    if (!token) {
      setLoading(false);
      return;
    }

    // Try cached user first for instant render
    const cached = authStorage.getUser();
    if (cached) {
      // Если уже знаем что это автор — сразу перенаправляем без рендера профиля
      if (cached.role === 'ARTIST') {
        router.replace('/author');
        return;
      }
      setUser(cached);
      setNameValue(cached.firstName ? `${cached.firstName} ${cached.lastName || ''}`.trim() : cached.username || '');
    }

    // Then refresh from API
    api.getMe().then(async (res) => {
      if (res.success && res.data) {
        const u = res.data;
        authStorage.setUser(u);
        setUser(u);
        setNameValue(u.firstName ? `${u.firstName} ${u.lastName || ''}`.trim() : u.username || '');

        // === АВТО-ПЕРЕНАПРАВЛЕНИЕ В КАБИНЕТ ПО РОЛИ ===
        if (u.role === 'ARTIST') {
          router.replace('/author');
          return;
        }
        // Проверяем привязку к учебному заведению
        try {
          const r = await fetch('/api/edu/me', {
            headers: { Authorization: `Bearer ${token}` },
          });
          const j = await r.json();
          if (j.success && j.institution && j.myRole) {
            router.replace('/edu');
            return;
          }
        } catch {}
      } else {
        authStorage.clear();
        setUser(null);
      }
      setLoading(false);
    });
  }, []);

  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  const confirmLogout = async () => {
    setShowLogoutConfirm(false);
    await api.logout().catch(() => {});
    authStorage.clear();
    window.location.href = '/';
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const token = authStorage.getToken();
      // Парсим nameValue → firstName + lastName (если есть пробел)
      const parts = (nameValue || '').trim().split(/\s+/);
      const firstName = parts[0] || null;
      const lastName = parts.slice(1).join(' ') || null;
      const r = await fetch('/api/users/me/preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ firstName, lastName }),
      });
      const j = await r.json();
      if (j.success && j.data) {
        const updated = { ...user, ...j.data };
        setUser(updated);
        authStorage.setUser(updated);
      }
    } finally {
      setSaving(false);
    }
  };

  // Загрузка аватара через /api/upload/avatar + сохранение URL в /api/users/me/preferences
  const [avatarUploading, setAvatarUploading] = useState(false);
  const handleAvatarUpload = async (file: File | null) => {
    if (!file || !user) return;
    setAvatarUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('userSlug', user.username || user.id || 'user');
      const ur = await fetch('/api/upload/avatar', { method: 'POST', body: fd });
      const uj = await ur.json();
      const avatarUrl = uj?.data?.avatarUrl || uj?.avatarUrl || uj?.url;
      if (!uj.success || !avatarUrl) {
        console.error('Avatar upload failed', uj);
        return;
      }
      // Сохраняем в профиль
      const token = authStorage.getToken();
      const r = await fetch('/api/users/me/preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ avatar: avatarUrl }),
      });
      const j = await r.json();
      if (j.success) {
        const updated = { ...user, avatar: avatarUrl };
        setUser(updated);
        authStorage.setUser(updated);
      }
    } finally {
      setAvatarUploading(false);
    }
  };
  const handleAvatarRemove = async () => {
    if (!user) return;
    setAvatarUploading(true);
    try {
      const token = authStorage.getToken();
      const r = await fetch('/api/users/me/preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ avatar: '' }),
      });
      const j = await r.json();
      if (j.success) {
        const updated = { ...user, avatar: null };
        setUser(updated);
        authStorage.setUser(updated);
      }
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleSubscribe = async (tier: 'PREMIUM') => {
    setUpgrading(true);
    try {
      const token = authStorage.getToken();
      const res = await fetch('/api/payments/init', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ tier }),
      });
      const json = await res.json();
      if (json.success && json.paymentUrl) {
        window.location.href = json.paymentUrl;
        return;
      }
      alert(json.error || 'Не удалось перейти к оплате');
    } catch (e) {
      console.error(e);
      alert('Ошибка сети');
    } finally {
      setUpgrading(false);
    }
  };

  // ─── Loading state ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-[var(--text-secondary)]">
          <svg className="w-8 h-8 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <span>Загрузка...</span>
        </div>
      </main>
    );
  }

  // ─── Guest state ─────────────────────────────────────────────────────────────
  if (!user) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center max-w-md animate-fadeInUp">
          <h1 className="text-3xl font-bold mb-3">Войдите в аккаунт</h1>
          <p className="text-[var(--text-secondary)] mb-8">
            Чтобы открыть профиль, управлять подпиской и сохранять любимую музыку — войдите или создайте аккаунт.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <ShimmerButton
              shimmerColor="#a5b4fc"
              shimmerDuration="2.5s"
              background="rgba(29,29,31,1)"
              borderRadius="980px"
              className="px-8 py-3 text-sm font-semibold tracking-tight"
              onClick={() => window.location.href = '/login'}>
              Войти
            </ShimmerButton>
            <ShimmerButton
              shimmerColor="#c7d2fe"
              shimmerDuration="3s"
              background="rgba(255,255,255,0.9)"
              borderRadius="980px"
              className="px-8 py-3 text-sm font-semibold tracking-tight !text-[var(--text-primary)] border-[var(--border)]"
              onClick={() => window.location.href = '/register'}>
              Зарегистрироваться
            </ShimmerButton>
          </div>
        </div>
      </main>
    );
  }

  // ─── Display name helpers ────────────────────────────────────────────────────
  const displayName = user.firstName
    ? `${user.firstName} ${user.lastName || ''}`.trim()
    : user.username || user.email;

  const initials = displayName
    .split(' ')
    .map((w: string) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const roleLabel: Record<string, string> = {
    USER: 'Слушатель',
    ARTIST: 'Исполнитель',
    ADMIN: 'Администратор',
  };

  // ─── Tab renderers ───────────────────────────────────────────────────────────
  const renderSettings = () => (
    <div className="space-y-8 animate-fadeInUp">
      {/* Аватар */}
      <div className="apple-card p-6 md:p-8">
        <h2 className="text-2xl font-bold mb-6">Фото профиля</h2>
        <div className="flex items-center gap-5">
          <div className="w-24 h-24 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-2xl font-bold text-gray-400 overflow-hidden shrink-0">
            {user.avatar ? (
              <img src={user.avatar} alt="" className="w-full h-full object-cover" />
            ) : (
              <span>{(user.firstName?.[0] || user.username?.[0] || user.email?.[0] || '?').toUpperCase()}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-600 mb-2">
              JPG или PNG, до 5 МБ. Будет показано рядом с вашим именем в комментариях и плейлистах.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <label
                className={`px-4 py-2 rounded-full text-sm font-medium cursor-pointer transition-colors ${
                  avatarUploading
                    ? 'bg-gray-200 text-gray-500'
                    : 'bg-black text-white hover:bg-gray-800'
                }`}>
                {avatarUploading ? 'Загрузка…' : user.avatar ? 'Заменить фото' : 'Загрузить фото'}
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  className="hidden"
                  disabled={avatarUploading}
                  onChange={(e) => handleAvatarUpload(e.target.files?.[0] || null)}
                />
              </label>
              {user.avatar && !avatarUploading && (
                <button
                  type="button"
                  onClick={handleAvatarRemove}
                  className="px-4 py-2 rounded-full text-sm font-medium bg-white text-gray-900 border border-gray-300 hover:bg-gray-100 transition-colors">
                  Убрать
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="apple-card p-6 md:p-8">
        <h2 className="text-2xl font-bold mb-6">Профиль</h2>
        <form className="space-y-4 max-w-md" onSubmit={handleSave}>
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Имя</label>
            <input
              type="text"
              value={nameValue}
              onChange={e => setNameValue(e.target.value)}
              className="w-full p-3 rounded-xl border border-[var(--border)] bg-[var(--background)] focus:bg-white transition-colors outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Email</label>
            <input
              type="email"
              defaultValue={user.email}
              disabled
              className="w-full p-3 rounded-xl border border-[var(--border)] bg-gray-100 text-[var(--text-secondary)] outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Имя пользователя</label>
            <input
              type="text"
              defaultValue={user.username}
              disabled
              className="w-full p-3 rounded-xl border border-[var(--border)] bg-gray-100 text-[var(--text-secondary)] outline-none"
            />
          </div>
          <button type="submit" className="apple-button mt-4" disabled={saving}>
            {saving ? 'Сохраняем...' : 'Сохранить изменения'}
          </button>
        </form>
      </div>
      {/* Монетизация — только для артистов */}
      {user.role === 'ARTIST' && user.balance !== undefined && (
        <div className="apple-card p-6 md:p-8 border border-gray-300 bg-gray-50">
          <h2 className="text-2xl font-bold mb-2 text-gray-900">Баланс</h2>
          <p className="text-[var(--text-secondary)] mb-4 text-sm">Начисления за продажи ваших треков и нот.</p>
          <div className="text-4xl font-black text-gray-900 mb-6">{Number(user.balance).toFixed(2)} ₽</div>
          <button className="apple-button bg-black hover:bg-gray-800 text-white border-transparent disabled:opacity-50" disabled={Number(user.balance) < 1000}>
            Вывести средства (от 1000 ₽)
          </button>
        </div>
      )}

      <div className="apple-card p-6 md:p-8">
        <h2 className="text-2xl font-bold mb-6">Приватность профиля</h2>
        <div className="space-y-4">
          <label className="flex items-center gap-4 cursor-pointer">
            <div className="relative">
              <input type="checkbox" className="sr-only peer" defaultChecked />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--accent)]"></div>
            </div>
            <span className="font-medium text-[var(--text-primary)]">Сделать профиль публичным</span>
          </label>
          <label className="flex items-center gap-4 cursor-pointer">
            <div className="relative">
              <input type="checkbox" className="sr-only peer" defaultChecked />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--accent)]"></div>
            </div>
            <span className="font-medium text-[var(--text-primary)]">Показывать мои плейлисты</span>
          </label>
        </div>
      </div>
    </div>
  );

  const renderSubscription = () => {
    const subStatus = user?.subscription?.status;
    const subTier = user?.subscription?.tier;
    // Tier учитывается только если подписка активна; иначе считаем FREE.
    const currentTier = (subStatus === 'ACTIVE' && subTier && subTier !== 'FREE') ? subTier : 'FREE';
    const isPending = subStatus === 'PENDING';
    const hasActivePaid = currentTier !== "FREE" && (() => {
      const end = user?.subscription?.endDate;
      if (!end) return user?.subscription?.status === "ACTIVE";
      return new Date(end)> new Date() && user?.subscription?.status === "ACTIVE";
    })();


    // Дни до окончания активной подписки
    const endDateRaw = user?.subscription?.endDate;
    const daysLeft = (() => {
      if (!hasActivePaid || !endDateRaw) return null;
      const ms = new Date(endDateRaw).getTime() - Date.now();
      return ms> 0 ? Math.ceil(ms / (1000 * 60 * 60 * 24)) : 0;
    })();
    const formatDays = (n: number) => {
      const mod10 = n % 10, mod100 = n % 100;
      if (mod100>= 11 && mod100 <= 14) return `${n} дней`;
      if (mod10 === 1) return `${n} день`;
      if (mod10>= 2 && mod10 <= 4) return `${n} дня`;
      return `${n} дней`;
    };

    const planTitle = isPending
      ? 'Ожидает оплаты'
      : currentTier === 'FREE'
      ? 'Freemium'
      : `Sonatum ${currentTier}`;
    const planDesc = isPending
      ? 'Перейдите по последней ссылке Т-Банка или оформите подписку заново.'
      : hasActivePaid && daysLeft !== null
      ? `Активна — осталось ${formatDays(daysLeft)}${
          endDateRaw
            ? ` (до ${new Date(endDateRaw).toLocaleDateString('ru-RU')})`
            : ''
        }`
      : currentTier === 'FREE'
      ? 'Доступ к базовому каталогу с ограничениями'
      : 'Полный доступ ко всем функциям и HQ-качеству';

    return (
      <div className="space-y-8 animate-fadeInUp">
        <div>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">
            {planTitle}
          </h2>
          <p className="text-[var(--text-secondary)]">{planDesc}</p>
        </div>
        <div className="max-w-md">
          {/* Premium — единственный тариф */}
          <div
            className={`apple-card p-6 md:p-8 transition-shadow flex flex-col ${
              currentTier === 'PREMIUM' ? 'ring-2 ring-[var(--text-primary)]' : ''
            }`}>
            <h3 className="text-xl font-bold mb-3">Sonatum Premium</h3>
            <p className="text-4xl font-bold mb-6">
              299 ₽
              <span className="text-base text-[var(--text-secondary)] font-normal">
                {' '}
                / мес
              </span>
            </p>
            <ul className="space-y-2 mb-8 text-sm text-[var(--text-secondary)] flex-grow">
              <li>• Без рекламы</li>
              <li>• HQ Audio / FLAC</li>
              <li>• Нотный архив и тексты</li>
              <li>• Комментарии и плейлисты</li>
            </ul>
            <button
              className={`apple-button w-full ${
                currentTier === 'PREMIUM' ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              onClick={() =>
                currentTier !== 'PREMIUM' && handleSubscribe('PREMIUM')
              }
              disabled={upgrading || currentTier === 'PREMIUM'}>
              {currentTier === 'PREMIUM'
                ? daysLeft !== null
                  ? `Активна · ${formatDays(daysLeft)}`
                  : 'Активна'
                : upgrading
                ? 'Оформляем...'
                : isPending
                ? 'Оплатить заново'
                : 'Оформить подписку'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ─── Authenticated layout ────────────────────────────────────────────────────
  return (
    <main className="min-h-screen pt-0 md:pt-16 pb-12 px-6 md:px-12 max-w-6xl mx-auto flex flex-col md:flex-row gap-12">
      {/* Sidebar */}
      <aside className="w-full md:w-64 shrink-0">
        <div className="sticky top-20">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-16 h-16 bg-[var(--text-primary)] rounded-full shrink-0 flex items-center justify-center text-white font-bold text-xl">
              {user.avatar
                ? <img src={user.avatar} alt={displayName} className="w-full h-full object-cover rounded-full" />
                : initials}
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-lg truncate">{displayName}</h1>
            </div>
          </div>
          {(user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') && (
            <Link
              href="/admin"
              className="mb-3 block px-4 py-3 rounded-xl bg-[var(--text-primary)] text-white text-center text-sm font-semibold hover:opacity-90 transition-opacity">
              Админ-панель
            </Link>
          )}
          <nav className="flex flex-col gap-2">
            {[
              { id: 'library', label: 'Моя музыка' },
              { id: 'settings', label: 'Настройки профиля' },
              { id: 'subscription', label: 'Подписка' },
              ...(user.role === 'ARTIST' ? [{ id: 'collective', label: 'Мои коллективы' }] : []),
            ].map(item => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`text-left px-4 py-3 rounded-xl font-medium transition-colors ${
                  activeTab === item.id
                    ? 'bg-[var(--text-primary)] text-white shadow-md'
                    : 'text-[var(--text-primary)] hover:bg-[var(--hover)]'
                }`}>
                {item.label}
              </button>
            ))}

            <button
              onClick={handleLogout}
              className="text-left px-4 py-3 rounded-xl font-medium text-red-500 hover:bg-red-50 transition-colors">
              Выйти из аккаунта
            </button>
          </nav>
        </div>
      </aside>
      {/* Main content */}
      <div className="flex-grow">
        {activeTab === 'library' && <LibraryTab />}
        {activeTab === 'settings' && renderSettings()}
        {activeTab === 'subscription' && renderSubscription()}
        {activeTab === 'collective' && (
          <div className="apple-card p-12 text-center text-[var(--text-secondary)] animate-fadeInUp">
            У вас пока нет привязанных коллективов.
            <div className="mt-6">
              <button className="apple-button-secondary">Создать коллектив</button>
            </div>
          </div>
        )}
      </div>
      {showLogoutConfirm && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md"
          onClick={() => setShowLogoutConfirm(false)}>
          <div
            className="apple-card max-w-sm w-full p-6 shadow-2xl animate-fadeInUp"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true">
            <h3 className="text-xl font-bold tracking-tight mb-2 text-[var(--text-primary)]">
              Выход из аккаунта
            </h3>
            <p className="text-sm text-[var(--text-secondary)] mb-6">
              Вы уверены, что хотите выйти?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 px-4 py-3 rounded-xl font-medium text-[var(--text-primary)] bg-[var(--hover)] hover:opacity-80 transition-opacity">
                Отмена
              </button>
              <button
                onClick={confirmLogout}
                className="flex-1 px-4 py-3 rounded-xl font-medium text-white bg-red-500 hover:bg-red-600 transition-colors">
                Выйти
              </button>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}
