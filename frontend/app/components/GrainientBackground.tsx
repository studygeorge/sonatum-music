'use client';

import { usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';

const Grainient = dynamic(() => import('./Grainient'), { ssr: false });

// Which pages get which palette
const PAGE_PALETTES: Record<string, { color1: string; color2: string; color3: string; saturation?: number; contrast?: number }> = {
  // Home, Catalog, Map — lively colors
  '/': { color1: '#d0e8ff', color2: '#f8f8ff', color3: '#ffd0d0', saturation: 0.7, contrast: 1.08 },
  '/catalog': { color1: '#d0e8ff', color2: '#f8f8ff', color3: '#ffd0d0', saturation: 0.7, contrast: 1.08 },
  '/map': { color1: '#d0e8ff', color2: '#f8f8ff', color3: '#ffd0d0', saturation: 0.7, contrast: 1.08 },
  // Auth & Profile — Lavender
  '/login':    { color1: '#c7d2fe', color2: '#f0f4ff', color3: '#e0e7ff', saturation: 0.7, contrast: 1.1 },
  '/register': { color1: '#c7d2fe', color2: '#f0f4ff', color3: '#e0e7ff', saturation: 0.7, contrast: 1.1 },
  '/profile':  { color1: '#e0e7ff', color2: '#f8faff', color3: '#ede9fe', saturation: 0.5, contrast: 1.05 },
};

const DEFAULT_PALETTE = { color1: '#e8eaf6', color2: '#f8f8ff', color3: '#ede8f5', saturation: 0.4, contrast: 1.04 };

export default function GrainientBackground() {
  const pathname = usePathname();
  const palette = PAGE_PALETTES[pathname] ?? DEFAULT_PALETTE;

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: -1,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
      }}
    >
      <Grainient
        color1={palette.color1}
        color2={palette.color2}
        color3={palette.color3}
        grainAmount={0.06}
        timeSpeed={0.14}
        saturation={palette.saturation ?? 0.6}
        contrast={palette.contrast ?? 1.07}
        zoom={0.88}
        warpAmplitude={60}
      />
    </div>
  );
}
