'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Footer() {
  const pathname = usePathname();
  
  if (pathname === '/map') {
    return null;
  }

  return (
    <footer className="border-t border-[var(--border)] bg-[#fafafa] pt-16 pb-8 mt-auto">
      <div className="max-w-7xl mx-auto px-6 md:px-12 grid grid-cols-1 md:grid-cols-5 gap-12 mb-16">

        <div className="md:col-span-2">
          <Link href="/" className="inline-flex items-center gap-3 mb-4" aria-label="Сонатум — на главную">
            <img src="/logo.png" alt="Сонатум" width="180" height="48" className="h-10 w-auto" />
          </Link>
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-6 max-w-md">
            Музыкальный сервис, объединяющий историческое наследие и современное творчество в совершенном цифровом формате.
          </p>
          <h4 className="font-semibold text-[var(--text-primary)] mb-3 uppercase text-xs tracking-wider">Контакты</h4>
          <ul className="space-y-2 text-sm text-[var(--text-secondary)]">
            <li>
              Поддержка:&nbsp;
              <a href="mailto:info@sonatum-music.ru" className="hover:text-[var(--text-primary)] transition-colors">
                info@sonatum-music.ru
              </a>
            </li>
            <li>
              Правообладателям:&nbsp;
              <a href="mailto:info@sonatum-music.ru" className="hover:text-[var(--text-primary)] transition-colors">
                info@sonatum-music.ru
              </a>
            </li>
            <li className="text-xs leading-relaxed text-[var(--text-secondary)]/80 pt-1">
              ООО «СОНАТУМ» · ИНН 2634116369 · ОГРН 1252600013973
            </li>
          </ul>
        </div>

        <div>
           <h4 className="font-semibold text-[var(--text-primary)] mb-4 uppercase text-xs tracking-wider">Платформа</h4>
           <ul className="space-y-3 text-sm text-[var(--text-secondary)]">
             <li><Link href="/catalog" className="hover:text-[var(--text-primary)] transition-colors">Каталог</Link></li>
             <li><Link href="/sheets" className="hover:text-[var(--text-primary)] transition-colors">Нотный архив</Link></li>
             <li><Link href="/map" className="hover:text-[var(--text-primary)] transition-colors">Музыкальная карта</Link></li>
             <li><Link href="/chart" className="hover:text-[var(--text-primary)] transition-colors">Чарты</Link></li>
           </ul>
        </div>

        <div>
           <h4 className="font-semibold text-[var(--text-primary)] mb-4 uppercase text-xs tracking-wider">Сотрудничество</h4>
           <ul className="space-y-3 text-sm text-[var(--text-secondary)]">
             <li><Link href="/cooperation" className="hover:text-[var(--text-primary)] transition-colors">Все направления</Link></li>
             <li><Link href="/b2b" className="hover:text-[var(--text-primary)] transition-colors">Для бизнеса и учебных заведений</Link></li>
             <li><Link href="/artists/join" className="hover:text-[var(--text-primary)] transition-colors">Артистам</Link></li>
             <li><Link href="/legal/copyright" className="hover:text-[var(--text-primary)] transition-colors">Правообладателям</Link></li>
           </ul>
        </div>

        <div>
           <h4 className="font-semibold text-[var(--text-primary)] mb-4 uppercase text-xs tracking-wider">Правовая информация</h4>
           <ul className="space-y-3 text-sm text-[var(--text-secondary)]">
             <li><Link href="/legal/terms" className="hover:text-[var(--text-primary)] transition-colors">Пользовательское соглашение</Link></li>
             <li><Link href="/legal/privacy" className="hover:text-[var(--text-primary)] transition-colors">Политика конфиденциальности</Link></li>
             <li><Link href="/legal/personal-data" className="hover:text-[var(--text-primary)] transition-colors">Обработка персональных данных</Link></li>
             <li><Link href="/legal/refund" className="hover:text-[var(--text-primary)] transition-colors">Условия возврата</Link></li>
             <li><Link href="/legal/cookies" className="hover:text-[var(--text-primary)] transition-colors">Использование файлов Cookie</Link></li>
             <li><Link href="/legal/recommendations" className="hover:text-[var(--text-primary)] transition-colors">Рекомендательные технологии</Link></li>
           </ul>
        </div>
      </div>

      {/* Поддержка Фонда содействия инновациям */}
      <div className="max-w-7xl mx-auto px-6 md:px-12 mb-12">
        <div className="flex flex-col md:flex-row items-center gap-5 md:gap-7 border-t border-[var(--border)] pt-8">
          <div className="flex items-center gap-5 md:gap-7 shrink-0">
            <img
              src="/partners/fasie.png"
              alt="Фонд содействия инновациям"
              width="200"
              height="100"
              className="h-16 md:h-20 w-auto select-none"
            />
            <img
              src="/partners/platforma.svg"
              alt="Платформа университетского технологического предпринимательства"
              width="200"
              height="120"
              className="h-16 md:h-20 w-auto select-none"
            />
          </div>
          <p className="text-xs leading-relaxed text-[var(--text-secondary)] max-w-3xl text-center md:text-left">
            Проект реализован при поддержке Фонда содействия инновациям в рамках программы «Студенческий стартап»
            мероприятия «Платформа университетского технологического предпринимательства» федерального проекта «Технологии».
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 md:px-12 flex flex-col md:flex-row justify-between items-center text-xs text-[var(--text-secondary)] border-t border-[var(--border)] pt-8">
        <p className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded border border-[var(--border)] text-[10px] font-semibold text-[var(--text-secondary)]">12+</span>
          © 2026 Sonatum Music. Все права защищены.
        </p>
        <div className="flex gap-6 mt-4 md:mt-0">
          <a href="https://vk.com/sonatum" target="_blank" rel="noopener noreferrer" className="cursor-pointer hover:text-[var(--text-primary)] transition-colors">ВКонтакте</a>
          <a href="https://max.ru/id2634116369_biz" target="_blank" rel="noopener noreferrer" className="cursor-pointer hover:text-[var(--text-primary)] transition-colors">МАКС</a>
          <a href="https://rutube.ru/channel/78183980/" target="_blank" rel="noopener noreferrer" className="cursor-pointer hover:text-[var(--text-primary)] transition-colors">Rutube</a>
        </div>
      </div>
    </footer>
  );
}
