"use client";

import { useEffect } from "react";

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

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4 backdrop-blur-md bg-black/40"
      onClick={onClose}
    >
      <div
        className="apple-card relative max-w-2xl w-full max-h-[90vh] overflow-y-auto bg-white shadow-2xl rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Закрыть"
          className="absolute top-5 right-5 w-9 h-9 rounded-full bg-black/5 hover:bg-black/10 flex items-center justify-center text-[#1c1c1e] z-10 transition"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        {/* Hero */}
        <div className="px-8 pt-10 pb-8 text-center bg-gradient-to-br from-[#0039a6] to-[#d52b1e] rounded-t-3xl text-white">
          <div className="text-[11px] tracking-[3px] uppercase opacity-80 mb-3">Сонатум Premium</div>
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-3">
            {feature ? `${feature} — только для Premium` : "Полный доступ к Сонатум"}
          </h2>
          <p className="text-[15px] opacity-90 max-w-md mx-auto">
            Поддержка авторов, без рекламы, скачивание в Hi-Res и доступ к редким архивам.
          </p>
        </div>

        {/* Преимущества */}
        <div className="px-6 md:px-10 py-8">
          <ul className="grid sm:grid-cols-2 gap-3 mb-8">
            {BENEFITS.map((b) => (
              <li key={b} className="flex items-start gap-3 text-[14px] text-[#1c1c1e]">
                <span className="mt-1 inline-block w-5 h-5 rounded-full bg-[#0039a6]/10 text-[#0039a6] flex-shrink-0 grid place-items-center">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
                <span className="leading-relaxed">{b}</span>
              </li>
            ))}
          </ul>

          {/* Тарифы */}
          <div className="grid sm:grid-cols-3 gap-3 mb-6">
            {PLANS.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  window.location.href = `/profile?subscribe=${p.id}`;
                }}
                className="text-left p-5 rounded-2xl border border-[var(--border)] hover:border-[#1c1c1e] hover:shadow-md transition group relative bg-white"
              >
                {p.badge && (
                  <span className="absolute -top-2 right-4 px-2.5 py-0.5 rounded-full bg-[#1c1c1e] text-white text-[10px] font-bold tracking-wide uppercase">
                    {p.badge}
                  </span>
                )}
                <div className="text-[12px] uppercase tracking-wider text-[var(--text-secondary)] font-semibold">{p.title}</div>
                <div className="mt-2 text-[26px] font-extrabold text-[#1c1c1e] leading-none">{p.price}</div>
                <div className="text-[12px] text-[var(--text-secondary)] mt-1">{p.period}</div>
                <div className="text-[11px] text-[var(--text-secondary)] mt-3 leading-snug">{p.note}</div>
              </button>
            ))}
          </div>

          <p className="text-[11px] text-center text-[var(--text-secondary)]">
            Нажимая «Оформить», вы соглашаетесь с{" "}
            <a href="/legal/terms" className="underline">офертой</a>,{" "}
            <a href="/legal/privacy" className="underline">политикой конфиденциальности</a> и{" "}
            <a href="/legal/refund" className="underline">условиями возврата</a>.
          </p>
        </div>
      </div>
    </div>
  );
}
