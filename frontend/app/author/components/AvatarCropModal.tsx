'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  file: File;
  onCancel: () => void;
  onDone: (blob: Blob) => void;
}

const DEFAULT_CIRCLE = 320;
const MIN_CIRCLE = 100;
const STAGE_PAD = 60; // отступ от края stage до квадрата кропа
const OUTPUT = 512;

// Telegram-style:
// - изображение можно drag/zoom
// - круглый кроп с угловыми скобками
// - УГЛОВЫЕ СКОБКИ — это ручки изменения размера кропа (drag за угол → круг меняет размер)
export default function AvatarCropModal({ file, onCancel, onDone }: Props) {
  const [src, setSrc] = useState<string>('');
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [circle, setCircle] = useState(DEFAULT_CIRCLE);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const [busy, setBusy] = useState(false);

  // Контейнер кадрировщика — фиксированный размер, респонсивно ограничен viewport через CSS
  const [STAGE, setStage] = useState(560);
  useEffect(() => {
    const calc = () => setStage(Math.min(window.innerWidth - 40, window.innerHeight - 140, 560));
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, []);

  // Drag state (для перемещения картинки)
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number; active: boolean }>({
    x: 0, y: 0, ox: 0, oy: 0, active: false,
  });
  // Pinch state (для зума на мобиле)
  const pinchRef = useRef<{ d: number; s: number; active: boolean }>({ d: 0, s: 1, active: false });
  // Resize state (для изменения размера кропа за угол)
  const resizeRef = useRef<{ x: number; y: number; c: number; corner: string; active: boolean }>({
    x: 0, y: 0, c: 0, corner: '', active: false,
  });

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const onImgLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setNatural({ w: img.naturalWidth, h: img.naturalHeight });
    const minSide = Math.min(img.naturalWidth, img.naturalHeight);
    const fit = DEFAULT_CIRCLE / minSide;
    setScale(fit);
    setOffset({ x: 0, y: 0 });
    setCircle(DEFAULT_CIRCLE);
  };

  const minScale = () => 0.05;
  const maxScale = () => {
    if (!natural.w || !natural.h) return 10;
    const minSide = Math.min(natural.w, natural.h);
    return (circle * 10) / minSide;
  };
  const fitScale = () => {
    if (!natural.w || !natural.h) return 1;
    const minSide = Math.min(natural.w, natural.h);
    return circle / minSide;
  };

  // Drag по картинке (на любом месте кроме угловых ручек)
  const onStagePointerDown = (e: React.PointerEvent) => {
    if (pinchRef.current.active) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y, active: true };
  };
  const onStagePointerMove = (e: React.PointerEvent) => {
    if (resizeRef.current.active) return;
    if (!dragRef.current.active) return;
    const dx = e.clientX - dragRef.current.x;
    const dy = e.clientY - dragRef.current.y;
    setOffset({ x: dragRef.current.ox + dx, y: dragRef.current.oy + dy });
  };
  const onStagePointerUp = (e: React.PointerEvent) => {
    dragRef.current.active = false;
    try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
  };

  // Resize за угол: новый радиус = расстояние от центра до точки * 1.41 (диагональ)
  // упрощённо: dist между указателем и центром, в обе стороны
  const startResize = (corner: string) => (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    resizeRef.current = { x: e.clientX, y: e.clientY, c: circle, corner, active: true };
  };
  const onResizePointerMove = (e: React.PointerEvent) => {
    if (!resizeRef.current.active) return;
    const dx = e.clientX - resizeRef.current.x;
    const dy = e.clientY - resizeRef.current.y;
    // Направление: для tl/bl уменьшение по +X, для tr/br увеличение по +X. Знак подбираем по углу.
    const corner = resizeRef.current.corner;
    const sx = corner.includes('l') ? -1 : 1;
    const sy = corner.includes('t') ? -1 : 1;
    // Усреднённое изменение по диагонали — берём средний рост из двух осей
    const delta = (dx * sx + dy * sy);
    const next = clamp(resizeRef.current.c + delta, MIN_CIRCLE, STAGE - STAGE_PAD * 2);
    setCircle(next);
  };
  const onResizePointerUp = (e: React.PointerEvent) => {
    resizeRef.current.active = false;
    try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
  };

  // Pinch
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
      setScale(clamp(ns, minScale(), maxScale()));
    }
  };
  const onTouchEnd = () => {
    pinchRef.current.active = false;
  };

  // Wheel zoom: native listener с {passive:false}
  const stageRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const delta = -e.deltaY * 0.0015;
      setScale((s) => clamp(s * (1 + delta), minScale(), maxScale()));
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [natural.w, natural.h, circle]);

  const reset = () => {
    setScale(fitScale());
    setOffset({ x: 0, y: 0 });
    setCircle(DEFAULT_CIRCLE);
  };

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

      const k = OUTPUT / circle;
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

  const imgW = natural.w * scale;
  const imgH = natural.h * scale;
  const cx = STAGE / 2;
  const cy = STAGE / 2;
  const half = circle / 2;

  // Через portal в body — иначе родительские transform/backdrop-filter
  // (например GrainientBackground, плеер, navbar) создают свой containing block
  // и наш `fixed` не покрывает viewport.
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/85"
      style={{ zIndex: 2147483647, top: 0, left: 0, right: 0, bottom: 0 }}>
      <button
        type="button"
        onClick={onCancel}
        className="absolute top-4 left-4 text-white/80 hover:text-white text-3xl leading-none w-10 h-10 flex items-center justify-center">
        ×
      </button>
      <button
        type="button"
        onClick={confirm}
        disabled={busy || !natural.w}
        className="absolute top-4 right-4 text-white font-semibold text-sm px-5 py-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors disabled:opacity-50">
        {busy ? 'Сохраняем…' : 'Готово'}
      </button>

      <div
        ref={stageRef}
        className="relative overflow-hidden select-none touch-none"
        style={{ width: STAGE, height: STAGE, maxWidth: '100vw', maxHeight: '100vh' }}
        onPointerDown={onStagePointerDown}
        onPointerMove={(e) => {
          onStagePointerMove(e);
          onResizePointerMove(e);
        }}
        onPointerUp={(e) => {
          onStagePointerUp(e);
          onResizePointerUp(e);
        }}
        onPointerCancel={(e) => {
          onStagePointerUp(e);
          onResizePointerUp(e);
        }}
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
              left: cx - imgW / 2 + offset.x,
              top: cy - imgH / 2 + offset.y,
              width: imgW,
              height: imgH,
              userSelect: 'none',
              pointerEvents: 'none',
              maxWidth: 'none',
            }}
          />
        )}

        {/* Затемнение с круглым окном */}
        <div
          className="absolute rounded-full pointer-events-none"
          style={{
            left: cx - half,
            top: cy - half,
            width: circle,
            height: circle,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.65)',
            border: '1px solid rgba(255,255,255,0.15)',
          }}
        />

        {/* Угловые скобки — теперь ручки для изменения размера круга */}
        <CornerHandle corner="tl" cx={cx} cy={cy} half={half} onDown={startResize('tl')} />
        <CornerHandle corner="tr" cx={cx} cy={cy} half={half} onDown={startResize('tr')} />
        <CornerHandle corner="bl" cx={cx} cy={cy} half={half} onDown={startResize('bl')} />
        <CornerHandle corner="br" cx={cx} cy={cy} half={half} onDown={startResize('br')} />
      </div>

      <button
        type="button"
        onClick={reset}
        className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/70 hover:text-white text-sm uppercase tracking-widest">
        Сброс
      </button>
    </div>,
    document.body
  );
}

function CornerHandle({
  corner, cx, cy, half, onDown,
}: {
  corner: 'tl' | 'tr' | 'bl' | 'br';
  cx: number; cy: number; half: number;
  onDown: (e: React.PointerEvent) => void;
}) {
  const size = 22;
  const lineLen = 22;
  const isTop = corner.startsWith('t');
  const isLeft = corner.endsWith('l');
  // Позиция: внешний угол вписанного в круг квадрата
  const left = isLeft ? cx - half : cx + half - size;
  const top = isTop ? cy - half : cy + half - size;
  // Большая невидимая зона хвата + видимые две белые линии
  const hitPad = 14;
  return (
    <div
      className="absolute"
      style={{
        left: left - hitPad,
        top: top - hitPad,
        width: size + hitPad * 2,
        height: size + hitPad * 2,
        cursor: isTop === isLeft ? 'nwse-resize' : 'nesw-resize',
      }}
      onPointerDown={onDown}>
      {/* Видимые линии скобки внутри хит-зоны */}
      <div
        className="absolute bg-white"
        style={{
          width: 3,
          height: lineLen,
          ...(isLeft ? { left: hitPad } : { right: hitPad }),
          ...(isTop ? { top: hitPad } : { bottom: hitPad }),
        }}
      />
      <div
        className="absolute bg-white"
        style={{
          height: 3,
          width: lineLen,
          ...(isLeft ? { left: hitPad } : { right: hitPad }),
          ...(isTop ? { top: hitPad } : { bottom: hitPad }),
        }}
      />
    </div>
  );
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}
