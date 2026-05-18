'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  file: File;
  onCancel: () => void;
  onDone: (blob: Blob) => void;
}

const CIRCLE = 320; // диаметр круглой области выбора
const OUTPUT = 512; // итоговый размер аватарки

// Telegram-style кадрировщик:
// - картинка занимает всё окно, поверх — затемнение с круглым «окошком»
// - перетаскивание (мышка / палец) → перемещение
// - колесо мыши / пинч → зум, БЕЗ ползунка
// - угловые скобки показывают границу видимой области
// - кнопка "Сброс" возвращает в начальное положение
export default function AvatarCropModal({ file, onCancel, onDone }: Props) {
  const [src, setSrc] = useState<string>('');
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const [busy, setBusy] = useState(false);

  // Drag state
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number; active: boolean }>({
    x: 0, y: 0, ox: 0, oy: 0, active: false,
  });
  const pinchRef = useRef<{ d: number; s: number; active: boolean }>({ d: 0, s: 1, active: false });

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const onImgLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setNatural({ w: img.naturalWidth, h: img.naturalHeight });
    const minSide = Math.min(img.naturalWidth, img.naturalHeight);
    const fit = CIRCLE / minSide;
    setScale(fit);
    setOffset({ x: 0, y: 0 });
  };

  const minScale = () => {
    if (!natural.w || !natural.h) return 0.1;
    const minSide = Math.min(natural.w, natural.h);
    return CIRCLE / minSide;
  };

  // PC drag
  const onPointerDown = (e: React.PointerEvent) => {
    if (pinchRef.current.active) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y, active: true };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current.active) return;
    const dx = e.clientX - dragRef.current.x;
    const dy = e.clientY - dragRef.current.y;
    setOffset({ x: dragRef.current.ox + dx, y: dragRef.current.oy + dy });
  };
  const onPointerUp = (e: React.PointerEvent) => {
    dragRef.current.active = false;
    try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
  };

  // Wheel zoom (PC)
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.0015;
    setScale((s) => clamp(s * (1 + delta), minScale(), minScale() * 10));
  };

  // Pinch zoom (mobile)
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const [a, b] = [e.touches[0], e.touches[1]];
      const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      pinchRef.current = { d, s: scale, active: true };
      dragRef.current.active = false;
    }
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchRef.current.active) {
      e.preventDefault();
      const [a, b] = [e.touches[0], e.touches[1]];
      const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      const ns = pinchRef.current.s * (d / pinchRef.current.d);
      setScale(clamp(ns, minScale(), minScale() * 10));
    }
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) pinchRef.current.active = false;
  };

  const reset = () => {
    setScale(minScale());
    setOffset({ x: 0, y: 0 });
  };

  // Финальная отрисовка: квадрат 512×512, обрезанный кругом
  const confirm = async () => {
    if (!imgRef.current) return;
    setBusy(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = OUTPUT;
      canvas.height = OUTPUT;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.beginPath();
      ctx.arc(OUTPUT / 2, OUTPUT / 2, OUTPUT / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();

      const k = OUTPUT / CIRCLE;
      const drawW = natural.w * scale * k;
      const drawH = natural.h * scale * k;
      const cx = OUTPUT / 2 + offset.x * k;
      const cy = OUTPUT / 2 + offset.y * k;
      const dx = cx - drawW / 2;
      const dy = cy - drawH / 2;
      ctx.drawImage(imgRef.current, dx, dy, drawW, drawH);

      canvas.toBlob((blob) => {
        if (blob) onDone(blob);
      }, 'image/png', 0.92);
    } finally {
      setBusy(false);
    }
  };

  // Размер контейнера — больше круга, чтобы оставить место для скобок и затемнения
  const CONTAINER = CIRCLE + 80;

  // Картинка на экране
  const imgW = natural.w * scale;
  const imgH = natural.h * scale;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/85">
      {/* Header — закрыть */}
      <button
        type="button"
        onClick={onCancel}
        className="absolute top-4 left-4 text-white/80 hover:text-white text-3xl leading-none w-10 h-10 flex items-center justify-center">
        ×
      </button>
      {/* Готово */}
      <button
        type="button"
        onClick={confirm}
        disabled={busy || !natural.w}
        className="absolute top-4 right-4 text-white font-semibold text-sm px-5 py-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors disabled:opacity-50">
        {busy ? 'Сохраняем…' : 'Готово'}
      </button>

      {/* Сам кадрировщик */}
      <div
        className="relative overflow-hidden select-none touch-none"
        style={{ width: CONTAINER, height: CONTAINER, maxWidth: '100vw', maxHeight: '100vh' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}>
        {/* Картинка */}
        {src && (
          <img
            ref={imgRef}
            src={src}
            alt=""
            onLoad={onImgLoad}
            draggable={false}
            style={{
              position: 'absolute',
              left: CONTAINER / 2 - imgW / 2 + offset.x,
              top: CONTAINER / 2 - imgH / 2 + offset.y,
              width: imgW,
              height: imgH,
              userSelect: 'none',
              pointerEvents: 'none',
              maxWidth: 'none',
              cursor: 'grab',
            }}
          />
        )}

        {/* Затемнение с круглым окном (box-shadow trick) */}
        <div
          className="absolute rounded-full pointer-events-none"
          style={{
            left: CONTAINER / 2 - CIRCLE / 2,
            top: CONTAINER / 2 - CIRCLE / 2,
            width: CIRCLE,
            height: CIRCLE,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.65)',
            border: '1px solid rgba(255,255,255,0.15)',
          }}
        />

        {/* Угловые скобки вокруг круга */}
        <CropBracket pos="tl" />
        <CropBracket pos="tr" />
        <CropBracket pos="bl" />
        <CropBracket pos="br" />
      </div>

      {/* Сброс */}
      <button
        type="button"
        onClick={reset}
        className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/70 hover:text-white text-sm uppercase tracking-widest">
        Сброс
      </button>
    </div>
  );
}

function CropBracket({ pos }: { pos: 'tl' | 'tr' | 'bl' | 'br' }) {
  // Скобка: 2 белые линии в углу 24x24, угол к центру круга
  const CONTAINER = CIRCLE + 80;
  const inset = CONTAINER / 2 - CIRCLE / 2; // отступ от края контейнера до круга
  const size = 22;
  const off = inset - 6;
  const isTop = pos.startsWith('t');
  const isLeft = pos.endsWith('l');
  const pad: any = {};
  if (isTop) pad.top = off; else pad.bottom = off;
  if (isLeft) pad.left = off; else pad.right = off;
  return (
    <div className="absolute pointer-events-none" style={{ ...pad, width: size, height: size }}>
      <div
        className="absolute bg-white"
        style={{
          width: 2,
          height: size,
          ...(isLeft ? { left: 0 } : { right: 0 }),
          ...(isTop ? { top: 0 } : { bottom: 0 }),
        }}
      />
      <div
        className="absolute bg-white"
        style={{
          height: 2,
          width: size,
          ...(isLeft ? { left: 0 } : { right: 0 }),
          ...(isTop ? { top: 0 } : { bottom: 0 }),
        }}
      />
    </div>
  );
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}
