'use client';

import { useEffect, useState, ReactNode, MouseEvent } from 'react';
import { createPortal } from 'react-dom';

/**
 * Универсальная модалка через React portal в document.body.
 *
 * Зачем portal: position: fixed внутри элементов с transform / filter /
 * backdrop-filter / will-change позиционируется не относительно viewport,
 * а относительно ближайшего такого предка. Это приводит к тому, что
 * затемнение и blur накрывают только часть экрана (см. плеер, layout).
 * Portal вырывает узел из дерева и монтирует прямо в <body>.
 */
type Props = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  // Закрывать по клику в фон. Default true.
  closeOnBackdrop?: boolean;
  // Закрывать по Esc. Default true.
  closeOnEsc?: boolean;
  // Дополнительный класс внешнего блока (карточки)
  className?: string;
  // Z-index (default 1000 — выше плеера и навбара)
  zIndex?: number;
  // Если true — модалка не блокирует скролл body (редко нужно).
  allowBodyScroll?: boolean;
};

export default function Modal({
  open,
  onClose,
  children,
  closeOnBackdrop = true,
  closeOnEsc = true,
  className = '',
  zIndex = 1000,
  allowBodyScroll = false,
}: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Блокируем скролл body, пока модалка открыта
  useEffect(() => {
    if (!open || allowBodyScroll) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open, allowBodyScroll]);

  // Закрытие по Esc
  useEffect(() => {
    if (!open || !closeOnEsc) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, closeOnEsc, onClose]);

  if (!mounted || !open) return null;

  const onBackdrop = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && closeOnBackdrop) onClose();
  };

  return createPortal(
    <div
      onClick={onBackdrop}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        background: 'rgba(0,0,0,0.45)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        overscrollBehavior: 'contain',
      }}>
      <div
        className={className}
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        {children}
      </div>
    </div>,
    document.body
  );
}
