'use client';

import { useState, useCallback, useEffect } from 'react';
import Cropper, { Area } from 'react-easy-crop';
import Portal from './Portal';

type Props = {
  open: boolean;
  imageUrl: string;
  aspect?: number; // default 1 (квадрат)
  freeAspect?: boolean; // true → кадрируем в исходных пропорциях картинки (без квадрата)
  title?: string;
  cropShape?: 'rect' | 'round'; // круг для аватаров
  onCancel: () => void;
  onCropped: (blob: Blob) => void;
};

/**
 * Модалка кадрирования фото. Возвращает Blob (JPEG, размер до 1024×1024).
 * Используется для обложек плейлистов, аватара и т.п.
 */
const MIN_ZOOM = 1;
const MAX_ZOOM = 5;

export default function ImageCropper({
  open,
  imageUrl,
  aspect = 1,
  freeAspect = false,
  title = 'Кадрирование',
  cropShape = 'rect',
  onCancel,
  onCropped,
}: Props) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);
  // Натуральные пропорции загруженной картинки — по ним строим «сцену»,
  // чтобы фото было видно целиком, а квадратную рамку накладываем сверху.
  const [naturalAspect, setNaturalAspect] = useState<number | null>(null);

  // Сцену показа делаем по пропорциям фото (с разумным ограничением),
  // чтобы картинка влезала целиком. Рамка кадрирования всегда aspect (=1, квадрат).
  const stageAspect = freeAspect && naturalAspect
    ? Math.max(0.6, Math.min(2.2, naturalAspect))
    : 1;

  // Сброс при смене картинки
  useEffect(() => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setNaturalAspect(null);
  }, [imageUrl]);

  const onCropComplete = useCallback((_: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  // Double-click — reset position+zoom
  const handleDoubleClick = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  };

  const clamp = (v: number) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, v));

  const apply = async () => {
    if (!croppedAreaPixels) return;
    setBusy(true);
    try {
      const blob = await getCroppedBlob(imageUrl, croppedAreaPixels);
      onCropped(blob);
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <Portal>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget && !busy) onCancel();
        }}>
        <div
          className="apple-card shadow-2xl"
          style={{ width: '100%', maxWidth: 520, padding: 0, overflow: 'hidden' }}
          onClick={(e) => e.stopPropagation()}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{title}</h3>
              <button
                onClick={onCancel}
                disabled={busy}
                aria-label="Закрыть"
                style={{ background: 'transparent', border: 'none', lineHeight: 0, cursor: 'pointer', color: '#86868b' }}>
                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          </div>

          <div
            style={{
              position: 'relative',
              width: '100%',
              aspectRatio: String(stageAspect),
              maxHeight: '60vh',
              background: '#1c1c1e',
              overflow: 'hidden',
            }}
            onDoubleClick={handleDoubleClick}>
            <Cropper
              image={imageUrl}
              crop={crop}
              zoom={zoom}
              minZoom={MIN_ZOOM}
              maxZoom={MAX_ZOOM}
              zoomSpeed={0.5}
              aspect={aspect}
              cropShape={cropShape}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
              onMediaLoaded={(media) => {
                if (freeAspect && media?.naturalWidth && media?.naturalHeight) {
                  setNaturalAspect(media.naturalWidth / media.naturalHeight);
                }
              }}
              showGrid={true}
              objectFit={freeAspect ? 'contain' : 'cover'}
              restrictPosition={true}
              style={{
                cropAreaStyle: {
                  border: '2px solid rgba(255,255,255,0.95)',
                  boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)',
                },
              }}
            />

            {/* Floating zoom controls — как в Telegram / Instagram */}
            <div
              style={{
                position: 'absolute',
                bottom: 12,
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                background: 'rgba(0,0,0,0.55)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                borderRadius: 999,
                padding: '4px 4px',
                userSelect: 'none',
              }}>
              <button
                type="button"
                onClick={() => setZoom((z) => clamp(z - 0.25))}
                disabled={zoom <= MIN_ZOOM + 0.001}
                aria-label="Уменьшить"
                style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: 'rgba(255,255,255,0.12)',
                  color: '#fff', border: 'none', cursor: 'pointer',
                  fontSize: 18, fontWeight: 300, lineHeight: 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  opacity: zoom <= MIN_ZOOM + 0.001 ? 0.4 : 1,
                }}>
                −
              </button>
              <div style={{ color: '#fff', fontSize: 11, minWidth: 36, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                {Math.round(zoom * 100)}%
              </div>
              <button
                type="button"
                onClick={() => setZoom((z) => clamp(z + 0.25))}
                disabled={zoom >= MAX_ZOOM - 0.001}
                aria-label="Увеличить"
                style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: 'rgba(255,255,255,0.12)',
                  color: '#fff', border: 'none', cursor: 'pointer',
                  fontSize: 18, fontWeight: 300, lineHeight: 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  opacity: zoom >= MAX_ZOOM - 0.001 ? 0.4 : 1,
                }}>
                +
              </button>
            </div>
          </div>

          <div style={{ padding: '12px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 12, color: '#86868b', lineHeight: 1.5 }}>
              Квадратная рамка — это область обложки. Двигайте фото, чтобы выбрать,<br />
              что попадёт в рамку (картинка показана целиком, не сжимается).<br />
              Колесо мыши / pinch на трекпаде / щипок на телефоне — масштаб.
              Двойной клик — сброс.
            </div>
          </div>

          <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button
              onClick={onCancel}
              disabled={busy}
              style={{
                padding: '10px 20px',
                borderRadius: 999,
                background: 'var(--hover)',
                border: 'none',
                fontSize: 14,
                fontWeight: 500,
                cursor: busy ? 'not-allowed' : 'pointer',
              }}>
              Отмена
            </button>
            <button
              onClick={apply}
              disabled={busy || !croppedAreaPixels}
              style={{
                padding: '10px 24px',
                borderRadius: 999,
                background: 'var(--text-primary)',
                color: '#fff',
                border: 'none',
                fontSize: 14,
                fontWeight: 600,
                cursor: busy ? 'not-allowed' : 'pointer',
                opacity: busy ? 0.5 : 1,
              }}>
              {busy ? 'Обрабатываем…' : 'Применить'}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = url;
  });
}

async function getCroppedBlob(imageSrc: string, pixelCrop: Area): Promise<Blob> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  // Ограничиваем выходной размер до 1024 (достаточно для обложек, не раздуваем CDN).
  const MAX = 1024;
  const scale = Math.min(1, MAX / Math.max(pixelCrop.width, pixelCrop.height));
  canvas.width = Math.round(pixelCrop.width * scale);
  canvas.height = Math.round(pixelCrop.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2d context unavailable');
  ctx.drawImage(
    image,
    pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height,
    0, 0, canvas.width, canvas.height
  );
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error('toBlob failed'));
    }, 'image/jpeg', 0.9);
  });
}
