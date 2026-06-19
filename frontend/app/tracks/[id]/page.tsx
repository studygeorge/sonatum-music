'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { usePlayer } from '@/context/PlayerContext';
import Link from 'next/link';
import { api } from '@/app/lib/api';
import { useRouter } from 'next/navigation';
import TrackTabs from '@/components/TrackTabs';
import CommentsSection from '@/components/CommentsSection';
import LicenseMarketplace from './LicenseMarketplace';
import { Plus, Check, Flag } from 'lucide-react';
import { PremiumModal } from '@/components/PremiumModal';

import { toast } from '@/app/components/Toast';
export default function TrackPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { playTrack, dislikeTrack, currentTrack } = usePlayer();
  
  const [track, setTrack] = useState<any>(null);
  const [similarTracks, setSimilarTracks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [lyricsExpanded, setLyricsExpanded] = useState(false);

  // Состояние "добавлен в библиотеку" (та же логика что у сердечка в плеере)
  const [inLibrary, setInLibrary] = useState(false);
  const [libraryBusy, setLibraryBusy] = useState(false);
  // Premium-гейт для нот
  const [premiumOpen, setPremiumOpen] = useState(false);

  // Тот же подход, что в Player.tsx — fetch с ключом sonatum_token.
  const toggleLibrary = async () => {
    if (libraryBusy || !track?.id) return;
    const token = typeof window !== 'undefined' ? localStorage.getItem('sonatum_token') : null;
    if (!token) {
      router.push('/login');
      return;
    }
    setLibraryBusy(true);
    const wasInLibrary = inLibrary;
    setInLibrary(!wasInLibrary); // optimistic
    try {
      const res = await fetch(`/api/likes/${track.id}`, {
        method: wasInLibrary ? 'DELETE' : 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setInLibrary(wasInLibrary); // rollback
      }
    } catch {
      setInLibrary(wasInLibrary);
    } finally {
      setLibraryBusy(false);
    }
  };
  
  // Interactive variables — report lives in CommentsSection now
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<{ type: string, id: string }>({ type: 'TRACK', id: params.id });
  const [reportReason, setReportReason] = useState('INAPPROPRIATE');
  const [reportDetails, setReportDetails] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Get user for premium check — только ACTIVE подписка с не истёкшим endDate
        const userRes = await api.getMe();
        if (userRes.success && userRes.data) {
          setUser(userRes.data);
          const sub = userRes.data?.subscription;
          const subActive =
            !!sub &&
            sub.status === 'ACTIVE' &&
            (sub.tier === 'PREMIUM' || sub.tier === 'STUDENT') &&
            (!sub.endDate || new Date(sub.endDate).getTime() > Date.now());
          setIsPremium(subActive || userRes.data?.role === 'ADMIN' || userRes.data?.role === 'SUPER_ADMIN');
        }

        // Fetch track — backend returns { data: { track, similarTracks } }
        const trackRes = await api.getTrack(params.id);
        if (trackRes.success && trackRes.data?.track) {
          setTrack(trackRes.data.track);
          if (trackRes.data.similarTracks) {
            setSimilarTracks(trackRes.data.similarTracks.slice(0, 4));
          }
          // Проверяем, в библиотеке ли уже трек — ключ sonatum_token (как в Player.tsx)
          try {
            const token = localStorage.getItem('sonatum_token');
            if (token) {
              const r = await fetch(`/api/likes/${trackRes.data.track.id}`, {
                headers: { Authorization: `Bearer ${token}` },
              });
              const j = await r.json();
              setInLibrary(!!j?.liked);
            }
          } catch {}
        } else {
          // Track not found — show nothing, don't use fake data
          setTrack(null);
        }

      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [params.id]);

  const submitReport = async () => {
    if (!reportReason) return;
    const res = await api.report(reportTarget.id, reportTarget.type, reportReason, reportDetails);
    if (res.success) {
      toast.error('Ваша жалоба успешно отправлена на модерацию.');
      setReportModalOpen(false);
      setReportDetails('');
    } else {
      toast.error(res.error || 'Ошибка отправки');
    }
  };

  const openReportModal = (type: string, id: string) => {
    setReportTarget({ type, id });
    setReportReason('INAPPROPRIATE');
    setReportDetails('');
    setReportModalOpen(true);
  };

  const formatTime = (seconds: number) => {
    if (!seconds) return '0:00';
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  if (loading) return <div className="min-h-screen pt-32 flex justify-center items-center"><div className="w-8 h-8 rounded-full border-4 border-[var(--border)] border-t-[var(--accent)] animate-spin"></div></div>;
  if (!track) return <div className="min-h-screen pt-32 flex justify-center items-center text-[var(--text-secondary)]">Трек не найден</div>;

  // Sheet-only: нет ни основного аудио, ни минусовки — только ноты в PDF
  const hasAudio = !!(track.audioUrl && String(track.audioUrl).trim());
  const hasInstrumental = !!(track.instrumentalUrl && String(track.instrumentalUrl).trim());
  const isSheetOnly = !hasAudio && !hasInstrumental && !!track.sheetMusic?.pdfUrl;
  const releaseTypeLabel = track.album?.title || (isSheetOnly ? 'Ноты' : 'Сингл');

  return (
    <main className="min-h-screen pt-24 md:pt-32 pb-32 px-4 md:px-8 max-w-[1500px] mx-auto flex flex-col xl:flex-row gap-6 animate-fadeInUp">
      
      {/* Левая колонка */}
      <div className="flex-1 xl:max-w-[850px]">
        {/* Мобильная версия: обложка слева, текст справа. Десктоп: обложка слева большая, текст справа/снизу */}
        <div className="flex flex-row md:flex-row gap-4 md:gap-6 items-center md:items-start mb-6 md:mb-8">
           {/* Обложка (112px на мобильных, 320px на десктопе) — без hover-эффектов */}
           <div className="w-28 h-28 md:w-[320px] md:h-[320px] rounded-[1rem] md:rounded-[2rem] bg-gray-200 shadow-md md:shadow-xl border border-[var(--border)] shrink-0 overflow-hidden relative">
              {track.cover && <img src={track.cover} className="w-full h-full object-cover" alt="cover" />}
           </div>
           
           {/* Текстовая информация */}
           <div className="flex flex-col justify-center py-1 md:py-2 h-full min-w-0">
              <span className="text-[11px] md:text-[13px] font-semibold text-[var(--text-secondary)] mb-0.5 md:mb-1 uppercase tracking-wider truncate w-full">{releaseTypeLabel}</span>
              <h1 className="text-2xl sm:text-4xl md:text-7xl font-black tracking-tighter mb-1.5 md:mb-4 text-[#1c1c1e] leading-tight truncate w-full">{track.title}</h1>
              
              <div className="flex items-center gap-1.5 md:gap-3 mb-2 md:mb-8 text-[11px] md:text-[15px]">
                 <Link
                   href={`/artist/${track.artist?.slug || track.artist?.id || '1'}`}
                   className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-gray-200 overflow-hidden inline-flex items-center justify-center shrink-0 text-[10px] md:text-[11px] font-bold text-gray-700"
                 >
                   {track.artist?.avatar ? (
                     <img src={track.artist.avatar} className="w-full h-full object-cover" alt={track.artist.name || ''} />
                   ) : (
                     <span>{(track.artist?.name || '?').trim()[0]?.toUpperCase() || '?'}</span>
                   )}
                 </Link>
                 <Link href={`/artist/${track.artist?.slug || track.artist?.id || '1'}`} className="font-semibold hover:underline uppercase text-[#1c1c1e] tracking-wide truncate max-w-[120px] md:max-w-none">
                    {track.artist?.name || 'Неизвестный'}
                 </Link>
                 <span className="text-gray-400 text-[10px] md:text-xs shrink-0">•</span>
                 <span className="text-[var(--text-secondary)] font-medium shrink-0">{track.releaseDate ? new Date(track.releaseDate).getFullYear() : '2026'}</span>
              </div>
              
              {/* Кнопки управления ТОЛЬКО ДЛЯ ДЕСКТОПА (мобильные перенесены вниз) */}
              <div className="hidden md:flex flex-wrap items-center gap-3 mb-10">
                {hasAudio ? (
                  <button
                    className="px-8 py-3 rounded-full text-[15px] flex items-center gap-2 bg-[var(--text-primary)] text-white hover:opacity-90 transition-colors shadow-sm font-bold"
                    onClick={() => playTrack(track as any)}
                  >
                     <span className="inline-flex items-center gap-1.5"><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>Слушать</span>
                  </button>
                ) : isSheetOnly && track.sheetMusic?.pdfUrl ? (
                  isPremium ? (
                    <a
                      href={track.sheetMusic.pdfUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-8 py-3 rounded-full text-[15px] flex items-center gap-2 bg-[var(--text-primary)] text-white hover:opacity-90 transition-colors shadow-sm font-bold">
                      Открыть ноты PDF
                    </a>
                  ) : (
                    <button
                      onClick={() => { window.location.href = "/profile?tab=subscription"; }}
                      className="px-8 py-3 rounded-full text-[15px] flex items-center gap-2 bg-[var(--text-primary)] text-white hover:opacity-90 transition-colors shadow-sm font-bold">
                      Открыть ноты PDF · Premium
                    </button>
                  )
                ) : null}
                <button
                  onClick={toggleLibrary}
                  disabled={libraryBusy}
                  className={`h-12 px-5 rounded-full transition-colors flex items-center justify-center gap-2 font-medium border ${
                    inLibrary
                      ? 'bg-[var(--text-primary)] text-white border-transparent hover:opacity-90'
                      : 'bg-[#e8e6e1] text-[#1c1c1e] hover:bg-[#dfdcd5] border-transparent'
                  } disabled:opacity-50`}
                  title={inLibrary ? 'Убрать из библиотеки' : 'Добавить в библиотеку'}
                >
                  {inLibrary ? <Check size={18} /> : <Plus size={18} />}
                  {inLibrary ? 'В библиотеке' : 'Добавить'}
                </button>
                <button
                  onClick={() => openReportModal('TRACK', track.id)}
                  className="w-12 h-12 rounded-full bg-[#e8e6e1] text-[#1c1c1e] hover:bg-[#dfdcd5] transition-colors flex items-center justify-center"
                  title="Пожаловаться"
                >
                  <Flag size={18} />
                </button>
              </div>
           </div>
        </div>

        {/* Кнопки управления ТОЛЬКО ДЛЯ МОБИЛОК */}
        <div className="flex md:hidden flex-col gap-3 mb-8">
           <div className="flex gap-2 w-full">
              {hasAudio ? (
                <button
                  className="flex-1 py-3.5 rounded-2xl text-[15px] flex items-center justify-center gap-2 bg-[var(--text-primary)] text-white active:scale-95 transition-all shadow-sm font-bold"
                  onClick={() => playTrack(track as any)}
                >
                   <span className="inline-flex items-center gap-1.5"><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>Слушать</span>
                </button>
              ) : isSheetOnly && track.sheetMusic?.pdfUrl ? (
                isPremium ? (
                  <a
                    href={track.sheetMusic.pdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 py-3.5 rounded-2xl text-[15px] flex items-center justify-center gap-2 bg-[var(--text-primary)] text-white active:scale-95 transition-all shadow-sm font-bold">
                    Открыть ноты PDF
                  </a>
                ) : (
                  <button
                    onClick={() => { window.location.href = "/profile?tab=subscription"; }}
                    className="flex-1 py-3.5 rounded-2xl text-[15px] flex items-center justify-center gap-2 bg-[var(--text-primary)] text-white active:scale-95 transition-all shadow-sm font-bold">
                    Открыть ноты PDF · Premium
                  </button>
                )
              ) : null}
              <button
                onClick={toggleLibrary}
                disabled={libraryBusy}
                className={`w-[52px] h-[52px] rounded-2xl active:scale-95 transition-all flex items-center justify-center shrink-0 disabled:opacity-50 ${
                  inLibrary ? 'bg-[var(--text-primary)] text-white' : 'bg-[#e8e6e1] text-[#1c1c1e]'
                }`}
                title={inLibrary ? 'Убрать из библиотеки' : 'Добавить в библиотеку'}
              >
                {inLibrary ? <Check size={22} /> : <Plus size={22} />}
              </button>
              <button
                onClick={() => openReportModal('TRACK', track.id)}
                className="w-[52px] h-[52px] rounded-2xl bg-[#e8e6e1] text-[#1c1c1e] active:scale-95 transition-all flex items-center justify-center shrink-0"
                title="Пожаловаться"
              >
                <Flag size={20} />
              </button>
           </div>
        </div>
        
        {/* Выбор версии — полная / минусовка. Согласно ТЗ:
            «Минусовка доступна только при покупке. Она не проигрывается на сайте.» */}
        {hasInstrumental && track.audioType && track.audioType !== 'FULL' && (
          <div className="mb-8 apple-card p-5 md:p-6">
            <h3 className="text-[15px] font-bold text-[#1c1c1e] mb-1">Версии трека</h3>
            <p className="text-[12px] text-[var(--text-secondary)] mb-4">
              Минусовка доступна только при покупке — она не воспроизводится на сайте.
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              {/* Полная версия */}
              {track.audioType === 'BOTH' && (
                <div className="rounded-2xl border border-[var(--border)] bg-white p-4 flex flex-col">
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="text-[13px] font-bold text-[#1c1c1e]">Полная версия</span>
                    {(track.price || 0) > 0 && (
                      <span className="text-[14px] font-black tabular-nums">{Number(track.price || 0).toLocaleString('ru-RU')} ₽</span>
                    )}
                    {!track.price && <span className="text-[11px] text-[var(--text-secondary)]">бесплатно</span>}
                  </div>
                  <p className="text-[11px] text-[var(--text-secondary)] mb-3 flex-1">С вокалом, как в записи</p>
                  <button
                    className="px-4 py-2 rounded-full text-[12px] font-bold bg-[var(--text-primary)] text-white hover:opacity-90 transition-opacity"
                    onClick={() => playTrack(track as any)}
                  >
                    <span className="inline-flex items-center gap-1.5"><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>Слушать</span>
                  </button>
                </div>
              )}
              {/* Минусовка */}
              <div className="rounded-2xl border border-black bg-white p-4 flex flex-col">
                <div className="flex items-baseline justify-between mb-1">
                  <span className="text-[13px] font-bold text-[#1c1c1e]">Минусовка (инструментал)</span>
                  {track.instrumentalPrice && Number(track.instrumentalPrice) > 0 ? (
                    <span className="text-[14px] font-black tabular-nums">{Number(track.instrumentalPrice).toLocaleString('ru-RU')} ₽</span>
                  ) : (
                    <span className="text-[11px] text-[var(--text-secondary)]">по запросу</span>
                  )}
                </div>
                <p className="text-[11px] text-[var(--text-secondary)] mb-3 flex-1">Без вокала, для каверов и исполнения</p>
                <button
                  className="px-4 py-2 rounded-full text-[12px] font-bold bg-[var(--text-primary)] text-white hover:opacity-90 transition-opacity"
                  onClick={() => {
                    // Сначала прокручиваем к маркетплейсу, чтобы пользователь видел модалку,
                    // и одним кадром позже открываем модалку MINUS-лицензии.
                    const el = document.getElementById('license-marketplace');
                    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    setTimeout(() => {
                      window.dispatchEvent(new CustomEvent('sonatum:open-license', { detail: { code: 'MINUS' } }));
                    }, 200);
                  }}
                >
                  Купить минусовку
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TrackTabs: О треке / Текст / Ноты */}
        <TrackTabs track={track} isPremium={isPremium} isSheetOnly={isSheetOnly} />
        <div id="license-marketplace">
          <LicenseMarketplace trackId={track.id} trackTitle={track.title} />
        </div>

        {/* Comments */}
        <CommentsSection trackId={track.id} isPremium={isPremium} user={user} />

        {/* Similar tracks in this genre */}
        {similarTracks.length > 0 && (
          <div className="mt-20">
             <h2 className="text-[28px] font-black tracking-tight mb-6 text-[#1c1c1e]">Похожие треки в этом жанре</h2>
             <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {similarTracks.map((sim: any) => (
                  <Link
                    key={sim.id}
                    href={`/tracks/${sim.slug || sim.id}`}
                    className="cursor-pointer block group">
                    <div className="aspect-square rounded-[1.25rem] bg-gray-200 mb-3 overflow-hidden shadow-sm border border-[var(--border)] relative">
                      {sim.cover && (
                        <img
                          src={sim.cover}
                          alt={sim.title}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                    <h4 className="font-bold text-[#1c1c1e] text-sm truncate leading-tight group-hover:underline">{sim.title}</h4>
                    <p className="text-[13px] text-[var(--text-secondary)] truncate leading-tight mt-0.5">
                      {sim.artist?.name || 'Неизвестный'}
                    </p>
                    {sim.duration > 0 && (
                      <p className="text-[12px] text-gray-400 mt-0.5 tabular-nums">{formatTime(sim.duration)}</p>
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
            <div className="flex justify-between items-start mb-2">
               <span className="text-[var(--text-secondary)] text-[13px] font-semibold">Трек</span>
               <button className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center hover:bg-black/10 transition-colors">
                 <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
               </button>
            </div>
            
            <h2 className="text-[44px] leading-none font-black tracking-tighter mb-2 text-[#1c1c1e]">{track.title}</h2>
            <Link href={`/artist/${track.artist?.slug || track.artist?.id || '1'}`} className="text-[var(--text-secondary)] tracking-wider text-[13px] font-semibold uppercase hover:text-[var(--text-primary)] transition-colors">
              {track.artist?.name || 'Неизвестный исполнитель'}
            </Link>
            
            <div className="flex items-center gap-3 mt-6 mb-10">
                {hasAudio ? (
                  <button
                    className="px-6 py-2.5 rounded-full text-[14px] flex items-center gap-2 bg-[var(--text-primary)] text-white hover:opacity-90 transition-colors shadow-sm font-bold"
                    onClick={() => playTrack(track as any)}
                  >
                     <span className="inline-flex items-center gap-1.5"><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>Слушать</span>
                  </button>
                ) : isSheetOnly && track.sheetMusic?.pdfUrl ? (
                  isPremium ? (
                    <a
                      href={track.sheetMusic.pdfUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-6 py-2.5 rounded-full text-[14px] flex items-center gap-2 bg-[var(--text-primary)] text-white hover:opacity-90 transition-colors shadow-sm font-bold">
                      Открыть ноты PDF
                    </a>
                  ) : (
                    <button
                      onClick={() => { window.location.href = "/profile?tab=subscription"; }}
                      className="px-6 py-2.5 rounded-full text-[14px] flex items-center gap-2 bg-[var(--text-primary)] text-white hover:opacity-90 transition-colors shadow-sm font-bold">
                      Открыть · Premium
                    </button>
                  )
                ) : null}
                <button
                  onClick={toggleLibrary}
                  disabled={libraryBusy}
                  className={`w-10 h-10 rounded-full transition-colors flex items-center justify-center disabled:opacity-50 ${
                    inLibrary
                      ? 'bg-[var(--text-primary)] text-white hover:opacity-90'
                      : 'bg-black/5 text-[#1c1c1e] hover:bg-black/10'
                  }`}
                  title={inLibrary ? 'Убрать из библиотеки' : 'Добавить в библиотеку'}
                >
                  {inLibrary ? <Check size={18} /> : <Plus size={18} />}
                </button>
                <button
                  onClick={() => openReportModal('TRACK', track.id)}
                  className="w-10 h-10 rounded-full bg-black/5 text-[#1c1c1e] hover:bg-black/10 transition-colors flex items-center justify-center"
                  title="Пожаловаться"
                >
                  <Flag size={18} />
                </button>
            </div>
            
            <h3 className="text-2xl font-black mb-4 tracking-tight text-[#1c1c1e]">{releaseTypeLabel}</h3>
            <div className="flex items-center gap-4 mb-8">
               <div className="w-16 h-16 rounded-[1rem] bg-gray-200 overflow-hidden shadow-sm shrink-0 flex items-center justify-center text-lg font-bold text-gray-400">
                   {track.cover ? (
                     <img src={track.cover} className="w-full h-full object-cover" alt="cover" />
                   ) : (
                     <span>{(track.title || '?').trim()[0]?.toUpperCase() || '?'}</span>
                   )}
               </div>
               <div className="flex flex-col justify-center">
                  <div className="font-bold text-[17px] text-[#1c1c1e] flex items-center gap-1 group cursor-pointer hover:underline">
                    {track.title} 
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6"/></svg>
                  </div>
                  <div className="text-[var(--text-secondary)] text-[14px] mt-0.5">1 трек</div>
               </div>
            </div>
            
            <h3 className="text-2xl font-black mb-4 tracking-tight text-[#1c1c1e]">Текст</h3>
            <div className="text-gray-500 font-medium text-[15px] leading-relaxed mb-10 relative">
               <div className={`relative whitespace-pre-line ${lyricsExpanded ? '' : 'max-h-24 overflow-hidden'}`}>
                  {track.lyrics || "Текст отсутствует."}
                  {!lyricsExpanded && (track.lyrics?.length || 0) > 100 && (
                    <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#EAE8E3]/90 to-transparent backdrop-blur-[1px]"></div>
                  )}
               </div>
               {track.lyrics && track.lyrics.length > 100 && (
                 <button
                   onClick={() => setLyricsExpanded(v => !v)}
                   className="font-semibold text-gray-700 hover:text-black mt-2 text-sm transition-colors"
                 >
                   {lyricsExpanded ? 'Свернуть' : 'Читать полностью'}
                 </button>
               )}
            </div>
            
            <h3 className="text-2xl font-black mt-10 mb-6 tracking-tight text-[#1c1c1e]">Похожие треки</h3>
            <div className="flex flex-col">
               {similarTracks.length > 0 ? similarTracks.map((sim) => (
                 <Link
                   key={sim.id}
                   href={`/tracks/${sim.slug || sim.id}`}
                   className="flex items-center py-2.5 cursor-pointer border-b border-black/5 last:border-0 rounded-lg px-2 -mx-2 hover:bg-black/5 transition-colors">
                    <div className="w-10 h-10 rounded-md bg-gray-200 overflow-hidden shrink-0 mr-3">
                       {sim.cover ? (
                         <img src={sim.cover} className="w-full h-full object-cover" alt="sim" />
                       ) : (
                         <div className="w-full h-full flex items-center justify-center text-xs font-bold text-gray-400">
                           {(sim.title || '?').trim()[0]?.toUpperCase()}
                         </div>
                       )}
                    </div>
                    <div className="flex-1 min-w-0 pr-4">
                       <div className="font-bold text-[14px] text-[#1c1c1e] truncate">{sim.title}</div>
                       <div className="text-[12px] text-[var(--text-secondary)] truncate mt-0.5">{sim.artist?.name || 'Неизвестный'}</div>
                    </div>
                    {sim.duration > 0 && (
                      <div className="flex items-center gap-3 shrink-0">
                         <span className="text-[13px] font-medium text-[var(--text-secondary)] tabular-nums">{formatTime(sim.duration)}</span>
                      </div>
                    )}
                 </Link>
               )) : (
                 <div className="text-sm text-[var(--text-secondary)]">Нет похожих треков</div>
               )}
            </div>
         </div>
      </div>

      {/* Модалка жалобы — через portal в body, чтобы родительские
         transform/backdrop-filter не ломали fixed-позиционирование */}
      {reportModalOpen && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ top: 0, left: 0, right: 0, bottom: 0 }}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setReportModalOpen(false)} />
          <div className="bg-white p-8 w-full max-w-md relative z-10 rounded-2xl shadow-2xl border border-gray-200">
            <h2 className="text-2xl font-bold mb-6 text-gray-900">Жалоба / Обращение</h2>
            <select
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              className="w-full p-3 rounded-xl border border-gray-300 bg-white mb-4 outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900"
            >
              <option value="COPYRIGHT">Нарушение авторских прав (DMCA)</option>
              <option value="INAPPROPRIATE">Оскорбительный контент</option>
              <option value="METADATA">Неверные метаданные / Ошибка названия</option>
              <option value="TECHNICAL">Техническая проблема</option>
              <option value="OTHER">Другое</option>
            </select>
            <textarea
              value={reportDetails}
              onChange={(e) => setReportDetails(e.target.value)}
              placeholder="Опишите проблему подробно..."
              className="w-full p-3 rounded-xl border border-gray-300 bg-white mb-6 outline-none min-h-[120px] resize-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900"
            />
            <div className="flex justify-end gap-3">
              <button
                className="px-5 py-2 rounded-full font-medium text-gray-900 bg-gray-100 hover:bg-gray-200 transition-colors"
                onClick={() => setReportModalOpen(false)}
              >
                Отмена
              </button>
              <button
                className="bg-black text-white px-6 py-2 rounded-full font-medium hover:bg-gray-800 transition-colors"
                onClick={submitReport}
              >
                Отправить
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Premium-гейт для нот */}
      <PremiumModal open={premiumOpen} onClose={() => setPremiumOpen(false)} feature="Ноты" />
    </main>
  );
}
