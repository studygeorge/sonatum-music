'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/app/lib/api';
import { Artist, Track } from '@/app/types';
import Link from 'next/link';
import { usePlayer } from '@/context/PlayerContext';
import { User as UserIcon } from 'lucide-react';

function AvatarFallback({ size = 80 }: { size?: number }) {
  return (
    <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-300">
      <UserIcon size={size} strokeWidth={1.4} />
    </div>
  );
}

export default function ArtistPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const { playTrack } = usePlayer();

  const [artist, setArtist] = useState<Artist | null>(null);
  const [loading, setLoading] = useState(true);
  const [bioExpanded, setBioExpanded] = useState(false);

  // Подписка
  const [isFollowing, setIsFollowing] = useState(false);
  const [followers, setFollowers] = useState(0);
  const [followBusy, setFollowBusy] = useState(false);

  // Сломанные аватарки — fallback на иконку человека
  const [avatarBroken, setAvatarBroken] = useState(false);

  useEffect(() => {
    loadArtist();
  }, [slug]);

  const loadArtist = async () => {
    try {
      const response = await api.getArtist(slug);
      if (response.success && response.data) {
        const a = response.data as any;
        setArtist(a);
        setIsFollowing(!!a.isFollowing);
        setFollowers(a.followers || 0);
      } else {
        setArtist(null);
      }
    } catch (error) {
      console.error('Ошибка загрузки артиста:', error);
      setArtist(null);
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async () => {
    if (!artist || followBusy) return;
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) {
      router.push('/login');
      return;
    }
    setFollowBusy(true);
    const wasFollowing = isFollowing;
    const prevFollowers = followers;
    // Оптимистично переключаем
    setIsFollowing(!wasFollowing);
    setFollowers(prevFollowers + (wasFollowing ? -1 : 1));
    try {
      const res = await fetch(`/api/artists/${slug}/follow`, {
        method: wasFollowing ? 'DELETE' : 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json?.success) {
        if (typeof json.followers === 'number') setFollowers(json.followers);
        if (typeof json.following === 'boolean') setIsFollowing(json.following);
      } else {
        // откат
        setIsFollowing(wasFollowing);
        setFollowers(prevFollowers);
      }
    } catch {
      setIsFollowing(wasFollowing);
      setFollowers(prevFollowers);
    } finally {
      setFollowBusy(false);
    }
  };

  const formatTime = (seconds: number) => {
    if (!seconds) return '0:00';
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  const formatFollowers = (n: number) => {
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return String(n);
  };

  if (loading) return <div className="min-h-screen pt-32 flex justify-center items-center"><div className="w-8 h-8 rounded-full border-4 border-[var(--border)] border-t-[var(--accent)] animate-spin"></div></div>;
  if (!artist) return <div className="min-h-screen pt-32 flex justify-center items-center text-[var(--text-secondary)]">Артист не найден</div>;

  const realAlbums = (artist as any)?.albums || [];

  return (
    <main className="min-h-screen pt-0 md:pt-20 pb-32 px-4 md:px-8 max-w-[1500px] mx-auto flex flex-col xl:flex-row gap-6 animate-fadeInUp">

      {/* Левая колонка */}
      <div className="flex-1 xl:max-w-[850px]">
        <div className="flex flex-col md:flex-row gap-8 items-start">
           <div className="w-full md:w-[320px] aspect-square rounded-full bg-gray-100 shadow-xl border-4 border-white shrink-0 overflow-hidden relative group">
              {artist.avatar && !avatarBroken ? (
                 <img
                   src={artist.avatar}
                   alt=""
                   onError={() => setAvatarBroken(true)}
                   className="w-full h-full object-cover"
                 />
              ) : (
                 <AvatarFallback size={140} />
              )}
           </div>

           <div className="flex flex-col justify-center py-2 h-full w-full">
              {(artist.isProfi || artist.verified) && (
                <div className="flex items-center gap-2 mb-3">
                  {artist.isProfi && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-black text-white text-[10px] font-bold tracking-wider uppercase" title="Подписка ПРОФИ — расширенный профиль">
                      ПРОФИ
                    </span>
                  )}
                </div>
              )}
              <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-8 text-[#1c1c1e]">
                {artist.name}
              </h1>

              <div className="flex flex-wrap items-center gap-3 mb-12">
                <button
                  className="px-8 py-3 rounded-full text-[15px] flex items-center gap-2 bg-[var(--text-primary)] text-white hover:opacity-90 transition-colors shadow-sm font-bold"
                  onClick={() => artist.tracks && artist.tracks.length > 0 && playTrack(artist.tracks[0])}
                >
                   Перемешать
                </button>
                <button
                  onClick={handleFollow}
                  disabled={followBusy}
                  className={`px-5 py-3 rounded-full text-[15px] flex items-center gap-2 transition-colors font-medium disabled:opacity-50 ${
                    isFollowing
                      ? 'bg-[var(--text-primary)] text-white hover:opacity-90'
                      : 'bg-[#e8e6e1] text-[#1c1c1e] hover:bg-[#dfdcd5]'
                  }`}
                >
                   {isFollowing ? '✓ Вы подписаны' : 'Подписаться'}
                </button>
              </div>

              {/* Соцсети */}
              {artist.socialLinks && Object.values(artist.socialLinks).some((v: any) => v) && (
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  {artist.socialLinks.vk && (
                    <SocialLink href={artist.socialLinks.vk} label="ВКонтакте" />
                  )}
                  {artist.socialLinks.telegram && (
                    <SocialLink
                      href={artist.socialLinks.telegram.startsWith('@')
                        ? `https://t.me/${artist.socialLinks.telegram.slice(1)}`
                        : artist.socialLinks.telegram}
                      label="Telegram"
                    />
                  )}
                  {artist.socialLinks.youtube && (
                    <SocialLink href={artist.socialLinks.youtube} label="YouTube" />
                  )}
                  {artist.socialLinks.instagram && (
                    <SocialLink href={artist.socialLinks.instagram} label="Instagram" />
                  )}
                  {artist.socialLinks.website && (
                    <SocialLink href={artist.socialLinks.website} label="Сайт" />
                  )}
                </div>
              )}
           </div>
        </div>

        {realAlbums.length > 0 && (
          <div className="mt-20">
             <h2 className="text-[28px] font-black tracking-tight mb-6 text-[#1c1c1e]">Альбомы</h2>
             <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {realAlbums.map((album: any) => (
                  <Link key={album.id} href={`/albums/${album.slug || album.id}`} className="group cursor-pointer">
                    <div className="aspect-square rounded-[1.25rem] bg-gray-100 mb-3 overflow-hidden shadow-sm border border-[var(--border)] relative">
                      {album.cover ? (
                        <img src={album.cover} alt={album.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      ) : (
                        <AvatarFallback size={64} />
                      )}
                      <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    </div>
                    <h4 className="font-bold text-[#1c1c1e] text-sm truncate leading-tight group-hover:underline">{album.title}</h4>
                    {album.releaseDate && (
                      <p className="text-[12px] text-gray-400 mt-0.5">{new Date(album.releaseDate).getFullYear()}</p>
                    )}
                  </Link>
                ))}
             </div>
          </div>
        )}
      </div>

      {/* Правая колонка (Floating Sidebar) */}
      <div className="w-full xl:w-[480px] shrink-0 xl:pl-6 hidden lg:block">
         <div className="sticky top-24 bg-[#EAE8E3]/60 backdrop-blur-3xl rounded-[2rem] p-8 border border-white/40 shadow-[0_8px_32px_rgba(0,0,0,0.05)] h-[calc(100vh-120px)] overflow-y-auto custom-scrollbar">
            <h2 className="text-[44px] leading-none font-black tracking-tighter mb-6 text-[#1c1c1e]">{artist.name}</h2>

            <h3 className="text-2xl font-black mb-4 tracking-tight text-[#1c1c1e]">Информация</h3>
            <div className="text-gray-500 font-medium text-[15px] leading-relaxed mb-10 relative">
               <div className={`relative whitespace-pre-line ${bioExpanded ? '' : 'max-h-32 overflow-hidden'}`}>
                  {artist.bio || "Информация об артисте пока не добавлена."}
                  {!bioExpanded && (artist.bio?.length || 0) > 180 && (
                    <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#EAE8E3]/90 to-transparent backdrop-blur-[1px]"></div>
                  )}
               </div>
               {artist.bio && artist.bio.length > 180 && (
                 <button
                   onClick={() => setBioExpanded(v => !v)}
                   className="font-semibold text-gray-700 hover:text-black mt-2 text-sm transition-colors"
                 >
                   {bioExpanded ? 'Свернуть' : 'Читать полностью'}
                 </button>
               )}
            </div>

            <h3 className="text-2xl font-black mt-10 mb-6 tracking-tight text-[#1c1c1e]">Популярные треки</h3>
            <div className="flex flex-col">
               {artist.tracks && artist.tracks.length > 0 ? artist.tracks.map((sim, i) => (
                 <div key={sim.id} className="flex items-center py-2.5 group cursor-pointer border-b border-black/5 last:border-0 hover:bg-black/5 rounded-lg px-2 -mx-2 transition-colors" onClick={() => playTrack(sim)}>
                    <div className="w-10 h-10 rounded-md bg-gray-100 overflow-hidden shrink-0 relative mr-3">
                       {(sim.cover || artist.avatar) ? (
                         <img src={sim.cover || artist.avatar} className="w-full h-full object-cover" alt={sim.title} />
                       ) : (
                         <AvatarFallback size={20} />
                       )}
                       <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                         <span className="text-white"><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg></span>
                       </div>
                    </div>
                    <div className="flex-1 min-w-0 pr-4">
                       <div className="font-bold text-[14px] text-[#1c1c1e] truncate">{sim.title}</div>
                       <div className="text-[12px] text-[var(--text-secondary)] truncate mt-0.5">{(sim.playCount || 0).toLocaleString('ru-RU')} прослушиваний</div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                       <span className="text-[13px] font-medium text-[var(--text-secondary)] tabular-nums">{formatTime(sim.duration)}</span>
                    </div>
                 </div>
               )) : (
                 <div className="text-sm text-[var(--text-secondary)]">Нет треков</div>
               )}
            </div>
         </div>
      </div>
    </main>
  );
}

function SocialLink({ href, label }: { href: string; label: string }) {
  // Безопасный URL: добавляем https:// если отсутствует
  const safeHref = href.startsWith('http') ? href : `https://${href}`;
  return (
    <a
      href={safeHref}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#e8e6e1] text-[#1c1c1e] text-xs font-medium hover:bg-[#dfdcd5] transition-colors"
      title={safeHref}>
      {label}
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 17L17 7M17 7H8M17 7v9" />
      </svg>
    </a>
  );
}
