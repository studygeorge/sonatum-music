'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { authStorage } from '@/app/lib/auth';
import AvatarCropModal from '@/app/author/components/AvatarCropModal';

export default function AuthorOverviewPage() {
  const [me, setMe] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [avatarUploading, setAvatarUploading] = useState(false);

  const reload = () => {
    return fetch('/api/author/me', {
      headers: { Authorization: `Bearer ${authStorage.getToken() || ''}` },
    })
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setMe(j.data);
      });
  };

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, []);

  // Файл сначала открываем в кропалке, и только после Готово отправляем
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const handleSelectFile = (f: File | null) => {
    if (f) setPendingFile(f);
  };

  const uploadCroppedAvatar = async (blob: Blob) => {
    if (!me?.artist) return;
    setPendingFile(null);
    setAvatarUploading(true);
    try {
      const fd = new FormData();
      const file = new File([blob], 'avatar.png', { type: 'image/png' });
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
      await reload();
      // Сообщаем layout-у и другим компонентам, что аватар сменился
      window.dispatchEvent(new CustomEvent('sonatum:avatar-updated', { detail: { avatar: avatarUrl } }));
    } finally {
      setAvatarUploading(false);
    }
  };

  // Редактирование основных полей (имя/регион/город/bio)
  const [editing, setEditing] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [form, setForm] = useState({
    name: '', region: '', city: '', bio: '',
    vk: '', telegram: '', website: '', youtube: '', instagram: '',
  });
  const [regions, setRegions] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    fetch('/api/map/regions')
      .then((r) => r.json())
      .then((j) => {
        if (j.success && Array.isArray(j.data)) {
          setRegions(
            j.data
              .map((r: any) => ({ id: r.id, name: r.name }))
              .sort((a: any, b: any) => a.name.localeCompare(b.name, 'ru'))
          );
        }
      })
      .catch(() => {});
  }, []);

  const openEdit = () => {
    if (!me?.artist) return;
    const sl = (me.artist.socialLinks || {}) as any;
    setForm({
      name: me.artist.name || '',
      region: me.artist.region || '',
      city: me.artist.city || '',
      bio: me.artist.bio || '',
      vk: sl.vk || '',
      telegram: sl.telegram || '',
      website: sl.website || '',
      youtube: sl.youtube || '',
      instagram: sl.instagram || '',
    });
    setEditing(true);
  };

  const saveProfile = async () => {
    if (!me?.artist) return;
    setSavingProfile(true);
    try {
      await fetch('/api/author/me', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authStorage.getToken() || ''}`,
        },
        body: JSON.stringify({
          // name НЕ меняем через API автора (нужен модератор), но сохраняем
          // bio/region/city/foundedYear
          bio: form.bio,
          region: form.region,
          city: form.city,
          socialLinks: {
            vk: form.vk.trim() || undefined,
            telegram: form.telegram.trim() || undefined,
            website: form.website.trim() || undefined,
            youtube: form.youtube.trim() || undefined,
            instagram: form.instagram.trim() || undefined,
          },
        }),
      });
      await reload();
      setEditing(false);
    } finally {
      setSavingProfile(false);
    }
  };

  const removeAvatar = async () => {
    if (!me?.artist) return;
    setAvatarUploading(true);
    try {
      await fetch('/api/author/me', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authStorage.getToken() || ''}`,
        },
        body: JSON.stringify({ avatar: '' }),
      });
      await reload();
      window.dispatchEvent(new CustomEvent('sonatum:avatar-updated', { detail: { avatar: null } }));
    } finally {
      setAvatarUploading(false);
    }
  };

  if (loading) return null;
  if (!me) return null;

  const displayName = me.artist?.name || me.collective?.name || 'Автор';
  const bio = me.artist?.bio || me.collective?.bio || '';

  return (
    <div className="space-y-6 animate-fadeInUp">
      <section
        className="relative rounded-3xl overflow-hidden p-7 md:p-10 text-white flex items-center gap-5"
        style={{ background: 'linear-gradient(135deg, #1d4cb8 0%, #2f9e8f 55%, #e6e6e6 100%)' }}>
        {/* Аватарка-кнопка в шапке: клик → выбор файла → загрузка */}
        <label
          className="group relative w-20 h-20 md:w-24 md:h-24 rounded-full bg-white/10 border-2 border-white/30 overflow-hidden shrink-0 flex items-center justify-center text-3xl font-bold text-white/80 cursor-pointer hover:bg-white/20 transition-colors"
          title={avatarUploading ? 'Загрузка…' : me.artist?.avatar ? 'Заменить фото' : 'Загрузить фото'}>
          {me.artist?.avatar ? (
            <img src={me.artist.avatar} alt="" className="w-full h-full object-cover" />
          ) : (
            <span>{(displayName || '?').trim()[0]?.toUpperCase() || '?'}</span>
          )}
          {/* Hover-оверлей с иконкой камеры */}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
            {avatarUploading ? (
              <span className="text-xs font-medium">...</span>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            )}
          </div>
          <input
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            className="hidden"
            disabled={avatarUploading}
            onChange={(e) => handleSelectFile(e.target.files?.[0] || null)}
          />
        </label>
        <div className="relative z-10 max-w-2xl">
          <div className="text-xs uppercase tracking-widest font-semibold mb-2 opacity-90">
            Кабинет автора
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">
            {displayName}
          </h1>
          {bio && (
            <p className="text-sm md:text-base text-white/85 max-w-xl mt-3 line-clamp-2">
              {bio}
            </p>
          )}
        </div>
      </section>
      <div className="grid sm:grid-cols-2 gap-3">
        <StatCard label="Треков" value={me.stats.tracksCount} />
        <StatCard label="Доход с лицензий" value={`${Math.round(me.stats.totalSales).toLocaleString('ru-RU')} ₽`} />
      </div>
      <section>
        <div className="flex items-end justify-between mb-4">
          <h2 className="text-xl font-bold tracking-tight">Быстрые действия</h2>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <Link href="/author/upload" className="apple-card p-5 hover:bg-[var(--hover)] transition-colors">
                        <div className="font-semibold mb-1">Загрузить новый трек</div>
            <div className="text-sm text-[var(--text-secondary)]">
              Оригинал, кавер или только ноты — выбираете тип и заполняете 3 шага.
            </div>
          </Link>
          <Link href="/author/finance" className="apple-card p-5 hover:bg-[var(--hover)] transition-colors">
                        <div className="font-semibold mb-1">
              {me.user.payoutEnabled ? 'Управление выплатами' : 'Подключить выплаты'}
            </div>
            <div className="text-sm text-[var(--text-secondary)]">
              {me.user.payoutEnabled
                ? 'Вывод средств на карту через СБП.'
                : 'Подтвердите статус самозанятого и подключите СБП.'}
            </div>
          </Link>
          <Link href="/author/collabs" className="apple-card p-5 hover:bg-[var(--hover)] transition-colors">
                        <div className="font-semibold mb-1">Найти соавтора</div>
            <div className="text-sm text-[var(--text-secondary)]">
              Творческая лаборатория — заявки на сотрудничество с другими авторами.
            </div>
          </Link>
          <Link href="/author/events" className="apple-card p-5 hover:bg-[var(--hover)] transition-colors">
                        <div className="font-semibold mb-1">Создать событие</div>
            <div className="text-sm text-[var(--text-secondary)]">
              Концерт, премьера, мастер-класс — попадёт в афишу после модерации.
            </div>
          </Link>
        </div>
      </section>
      {me.artist && (
        <section className="apple-card p-6 space-y-5">
          <h2 className="text-xl font-bold tracking-tight">Профиль</h2>

          {/* Фото профиля — клик по кружку открывает выбор файла */}
          <div className="flex items-center gap-5 pb-5 border-b border-[var(--border)]">
            <label
              className="group relative w-24 h-24 rounded-full bg-gray-100 border border-gray-200 overflow-hidden shrink-0 flex items-center justify-center text-2xl font-bold text-gray-400 cursor-pointer"
              title={avatarUploading ? 'Загрузка…' : me.artist.avatar ? 'Заменить фото' : 'Загрузить фото'}>
              {me.artist.avatar ? (
                <img src={me.artist.avatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <span>{(me.artist.name || '?').trim()[0]?.toUpperCase() || '?'}</span>
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                {avatarUploading ? (
                  <span className="text-xs font-medium">...</span>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                )}
              </div>
              <input
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                className="hidden"
                disabled={avatarUploading}
                onChange={(e) => handleSelectFile(e.target.files?.[0] || null)}
              />
            </label>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-gray-900 mb-0.5">Фото профиля</div>
              <p className="text-xs text-gray-600 mb-3">
                Кликните на кружок, чтобы загрузить или заменить фото. JPG, PNG или WebP до 5 МБ.
              </p>
              {me.artist.avatar && !avatarUploading && (
                <button
                  type="button"
                  onClick={removeAvatar}
                  className="px-4 py-2 rounded-full text-sm font-medium bg-white text-gray-900 border border-gray-300 hover:bg-gray-100 transition-colors">
                  Убрать фото
                </button>
              )}
            </div>
          </div>

          {editing ? (
            <div className="space-y-3">
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Сценическое имя</label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    disabled
                    title="Сценическое имя изменяется только администратором"
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-gray-50 text-gray-500 text-sm"
                  />
                  <p className="text-[11px] text-gray-500 mt-1">Меняется только администратором</p>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Регион</label>
                  <select
                    value={form.region}
                    onChange={(e) => setForm({ ...form, region: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-white text-sm focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 outline-none">
                    <option value="">— не указан —</option>
                    {form.region && !regions.some((r) => r.name === form.region) && (
                      <option value={form.region}>{form.region}</option>
                    )}
                    {regions.map((r) => (
                      <option key={r.id} value={r.name}>{r.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Город</label>
                  <input
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    placeholder="Москва"
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-white text-sm focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Slug</label>
                  <input
                    value={me.artist.slug}
                    disabled
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-gray-50 text-gray-500 text-sm font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">О себе (биография)</label>
                <textarea
                  value={form.bio}
                  onChange={(e) => setForm({ ...form, bio: e.target.value })}
                  rows={3}
                  placeholder="Короткое описание для публичного профиля"
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-white text-sm focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 outline-none resize-none"
                />
              </div>

              {/* Соцсети */}
              <div className="pt-3 border-t border-gray-200">
                <div className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-3">Соцсети и ссылки</div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">ВКонтакте</label>
                    <input
                      value={form.vk}
                      onChange={(e) => setForm({ ...form, vk: e.target.value })}
                      placeholder="https://vk.com/your-page"
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-white text-sm focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Telegram</label>
                    <input
                      value={form.telegram}
                      onChange={(e) => setForm({ ...form, telegram: e.target.value })}
                      placeholder="@username или https://t.me/username"
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-white text-sm focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">YouTube</label>
                    <input
                      value={form.youtube}
                      onChange={(e) => setForm({ ...form, youtube: e.target.value })}
                      placeholder="https://youtube.com/@channel"
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-white text-sm focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Сайт</label>
                    <input
                      value={form.website}
                      onChange={(e) => setForm({ ...form, website: e.target.value })}
                      placeholder="https://example.com"
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-white text-sm focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="px-5 py-2 rounded-full bg-white border border-gray-300 text-gray-900 font-medium hover:bg-gray-100 transition-colors">
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={saveProfile}
                  disabled={savingProfile}
                  className="px-5 py-2 rounded-full bg-black text-white font-medium hover:bg-gray-800 transition-colors disabled:opacity-50">
                  {savingProfile ? 'Сохраняем…' : 'Сохранить'}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <Info label="Сценическое имя" value={me.artist.name} />
                <Info label="Slug" value={me.artist.slug} />
                <Info label="Регион" value={me.artist.region || '—'} />
                <Info label="Город" value={me.artist.city || '—'} />
                <Info label="Подписчики" value={me.artist.followers ?? 0} />
              </div>
              {me.artist.bio && (
                <p className="text-sm text-gray-700 mt-3 whitespace-pre-wrap">{me.artist.bio}</p>
              )}
              <div className="flex gap-3 items-center mt-1">
                <button
                  type="button"
                  onClick={openEdit}
                  className="text-sm px-4 py-2 rounded-full bg-gray-100 text-gray-900 hover:bg-gray-200 font-medium transition-colors">
                  Редактировать
                </button>
                <Link
                  href={`/artist/${me.artist.slug}`}
                  className="text-sm underline decoration-gray-400 hover:decoration-black underline-offset-2">
                  Открыть публичный профиль
                </Link>
              </div>
            </>
          )}
        </section>
      )}

      {me.collective && (
        <section className="apple-card p-6">
          <h2 className="text-xl font-bold tracking-tight mb-4">Коллектив</h2>
          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <Info label="Название" value={me.collective.name} />
            <Info label="Сокращение" value={me.collective.short_name || '—'} />
            <Info label="Получатель выплат" value={
              me.collective.payee_type === 'LEGAL_ENTITY' ? 'Юрлицо' :
              me.collective.payee_type === 'SOLE_PROP' ? 'ИП' :
              me.collective.payee_type === 'SELF_EMPLOYED' ? 'Самозанятый' : '—'
            } />
            <Info label="Регион" value={me.collective.region || '—'} />
            <Info label="ИНН" value={me.collective.legal_inn || '—'} />
          </div>
        </section>
      )}

      {/* Модалка кадрирования фото */}
      {pendingFile && (
        <AvatarCropModal
          file={pendingFile}
          onCancel={() => setPendingFile(null)}
          onDone={uploadCroppedAvatar}
        />
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: any }) {
  return (
    <div className="apple-card p-5">
      <div className="text-xs text-[var(--text-secondary)] mb-1.5">{label}</div>
      <div className="text-2xl font-bold tracking-tight tabular-nums">{value}</div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <div className="text-xs text-[var(--text-secondary)] mb-0.5">{label}</div>
      <div className="font-medium">{String(value ?? '—')}</div>
    </div>
  );
}
