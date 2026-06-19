'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { User as UserIcon } from 'lucide-react';

function AvatarFallback({ size = 80 }: { size?: number }) {
  return (
    <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-300">
      <UserIcon size={size} strokeWidth={1.4} />
    </div>
  );
}

type Playlist = {
  id: string;
  title: string;
  cover?: string | null;
  trackCount?: number;
  slug?: string;
};

type Track = {
  id: string;
  title: string;
  slug: string;
  cover?: string | null;
  plays?: number;
  artist?: { name?: string | null; slug?: string | null } | null;
  likedAt?: string;
};

type PublicProfile = {
  id: string;
  username: string;
  nickname?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  avatar?: string | null;
  bio?: string | null;
  playlists?: Playlist[];
  favoriteGenres?: string[];
  favoriteEras?: string[];
  favoriteComposers?: string[];
  isPrivate?: boolean;
  createdAt?: string;
  topTracks?: Track[];
  currentlyLiking?: Track;
  followingCount?: number;
  isPremium?: boolean;
};

export default function PublicUserPage() {
  const params = useParams();
  const username = params.username as string;

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bioExpanded, setBioExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/users/${encodeURIComponent(username)}`);
        const json = await res.json();
        if (cancelled) return;
        if (res.ok && json.success) {
          setProfile(json.data);
        } else {
          setError(json.error || 'Пользователь не найден');
        }
      } catch (e) {
        if (!cancelled) setError('Ошибка загрузки');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [username]);

  if (loading) {
    return (
      <div className="min-h-screen pt-32 flex justify-center items-center">
        <div className="w-8 h-8 rounded-full border-4 border-[var(--border)] border-t-[var(--accent)] animate-spin" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen pt-32 flex flex-col items-center justify-center gap-4 text-center px-6">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Пользователь не найден</h1>
        <p className="text-[var(--text-secondary)]">{error || 'Возможно, профиль скрыт или удалён.'}</p>
        <Link href="/" className="apple-button mt-4">На главную</Link>
      </div>
    );
  }

  if (profile.isPrivate) {
    return (
      <main className="min-h-screen pt-24 pb-32 px-6 max-w-3xl mx-auto">
        <div className="apple-card p-10 text-center flex flex-col items-center gap-4">
          <div className="w-32 h-32 rounded-full bg-gray-100 overflow-hidden">
            {profile.avatar ? (
              <img src={profile.avatar} alt={profile.username} className="w-full h-full object-cover" />
            ) : (
              <AvatarFallback size={56} />
            )}
          </div>
          <h1 className="text-3xl font-bold">@{profile.username}</h1>
          <p className="text-[var(--text-secondary)]">Этот профиль скрыт владельцем</p>
        </div>
      </main>
    );
  }

  const displayName =
    profile.nickname ||
    [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim() ||
    profile.username;

  const showBioExpand = (profile.bio?.length || 0) > 220;

  return (
    <main className="min-h-screen pt-24 pb-32 px-4 md:px-8 max-w-5xl mx-auto">
      {/* Шапка профиля */}
      <section className="flex flex-col md:flex-row gap-8 items-start md:items-center mb-12">
        <div className="w-32 h-32 md:w-40 md:h-40 rounded-full bg-gray-100 shrink-0 overflow-hidden shadow-md">
          {profile.avatar ? (
            <img src={profile.avatar} alt={displayName} className="w-full h-full object-cover" />
          ) : (
            <AvatarFallback size={70} />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h1 className="text-3xl md:text-5xl font-black tracking-tight text-[var(--text-primary)] break-words">
            {displayName}
          </h1>
          <p className="text-[var(--text-secondary)] mt-2">@{profile.username}</p>

          {profile.createdAt && (
            <p className="text-sm text-[var(--text-secondary)] mt-3">
              На Сонатум с {new Date(profile.createdAt).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}
            </p>
          )}
        </div>
      </section>

      {/* Информация (bio) */}
      {profile.bio && (
        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight mb-4">Информация</h2>
          <div className="apple-card p-6">
            <div className={`relative whitespace-pre-line text-[var(--text-secondary)] leading-relaxed ${bioExpanded ? '' : 'max-h-32 overflow-hidden'}`}>
              {profile.bio}
              {!bioExpanded && showBioExpand && (
                <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white to-transparent" />
              )}
            </div>
            {showBioExpand && (
              <button
                onClick={() => setBioExpanded(v => !v)}
                className="font-semibold text-[var(--text-primary)] hover:opacity-70 mt-2 text-sm transition-opacity"
              >
                {bioExpanded ? 'Свернуть' : 'Читать полностью'}
              </button>
            )}
          </div>
        </section>
      )}

      {/* Сейчас нравится — виджет последнего лайка */}
      {profile.currentlyLiking && (
        <section className="mb-8">
          <div className="apple-card p-5 flex items-center gap-4">
            <div className="text-red-500 shrink-0" title="Сейчас нравится" aria-label="Сейчас нравится">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
            </div>
            <Link
              href={`/tracks/${profile.currentlyLiking.slug}`}
              className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition-opacity">
              {profile.currentlyLiking.cover ? (
                <img src={profile.currentlyLiking.cover} alt="" className="w-12 h-12 rounded-lg object-cover" />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-black/[0.06] flex items-center justify-center text-[var(--text-secondary)]"><svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg></div>
              )}
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm truncate">{profile.currentlyLiking.title}</div>
                <div className="text-xs text-[var(--text-secondary)] truncate">
                  {profile.currentlyLiking.artist?.name || '—'}
                </div>
              </div>
            </Link>
          </div>
        </section>
      )}

      {/* Топ-5 треков за месяц */}
      {profile.topTracks && profile.topTracks.length > 0 && (
        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight mb-4">Топ-5 треков за месяц</h2>
          <ol className="space-y-1.5">
            {profile.topTracks.map((t, i) => (
              <li key={t.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-black/[0.03]">
                <span className="text-sm font-bold text-[var(--text-secondary)] w-6 tabular-nums">{i + 1}</span>
                {t.cover ? (
                  <img src={t.cover} alt="" className="w-10 h-10 rounded-lg object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-black/[0.06] flex items-center justify-center text-xs">♪</div>
                )}
                <Link href={`/tracks/${t.slug}`} className="flex-1 min-w-0 hover:opacity-80 transition-opacity">
                  <div className="font-semibold text-sm truncate">{t.title}</div>
                  <div className="text-xs text-[var(--text-secondary)] truncate">{t.artist?.name || '—'}</div>
                </Link>
                <span className="text-xs text-[var(--text-secondary)] tabular-nums whitespace-nowrap">
                  {t.plays} прослушиваний
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Музыкальная идентичность */}
      {(profile.favoriteGenres?.length || profile.favoriteEras?.length || profile.favoriteComposers?.length) && (
        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight mb-4">Музыкальная идентичность</h2>
          <div className="space-y-4">
            {profile.favoriteGenres && profile.favoriteGenres.length > 0 && (
              <TagsRow label="Любимые жанры" items={profile.favoriteGenres} prefix="#" />
            )}
            {profile.favoriteEras && profile.favoriteEras.length > 0 && (
              <TagsRow label="Любимые эпохи" items={profile.favoriteEras} prefix="#" />
            )}
            {profile.favoriteComposers && profile.favoriteComposers.length > 0 && (
              <TagsRow label="Любимые композиторы" items={profile.favoriteComposers} />
            )}
          </div>
        </section>
      )}

      {/* Публичные плейлисты */}
      {profile.playlists && profile.playlists.length > 0 && (
        <section className="mb-12">
          <h2 className="text-2xl font-bold tracking-tight mb-6">Публичные плейлисты</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {profile.playlists.map(p => (
              <Link key={p.id} href={`/playlists/${p.slug || p.id}`} className="apple-card hover-scale p-3 group cursor-pointer">
                <div className="aspect-square bg-[var(--border)] rounded-xl mb-3 overflow-hidden">
                  {p.cover ? (
                    <img src={p.cover} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-[#0039a6] to-[#2f9e8f]" />
                  )}
                </div>
                <h3 className="font-semibold truncate">{p.title}</h3>
                {typeof p.trackCount === 'number' && (
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">{p.trackCount} треков</p>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Пустой профиль — fallback */}
      {!profile.bio &&
        !profile.favoriteGenres?.length &&
        !profile.favoriteEras?.length &&
        !profile.favoriteComposers?.length &&
        !profile.playlists?.length && (
          <section className="apple-card p-10 text-center">
            <p className="text-[var(--text-secondary)]">
              Пользователь пока ничего не рассказал о себе.
            </p>
          </section>
        )}
    </main>
  );
}

function TagsRow({ label, items, prefix = '' }: { label: string; items: string[]; prefix?: string }) {
  return (
    <div>
      <div className="text-sm font-semibold text-[var(--text-secondary)] mb-2">{label}</div>
      <div className="flex flex-wrap gap-2">
        {items.map((it, i) => (
          <span
            key={i}
            className="px-4 py-1.5 rounded-full bg-[var(--border)] text-sm font-medium text-[var(--text-primary)]"
          >
            {prefix}
            {it}
          </span>
        ))}
      </div>
    </div>
  );
}
