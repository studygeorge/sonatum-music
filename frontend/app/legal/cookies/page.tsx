'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

const STORAGE_KEY = 'sonatum:cookie-consent';

type Consent = { value: 'all' | 'essential'; version?: number; at?: string } | null;

export default function CookiesPolicyPage() {
  const [consent, setConsent] = useState<Consent>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setConsent(JSON.parse(raw));
    } catch {}
  }, []);

  const reset = () => {
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    setConsent(null);
    location.reload();
  };

  const set = (value: 'all' | 'essential') => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ value, version: 2, at: new Date().toISOString() })
      );
    } catch {}
    setConsent({ value });
  };

  return (
    <main className="min-h-screen pt-10 md:pt-14 pb-24 px-6 md:px-12 max-w-3xl mx-auto">
      <h1 className="text-4xl lg:text-5xl font-bold tracking-tight mb-3">Файлы cookie</h1>
      <p className="text-[var(--text-secondary)] mb-10">
        Как мы используем cookies в Sonatum и как ими управлять.
      </p>

      <Section title="Что такое cookies">
        <p>
          Cookies — это небольшие текстовые файлы, которые ваш браузер сохраняет, когда
          вы посещаете сайт. Они нужны, чтобы запомнить ваши предпочтения, состояние входа
          и собрать обезличенную статистику использования сервиса.
        </p>
      </Section>

      <Section title="Какие cookies мы используем">
        <CookieType
          label="Необходимые"
          desc="Без них сервис не работает: авторизация, плеер, защита форм. Эти cookies нельзя отключить."
        />
        <CookieType
          label="Аналитические"
          desc="Помогают понять, какие разделы и треки чаще всего слушают, чтобы делать каталог удобнее. Данные обезличены."
        />
        <CookieType
          label="Персонализация"
          desc="Сохраняют громкость, последнее воспроизведение, тёмную тему и подобные настройки на вашем устройстве."
        />
      </Section>

      <Section title="Ваш выбор">
        <p className="mb-4">
          Текущее согласие:{' '}
          <strong className="text-[var(--text-primary)]">
            {consent?.value === 'all'
              ? 'Все cookies'
              : consent?.value === 'essential'
              ? 'Только необходимые'
              : 'Не задано'}
          </strong>
          {consent?.at && (
            <span className="text-[var(--text-secondary)] text-sm">
              {' · '}обновлено {new Date(consent.at).toLocaleString('ru-RU')}
            </span>
          )}
        </p>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => set('all')}
            className="px-5 py-2.5 rounded-full bg-[var(--text-primary)] text-white text-sm font-medium hover:opacity-90 transition"
          >
            Принять все
          </button>
          <button
            onClick={() => set('essential')}
            className="px-5 py-2.5 rounded-full bg-[var(--background)] border border-[var(--border)] text-sm font-medium hover:bg-[var(--hover)] transition"
          >
            Только необходимые
          </button>
          <button
            onClick={reset}
            className="px-5 py-2.5 rounded-full text-sm font-medium text-[var(--accent)] hover:underline"
          >
            Сбросить и спросить заново
          </button>
        </div>
      </Section>

      <Section title="Как отключить cookies в браузере">
        <p className="mb-3">
          Помимо нашего баннера, вы можете полностью отключить cookies в настройках
          браузера. После этого часть функций (вход, плеер) может перестать работать.
        </p>
        <ul className="list-disc pl-5 space-y-1 text-[var(--text-secondary)]">
          <li>
            <ExternalLink href="https://support.google.com/chrome/answer/95647">Chrome</ExternalLink>
          </li>
          <li>
            <ExternalLink href="https://support.mozilla.org/ru/kb/udalenie-kukov-i-dannyh-sajtov-v-firefox">Firefox</ExternalLink>
          </li>
          <li>
            <ExternalLink href="https://support.apple.com/ru-ru/guide/safari/sfri11471/mac">Safari</ExternalLink>
          </li>
          <li>
            <ExternalLink href="https://support.microsoft.com/ru-ru/microsoft-edge/удаление-файлов-cookie-в-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09">Microsoft Edge</ExternalLink>
          </li>
        </ul>
      </Section>

      <Section title="Связанные документы">
        <ul className="list-disc pl-5 space-y-1 text-[var(--accent)]">
          <li><Link href="/legal/privacy" className="hover:underline">Политика конфиденциальности</Link></li>
          <li><Link href="/legal/terms" className="hover:underline">Пользовательское соглашение</Link></li>
          <li><Link href="/legal/personal-data" className="hover:underline">Обработка персональных данных</Link></li>
        </ul>
      </Section>

      <p className="text-xs text-[var(--text-secondary)] mt-12">
        Версия политики: 2 · Последнее обновление: {new Date().toLocaleDateString('ru-RU')}
      </p>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-2xl font-bold tracking-tight mb-4">{title}</h2>
      <div className="text-[var(--text-secondary)] leading-relaxed space-y-3">{children}</div>
    </section>
  );
}

function CookieType({ label, desc }: { label: string; desc: string }) {
  return (
    <div className="apple-card p-5 mb-3">
      <h3 className="font-semibold text-[var(--text-primary)] mb-2">{label}</h3>
      <p className="text-sm">{desc}</p>
    </div>
  );
}

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-[var(--accent)] hover:underline"
    >
      {children}
    </a>
  );
}
