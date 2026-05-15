'use client';

import { useEffect, useState } from 'react';

export default function StatsSection() {
  const [counts, setCounts] = useState({ tracks: 0, users: 0, rating: 0 });
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  useEffect(() => {
    if (!isVisible) return;

    // Анимация счетчиков
    const duration = 2000;
    const steps = 60;
    const interval = duration / steps;

    const targets = { tracks: 15000, users: 125000, rating: 4.9 };
    let current = 0;

    const timer = setInterval(() => {
      current++;
      const progress = current / steps;

      setCounts({
        tracks: Math.floor(targets.tracks * progress),
        users: Math.floor(targets.users * progress),
        rating: parseFloat((targets.rating * progress).toFixed(1)),
      });

      if (current >= steps) {
        clearInterval(timer);
        setCounts(targets);
      }
    }, interval);

    return () => clearInterval(timer);
  }, [isVisible]);

  const formatNumber = (num: number): string => {
    if (num >= 1000) {
      return `${(num / 1000).toFixed(0)}K+`;
    }
    return num.toString();
  };

  return (
    <section className="mb-16">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="apple-card p-8 text-center group hover:shadow-xl transition-shadow duration-300">
          <div className="text-5xl font-semibold mb-3 text-gray-900">
            {formatNumber(counts.tracks)}
          </div>
          <div className="text-gray-600 font-light">Треков в библиотеке</div>
        </div>

        <div className="apple-card p-8 text-center group hover:shadow-xl transition-shadow duration-300">
          <div className="text-5xl font-semibold mb-3 text-gray-900">
            {formatNumber(counts.users)}
          </div>
          <div className="text-gray-600 font-light">Активных слушателей</div>
        </div>

        <div className="apple-card p-8 text-center group hover:shadow-xl transition-shadow duration-300">
          <div className="text-5xl font-semibold mb-3 text-gray-900">
            {counts.rating.toFixed(1)}
          </div>
          <div className="text-gray-600 font-light">Средний рейтинг</div>
        </div>
      </div>
    </section>
  );
}
