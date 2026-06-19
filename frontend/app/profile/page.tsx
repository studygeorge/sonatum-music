'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '../lib/api';
import { authStorage } from '../lib/auth';
import { ShimmerButton } from '../components/ShimmerButton';
import LibraryTab from './LibraryTab';
import PersonalUploadsTab from './PersonalUploadsTab';
import { usePlayer } from '../context/PlayerContext';
import ImageCropper from '../components/ImageCropper';

import { toast } from '@/app/components/Toast';
export default function ProfilePage() {
  const router = useRouter();
  const { isCollapsed: playerCollapsed } = usePlayer();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('library');
  const [saving, setSaving] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [nameValue, setNameValue] = useState('');
  // Интересы / о себе
  const [bioValue, setBioValue] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [regionId, setRegionId] = useState('');
  const [favoriteGenres, setFavoriteGenres] = useState<string[]>([]);
  const [favoriteEras, setFavoriteEras] = useState<string[]>([]);
  const [regions, setRegions] = useState<Array<{ id: string; name: string }>>([]);
  const [allGenres, setAllGenres] = useState<string[]>([]);
  const [savingInterests, setSavingInterests] = useState(false);
  const [eduInfo, setEduInfo] = useState<{ institution: any; myRole: string } | null>(null);
  const ERAS_OPTIONS = ['Средневековье', 'Возрождение', 'Барокко', 'Классицизм', 'Романтизм', 'XX век', 'Современность'];

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

    // Подгружаем регионы и жанры для селекторов интересов
    fetch('/api/regions').then(r => r.json()).then(j => {
      if (j.success && Array.isArray(j.data)) setRegions(j.data.map((r: any) => ({ id: r.id, name: r.name })));
    }).catch(() => {});
    fetch('/api/genres').then(r => r.json()).then(j => {
      if (j.success && Array.isArray(j.data)) setAllGenres(j.data.map((g: any) => g.name).sort((a: string, b: string) => a.localeCompare(b, 'ru')));
    }).catch(() => {});

    // Then refresh from API
    api.getMe().then(async (res) => {
      if (res.success && res.data) {
        const u = res.data;
        authStorage.setUser(u);
        setUser(u);
        setNameValue(u.firstName ? `${u.firstName} ${u.lastName || ''}`.trim() : u.username || '');
        setBioValue(u.bio || '');
        setBirthDate(u.birthDate ? String(u.birthDate).slice(0, 10) : '');
        setRegionId(u.regionId || '');
        setFavoriteGenres(Array.isArray(u.favoriteGenres) ? u.favoriteGenres : []);
        setFavoriteEras(Array.isArray(u.favoriteEras) ? u.favoriteEras : []);

        // === АВТО-ПЕРЕНАПРАВЛЕНИЕ В КАБИНЕТ ПО РОЛИ ===
        if (u.role === 'ARTIST') {
          router.replace('/author');
          return;
        }
        // Подгружаем привязку к учебному заведению — НЕ редиректим,
        // показываем баннер в /profile, чтобы обычный функционал оставался доступен.
        try {
          const r = await fetch('/api/edu/me', {
            headers: { Authorization: `Bearer ${token}` },
          });
          const j = await r.json();
          if (j.success && j.institution && j.myRole) {
            setEduInfo({ institution: j.institution, myRole: j.myRole });
          }
        } catch {}
      } else {
        authStorage.clear();
        setUser(null);
      }
      setLoading(false);
    });
  }, []);

  const handleLogout = async () => {
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
  // Кадрирование аватара
  const [avatarCropSrc, setAvatarCropSrc] = useState<string | null>(null);
  const [avatarCropOpen, setAvatarCropOpen] = useState(false);

  // Шаг 1 — пользователь выбрал файл → показываем кроп
  const handleAvatarUpload = (file: File | null) => {
    if (!file || !user) return;
    if (file.size > 10 * 1024 * 1024) { toast.error('Файл больше 10 МБ'); return; }
    const url = URL.createObjectURL(file);
    setAvatarCropSrc(url);
    setAvatarCropOpen(true);
  };

  // Шаг 2 — пришёл blob из кроппера → загружаем
  const uploadAvatarCropped = async (blob: Blob) => {
    setAvatarCropOpen(false);
    if (avatarCropSrc) { try { URL.revokeObjectURL(avatarCropSrc); } catch {} }
    setAvatarCropSrc(null);
    if (!user) return;
    setAvatarUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', new File([blob], 'avatar.jpg', { type: 'image/jpeg' }));
      fd.append('userSlug', user.username || user.id || 'user');
      const ur = await fetch('/api/upload/avatar', { method: 'POST', body: fd });
      const uj = await ur.json();
      const avatarUrl = uj?.data?.avatarUrl || uj?.avatarUrl || uj?.url;
      if (!uj.success || !avatarUrl) {
        console.error('Avatar upload failed', uj);
        return;
      }
      const token = authStorage.getToken();
      const r = await fetch('/api/users/me/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
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

  const cancelAvatarCrop = () => {
    setAvatarCropOpen(false);
    if (avatarCropSrc) { try { URL.revokeObjectURL(avatarCropSrc); } catch {} }
    setAvatarCropSrc(null);
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

  const handleSubscribe = async (tier: 'PREMIUM' | 'STUDENT') => {
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
      // Студент без верификации — тихо переводим на вкладку подачи документов
      if (json?.code === 'STUDENT_NOT_VERIFIED') {
        setActiveTab('student-verify');
        return;
      }
      toast.error(json.error || 'Не удалось перейти к оплате');
    } catch (e) {
      console.error(e);
      toast.error('Ошибка сети');
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
      <main className={`min-h-[50vh] md:min-h-screen flex items-start md:items-center justify-center px-6 md:pt-0 transition-[padding] duration-500 ${playerCollapsed ? 'pt-6' : 'pt-24'}`}>
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

      {/* О себе */}
      <div className="apple-card p-6 md:p-8">
        <h2 className="text-2xl font-bold mb-2">О себе</h2>
        <p className="text-sm text-[var(--text-secondary)] mb-6">Расскажите немного о себе — это помогает нам подбирать рекомендации.</p>
        <div className="space-y-4 max-w-md">
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Краткое био</label>
            <textarea
              value={bioValue}
              onChange={(e) => setBioValue(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Чем увлекаетесь, кем работаете, любимая эпоха…"
              className="w-full p-3 rounded-xl border border-[var(--border)] bg-[var(--background)] focus:bg-white outline-none focus:ring-2 focus:ring-[var(--accent)] text-sm"
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Дата рождения</label>
              <input
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className="w-full p-3 rounded-xl border border-[var(--border)] bg-[var(--background)] focus:bg-white outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Регион</label>
              <select
                value={regionId}
                onChange={(e) => setRegionId(e.target.value)}
                className="w-full p-3 rounded-xl border border-[var(--border)] bg-[var(--background)] focus:bg-white outline-none text-sm">
                <option value="">— не указан —</option>
                {regions.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Уведомления */}
      <NotificationsSection />

      {/* Безопасность */}
      <SecuritySection user={user} />

      {/* Музыкальные интересы */}
      <div className="apple-card p-6 md:p-8">
        <h2 className="text-2xl font-bold mb-2">Музыкальные интересы</h2>
        <p className="text-sm text-[var(--text-secondary)] mb-6">Любимые жанры и эпохи — для подбора рекомендаций и афиш.</p>

        <div className="mb-6">
          <div className="text-sm font-medium text-[var(--text-secondary)] mb-2">Жанры</div>
          <div className="flex flex-wrap gap-2">
            {allGenres.map((g) => {
              const active = favoriteGenres.includes(g);
              return (
                <button
                  key={g}
                  type="button"
                  onClick={() => setFavoriteGenres(active ? favoriteGenres.filter(x => x !== g) : [...favoriteGenres, g])}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    active ? 'bg-[var(--text-primary)] text-white' : 'bg-[var(--hover)] text-[var(--text-primary)] hover:bg-gray-200'
                  }`}>
                  {g}
                </button>
              );
            })}
            {allGenres.length === 0 && (
              <div className="text-xs text-[var(--text-secondary)]">Загружаем жанры…</div>
            )}
          </div>
        </div>

        <div className="mb-6">
          <div className="text-sm font-medium text-[var(--text-secondary)] mb-2">Эпохи</div>
          <div className="flex flex-wrap gap-2">
            {ERAS_OPTIONS.map((e) => {
              const active = favoriteEras.includes(e);
              return (
                <button
                  key={e}
                  type="button"
                  onClick={() => setFavoriteEras(active ? favoriteEras.filter(x => x !== e) : [...favoriteEras, e])}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    active ? 'bg-[var(--text-primary)] text-white' : 'bg-[var(--hover)] text-[var(--text-primary)] hover:bg-gray-200'
                  }`}>
                  {e}
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          disabled={savingInterests}
          onClick={async () => {
            setSavingInterests(true);
            try {
              const r = await fetch('/api/users/me/preferences', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStorage.getToken()}` },
                body: JSON.stringify({
                  bio: bioValue,
                  birthDate: birthDate || null,
                  regionId: regionId || null,
                  favoriteGenres,
                  favoriteEras,
                }),
              });
              const j = await r.json();
              if (j.success) {
                const updated = { ...user, ...j.data };
                setUser(updated);
                authStorage.setUser(updated);
                toast.error('Сохранено');
              } else {
                toast.error(j.error || 'Ошибка');
              }
            } catch (e: any) {
              toast.error(e?.message || 'Ошибка');
            } finally {
              setSavingInterests(false);
            }
          }}
          className="apple-button">
          {savingInterests ? 'Сохраняем…' : 'Сохранить'}
        </button>
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

      {/* Уведомления (рассылки) */}
      <NotificationSettings />

      {/* Безопасность — двухфакторная аутентификация */}
      <TwoFactorSettings />
    </div>
  );

  const renderSubscription = () => {
    const subStatus = user?.subscription?.status;
    const subTier = user?.subscription?.tier;
    // Tier учитывается только если подписка активна; иначе считаем FREE.
    const currentTier = (subStatus === 'ACTIVE' && subTier && subTier !== 'FREE') ? subTier : 'FREE';
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

    // PENDING-подписки игнорируем — показываем юзеру обычные тарифы Premium/Студенческий.
    const planTitle = currentTier === 'FREE'
      ? 'Freemium'
      : `Sonatum ${currentTier === 'STUDENT' ? 'Студент' : currentTier}`;
    const planDesc = hasActivePaid && daysLeft !== null
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
        {/* === Freemium: «Преимущества Premium» + 2 кнопки апсейла === */}
        {currentTier === 'FREE' && (
          <div className="apple-card p-6 md:p-8">
            <h3 className="text-xl font-bold mb-3">Преимущества Premium</h3>
            <ul className="grid sm:grid-cols-2 gap-2 mb-6 text-sm text-[var(--text-primary)]">
              <li className="flex items-start gap-2"><span>✓</span>Без рекламы, фоновое прослушивание</li>
              <li className="flex items-start gap-2"><span>✓</span>Высокое качество (320 kbps / FLAC)</li>
              <li className="flex items-start gap-2"><span>✓</span>Полные ноты PDF и тексты</li>
              <li className="flex items-start gap-2"><span>✓</span>Безлимит плейлистов и вся история</li>
              <li className="flex items-start gap-2"><span>✓</span>Комментарии под треками</li>
              <li className="flex items-start gap-2"><span>✓</span>Загрузка своей музыки в библиотеку</li>
            </ul>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleSubscribe('PREMIUM')}
                disabled={upgrading}
                className="px-5 py-2.5 rounded-full bg-[var(--text-primary)] text-white text-sm font-semibold disabled:opacity-60">
                {upgrading ? 'Открываем оплату…' : 'Подключить Premium за 299 ₽/мес'}
              </button>
              <button
                onClick={() => handleSubscribe('STUDENT')}
                disabled={upgrading}
                className="px-5 py-2.5 rounded-full bg-white border border-[var(--text-primary)] text-[var(--text-primary)] text-sm font-semibold hover:bg-[var(--hover)] transition-colors disabled:opacity-60">
                {upgrading ? 'Открываем оплату…' : 'Подключить студенческий за 149 ₽/мес'}
              </button>
            </div>
          </div>
        )}

        {/* === Premium === */}
        {currentTier === 'PREMIUM' && (
          <div className="apple-card p-6 md:p-8">
            <h3 className="text-xl font-bold mb-1">Sonatum Premium</h3>
            <p className="text-sm text-[var(--text-secondary)] mb-5">
              {hasActivePaid && daysLeft !== null && endDateRaw
                ? `Активна · осталось ${formatDays(daysLeft)} (до ${new Date(endDateRaw).toLocaleDateString('ru-RU')})`
                : '—'}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => toast.error('Чтобы отменить подписку, напишите на support@sonatum-music.ru — мы вернём остаток средств за неиспользованный период.')}
                className="px-5 py-2.5 rounded-full bg-white border border-black text-black text-sm font-medium">
                Отменить подписку
              </button>
              <button
                onClick={() => setActiveTab('purchases')}
                className="px-5 py-2.5 rounded-full bg-white border border-[var(--border)] text-black text-sm font-medium">
                История платежей
              </button>
            </div>
          </div>
        )}

        {/* === Студенческий === */}
        {currentTier === 'STUDENT' && (
          <div className="apple-card p-6 md:p-8">
            <h3 className="text-xl font-bold mb-1">Студенческий тариф</h3>
            <p className="text-sm text-[var(--text-secondary)] mb-5">
              {hasActivePaid && daysLeft !== null && endDateRaw
                ? `Активен · осталось ${formatDays(daysLeft)} (до ${new Date(endDateRaw).toLocaleDateString('ru-RU')})`
                : '—'}
            </p>
            <div className="flex flex-wrap gap-2 mb-4">
              <button
                onClick={() => handleSubscribe('PREMIUM')}
                className="px-5 py-2.5 rounded-full bg-[var(--text-primary)] text-white text-sm font-medium">
                Продлить подписку
              </button>
              <button
                onClick={() => setActiveTab('student-verify')}
                className="px-5 py-2.5 rounded-full bg-white border border-[var(--border)] text-black text-sm font-medium">
                Подтвердить статус заново
              </button>
            </div>
            <div className="text-xs text-[var(--text-secondary)] rounded-xl p-3 bg-[var(--hover)]">
              ⓘ Студенческий тариф требует подтверждения статуса каждый год. За 30 дней до окончания мы напомним.
            </div>
          </div>
        )}

        {/* блок «Платёж ожидает» удалён по требованию — pending-подписка не показывается */}
      </div>
    );
  };

  // ─── Authenticated layout ────────────────────────────────────────────────────
  return (
    <main className="min-h-screen pt-0 md:pt-16 pb-12 px-6 md:px-12 max-w-6xl mx-auto flex flex-col md:flex-row gap-12">
      {/* Sidebar */}
      <aside className="w-full md:w-64 shrink-0">
        <div className="sticky top-20">
          {/* Баннер EDU — если пользователь привязан к учебному заведению */}
          {eduInfo && (
            <Link
              href="/edu"
              className="block mb-5 p-4 rounded-2xl text-white relative overflow-hidden hover:scale-[1.02] transition-transform"
              style={{ background: 'linear-gradient(135deg, #1d4cb8 0%, #6d28d9 100%)' }}>
              <div className="text-[10px] uppercase tracking-widest font-semibold opacity-90">
                {eduInfo.myRole === 'ADMIN' ? 'Администратор' : eduInfo.myRole === 'TEACHER' ? 'Преподаватель' : 'Учащийся'}
              </div>
              <div className="font-bold text-sm mt-1 truncate">
                {eduInfo.institution?.name || 'Учебное заведение'}
              </div>
              <div className="text-xs opacity-85 mt-2">Открыть EDU →</div>
            </Link>
          )}

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
              { id: 'history', label: 'История' },
              { id: 'purchases', label: 'Покупки' },
              // «Мои загрузки» — только для Premium / Student (ТЗ: загрузка музыки = Premium-фича)
              ...(user.isPremium || user.subscription?.tier === 'PREMIUM' || user.subscription?.tier === 'STUDENT'
                ? [{ id: 'uploads', label: 'Мои загрузки' }]
                : []),
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
              className="text-left px-4 py-3 rounded-xl font-medium text-[var(--text-primary)] hover:bg-[var(--hover)] transition-colors">
              Выйти из аккаунта
            </button>
          </nav>
        </div>
      </aside>
      {/* Main content */}
      <div className="flex-grow">
        {activeTab === 'library' && <LibraryTab />}
        {activeTab === 'uploads' && <PersonalUploadsTab user={user} />}
        {activeTab === 'settings' && renderSettings()}
        {activeTab === 'subscription' && renderSubscription()}
        {activeTab === 'student-verify' && <StudentVerifyTab />}
        {activeTab === 'purchases' && <PurchasesTab />}
        {activeTab === 'history' && <HistoryTab />}
        {activeTab === 'collective' && (
          <div className="apple-card p-12 text-center text-[var(--text-secondary)] animate-fadeInUp">
            У вас пока нет привязанных коллективов.
            <div className="mt-6">
              <button className="apple-button-secondary">Создать коллектив</button>
            </div>
          </div>
        )}
      </div>

      <ImageCropper
        open={avatarCropOpen && !!avatarCropSrc}
        imageUrl={avatarCropSrc || ''}
        aspect={1}
        cropShape="round"
        title="Фото профиля"
        onCancel={cancelAvatarCrop}
        onCropped={uploadAvatarCropped}
      />
    </main>
  );
}

const NOTIF_LABELS: Record<string, { title: string; hint: string }> = {
  newReleases: { title: 'Новые релизы любимых авторов', hint: 'Когда автор, на которого вы подписаны, публикует трек или альбом' },
  recommendations: { title: 'Персональные рекомендации', hint: 'Подборки на основе ваших прослушиваний и лайков' },
  replies: { title: 'Ответы на мои комментарии', hint: 'Когда кто-то отвечает в обсуждении трека' },
  events: { title: 'Афиша рядом', hint: 'События в вашем регионе и от любимых авторов' },
  marketing: { title: 'Маркетинговые рассылки', hint: 'Скидки на Premium, новости платформы' },
};

function NotificationSettings() {
  const [prefs, setPrefs] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  useEffect(() => {
    const token = authStorage.getToken();
    if (!token) { setLoading(false); return; }
    fetch('/api/users/me/notifications', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((j) => { if (j.success) setPrefs(j.data || {}); })
      .finally(() => setLoading(false));
  }, []);

  const save = async (next: Record<string, boolean>) => {
    setSaving(true);
    setBanner(null);
    try {
      const token = authStorage.getToken();
      const r = await fetch('/api/users/me/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(next),
      });
      const j = await r.json();
      if (j.success) {
        setPrefs(j.data);
        setBanner('Сохранено');
        setTimeout(() => setBanner(null), 1500);
      }
    } finally { setSaving(false); }
  };

  const toggle = (key: string) => {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    save(next);
  };

  if (loading) {
    return (
      <div className="apple-card p-6 md:p-8 text-sm text-[var(--text-secondary)]">Загрузка настроек уведомлений…</div>
    );
  }

  return (
    <div className="apple-card p-6 md:p-8">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-2xl font-bold">Уведомления</h2>
        {banner && <span className="text-xs text-[var(--text-secondary)]">{banner}</span>}
      </div>
      <p className="text-sm text-[var(--text-secondary)] mb-5">
        Что присылать вам на почту и показывать как уведомления в кабинете.
      </p>
      <div className="space-y-3">
        {Object.entries(NOTIF_LABELS).map(([key, info]) => (
          <label key={key} className="flex items-start gap-4 cursor-pointer p-3 rounded-xl hover:bg-[var(--hover)]">
            <div className="relative shrink-0 mt-0.5">
              <input
                type="checkbox"
                checked={!!prefs[key]}
                disabled={saving}
                onChange={() => toggle(key)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--text-primary)]"></div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm text-[var(--text-primary)]">{info.title}</div>
              <div className="text-xs text-[var(--text-secondary)] mt-0.5 leading-snug">{info.hint}</div>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}

/**
 * Двухфакторная аутентификация — UI настройки.
 * Поток:
 *  1) Кнопка "Включить" → POST /setup → получаем secret + otpauthUrl + backupCodes
 *  2) Показываем QR (генерим из otpauthUrl через сторонний сервис) + код для ручного ввода + backup-коды
 *  3) Пользователь вводит код из приложения → POST /verify-setup → 2FA активирована
 *  4) Кнопка "Отключить" → запрашиваем пароль и код → DELETE /setup
 */
function TwoFactorSettings() {
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [backupRemaining, setBackupRemaining] = useState(0);

  const [setupMode, setSetupMode] = useState<null | 'show' | 'verify'>(null);
  const [secret, setSecret] = useState('');
  const [otpauthUrl, setOtpauthUrl] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Disable mode
  const [disableMode, setDisableMode] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [disableCode, setDisableCode] = useState('');

  const token = () => authStorage.getToken() || '';

  const load = () => {
    setLoading(true);
    fetch('/api/auth/2fa/setup', { headers: { Authorization: `Bearer ${token()}` } })
      .then((r) => r.json())
      .then((j) => {
        if (j.success) {
          setEnabled(!!j.data.enabled);
          setBackupRemaining(j.data.backupCodesRemaining || 0);
        }
      })
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const startSetup = async () => {
    setError(null);
    setBusy(true);
    try {
      const r = await fetch('/api/auth/2fa/setup', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}` },
      });
      const j = await r.json();
      if (j.success) {
        setSecret(j.data.secret);
        setOtpauthUrl(j.data.otpauthUrl);
        setBackupCodes(j.data.backupCodes);
        setSetupMode('show');
      } else {
        setError(j.error || 'Ошибка');
      }
    } finally { setBusy(false); }
  };

  const verifyCode = async () => {
    setError(null);
    if (!/^\d{6}$/.test(code.trim())) {
      setError('Код должен быть из 6 цифр');
      return;
    }
    setBusy(true);
    try {
      const r = await fetch('/api/auth/2fa/verify-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ code: code.trim() }),
      });
      const j = await r.json();
      if (j.success) {
        setBanner('2FA активирована');
        setSetupMode(null);
        setSecret(''); setOtpauthUrl(''); setBackupCodes([]); setCode('');
        load();
      } else {
        setError(j.error || 'Неверный код');
      }
    } finally { setBusy(false); }
  };

  const disable = async () => {
    setError(null);
    if (!disablePassword) { setError('Введите пароль'); return; }
    setBusy(true);
    try {
      const r = await fetch('/api/auth/2fa/setup', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ password: disablePassword, code: disableCode.trim() || undefined }),
      });
      const j = await r.json();
      if (j.success) {
        setBanner('2FA отключена');
        setDisableMode(false);
        setDisablePassword(''); setDisableCode('');
        load();
      } else {
        setError(j.error || 'Ошибка');
      }
    } finally { setBusy(false); }
  };

  const copyToClipboard = async (text: string, msg = 'Скопировано') => {
    try { await navigator.clipboard.writeText(text); setBanner(msg); setTimeout(() => setBanner(null), 1500); } catch {}
  };

  const qrSrc = otpauthUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpauthUrl)}`
    : '';

  if (loading) {
    return <div className="apple-card p-6 md:p-8 text-sm text-[var(--text-secondary)]">Загрузка настроек 2FA…</div>;
  }

  return (
    <div className="apple-card p-6 md:p-8">
      <div className="flex items-center justify-between mb-1 gap-3 flex-wrap">
        <h2 className="text-2xl font-bold">Двухфакторная аутентификация</h2>
        {banner && <span className="text-xs text-[var(--text-secondary)]">{banner}</span>}
      </div>
      <p className="text-sm text-[var(--text-secondary)] mb-5">
        Дополнительный код из приложения (Google Authenticator, Authy, Яндекс.Ключ) при каждом входе.
      </p>

      {error && <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>}

      {enabled && !setupMode && !disableMode && (
        <div className="space-y-3">
          <div className="p-4 rounded-2xl border border-black bg-black/[0.02]">
            <div className="flex items-center gap-2 text-sm font-semibold mb-1">
              <span>✓ 2FA включена</span>
            </div>
            <div className="text-xs text-[var(--text-secondary)]">
              Осталось {backupRemaining} backup-кодов из 8. Если потеряли доступ к приложению — используйте один из них.
            </div>
          </div>
          <button onClick={() => setDisableMode(true)}
            className="px-5 py-2.5 rounded-full bg-white border border-black text-black text-sm font-medium hover:bg-gray-100">
            Отключить 2FA
          </button>
        </div>
      )}

      {!enabled && !setupMode && (
        <button onClick={startSetup} disabled={busy}
          className="px-5 py-2.5 rounded-full bg-[var(--text-primary)] text-white text-sm font-medium disabled:opacity-60">
          {busy ? 'Подготавливаем…' : 'Включить 2FA'}
        </button>
      )}

      {setupMode === 'show' && (
        <div className="space-y-5">
          <div className="grid sm:grid-cols-[200px_1fr] gap-5 items-start">
            <img src={qrSrc} alt="QR" className="w-[200px] h-[200px] border border-[var(--border)] rounded-xl bg-white" />
            <div className="space-y-3 text-sm">
              <div>
                <div className="font-bold mb-1">1. Откройте приложение-аутентификатор</div>
                <div className="text-[var(--text-secondary)] text-xs">Google Authenticator, Authy, Яндекс.Ключ, 1Password — любой</div>
              </div>
              <div>
                <div className="font-bold mb-1">2. Отсканируйте QR или введите код вручную</div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 rounded-lg bg-[var(--hover)] font-mono text-xs break-all">{secret}</code>
                  <button onClick={() => copyToClipboard(secret, 'Секрет скопирован')}
                    className="px-3 py-2 rounded-lg bg-white border border-[var(--border)] text-xs font-semibold">
                    Скопировать
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Backup-коды */}
          <div className="rounded-2xl border-2 border-black p-4 bg-[var(--hover)]">
            <div className="flex items-center justify-between mb-2">
              <div className="font-bold text-sm">3. Сохраните backup-коды</div>
              <button onClick={() => copyToClipboard(backupCodes.join('\n'), 'Все коды скопированы')}
                className="px-3 py-1.5 rounded-full bg-black text-white text-xs font-semibold">
                Скопировать все
              </button>
            </div>
            <div className="text-xs text-[var(--text-secondary)] mb-3">
              <b>Важно:</b> сохраните их в надёжном месте. Каждый код можно использовать ОДИН раз вместо TOTP-кода (если потеряли телефон).
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-sm">
              {backupCodes.map((c) => (
                <code key={c} className="px-3 py-2 rounded-lg bg-white border border-[var(--border)] text-center">{c}</code>
              ))}
            </div>
          </div>

          {/* Подтверждение */}
          <div>
            <div className="font-bold text-sm mb-2">4. Введите код из приложения для подтверждения</div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                className="px-4 py-2.5 rounded-xl bg-white border border-[var(--border)] focus:border-black focus:outline-none text-sm font-mono tracking-widest w-40 text-center"
              />
              <button onClick={verifyCode} disabled={busy || code.length !== 6}
                className="px-5 py-2.5 rounded-full bg-[var(--text-primary)] text-white text-sm font-medium disabled:opacity-60">
                {busy ? 'Проверяем…' : 'Подтвердить'}
              </button>
              <button onClick={() => { setSetupMode(null); setError(null); setCode(''); }}
                className="px-5 py-2.5 rounded-full bg-white border border-[var(--border)] text-black text-sm font-medium">
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {disableMode && (
        <div className="space-y-3">
          <p className="text-sm">Для отключения двухфакторной аутентификации введите пароль и (если доступно) текущий 6-значный код.</p>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1">Пароль</label>
            <input type="password" value={disablePassword} onChange={(e) => setDisablePassword(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[var(--border)] focus:border-black focus:outline-none text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1">Код из приложения (опционально)</label>
            <input type="text" inputMode="numeric" maxLength={6} value={disableCode}
              onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              className="px-3.5 py-2.5 rounded-xl bg-white border border-[var(--border)] focus:border-black focus:outline-none text-sm font-mono tracking-widest w-40 text-center" />
          </div>
          <div className="flex gap-2">
            <button onClick={disable} disabled={busy}
              className="px-5 py-2.5 rounded-full bg-[var(--text-primary)] text-white text-sm font-medium disabled:opacity-60">
              {busy ? 'Отключаем…' : 'Отключить 2FA'}
            </button>
            <button onClick={() => { setDisableMode(false); setDisablePassword(''); setDisableCode(''); setError(null); }}
              className="px-5 py-2.5 rounded-full bg-white border border-[var(--border)] text-black text-sm font-medium">
              Отмена
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const VERIFY_STATUS_LABEL: Record<string, { l: string; c: string }> = {
  PENDING: { l: 'На проверке', c: 'bg-gray-200 text-gray-900' },
  APPROVED: { l: 'Одобрено', c: 'bg-black text-white' },
  REJECTED: { l: 'Отклонено', c: 'bg-white text-black border-2 border-black' },
};

function StudentVerifyTab() {
  const [last, setLast] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [institution, setInstitution] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [buyingStudent, setBuyingStudent] = useState(false);

  const token = () => authStorage.getToken() || '';

  const isApproved = last?.status === 'APPROVED' && last?.expiresAt && new Date(last.expiresAt) > new Date();

  const buyStudent = async () => {
    setBuyingStudent(true);
    try {
      const r = await fetch('/api/payments/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ tier: 'STUDENT' }),
      });
      const j = await r.json();
      if (j.success && j.paymentUrl) {
        window.location.href = j.paymentUrl;
        return;
      }
      toast.error(j.error || 'Не удалось перейти к оплате');
    } finally { setBuyingStudent(false); }
  };

  const load = () => {
    setLoading(true);
    fetch('/api/subscriptions/verify-student', { headers: { Authorization: `Bearer ${token()}` } })
      .then((r) => r.json())
      .then((j) => { if (j.success) setLast(j.data); })
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBanner(null);
    if (!file) { setError('Выберите файл документа'); return; }
    if (!institution.trim()) { setError('Укажите название учебного заведения'); return; }
    if (file.size > 5 * 1024 * 1024) { setError('Файл больше 5 МБ'); return; }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('document', file);
      fd.append('institution', institution.trim());
      const r = await fetch('/api/subscriptions/verify-student', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}` },
        body: fd,
      });
      const j = await r.json();
      if (j.success) {
        setBanner(j.data?.message || 'Документы отправлены на проверку');
        setInstitution(''); setFile(null);
        load();
      } else setError(j.error || 'Ошибка');
    } finally { setSubmitting(false); }
  };

  if (loading) return <div className="apple-card p-10 text-center text-sm text-[var(--text-secondary)]">Загрузка…</div>;

  return (
    <div className="space-y-6 animate-fadeInUp">
      <div>
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">Студенческий статус</h2>
        <p className="text-[var(--text-secondary)]">
          {isApproved
            ? 'Ваш статус подтверждён. Можно оформить подписку Premium по студенческой цене 149 ₽/мес.'
            : 'Подтвердите, что вы учитесь — и получите подписку Premium за 149 ₽/мес вместо 299 ₽.'}
        </p>
      </div>

      {/* Баннер CTA — статус одобрен, можно покупать */}
      {isApproved && (
        <div className="apple-card p-6 md:p-8 bg-[var(--text-primary)] text-white">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-widest opacity-80 mb-1">Статус подтверждён</div>
              <h3 className="text-xl md:text-2xl font-bold">Premium для студентов — 149 ₽/мес</h3>
              <p className="text-sm opacity-85 mt-1">
                Скидка 50% от Premium (299 ₽). Действует до {new Date(last.expiresAt).toLocaleDateString('ru-RU')}.
              </p>
            </div>
            <button
              onClick={buyStudent}
              disabled={buyingStudent}
              className="px-6 py-3 rounded-full bg-white text-[var(--text-primary)] font-semibold text-sm whitespace-nowrap hover:opacity-90 disabled:opacity-60">
              {buyingStudent ? 'Открываем оплату…' : 'Оформить за 149 ₽'}
            </button>
          </div>
        </div>
      )}

      {banner && <div className="apple-card p-4 text-sm">{banner}</div>}
      {error && <div className="apple-card p-4 text-sm border border-black">{error}</div>}

      {last && (
        <div className="apple-card p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold">Последняя заявка</h3>
            <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${VERIFY_STATUS_LABEL[last.status]?.c}`}>
              {VERIFY_STATUS_LABEL[last.status]?.l || last.status}
            </span>
          </div>
          <dl className="text-sm space-y-1">
            <div className="flex justify-between"><dt className="text-[var(--text-secondary)]">Учреждение</dt><dd>{last.institution}</dd></div>
            <div className="flex justify-between"><dt className="text-[var(--text-secondary)]">Документ</dt><dd><a href={last.documentUrl} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] underline">Открыть</a></dd></div>
            <div className="flex justify-between"><dt className="text-[var(--text-secondary)]">Подано</dt><dd>{new Date(last.createdAt).toLocaleString('ru-RU')}</dd></div>
            {last.expiresAt && <div className="flex justify-between"><dt className="text-[var(--text-secondary)]">Действует до</dt><dd>{new Date(last.expiresAt).toLocaleDateString('ru-RU')}</dd></div>}
            {last.adminNote && <div className="mt-2 p-3 rounded-lg bg-[var(--hover)] text-xs">{last.adminNote}</div>}
          </dl>
        </div>
      )}

      <form onSubmit={submit} className="apple-card p-6 md:p-8 space-y-4">
        <h3 className="text-xl font-bold">
          {last?.status === 'PENDING' ? 'Подать новую заявку' : 'Загрузить документ'}
        </h3>
        <p className="text-sm text-[var(--text-secondary)]">
          Скан или фото студенческого билета, справки из учебного заведения, либо страница приложения «Госуслуги».
          Форматы: JPG, PNG, PDF. До 5 МБ. Проверка до 24 часов.
        </p>
        <div>
          <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
            Учебное заведение
          </label>
          <input
            type="text"
            value={institution}
            onChange={(e) => setInstitution(e.target.value)}
            placeholder="Напр.: МГК им. П.И. Чайковского"
            required
            className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[var(--border)] focus:border-black focus:outline-none text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
            Документ
          </label>
          <input
            type="file"
            accept="image/jpeg,image/jpg,image/png,application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="block w-full text-sm text-[var(--text-secondary)] file:mr-3 file:px-4 file:py-2 file:rounded-full file:border-0 file:bg-[var(--text-primary)] file:text-white file:font-semibold file:text-xs hover:file:opacity-90 cursor-pointer"
          />
          {file && (
            <div className="text-xs text-[var(--text-secondary)] mt-1.5">
              {file.name} · {(file.size / 1024 / 1024).toFixed(1)} МБ
            </div>
          )}
        </div>
        <button type="submit" disabled={submitting || !file}
          className="px-5 py-2.5 rounded-full bg-[var(--text-primary)] text-white text-sm font-medium disabled:opacity-60">
          {submitting ? 'Отправляем…' : 'Отправить на проверку'}
        </button>
      </form>
    </div>
  );
}

const PURCHASE_STATUS_LABEL: Record<string, string> = {
  PAID: 'Оплачено',
  PENDING: 'Ожидает',
  AWAITING_MANAGER: 'У менеджера',
  EXCLUSIVE_REQUESTED: 'Запрос эксклюзив',
  REFUNDED: 'Возврат',
};

function PurchasesTab() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);

  const token = () => authStorage.getToken() || '';
  useEffect(() => {
    fetch('/api/users/me/purchases', { headers: { Authorization: `Bearer ${token()}` } })
      .then((r) => r.json())
      .then((j) => { if (j.success) setItems(j.data || []); })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6 animate-fadeInUp">
      <div>
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">Покупки</h2>
        <p className="text-[var(--text-secondary)]">Купленные треки, лицензии, история подписок и донаты.</p>
      </div>
      {loading ? (
        <div className="apple-card p-10 text-center text-sm text-[var(--text-secondary)]">Загрузка…</div>
      ) : items.length === 0 ? (
        <div className="apple-card p-10 text-center text-sm text-[var(--text-secondary)]">У вас пока нет покупок.</div>
      ) : (
        <div className="apple-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[var(--text-secondary)] text-xs border-b border-[var(--border)]">
                <th className="p-3 font-medium">Тип</th>
                <th className="p-3 font-medium">Объект</th>
                <th className="p-3 font-medium text-right">Сумма</th>
                <th className="p-3 font-medium">Статус</th>
                <th className="p-3 font-medium text-right">Дата</th>
                <th className="p-3 font-medium text-right">Чек</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id} className="border-b border-[var(--border)] last:border-0 hover:bg-black/[0.02]">
                  <td className="p-3 text-xs">
                    <span className="px-2 py-0.5 rounded-full bg-[var(--hover)]">{p.kind}</span>
                  </td>
                  <td className="p-3">
                    <div className="font-medium truncate max-w-[260px]">{p.subject}</div>
                    {p.detail && <div className="text-xs text-[var(--text-secondary)]">{p.detail}</div>}
                  </td>
                  <td className="p-3 text-right tabular-nums font-medium">{Math.round(p.amount).toLocaleString('ru-RU')} ₽</td>
                  <td className="p-3 text-xs">{PURCHASE_STATUS_LABEL[p.status] || p.status}</td>
                  <td className="p-3 text-right text-xs text-[var(--text-secondary)] whitespace-nowrap">
                    {new Date(p.paidAt || p.createdAt).toLocaleDateString('ru-RU')}
                  </td>
                  <td className="p-3 text-right">
                    {p.receiptUrl ? (
                      <a href={p.receiptUrl} target="_blank" rel="noopener noreferrer" className="text-xs underline">PDF</a>
                    ) : (
                      <span className="text-xs text-[var(--text-secondary)]">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}


function HistoryTab() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const { playTrack } = usePlayer();

  const load = () => {
    setLoading(true);
    fetch('/api/users/me/history?limit=200', {
      headers: { Authorization: `Bearer ${authStorage.getToken()}` },
    })
      .then((r) => r.json())
      .then((j) => { if (j.success) setItems(j.data || []); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const clearAll = async () => {
    if (!confirm('Очистить всю историю прослушиваний?')) return;
    setClearing(true);
    try {
      const r = await fetch('/api/users/me/history', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authStorage.getToken()}` },
      });
      const j = await r.json();
      if (j.success) setItems([]);
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeInUp">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-2xl font-bold">История прослушиваний</h2>
        {items.length > 0 && (
          <button
            onClick={clearAll}
            disabled={clearing}
            className="px-4 py-2 rounded-full text-sm font-medium bg-[var(--hover)] hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-40">
            {clearing ? 'Очищаем…' : 'Очистить'}
          </button>
        )}
      </div>

      {loading ? (
        <div className="apple-card p-10 text-center text-[var(--text-secondary)]">Загрузка…</div>
      ) : items.length === 0 ? (
        <div className="apple-card p-10 text-center text-[var(--text-secondary)]">
          История пуста. Начните слушать музыку — здесь появятся ваши треки.
        </div>
      ) : (
        <div className="apple-card overflow-hidden">
          {items.map((h, i) => (
            <button
              key={h.id}
              onClick={() => {
                if (!h.track?.audioUrl) return;
                const list = items.filter((x) => x.track?.audioUrl).map((x) => x.track);
                const idx = list.findIndex((t) => t.id === h.track.id);
                playTrack(h.track, { tracks: list as any, index: idx >= 0 ? idx : i, source: 'history' });
              }}
              className="w-full flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--hover)] text-left">
              <div className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden shrink-0">
                {h.track?.cover && <img src={h.track.cover} alt="" className="w-full h-full object-cover" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{h.track?.title || '—'}</div>
                <div className="text-xs text-[var(--text-secondary)] truncate">{h.track?.artist?.name || ''}</div>
              </div>
              <div className="text-xs text-[var(--text-secondary)] whitespace-nowrap">
                {new Date(h.playedAt).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}


function SecuritySection({ user }: { user: any }) {
  const [newEmail, setNewEmail] = useState('');
  const [emailPass, setEmailPass] = useState('');
  const [emailMsg, setEmailMsg] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);

  const [curPass, setCurPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [newPass2, setNewPass2] = useState('');
  const [passMsg, setPassMsg] = useState('');
  const [passBusy, setPassBusy] = useState(false);

  const changeEmail = async () => {
    setEmailMsg(''); setEmailBusy(true);
    try {
      const r = await fetch('/api/auth/change-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStorage.getToken()}` },
        body: JSON.stringify({ newEmail, password: emailPass }),
      });
      const j = await r.json();
      setEmailMsg(j.success ? (j.message || 'Email изменён') : (j.error || 'Ошибка'));
      if (j.success) { setNewEmail(''); setEmailPass(''); }
    } finally { setEmailBusy(false); }
  };

  const changePassword = async () => {
    setPassMsg('');
    if (newPass.length < 8) { setPassMsg('Пароль ≥ 8 символов'); return; }
    if (newPass !== newPass2) { setPassMsg('Пароли не совпадают'); return; }
    setPassBusy(true);
    try {
      const r = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStorage.getToken()}` },
        body: JSON.stringify({ currentPassword: curPass, newPassword: newPass }),
      });
      const j = await r.json();
      setPassMsg(j.success ? 'Пароль изменён' : (j.error || 'Ошибка'));
      if (j.success) { setCurPass(''); setNewPass(''); setNewPass2(''); }
    } finally { setPassBusy(false); }
  };

  const resendVerify = async () => {
    const r = await fetch('/api/auth/send-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: user.email }),
    });
    const j = await r.json();
    toast.error(j.success ? 'Письмо отправлено' : (j.error || 'Ошибка'));
  };

  return (
    <div className="apple-card p-6 md:p-8">
      <h2 className="text-2xl font-bold mb-6">Безопасность</h2>

      {user.email && (
        <div className="mb-6 pb-6 border-b border-[var(--border)]">
          <div className="text-sm font-medium mb-1">Подтверждение email</div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs text-[var(--text-secondary)]">Текущий: <b>{user.email}</b></span>
            <button onClick={resendVerify} className="px-3 py-1.5 rounded-full text-xs bg-[var(--hover)] hover:bg-gray-200">
              Отправить письмо подтверждения
            </button>
          </div>
        </div>
      )}

      <div className="mb-6 pb-6 border-b border-[var(--border)]">
        <div className="text-sm font-medium mb-2">Сменить email</div>
        <div className="space-y-2 max-w-md">
          <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="Новый email" className="w-full p-2.5 rounded-xl border border-[var(--border)] text-sm" />
          <input type="password" value={emailPass} onChange={(e) => setEmailPass(e.target.value)} placeholder="Текущий пароль" className="w-full p-2.5 rounded-xl border border-[var(--border)] text-sm" />
          <button onClick={changeEmail} disabled={emailBusy || !newEmail || !emailPass} className="apple-button disabled:opacity-40">
            {emailBusy ? 'Меняем…' : 'Сменить email'}
          </button>
          {emailMsg && <div className="text-xs text-[var(--text-secondary)]">{emailMsg}</div>}
        </div>
      </div>

      <div>
        <div className="text-sm font-medium mb-2">Сменить пароль</div>
        <div className="space-y-2 max-w-md">
          <input type="password" value={curPass} onChange={(e) => setCurPass(e.target.value)} placeholder="Текущий пароль" className="w-full p-2.5 rounded-xl border border-[var(--border)] text-sm" />
          <input type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} placeholder="Новый пароль (≥ 8 симв.)" className="w-full p-2.5 rounded-xl border border-[var(--border)] text-sm" />
          <input type="password" value={newPass2} onChange={(e) => setNewPass2(e.target.value)} placeholder="Повторите новый пароль" className="w-full p-2.5 rounded-xl border border-[var(--border)] text-sm" />
          <button onClick={changePassword} disabled={passBusy || !curPass || !newPass} className="apple-button disabled:opacity-40">
            {passBusy ? 'Меняем…' : 'Сменить пароль'}
          </button>
          {passMsg && <div className="text-xs text-[var(--text-secondary)]">{passMsg}</div>}
        </div>
      </div>
    </div>
  );
}


function NotificationsSection() {
  const [settings, setSettings] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/users/me/notifications', {
      headers: { Authorization: `Bearer ${authStorage.getToken()}` },
    })
      .then((r) => r.json())
      .then((j) => { if (j.success) setSettings(j.data); })
      .catch(() => {});
  }, []);

  const toggle = async (key: string, value: boolean) => {
    setSettings((s: any) => ({ ...s, [key]: value }));
    setBusy(true);
    try {
      await fetch('/api/users/me/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStorage.getToken()}` },
        body: JSON.stringify({ [key]: value }),
      });
    } finally { setBusy(false); }
  };

  if (!settings) return null;

  const items: { key: string; title: string; desc: string }[] = [
    { key: 'newReleases', title: 'Новые релизы любимых авторов', desc: 'Письмо, когда выходит новый трек у тех, на кого вы подписаны.' },
    { key: 'recommendations', title: 'Персональные рекомендации', desc: 'Подборки на основе ваших жанров и истории.' },
    { key: 'replies', title: 'Ответы на мои комментарии', desc: 'Когда кто-то отвечает на ваш комментарий или упоминает.' },
    { key: 'events', title: 'Афиша рядом', desc: 'События в вашем регионе и от любимых авторов.' },
    { key: 'marketing', title: 'Маркетинговые рассылки', desc: 'Скидки, акции и спецпредложения Сонатума.' },
  ];

  return (
    <div className="apple-card p-6 md:p-8">
      <h2 className="text-2xl font-bold mb-2">Уведомления по email</h2>
      <p className="text-sm text-[var(--text-secondary)] mb-6">
        Выберите, о чём сообщать на {settings.email || 'ваш email'}. Письма приходят с адреса noreply@sonatum-music.ru.
      </p>
      <div className="space-y-3">
        {items.map((it) => (
          <label key={it.key} className="flex items-start gap-3 cursor-pointer hover:bg-[var(--hover)] -mx-2 px-2 py-2 rounded-lg transition-colors">
            <input
              type="checkbox"
              checked={!!settings[it.key]}
              onChange={(e) => toggle(it.key, e.target.checked)}
              disabled={busy}
              className="mt-0.5 w-4 h-4 accent-[var(--text-primary)] cursor-pointer flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">{it.title}</div>
              <div className="text-xs text-[var(--text-secondary)] mt-0.5">{it.desc}</div>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}
