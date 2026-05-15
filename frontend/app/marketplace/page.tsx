'use client';

import { useState } from 'react';
import Header from '../components/Header';

export default function MarketplacePage() {
  const tracks = [
    { id: 1, title: 'Лунная соната', artist: 'П.И. Чайковский', price: 49, rating: 4.8, sales: 1247 },
    { id: 2, title: 'Полет шмеля', artist: 'Н.А. Римский-Корсаков', price: 39, rating: 4.9, sales: 2341 },
    { id: 3, title: 'Катюша', artist: 'М.И. Блантер', price: 29, rating: 4.7, sales: 892 },
  ];

  return (
    <div className="min-h-screen">
      <Header />
      
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-semibold text-gray-900 mb-2">Маркетплейс</h1>
          <p className="text-lg text-gray-600">Приобретайте треки в собственность</p>
        </div>

        {/* Баннер */}
        <div className="liquid-glass-strong rounded-2xl p-8 mb-8 text-center">
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">
            Владейте музыкой навсегда
          </h2>
          <p className="text-gray-600 mb-4">
            Покупайте треки без DRM и слушайте без ограничений
          </p>
          <div className="flex items-center justify-center gap-6 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <span>✓</span>
              <span>Высокое качество</span>
            </div>
            <div className="flex items-center gap-2">
              <span>✓</span>
              <span>Без подписки</span>
            </div>
            <div className="flex items-center gap-2">
              <span>✓</span>
              <span>Поддержка композиторов</span>
            </div>
          </div>
        </div>

        {/* Список треков */}
        <div className="space-y-4">
          {tracks.map((track) => (
            <div key={track.id} className="apple-card p-6">
              <div className="flex items-center gap-6">
                {/* Обложка */}
                <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-3xl flex-shrink-0">
                  ♪
                </div>

                {/* Информация */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 mb-1">{track.title}</h3>
                  <p className="text-sm text-gray-600">{track.artist}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                    <span>★ {track.rating}</span>
                    <span>💿 {track.sales} продаж</span>
                  </div>
                </div>

                {/* Цена и кнопка */}
                <div className="text-right flex-shrink-0">
                  <div className="text-2xl font-semibold text-gray-900 mb-2">
                    {track.price} ₽
                  </div>
                  <button className="apple-button">
                    Купить
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Для композиторов */}
        <div className="mt-12 liquid-glass rounded-2xl p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div>
              <h3 className="text-2xl font-semibold text-gray-900 mb-3">
                Для композиторов
              </h3>
              <p className="text-gray-600 mb-6">
                Размещайте свои произведения и получайте доход от продаж
              </p>
              <ul className="space-y-3 mb-6">
                <li className="flex items-center gap-3 text-gray-700">
                  <span className="w-6 h-6 rounded-full bg-gray-900 text-white flex items-center justify-center text-xs">✓</span>
                  <span>Прямые доходы от продаж</span>
                </li>
                <li className="flex items-center gap-3 text-gray-700">
                  <span className="w-6 h-6 rounded-full bg-gray-900 text-white flex items-center justify-center text-xs">✓</span>
                  <span>CRM-инструменты и аналитика</span>
                </li>
                <li className="flex items-center gap-3 text-gray-700">
                  <span className="w-6 h-6 rounded-full bg-gray-900 text-white flex items-center justify-center text-xs">✓</span>
                  <span>Продвижение через AI-рекомендации</span>
                </li>
              </ul>
              <button className="apple-button">
                Стать продавцом
              </button>
            </div>
            <div className="text-center">
              <div className="text-7xl mb-4">��</div>
              <p className="text-sm text-gray-600">Комиссия платформы — 15%</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
