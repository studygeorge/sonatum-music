'use client';

import { useState } from 'react';
import { PremiumModal } from "./PremiumModal";
import dynamic from "next/dynamic";
const SheetMusicViewer = dynamic(() => import("./SheetMusicViewer"), {
  ssr: false,
  loading: () => <div className="text-sm text-[var(--text-secondary)]">Загрузка нот…</div>,
});

interface Track {
  id: string;
  title: string;
  artist?: { name?: string; id?: string; slug?: string };
  album?: { title?: string };
  genre?: { name?: string };
  duration?: number;
  releaseDate?: string;
  playCount?: number;
  lyrics?: string;
  sheetMusic?: { id: string; title: string; pdfUrl: string; instrument?: string; difficulty?: string } | null;
}

interface TrackTabsProps {
  track: Track;
  isPremium: boolean;
  isSheetOnly?: boolean;
}

const TABS = ['О треке', 'Текст', 'Ноты'] as const;
type Tab = typeof TABS[number];

function formatTime(s: number) {
  if (!s) return '—';
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function PremiumGate({ label }: { label: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-4">
      <p className="text-[17px] font-bold text-[#1c1c1e]">{label} — для Premium-подписчиков</p>
      <p className="text-[13px] text-[var(--text-secondary)] text-center max-w-xs">
        Оформите подписку Сонатум, чтобы читать тексты и скачивать ноты в высоком качестве.
      </p>
      <button
        onClick={() => setOpen(true)}
        className="mt-1 px-8 py-3 rounded-full bg-[var(--text-primary)] text-white text-[14px] font-bold hover:opacity-90 transition-opacity shadow-md"
      >
        Оформить подписку
      </button>
      <PremiumModal open={open} onClose={() => setOpen(false)} feature={label} />
    </div>
  );
}

export default function TrackTabs({ track, isPremium, isSheetOnly = false }: TrackTabsProps) {
  // Если только ноты — открываем вкладку '«Ноты»' сразу
  const [activeTab, setActiveTab] = useState<Tab>(isSheetOnly ? 'Ноты' : 'О треке');
  const [isFullscreenViewerOpen, setIsFullscreenViewerOpen] = useState(false);

  const metaRows: { label: string; value: string | number | undefined }[] = [
    { label: 'Исполнитель', value: track.artist?.name },
    { label: 'Альбом', value: track.album?.title || (isSheetOnly ? undefined : 'Сингл') },
    { label: 'Жанр', value: (track as any).genre?.name || (track as any).genres?.[0]?.genre?.name },
    { label: 'Год выпуска', value: track.releaseDate ? new Date(track.releaseDate).getFullYear() : undefined },
    { label: 'Длительность', value: track.duration && track.duration > 0 ? formatTime(track.duration) : undefined },
    { label: 'Прослушиваний', value: isSheetOnly ? undefined : track.playCount?.toLocaleString('ru-RU') },
  ].filter(r => r.value);

  const lyricsBlocks = track.lyrics?.trim().split(/\n{2,}/) ?? [];

  return (
    <div className="mt-10">
      {/* Tab bar */}
      <div className="flex items-center gap-1 bg-black/[0.04] rounded-2xl p-1 w-fit mx-auto mb-7">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2 rounded-xl text-[13px] font-semibold transition-all ${activeTab === tab ? 'bg-white shadow text-[#1c1c1e]' : 'text-[var(--text-secondary)] hover:text-[#1c1c1e]'}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* О треке */}
      {activeTab === 'О треке' && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {metaRows.map(row => (
            <div key={row.label} className="bg-black/[0.03] rounded-2xl p-4 border border-[var(--border)]">
              <p className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1">{row.label}</p>
              <p className="font-semibold text-[14px] text-[#1c1c1e] truncate">{row.value}</p>
            </div>
          ))}
          {metaRows.length === 0 && (
            <p className="text-[14px] text-[var(--text-secondary)] col-span-3">Метаданные отсутствуют.</p>
          )}
        </div>
      )}

      {/* Текст */}
      {activeTab === 'Текст' && (
        isPremium ? (
          track.lyrics ? (
            <div className="max-w-lg space-y-5">
              {lyricsBlocks.map((block, i) => (
                <p key={i} className="text-[14.5px] text-[#1c1c1e] leading-relaxed whitespace-pre-wrap">{block}</p>
              ))}
            </div>
          ) : (
            <p className="text-[14px] text-[var(--text-secondary)] py-6">Текст для этого трека пока не добавлен.</p>
          )
        ) : (
          <PremiumGate label="Текст песни" />
        )
      )}

      {/* Ноты */}
      {activeTab === 'Ноты' && (
        isPremium ? (
          track.sheetMusic ? (
            <div className="flex flex-col gap-4">
              {/* Sheet block */}
              <div className="flex items-center gap-3 p-4 rounded-2xl border border-[var(--border)] bg-gray-50">
                <div className="text-[var(--text-primary)] opacity-80">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[13px] truncate">{track.sheetMusic.title}</p>
                  {track.sheetMusic.instrument && <p className="text-[11px] mt-0.5 text-[var(--text-secondary)]">{track.sheetMusic.instrument} {track.sheetMusic.difficulty ? `· ${track.sheetMusic.difficulty}` : ''}</p>}
                </div>
                <a href={track.sheetMusic.pdfUrl} target="_blank" rel="noreferrer" className="text-[12px] font-medium text-[var(--accent)] hover:opacity-80 px-4 py-2 rounded-lg bg-black/5 hover:bg-black/10 transition-colors">
                  <span className="inline-flex items-center gap-1.5"><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" /></svg>Скачать</span>
                </a>
              </div>
              {/* PDF viewer trigger */}
              <div className="rounded-2xl border border-[var(--border)] overflow-hidden bg-white mt-2 flex flex-col items-center justify-center p-8 bg-gradient-to-b from-gray-50 to-white shadow-sm">
                <div className="w-20 h-20 rounded-full bg-white shadow-md flex items-center justify-center mb-4 text-[var(--text-primary)]">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none opacity-80"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                </div>
                <h4 className="font-bold text-[#1c1c1e] text-lg mb-2">Интерактивные ноты</h4>
                <p className="text-[13px] text-[var(--text-secondary)] text-center max-w-xs mb-6">Откройте документ в полноэкранном режиме для чтения и добавления заметок.</p>
                <button 
                  onClick={() => setIsFullscreenViewerOpen(true)}
                  className="px-6 py-3 rounded-full bg-[var(--text-primary)] text-white text-[14px] font-bold shadow-md hover:scale-105 transition-transform"
                >
                  Открыть на весь экран
                </button>
              </div>
            </div>
          ) : (
            <p className="text-[14px] text-[var(--text-secondary)] py-6">Ноты для этого трека пока не загружены.</p>
          )
        ) : (
          <PremiumGate label="Ноты" />
        )
      )}
      
      {/* Fullscreen Overlay */}
      {isFullscreenViewerOpen && track.sheetMusic && (
        <SheetMusicViewer 
          sheetId={track.sheetMusic.id} 
          pdfUrl={track.sheetMusic.pdfUrl} 
          title={`${track.sheetMusic.title} — ${track.artist?.name || 'Неизвестный'}`} 
          onClose={() => setIsFullscreenViewerOpen(false)} 
        />
      )}
    </div>
  );
}
