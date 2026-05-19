"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

interface PremiumModalProps {
  open: boolean;
  onClose: () => void;
  feature?: string;
}

const PLANS = [
  {
    id: "monthly",
    title: "Месяц",
    price: "299 ₽",
    period: "в месяц",
    note: "Отмена в любой момент",
  },
  {
    id: "yearly",
    title: "Год",
    price: "2 490 ₽",
    period: "в год",
    note: "−30% — экономия 1 098 ₽",
    badge: "Выгодно",
  },
  {
    id: "student",
    title: "Студенческий",
    price: "149 ₽",
    period: "в месяц",
    note: "Подтверждение через вуз",
  },
];

const BENEFITS = [
  "Скачивание треков и нот в Hi-Res",
  "Безлимитные плейлисты и история",
  "Комментарии под треками",
  "Тексты песен и аннотации к нотам",
  "Доступ к редким архивам и духовной музыке",
  "Без рекламы, фоновое прослушивание",
];

export function PremiumModal({ open, onClose, feature }: PremiumModalProps) {
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onEsc);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onEsc);
    };
  }, [open, onClose]);

  if (!open) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
      style={{ zIndex: 2147483647, top: 0, left: 0, right: 0, bottom: 0 }}
      onClick={onClose}
    >
      <div
        className="relative max-w-2xl w-full max-h-[92vh] overflow-y-auto rounded-3xl shadow-[0_30px_80px_rgba(0,0,0,0.5)] text-white"
        style={{
          background:
            "linear-gradient(135deg, #1d4cb8 0%, #6a1bb3 35%, #c9285c 70%, #f06a2a 100%)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Закрыть"
          className="absolute top-5 right-5 w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white z-10 transition"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        {/* Hero */}
        <div className="px-8 pt-12 pb-8 text-center">
          <div className="text-[11px] tracking-[3px] uppercase font-bold opacity-90 mb-4 text-white">Сонатум Premium</div>
          <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-3 text-white">
            {feature ? `${feature} — только для Premium` : "Полный доступ к Сонатум"}
          </h2>
          <p className="text-[15px] text-white/90 max-w-md mx-auto">
            Поддержка авторов, без рекламы, скачивание в Hi-Res и доступ к редким архивам.
          </p>
        </div>

        {/* Преимущества — на полупрозрачном фоне поверх градиента */}
        <div className="px-6 md:px-10 pb-8">
          <ul className="grid sm:grid-cols-2 gap-3 mb-8">
            {BENEFITS.map((b) => (
              <li key={b} className="flex items-start gap-3 text-[14px] text-white">
                <span className="mt-0.5 inline-flex w-5 h-5 rounded-full bg-white/20 text-white flex-shrink-0 items-center justify-center">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
                <span className="leading-relaxed">{b}</span>
              </li>
            ))}
          </ul>

          {/* Тарифы — белые карточки контрастом к градиенту */}
          <div className="grid sm:grid-cols-3 gap-3 mb-6">
            {PLANS.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  window.location.href = `/profile?subscribe=${p.id}`;
                }}
                className="text-left p-5 rounded-2xl bg-white text-gray-900 hover:shadow-2xl transition relative"
              >
                {p.badge && (
                  <span className="absolute -top-2 right-4 px-2.5 py-0.5 rounded-full bg-black text-white text-[10px] font-bold tracking-wide uppercase">
                    {p.badge}
                  </span>
                )}
                <div className="text-[12px] uppercase tracking-wider text-gray-500 font-semibold">{p.title}</div>
                <div className="mt-2 text-[26px] font-extrabold text-gray-900 leading-none">{p.price}</div>
                <div className="text-[12px] text-gray-500 mt-1">{p.period}</div>
                <div className="text-[11px] text-gray-500 mt-3 leading-snug">{p.note}</div>
              </button>
            ))}
          </div>

          <p className="text-[11px] text-center text-white/80">
            Нажимая «Оформить», вы соглашаетесь с{" "}
            <a href="/legal/terms" className="underline hover:text-white">офертой</a>,{" "}
            <a href="/legal/privacy" className="underline hover:text-white">политикой конфиденциальности</a> и{" "}
            <a href="/legal/refund" className="underline hover:text-white">условиями возврата</a>.
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}
