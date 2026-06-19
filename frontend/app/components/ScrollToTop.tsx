'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Сбрасывает прокрутку наверх при каждой смене маршрута.
 * Чинит баг, когда страница открывалась слегка промотанной вниз
 * (браузер/Next переносил scroll-позицию с предыдущей страницы).
 * Уважает якоря (#hash) — если переход на якорь, наверх не прыгаем.
 */
export default function ScrollToTop() {
  const pathname = usePathname();
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.location.hash) return;
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}
