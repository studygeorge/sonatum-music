"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";

const STORAGE_KEY = "sonatum:cookie-consent";
const CURRENT_VERSION = 2; // Bump чтобы заново показать баннер при изменениях политики

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        setVisible(true);
        return;
      }
      const parsed = JSON.parse(raw);
      if ((parsed?.version ?? 1) < CURRENT_VERSION) setVisible(true);
    } catch {
      // localStorage недоступен (private mode) — показываем баннер
      setVisible(true);
    }
  }, []);

  const accept = (value: "all" | "essential") => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ value, version: CURRENT_VERSION, at: new Date().toISOString() })
      );
    } catch {}
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-28 left-4 right-4 md:left-auto md:right-6 md:bottom-6 md:max-w-md z-[350]">
      <div className="apple-card bg-white/95 backdrop-blur-md p-5 md:p-6 shadow-xl border border-[var(--border)]">
        <h3 className="font-semibold text-[var(--text-primary)] mb-2">Файлы cookie</h3>
        <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-4">
          Мы используем cookies для работы сервиса, аналитики и персональных рекомендаций.{" "}
          <Link href="/legal/cookies" className="underline hover:text-[var(--text-primary)]">
            Подробнее
          </Link>
          .
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => accept("all")}
            className="px-5 py-2.5 rounded-full bg-[var(--text-primary)] text-white text-sm font-medium hover:opacity-90 transition"
          >
            Принять все
          </button>
          <button
            onClick={() => accept("essential")}
            className="px-5 py-2.5 rounded-full bg-[var(--border)] text-[var(--text-primary)] text-sm font-medium hover:bg-[var(--hover)] transition"
          >
            Только необходимые
          </button>
        </div>
      </div>
    </div>
  );
}
