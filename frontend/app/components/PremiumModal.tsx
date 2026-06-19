"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { authStorage } from "@/app/lib/auth";

interface PremiumModalProps {
  open: boolean;
  onClose: () => void;
  feature?: string;
}

const PLANS = [
  {
    id: "monthly",
    tier: "PREMIUM",
    title: "Месяц",
    price: "299 ₽",
    period: "в месяц",
    note: "Отмена в любой момент",
  },
  {
    id: "yearly",
    tier: "PREMIUM_YEAR",
    title: "Год",
    price: "2 490 ₽",
    period: "в год",
    note: "−30% — экономия 1 098 ₽",
    badge: "Выгодно",
  },
  {
    id: "student",
    tier: "STUDENT",
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

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [trialEligible, setTrialEligible] = useState(false);
  const [trialBusy, setTrialBusy] = useState(false);
  const [trialBanner, setTrialBanner] = useState<string | null>(null);

  // Узнаём, может ли пользователь взять пробный период
  useEffect(() => {
    if (!open) return;
    const token = authStorage.getToken();
    if (!token) return;
    fetch('/api/payments/trial-start', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((j) => setTrialEligible(!!j?.data?.eligible))
      .catch(() => {});
  }, [open]);

  const startTrial = async () => {
    setError('');
    setTrialBusy(true);
    try {
      const token = authStorage.getToken();
      if (!token) {
        window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
        return;
      }
      const res = await fetch('/api/payments/trial-start', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await res.json();
      if (j?.success) {
        setTrialBanner(j.message || 'Пробный период активирован');
        setTrialEligible(false);
        setTimeout(() => { window.location.reload(); }, 1500);
        return;
      }
      setError(j?.error || 'Не удалось активировать пробный период');
    } catch (e: any) {
      setError(e?.message || 'Ошибка сети');
    } finally {
      setTrialBusy(false);
    }
  };

  const handleSubscribe = async (tier: string, planId: string) => {
    setError("");
    setBusy(planId);
    try {
      const token = authStorage.getToken();
      if (!token) {
        // не авторизован — на логин с возвратом
        window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
        return;
      }
      const res = await fetch("/api/payments/init", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ tier }),
      });
      const j = await res.json();
      if (j?.success && j.paymentUrl) {
        window.location.href = j.paymentUrl;
        return;
      }
      setError(j?.error || "Не удалось перейти к оплате");
    } catch (e: any) {
      setError(e?.message || "Ошибка сети");
    } finally {
      setBusy(null);
    }
  };

  if (!open) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
      style={{ zIndex: 2147483647, top: 0, left: 0, right: 0, bottom: 0 }}
      onClick={onClose}
    >
      <div
        className="relative max-w-2xl w-full overflow-hidden rounded-3xl shadow-[0_30px_80px_rgba(0,0,0,0.5)] text-white"
        style={{
          background:
            "linear-gradient(135deg, #1d4cb8 0%, #2f9e8f 55%, #e6e6e6 100%)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Декоративные блики как в hero на главной */}
        <div
          className="pointer-events-none absolute top-0 right-0 w-96 h-96 rounded-full blur-3xl opacity-35"
          style={{ background: "#3a78dc", transform: "translate(30%, -30%)" }}
        />
        <div
          className="pointer-events-none absolute bottom-0 left-1/3 w-80 h-80 rounded-full blur-3xl opacity-30"
          style={{ background: "#3aa8c9", transform: "translateY(40%)" }}
        />

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
        <div className="relative z-10 px-6 md:px-8 pt-8 md:pt-10 pb-4 md:pb-5 text-center">
          <div className="text-[10px] md:text-[11px] tracking-[3px] uppercase font-bold opacity-90 mb-2 md:mb-3 text-white">Сонатум Premium</div>
          <h2 className="text-2xl md:text-3xl font-black tracking-tight mb-2 text-white">
            {feature ? `${feature} — только для Premium` : "Полный доступ к Сонатум"}
          </h2>
          <p className="text-[13px] md:text-[14px] text-white/90 max-w-md mx-auto">
            Поддержка авторов, без рекламы, скачивание в Hi-Res и доступ к редким архивам.
          </p>
        </div>

        {/* Преимущества + тарифы */}
        <div className="relative z-10 px-5 md:px-8 pb-5 md:pb-6">
          <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5 mb-4 md:mb-5">
            {BENEFITS.map((b) => (
              <li key={b} className="flex items-start gap-2 text-[12px] md:text-[13px] text-white">
                <span className="mt-0.5 inline-flex w-4 h-4 rounded-full bg-white/20 text-white flex-shrink-0 items-center justify-center">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
                <span className="leading-snug">{b}</span>
              </li>
            ))}
          </ul>

          {/* 7-дневный пробный — даётся 1 раз на пользователя */}
          {trialEligible && (
            <div className="rounded-2xl border-2 border-white/40 bg-white/10 backdrop-blur p-3 mb-3 md:mb-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm text-white">Попробовать 7 дней бесплатно</div>
                  <div className="text-xs text-white/80 mt-0.5">
                    Полный Premium на неделю без оплаты. Без автопродления — потом нужно оформить заново.
                  </div>
                </div>
                <button
                  onClick={startTrial}
                  disabled={trialBusy}
                  className="px-4 py-2 rounded-full bg-white text-black text-xs font-bold whitespace-nowrap hover:opacity-90 disabled:opacity-60">
                  {trialBusy ? 'Активируем…' : 'Активировать триал'}
                </button>
              </div>
            </div>
          )}
          {trialBanner && (
            <div className="rounded-2xl bg-white/15 border border-white/30 p-3 mb-3 text-sm text-white">
              {trialBanner}
            </div>
          )}

          {/* Тарифы — белые карточки контрастом к градиенту */}
          <div className="grid grid-cols-3 gap-2 md:gap-3 mb-3 md:mb-4">
            {PLANS.map((p) => {
              const loading = busy === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => handleSubscribe(p.tier, p.id)}
                  disabled={loading || !!busy}
                  className="text-left p-3 md:p-4 rounded-2xl bg-white text-gray-900 hover:shadow-2xl transition relative disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {p.badge && (
                    <span className="absolute -top-2 right-3 px-2 py-0.5 rounded-full bg-black text-white text-[9px] font-bold tracking-wide uppercase">
                      {p.badge}
                    </span>
                  )}
                  <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">{p.title}</div>
                  <div className="mt-1.5 text-[20px] md:text-[22px] font-extrabold text-gray-900 leading-none">{p.price}</div>
                  <div className="text-[10px] text-gray-500 mt-1">{p.period}</div>
                  <div className="text-[10px] text-gray-500 mt-2 leading-snug">{p.note}</div>
                  <div className="mt-2 text-[11px] font-bold text-black">
                    {loading ? 'Открываем…' : 'Оформить →'}
                  </div>
                </button>
              );
            })}
          </div>

          {error && (
            <div className="mb-2 rounded-xl bg-white/10 border border-white/30 px-3 py-2 text-xs text-white">
              {error}
            </div>
          )}

          <p className="text-[10px] text-center text-white/80 leading-snug">
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
