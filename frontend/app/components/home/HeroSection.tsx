'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { authStorage, isAuthenticated } from '@/app/lib/auth';

export default function HeroSection() {
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    // Проверяем авторизацию при загрузке
    setAuthenticated(isAuthenticated());
  }, []);

  return (
    <section className="mb-16 animate-fadeInUp">
      <div className="liquid-glass-strong rounded-3xl p-12 md:p-16 text-center relative overflow-hidden group">
        <div className="relative z-10">
          <h1 className="text-5xl md:text-7xl font-semibold mb-4 text-gray-900 tracking-tight">
            Sonatum Music
          </h1>
          <p className="text-xl md:text-2xl text-gray-600 mb-8 font-light max-w-3xl mx-auto">
            Современная российская музыка. Все жанры. Все артисты. Поддержи независимых музыкантов.
          </p>
          
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link href="/catalog">
              <button className="apple-button group/btn relative overflow-hidden">
                <span className="relative z-10">Открыть каталог</span>
                <div className="absolute inset-0 bg-gradient-to-r from-gray-800 to-gray-900 transform scale-x-0 group-hover/btn:scale-x-100 transition-transform origin-left"></div>
              </button>
            </Link>
            
            {/* Показываем кнопку входа только если пользователь не авторизован */}
            {!authenticated && (
              <Link href="/login">
                <button className="apple-button-secondary">
                  Войти в аккаунт
                </button>
              </Link>
            )}
          </div>
        </div>
        
        {/* Animated background blobs */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-gray-200 rounded-full blur-3xl opacity-30 group-hover:scale-110 transition-transform duration-700"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-gray-300 rounded-full blur-3xl opacity-20 group-hover:scale-110 transition-transform duration-700"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gray-100 rounded-full blur-3xl opacity-10 group-hover:rotate-180 transition-transform duration-1000"></div>
      </div>
    </section>
  );
}
