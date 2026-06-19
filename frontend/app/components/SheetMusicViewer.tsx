'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { api } from '@/app/lib/api';

import { toast } from '@/app/components/Toast';
// Setup pdf.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface Annotation {
  id: string;
  pageNumber: number;
  positionX: number;
  positionY: number;
  content: string;
  user?: { id?: string; firstName?: string; lastName?: string; username?: string; avatar?: string };
  createdAt: string;
}

interface Props {
  sheetId: string;
  pdfUrl: string;
  title: string;
  onClose: () => void;
}

export default function SheetMusicViewer({ sheetId, pdfUrl, title, onClose }: Props) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(0.5);
  
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [isDrafting, setIsDrafting] = useState(false);
  const [draftPos, setDraftPos] = useState({ x: 0, y: 0 });
  const [draftContent, setDraftContent] = useState('');
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [showNotes, setShowNotes] = useState(true);
  const [pageWidth, setPageWidth] = useState<number>(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);
  const [draftShared, setDraftShared] = useState(false);
  const [eduContext, setEduContext] = useState<{ role: string } | null>(null);

  const pageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    document.body.style.overflow = 'hidden';
    fetchAnnotations();
    
    api.getMe().then(res => {
      if (res.success && res.data) {
        setCurrentUserId(res.data.id?.toString() || null);
      }
    });

    const updateWidth = () => {
      if (typeof window !== 'undefined') {
        const w = window.innerWidth;
        let padding = 48; // mobile: px-4 (32px) + p-2 (16px) = 48px
        if (w >= 1024) padding = 160; // lg: p-12 (96px) + p-8 (64px) = 160px
        else if (w >= 768) padding = 128; // md: p-8 (64px) + p-8 (64px) = 128px
        else if (w >= 640) padding = 64;  // sm: p-4 (32px) + p-4 (32px) = 64px
        setPageWidth(w - padding);
      }
    };
    
    updateWidth();
    window.addEventListener('resize', updateWidth);

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('resize', updateWidth);
    };
  }, [sheetId]);

  const fetchAnnotations = async () => {
    const res = await api.getSheetAnnotations(sheetId);
    if (res.success && res.data) {
      setEduContext((res as any).eduContext || null);
      setAnnotations(res.data);
    }
  };

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setPageNumber(1);
  };

  const handlePageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!showNotes) return;

    // If we click on an existing note, don't create a new one
    if ((e.target as HTMLElement).closest('.note-marker')) return;
    
    if (!pageRef.current) return;
    const rect = pageRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    setDraftPos({ x, y });
    setIsDrafting(true);
    setDraftContent('');
    setActiveNoteId(null);
    setNoteToDelete(null);
  };

  const saveAnnotation = async () => {
    if (!draftContent.trim()) {
      setIsDrafting(false);
      return;
    }
    const res = await api.addSheetAnnotation(sheetId, {
      pageNumber,
      positionX: draftPos.x,
      positionY: draftPos.y,
      content: draftContent,
      color: '#fbbf24',
      isShared: draftShared,
    });
    if (res.success) {
      setIsDrafting(false);
      setDraftShared(false);
      fetchAnnotations();
    } else {
      toast.error(res.error || 'Ошибка сохранения заметки');
    }
  };

  const handleDeleteAnnotation = async (annotationId: string) => {
    const res = await api.deleteSheetAnnotation(sheetId, annotationId);
    if (res.success) {
      setAnnotations(prev => prev.filter(a => a.id !== annotationId));
      setActiveNoteId(null);
      setNoteToDelete(null);
    } else {
      toast.error(res.error || 'Ошибка удаления заметки');
    }
  };

  const pageAnnotations = annotations.filter(a => a.pageNumber === pageNumber);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[99999] bg-[#fdfdfd] flex flex-col animate-fadeIn">
      {/* Top Toolbar */}
      <div className="h-16 shrink-0 bg-white border-b border-gray-200 flex items-center justify-between px-4 md:px-6 shadow-sm">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <button 
            onClick={onClose}
            className="hidden md:flex w-10 h-10 shrink-0 rounded-full bg-gray-100 items-center justify-center hover:bg-gray-200 transition-colors text-[#1c1c1e] font-bold"
          >
            ✕
          </button>
          <div className="flex flex-col min-w-0">
            <h2 className="font-bold text-[#1c1c1e] text-[14px] md:text-[15px] truncate max-w-[200px] md:max-w-md">{title}</h2>
            <span className="text-[11px] md:text-[12px] text-[var(--text-secondary)] font-medium truncate">Режим просмотра и заметок</span>
          </div>
        </div>

        {/* Pagination, Zoom & Toggle */}
        <div className="flex items-center gap-2 md:gap-6 shrink-0">
          
          {/* Show Notes Toggle */}
          <label className="flex items-center gap-1.5 md:gap-2 cursor-pointer">
             <span className="text-[10px] md:text-[13px] font-medium text-[#1c1c1e] md:capitalize tracking-tight md:tracking-normal">Заметки</span>
             <div className={`w-10 h-6 shrink-0 rounded-full transition-colors relative ${showNotes ? 'bg-[var(--accent)]' : 'bg-gray-300'}`}>
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${showNotes ? 'translate-x-5' : 'translate-x-1'}`}></div>
             </div>
             <input type="checkbox" className="hidden" checked={showNotes} onChange={() => setShowNotes(!showNotes)} />
          </label>

          <div className="flex items-center gap-1 md:gap-2 bg-gray-50 px-2 md:px-3 py-1 md:py-1.5 rounded-full border border-gray-200">
            <button 
              disabled={pageNumber <= 1}
              onClick={() => { setPageNumber(p => p - 1); setIsDrafting(false); }}
              className="text-[#1c1c1e] hover:text-[var(--accent)] font-bold disabled:opacity-30 p-1 w-6 h-6 flex items-center justify-center"
            >
              &lt;
            </button>
            <span className="text-[12px] md:text-[13px] font-bold tabular-nums min-w-[40px] text-center">
              {pageNumber} / {numPages || '-'}
            </span>
            <button 
              disabled={pageNumber >= numPages}
              onClick={() => { setPageNumber(p => p + 1); setIsDrafting(false); }}
              className="text-[#1c1c1e] hover:text-[var(--accent)] font-bold disabled:opacity-30 p-1 w-6 h-6 flex items-center justify-center"
            >
              &gt;
            </button>
          </div>

          <div className="hidden md:flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-200">
            <button onClick={() => setScale(s => Math.max(0.5, s - 0.2))} className="w-6 h-6 flex items-center justify-center font-bold text-gray-700 hover:text-black">-</button>
            <span className="text-[12px] font-bold w-12 text-center">{Math.round(scale * 100)}%</span>
            <button onClick={() => setScale(s => Math.min(3, s + 0.2))} className="w-6 h-6 flex items-center justify-center font-bold text-gray-700 hover:text-black">+</button>
          </div>

          <button 
            onClick={onClose}
            className="md:hidden w-8 h-8 shrink-0 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors text-[#1c1c1e] font-bold ml-1"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto bg-[#f5f5f7] custom-scrollbar p-4 md:p-8 lg:p-12">
        <div className="relative shadow-xl bg-white mx-auto w-fit min-w-[280px] p-2 sm:p-4 md:p-8 transition-transform">
          <Document
            file={pdfUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            className="flex flex-col items-center"
            loading={<div className="p-20 text-gray-500 font-medium animate-pulse">Загрузка документа...</div>}
            error={<div className="p-20 text-red-500 font-medium">Ошибка загрузки PDF</div>}
          >
            <div 
              ref={pageRef}
              className="relative cursor-crosshair"
              onClick={handlePageClick}
            >
              <Page 
                pageNumber={pageNumber} 
                scale={scale} 
                width={pageWidth > 0 ? pageWidth : undefined}
                renderTextLayer={false} 
                renderAnnotationLayer={false} 
                className="select-none shadow-sm"
              />
              
              {/* Existing Annotations */}
              {showNotes && pageAnnotations.map(note => (
                <div 
                  key={note.id}
                  className="note-marker absolute w-6 h-6 -ml-3 -mt-3 rounded-full shadow-md cursor-pointer transition-transform hover:scale-125 hover:z-50 border-2 border-white flex items-center justify-center"
                  style={{
                    left: `${note.positionX}%`,
                    top: `${note.positionY}%`,
                    backgroundColor: (note as any).isShared ? '#3b82f6' : '#fbbf24',
                    zIndex: activeNoteId === note.id ? 50 : 10
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsDrafting(false);
                    setActiveNoteId(activeNoteId === note.id ? null : note.id);
                    setNoteToDelete(null);
                  }}
                >
                  <span className="text-[10px] font-black text-[#1c1c1e]">?</span>
                  
                  {activeNoteId === note.id && (
                    <div className="absolute top-8 left-1/2 -translate-x-1/2 w-48 bg-white rounded-xl shadow-xl p-3 border border-[var(--border)] cursor-default" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-2 border-b border-gray-100 pb-2 mb-2">
                        <div className="w-5 h-5 rounded-full bg-gray-200 overflow-hidden shrink-0">
                          {note.user?.avatar && <img src={note.user.avatar} alt="avatar" className="w-full h-full object-cover" />}
                        </div>
                        <span className="text-[11px] font-bold text-[#1c1c1e] truncate flex-1">
                          {note.user?.firstName || note.user?.username || 'Пользователь'}
                          {(note as any).isShared && (
                            <span className="ml-1 text-[8px] px-1 py-0.5 rounded bg-blue-100 text-blue-700 font-medium align-middle">общая</span>
                          )}
                        </span>
                        {currentUserId && note.user?.id === currentUserId && (
                          <button 
                            onClick={() => setNoteToDelete(note.id)}
                            className="w-5 h-5 rounded-full bg-gray-100 hover:bg-gray-200 text-[#1c1c1e] flex items-center justify-center shrink-0 transition-colors"
                            title="Удалить заметку"
                          >
                            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                          </button>
                        )}
                      </div>
                      
                      {noteToDelete === note.id ? (
                        <div className="mt-2 animate-fadeIn">
                          <p className="text-[11px] text-[#1c1c1e] font-bold mb-2 text-center">Точно удалить заметку?</p>
                          <div className="flex gap-2">
                            <button onClick={() => setNoteToDelete(null)} className="flex-1 py-1.5 bg-gray-100 text-[#1c1c1e] rounded text-[10px] font-bold hover:bg-gray-200 transition-colors">Отмена</button>
                            <button onClick={() => handleDeleteAnnotation(note.id)} className="flex-1 py-1.5 bg-[#1c1c1e] text-white rounded text-[10px] font-bold hover:bg-black transition-colors shadow-sm">Удалить</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="text-[12px] text-gray-700 whitespace-pre-wrap leading-relaxed">{note.content}</p>
                          <div className="text-[9px] text-gray-400 mt-2 text-right">{new Date(note.createdAt).toLocaleDateString()}</div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {/* Drafting Note */}
              {showNotes && isDrafting && (
                <div 
                  className="absolute w-6 h-6 -ml-3 -mt-3 rounded-full bg-white shadow-[0_0_0_2px_#3b82f6] animate-pulse z-40 note-marker"
                  style={{ left: `${draftPos.x}%`, top: `${draftPos.y}%` }}
                  onClick={e => e.stopPropagation()}
                >
                  <div className="absolute top-8 left-1/2 -translate-x-1/2 w-56 bg-white rounded-xl shadow-2xl p-3 border border-[var(--border)]">
                    <p className="text-[11px] font-bold text-gray-500 mb-2 uppercase tracking-wide">Новая заметка</p>
                    <textarea 
                      autoFocus
                      value={draftContent}
                      onChange={e => setDraftContent(e.target.value)}
                      placeholder="Введите текст заметки..."
                      className="w-full h-20 outline-none text-[13px] resize-none border border-gray-200 rounded-lg p-2 mb-2 focus:border-[#3b82f6] transition-colors"
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          saveAnnotation();
                        }
                      }}
                    />
                    {eduContext && (eduContext.role === 'ADMIN' || eduContext.role === 'TEACHER') && (
                      <label className="flex items-center gap-1.5 mb-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={draftShared}
                          onChange={(e) => setDraftShared(e.target.checked)}
                          className="w-3.5 h-3.5"
                        />
                        <span className="text-[10px] text-gray-600">Видна учащимся учреждения</span>
                      </label>
                    )}
                    <div className="flex gap-2">
                      <button onClick={() => { setIsDrafting(false); setDraftShared(false); }} className="flex-1 py-1.5 rounded-md text-[11px] font-bold text-gray-500 hover:bg-gray-100 transition-colors">Отмена</button>
                      <button onClick={saveAnnotation} className="flex-1 py-1.5 rounded-md text-[11px] font-bold bg-[#3b82f6] text-white hover:bg-blue-600 transition-colors">Сохранить</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Document>
        </div>
      </div>
    </div>,
    document.body
  );
}
