'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import HeroPlayButton from './HeroPlayButton';

type Track = {
  id: string;
  title: string;
  audioUrl?: string;
  cover?: string | null;
  duration?: number;
  artist?: { id?: string; name?: string; slug?: string; avatar?: string | null } | null;
};

type Slide = {
  title: string;
  subtitle: string;
  background: string;
  blobA: string;
  blobB: string;
};

const SLIDES: Slide[] = [
  {
    title: 'Откройте для себя богатство духовной музыки',
    subtitle:
      'Исследуйте редкие звоны, старинные распевы и народные традиции. Всё в безупречном качестве.',
    // Лавандово-синяя гамма
    background: 'linear-gradient(135deg, #4f5b93 0%, #7c8bbf 55%, #e8eaf2 100%)',
    blobA: '#8f9ed6',
    blobB: '#5c6aa8',
  },
  {
    title: 'Погрузитесь в безграничный мир академической музыки',
    subtitle:
      'Исследуйте редкие партитуры, старинные фуги и новые опусы современных композиторов. Всё в безупречном качестве.',
    // Бирюзово-зелёная гамма
    background: 'linear-gradient(135deg, #1d6e6e 0%, #2f9e8f 55%, #e6efe9 100%)',
    blobA: '#4fc3b0',
    blobB: '#1f7d72',
  },
  {
    title: 'Навстречу ритмам нового времени',
    subtitle:
      'Исследуйте фьюжн-эксперименты, акустические импровизации и работы современных композиторов. Всё в безупречном качестве.',
    // Сине-голубая гамма
    background: 'linear-gradient(135deg, #1d4cb8 0%, #3aa8c9 55%, #e6eef5 100%)',
    blobA: '#5aa9e6',
    blobB: '#2b6fd0',
  },
];

const INTERVAL = 6500;

export default function HeroCarousel({ tracks }: { tracks: Track[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const go = useCallback((i: number) => {
    setIndex(((i % SLIDES.length) + SLIDES.length) % SLIDES.length);
  }, []);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => {
      setIndex((prev) => (prev + 1) % SLIDES.length);
    }, INTERVAL);
    return () => clearInterval(id);
  }, [paused]);

  const slide = SLIDES[index];

  return (
    <section
      className="relative rounded-3xl overflow-hidden p-7 md:p-9 pb-12 md:pb-12 text-white min-h-[220px] md:min-h-[240px] grid transition-[background] duration-700"
      style={{ background: slide.background }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        className="absolute top-0 right-0 w-96 h-96 rounded-full blur-3xl opacity-35 transition-colors duration-700 pointer-events-none"
        style={{ background: slide.blobA, transform: 'translate(30%, -30%)' }}
      />
      <div
        className="absolute bottom-0 left-1/3 w-80 h-80 rounded-full blur-3xl opacity-30 transition-colors duration-700 pointer-events-none"
        style={{ background: slide.blobB, transform: 'translateY(40%)' }}
      />

      {/* Все слайды лежат в одной grid-ячейке → высота всегда по самому
          высокому слайду, переключение не «прыгает». Виден только активный. */}
      {SLIDES.map((s, i) => (
        <div
          key={i}
          aria-hidden={i !== index}
          className="col-start-1 row-start-1 relative z-10 flex items-center transition-opacity duration-500"
          style={{ opacity: i === index ? 1 : 0, pointerEvents: i === index ? 'auto' : 'none' }}
        >
          <div className="max-w-2xl">
            <h1 className="text-white text-2xl md:text-3xl lg:text-4xl font-bold mb-3 tracking-tight">
              {s.title}
            </h1>
            <p className="text-sm md:text-base text-white/80 mb-5 max-w-xl">{s.subtitle}</p>
            <div className="flex flex-wrap gap-3">
              <HeroPlayButton tracks={tracks} />
              <Link
                href="/catalog"
                tabIndex={i === index ? 0 : -1}
                className="bg-white/10 backdrop-blur-md text-white px-6 py-2.5 rounded-full text-sm font-semibold hover:bg-white/20 transition-colors duration-300 border border-white/20"
              >
                Каталог
              </Link>
            </div>
          </div>
        </div>
      ))}

      {/* Точки-навигация */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex gap-2.5">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            aria-label={`Слайд ${i + 1}`}
            onClick={() => go(i)}
            className={`h-2 rounded-full transition-all duration-300 ${
              i === index ? 'w-7 bg-white' : 'w-2 bg-white/45 hover:bg-white/70'
            }`}
          />
        ))}
      </div>
    </section>
  );
}
