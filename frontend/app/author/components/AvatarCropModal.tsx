'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  file: File;
  onCancel: () => void;
  onDone: (blob: Blob) => void;
}

const CIRCLE = 280; // диаметр кружка предпросмотра
const OUTPUT = 512; // итоговый размер квадрата (центр будет круглым после CSS)

// Простой кадрировщик: показывает картинку в круге, поддерживает drag и zoom
// (колесом мыши, ползунком, пинчем на мобильных). По «Готово» вырезает
// текущий видимый кружок в 512×512 PNG и отдаёт через onDone(blob).
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
  // Pinch state
  const pinchRef = useRef<{ d: number; s: number; active: boolean }>({ d: 0, s: 1, active: false });

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Когда картинка загружается — устанавливаем стартовый scale так, чтобы
  // короткая сторона помещалась в круг.
  const onImgLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setNatural({ w: img.naturalWidth, h: img.naturalHeight });
    const minSide = Math.min(img.naturalWidth, img.naturalHeight);
    const fit = CIRCLE / minSide;
    setScale(fit);
    setOffset({ x: 0, y: 0 });
  };

  // Drag handlers
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.isPrimary === false && pinchRef.current.active) return;
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
    setScale((s) => clamp(s * (1 + delta), minScale(), 8));
  };

  // Pinch zoom (mobile)
  const touchesRef = useRef<{ [k: number]: { x: number; y: number } }>({});
  const onTouchStart = (e: React.TouchEvent) => {
    for (let i = 0; i < e.touches.length; i++) {
      const t = e.touches[i];
      touchesRef.current[t.identifier] = { x: t.clientX, y: t.clientY };
    }
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
      setScale(clamp(ns, minScale(), 8));
    }
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) pinchRef.current.active = false;
    for (let i = 0; i < e.changedTouches.length; i++) {
      delete touchesRef.current[e.changedTouches[i].identifier];
    }
  };

  const minScale = () => {
    if (!natural.w || !natural.h) return 0.1;
    const minSide = Math.min(natural.w, natural.h);
    return CIRCLE / minSide;
  };

  const reset = () => {
    setScale(minScale());
    setOffset({ x: 0, y: 0 });
  };

  // Финальная отрисовка: вырезаем 512×512 квадрат с тем же преобразованием
  const confirm = async () => {
    if (!imgRef.current) return;
    setBusy(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = OUTPUT;
      canvas.height = OUTPUT;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Маска по кругу (canvas сам по себе квадратный, но мы рисуем
      // изображение, а CSS на фронте обрезает в круг). Чтобы получить
      // фактически круглую png — вырезаем clip.
      ctx.beginPath();
      ctx.arc(OUTPUT / 2, OUTPUT / 2, OUTPUT / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();

      // Масштаб: на экране 1 px источника = scale экранных px.
      // В выходной 512×512 1 px CIRCLE = OUTPUT/CIRCLE = ~1.83.
      const k = OUTPUT / CIRCLE;
      const sw = natural.w;
      const sh = natural.h;

      const drawW = sw * scale * k;
      const drawH = sh * scale * k;
      const drawX = (OUTPUT / 2) - (sw * scale / 2 - offset.x) * k - (sw * scale * k - sw * scale * k) / 2;
      // Положение: центр круга в (OUTPUT/2, OUTPUT/2), центр картинки
      // относительно центра круга — offset (в экранных px). Перевод в канвас:
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

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-md p-5 shadow-2xl">
        <h3 className="text-lg font-bold text-gray-900 mb-1">Подгоните фото</h3>
        <p className="text-xs text-gray-500 mb-4">
          Перетаскивайте — позиция; колесом мыши, ползунком или пинчем — масштаб.
        </p>

        {/* Контейнер с круглой маской */}
        <div
          className="mx-auto select-none touch-none"
          style={{ width: CIRCLE, height: CIRCLE }}>
          <div
            className="relative overflow-hidden rounded-full bg-gray-100 border-2 border-gray-200 cursor-grab active:cursor-grabbing"
            style={{ width: CIRCLE, height: CIRCLE }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onWheel={onWheel}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}>
            {src && (
              <img
                ref={imgRef}
                src={src}
                alt=""
                onLoad={onImgLoad}
                draggable={false}
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  width: natural.w * scale,
                  height: natural.h * scale,
                  transform: `translate(${offset.x - natural.w * scale / 2}px, ${offset.y - natural.h * scale / 2}px)`,
                  userSelect: 'none',
                  pointerEvents: 'none',
                  maxWidth: 'none',
                }}
              />
            )}
            {/* Сетка третей чтоб было удобно */}
            <div className="absolute inset-0 pointer-events-none border-2 border-white/50 rounded-full" />
          </div>
        </div>

        {/* Zoom slider */}
        <div className="mt-4 flex items-center gap-3">
          <span className="text-xs text-gray-500 shrink-0">Масштаб</span>
          <input
            type="range"
            min={minScale()}
            max={Math.max(minScale() * 5, 5)}
            step="0.01"
            value={scale}
            onChange={(e) => setScale(parseFloat(e.target.value))}
            className="flex-1 accent-black"
          />
          <button
            type="button"
            onClick={reset}
            className="text-xs text-gray-700 underline hover:text-black shrink-0">
            сброс
          </button>
        </div>

        <div className="flex gap-2 mt-5">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-3 rounded-xl border border-gray-300 bg-white text-gray-900 font-medium hover:bg-gray-100 transition-colors">
            Отмена
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={busy || !natural.w}
            className="flex-1 px-4 py-3 rounded-xl bg-black text-white font-medium hover:bg-gray-800 transition-colors disabled:opacity-50">
            {busy ? 'Сохраняем…' : 'Готово'}
          </button>
        </div>
      </div>
    </div>
  );
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}
