'use client';

export default function RegionPanelStyles() {
  return (
    <style jsx global>{`
      .region-panel {
        position: fixed;
        z-index: 20000;
        color: #1a202c;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', sans-serif;
      }

      .region-panel__inner {
        height: 100%;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        background: rgba(255, 255, 255, 0.92);
        backdrop-filter: blur(18px) saturate(160%);
        -webkit-backdrop-filter: blur(18px) saturate(160%);
        border: 1px solid rgba(0, 0, 0, 0.08);
      }

      .region-panel__top {
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 18px 16px;
        border-bottom: 1px solid rgba(0, 0, 0, 0.06);
        background: linear-gradient(135deg, rgba(0, 0, 0, 0.02), rgba(0, 0, 0, 0.01));
      }

      .region-panel__badge {
        width: 10px;
        height: 44px;
        border-radius: 8px;
        flex: 0 0 auto;
        box-shadow: 0 6px 18px rgba(0, 0, 0, 0.12);
      }

      .region-panel__titlewrap {
        flex: 1 1 auto;
        min-width: 0;
      }

      .region-panel__title {
        font-size: 18px;
        font-weight: 800;
        line-height: 1.2;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .region-panel__subtitle {
        font-size: 12px;
        font-weight: 600;
        color: rgba(45, 55, 72, 0.65);
        margin-top: 4px;
      }

      .region-panel__close {
        width: 40px;
        height: 40px;
        border-radius: 12px;
        border: 1px solid rgba(0, 0, 0, 0.08);
        background: rgba(255, 255, 255, 0.9);
        cursor: pointer;
        font-size: 24px;
        line-height: 1;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
      }

      .region-panel__close:hover {
        transform: scale(1.05);
        background: rgba(255, 255, 255, 1);
        box-shadow: 0 10px 18px rgba(0, 0, 0, 0.14);
      }

      .region-panel__content {
        padding: 18px 16px 22px 16px;
        overflow: auto;
        overscroll-behavior: contain;
      }

      .region-panel__placeholder {
        padding: 14px 14px;
        border-radius: 14px;
        background: rgba(0, 0, 0, 0.035);
        color: rgba(45, 55, 72, 0.72);
        font-weight: 700;
        line-height: 1.5;
      }

      .region-panel__content::-webkit-scrollbar { width: 10px; }
      .region-panel__content::-webkit-scrollbar-track { background: rgba(0, 0, 0, 0.06); border-radius: 10px; }
      .region-panel__content::-webkit-scrollbar-thumb { background: rgba(0, 0, 0, 0.22); border-radius: 10px; }
      .region-panel__content::-webkit-scrollbar-thumb:hover { background: rgba(0, 0, 0, 0.3); }

      /* DESKTOP DRAWER (шире) */
      .region-panel--drawer {
        left: 16px;
        top: 16px;
        bottom: 16px;
        width: 600px;
        max-width: calc(100vw - 32px);
      }

      @media (min-width: 1400px) {
        .region-panel--drawer {
          width: 720px;
        }
      }

      .region-panel--drawer .region-panel__inner {
        border-radius: 22px;
        box-shadow: 0 18px 60px rgba(0, 0, 0, 0.22);
      }

      .region-panel__handle {
        position: absolute;
        left: -14px;
        top: 50%;
        transform: translateY(-50%);
        width: 28px;
        height: 96px;
        border-radius: 16px;
        border: 1px solid rgba(0, 0, 0, 0.08);
        background: rgba(255, 255, 255, 0.88);
        backdrop-filter: blur(10px);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 10px 24px rgba(0, 0, 0, 0.16);
        transition: transform 160ms ease, box-shadow 160ms ease;
      }

      .region-panel__handle:hover {
        transform: translateY(-50%) scale(1.03);
        box-shadow: 0 14px 30px rgba(0, 0, 0, 0.18);
      }

      .region-panel__handle-bar {
        width: 6px;
        height: 38px;
        border-radius: 10px;
        background: rgba(45, 55, 72, 0.22);
      }

      .region-panel--drawer.is-open {
        transform: translateX(0);
        opacity: 1;
        transition: transform 260ms cubic-bezier(0.2, 0.9, 0.2, 1), opacity 160ms ease;
      }

      .region-panel--drawer.is-closed {
        transform: translateX(calc(-100% - 20px));
        opacity: 1;
        transition: transform 260ms cubic-bezier(0.2, 0.9, 0.2, 1), opacity 160ms ease;
      }

      /* SHEET */
      .region-panel__backdrop {
        position: fixed;
        inset: 0;
        z-index: 19999;
        background: rgba(0, 0, 0, 0.0);
        pointer-events: none;
        transition: background 220ms ease;
      }

      .region-panel__backdrop.is-visible {
        background: rgba(0, 0, 0, 0.22);
        pointer-events: auto;
      }

      .region-panel--sheet {
        left: 12px;
        right: 12px;
        bottom: 12px;
        height: 78vh;
        max-height: 78vh;
        transform: translateY(110%);
        opacity: 0;
      }

      .region-panel--sheet .region-panel__inner {
        border-radius: 22px;
        box-shadow: 0 18px 60px rgba(0, 0, 0, 0.22);
      }

      .region-panel__sheet-grabber {
        position: absolute;
        top: -14px;
        left: 0;
        right: 0;
        margin: 0 auto;
        width: 120px;
        height: 28px;
        border-radius: 16px;
        border: 1px solid rgba(0, 0, 0, 0.08);
        background: rgba(255, 255, 255, 0.88);
        backdrop-filter: blur(10px);
        cursor: grab;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 10px 24px rgba(0, 0, 0, 0.14);
      }

      .region-panel--sheet.is-closed {
        transform: translateY(110%);
        opacity: 0;
        transition: transform 260ms cubic-bezier(0.2, 0.9, 0.2, 1), opacity 120ms ease;
      }

      .region-panel--sheet.is-peek {
        transform: translateY(48%);
        opacity: 1;
        transition: transform 260ms cubic-bezier(0.2, 0.9, 0.2, 1), opacity 120ms ease;
      }

      .region-panel--sheet.is-full {
        transform: translateY(0);
        opacity: 1;
        transition: transform 260ms cubic-bezier(0.2, 0.9, 0.2, 1), opacity 120ms ease;
      }

      @media (max-width: 480px) {
        .region-panel--sheet {
          left: 10px;
          right: 10px;
          bottom: 10px;
          height: 82vh;
          max-height: 82vh;
        }
      }

      .modal-section { margin-bottom: 26px; }
      .section-title { font-size: 18px; font-weight: 800; color: #2d3748; margin: 0 0 12px 0; }
      .section-text { font-size: 15px; line-height: 1.75; color: #4a5568; margin: 0; }

      /* ===== ЛЕНТА ГОДОВ: дымка, центр, мягкая прокрутка ===== */
      .yearstrip {
        border-radius: 16px;
        border: 1px solid rgba(0, 0, 0, 0.08);
        background: rgba(255, 255, 255, 0.78);
        padding: 14px;
        margin: 10px 0 18px 0;
        box-shadow: 0 10px 28px rgba(0, 0, 0, 0.08);
      }

      .yearstrip__head {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 10px;
      }

      .yearstrip__meta {
        display: flex;
        align-items: baseline;
        gap: 10px;
        min-width: 0;
      }

      .yearstrip__metaLabel {
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 0.02em;
        color: rgba(45, 55, 72, 0.7);
      }

      .yearstrip__metaValue {
        font-size: 20px;
        font-weight: 950;
        letter-spacing: 0.04em;
        color: #1a202c;
      }

      .yearstrip__metaTag {
        height: 22px;
        padding: 0 10px;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 900;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: 1px solid rgba(0,0,0,0.10);
      }

      .yearstrip__metaTag.is-on {
        background: rgba(46, 204, 113, 0.16);
        color: rgba(22, 163, 74, 0.95);
      }

      .yearstrip__metaTag.is-off {
        background: rgba(0, 0, 0, 0.05);
        color: rgba(45, 55, 72, 0.65);
      }

      .yearstrip__snap {
        margin-left: auto;
        height: 30px;
        padding: 0 12px;
        border-radius: 10px;
        border: 1px solid rgba(0, 0, 0, 0.12);
        background: rgba(255, 255, 255, 0.92);
        cursor: pointer;
        font-size: 12px;
        font-weight: 900;
        color: #2d3748;
        transition: transform 140ms ease, box-shadow 140ms ease, background 140ms ease;
      }

      .yearstrip__snap:hover {
        transform: translateY(-1px);
        background: #fff;
        box-shadow: 0 10px 22px rgba(0, 0, 0, 0.12);
      }

      .yearstrip__viewport {
        position: relative;
        border-radius: 14px;
        background: linear-gradient(180deg, rgba(0,0,0,0.03), rgba(0,0,0,0.015));
        overflow: hidden;
        transform: perspective(1100px) rotateX(7deg);
      }

      .yearstrip__viewport {
        -webkit-mask-image: linear-gradient(to right, transparent 0%, #000 18%, #000 82%, transparent 100%);
        mask-image: linear-gradient(to right, transparent 0%, #000 18%, #000 82%, transparent 100%);
      }

      .yearstrip__scroller {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px 0;
        overflow-x: auto;
        overflow-y: hidden;
        scroll-snap-type: x mandatory;
        scroll-behavior: smooth;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: none;
        will-change: scroll-position;
      }

      .yearstrip__scroller::-webkit-scrollbar { display: none; }

      .yearstrip__pad { flex: 0 0 45%; }

      .yearstrip__item {
        scroll-snap-align: center;
        flex: 0 0 auto;
        width: 88px;
        height: 58px;
        border-radius: 16px;
        cursor: pointer;
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        background: transparent;
        border: 1px solid rgba(0,0,0,0.06);
        opacity: 0.38;
        filter: blur(0.6px) saturate(0.85);
        transition: transform 140ms ease, opacity 140ms ease, filter 140ms ease;
      }

      .yearstrip__digits {
        font-size: 20px;
        font-weight: 950;
        letter-spacing: 0.06em;
        color: rgba(45,55,72,0.62);
        transform: scale(0.92);
        transition: transform 140ms ease, color 140ms ease;
      }

      .yearstrip__mark {
        position: absolute;
        left: 50%;
        bottom: 9px;
        transform: translateX(-50%);
        width: 30px;
        height: 6px;
        border-radius: 999px;
        background: rgba(0,0,0,0.10);
      }

      .yearstrip__item.has-event .yearstrip__mark {
        background: rgba(120, 163, 255, 0.55);
      }

      .yearstrip__item.is-active {
        opacity: 1;
        filter: none;
        transform: translateY(-1px);
        border-color: rgba(0,0,0,0.10);
        background: rgba(255,255,255,0.65);
        box-shadow: 0 16px 30px rgba(0,0,0,0.10);
      }

      .yearstrip__item.is-active .yearstrip__digits {
        color: rgba(26, 32, 44, 0.95);
        transform: scale(1.15);
      }

      .yearstrip__item.is-active .yearstrip__mark {
        background: rgba(120, 163, 255, 0.95);
      }

      .yearstrip__centerHalo {
        position: absolute;
        left: 50%;
        top: 6px;
        bottom: 6px;
        width: 104px;
        transform: translateX(-50%);
        border-radius: 18px;
        background: radial-gradient(closest-side, rgba(120,163,255,0.22), rgba(120,163,255,0.06), transparent 70%);
        pointer-events: none;
        z-index: 3;
      }

      .yearstrip__centerLine {
        position: absolute;
        left: 50%;
        top: 0;
        bottom: 0;
        width: 2px;
        transform: translateX(-50%);
        background: rgba(0,0,0,0.06);
        pointer-events: none;
        z-index: 3;
      }

      .yearstrip__arrows {
        position: absolute;
        inset: 0;
        pointer-events: none;
        z-index: 4;
      }

      .yearstrip__arrow {
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        width: 34px;
        height: 34px;
        border-radius: 999px;
        background: rgba(255,255,255,0.70);
        border: 1px solid rgba(0,0,0,0.10);
        display: flex;
        align-items: center;
        justify-content: center;
        color: rgba(45,55,72,0.58);
        font-size: 22px;
        font-weight: 900;
        box-shadow: 0 10px 18px rgba(0,0,0,0.10);
        opacity: 0.85;
      }

      .yearstrip__arrow--left { left: 10px; }
      .yearstrip__arrow--right { right: 10px; }

      .yearstrip__hint {
        margin-top: 10px;
        font-size: 12px;
        font-weight: 700;
        color: rgba(45, 55, 72, 0.65);
      }

      @media (max-width: 768px) {
        .yearstrip__pad { flex-basis: 41%; }
        .yearstrip__viewport { transform: none; }
        .yearstrip__item { width: 84px; height: 60px; }
        .yearstrip__digits { font-size: 20px; }
      }
    `}</style>
  );
}