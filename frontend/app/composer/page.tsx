'use client';

import { useState } from 'react';
import Header from '../components/Header';

export default function ComposerPage() {
  const [activeTab, setActiveTab] = useState('works');

  const composerData = {
    name: 'Петр Ильич Чайковский',
    bio: 'Русский композитор, дирижёр, педагог, музыкально-общественный деятель. Один из величайших композиторов в истории музыки.',
    birthDate: '7 мая 1840',
    deathDate: '6 ноября 1893',
    region: 'Воткинск, Вятская губерния',
    era: 'XIX век',
    genres: ['Классическая', 'Симфоническая', 'Балет', 'Опера'],
    totalWorks: 156,
    totalSales: 45234,
    avgRating: 4.9,
  };

  const works = [
    { id: 1, title: 'Лебединое озеро', year: 1876, genre: 'Балет', price: 99, sales: 12453 },
    { id: 2, title: 'Щелкунчик', year: 1892, genre: 'Балет', price: 99, sales: 15672 },
    { id: 3, title: 'Евгений Онегин', year: 1879, genre: 'Опера', price: 149, sales: 8934 },
  ];

  return (
    <div className="min-h-screen">
      <Header />
      
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Заголовок профиля */}
        <div className="mb-8">
          <div className="liquid-glass-strong rounded-3xl p-8">
            <div className="flex flex-col md:flex-row gap-8">
              {/* Фото композитора */}
              <div className="w-48 h-48 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-7xl flex-shrink-0">
                
              </div>

              {/* Информация */}
              <div className="flex-1">
                <h1 className="text-4xl font-semibold text-gray-900 mb-3">
                  {composerData.name}
                </h1>
                <p className="text-lg text-gray-600 mb-4 leading-relaxed">
                  {composerData.bio}
                </p>

                {/* Даты и регион */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div>
                    <div className="text-sm text-gray-600 mb-1">Родился</div>
                    <div className="font-medium text-gray-900">{composerData.birthDate}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600 mb-1">Умер</div>
                    <div className="font-medium text-gray-900">{composerData.deathDate}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600 mb-1">Регион</div>
                    <div className="font-medium text-gray-900">{composerData.region}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600 mb-1">Эпоха</div>
                    <div className="font-medium text-gray-900">{composerData.era}</div>
                  </div>
                </div>

                {/* Жанры */}
                <div className="flex flex-wrap gap-2">
                  {composerData.genres.map((genre, i) => (
                    <span
                      key={i}
                      className="px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-700 font-medium"
                    >
                      {genre}
                    </span>
                  ))}
                </div>
              </div>

              {/* Статистика */}
              <div className="flex md:flex-col gap-4 md:gap-6">
                <div className="text-center">
                  <div className="text-3xl font-semibold text-gray-900">{composerData.totalWorks}</div>
                  <div className="text-sm text-gray-600">Произведений</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-semibold text-gray-900">{composerData.totalSales}</div>
                  <div className="text-sm text-gray-600">Продаж</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-semibold text-gray-900">{composerData.avgRating}</div>
                  <div className="text-sm text-gray-600">Рейтинг</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Вкладки */}
        <div className="mb-6">
          <div className="flex gap-2 liquid-glass rounded-2xl p-2">
            {['works', 'biography', 'context'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 px-6 py-3 rounded-xl font-medium transition-all ${
                  activeTab === tab
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab === 'works' && 'Произведения'}
                {tab === 'biography' && 'Биография'}
                {tab === 'context' && 'Культурный контекст'}
              </button>
            ))}
          </div>
        </div>

        {/* Контент */}
        {activeTab === 'works' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-2xl font-semibold text-gray-900">Произведения</h3>
              <select className="px-4 py-2 rounded-xl border border-gray-200 bg-white focus:border-gray-400 focus:outline-none">
                <option>Все жанры</option>
                <option>Балет</option>
                <option>Опера</option>
                <option>Симфония</option>
              </select>
            </div>

            {works.map((work) => (
              <div key={work.id} className="apple-card p-6">
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-3xl flex-shrink-0">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-gray-900 mb-1">{work.title}</h4>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span>{work.year} год</span>
                      <span>•</span>
                      <span>{work.genre}</span>
                      <span>•</span>
                      <span>{work.sales} продаж</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-2xl font-semibold text-gray-900 mb-2">{work.price} ₽</div>
                    <button className="apple-button">Купить</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'biography' && (
          <div className="liquid-glass rounded-2xl p-8">
            <h3 className="text-2xl font-semibold text-gray-900 mb-4">Полная биография</h3>
            <div className="space-y-4 text-gray-700 leading-relaxed">
              <p>
                Петр Ильич Чайковский родился 7 мая 1840 года в Воткинске. Его музыкальный талант 
                проявился в раннем возрасте, хотя профессиональное музыкальное образование он начал 
                получать только в 21 год.
              </p>
              <p>
                В 1862 году Чайковский поступил в только что открывшуюся Петербургскую консерваторию, 
                где учился у Антона Рубинштейна. После окончания консерватории в 1865 году он переехал 
                в Москву, где преподавал в Московской консерватории.
              </p>
              <p>
                Творческое наследие Чайковского включает 10 опер, 3 балета, 7 симфоний, 4 сюиты, 
                2 фортепианных концерта, концерт для скрипки с оркестром и более 100 романсов.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'context' && (
          <div className="liquid-glass rounded-2xl p-8">
            <h3 className="text-2xl font-semibold text-gray-900 mb-4">Культурный и исторический контекст</h3>
            <div className="space-y-4 text-gray-700 leading-relaxed">
              <p>
                Чайковский творил в эпоху расцвета русской культуры второй половины XIX века. 
                Его музыка отражала романтические идеалы того времени, сочетая русские народные 
                мотивы с европейскими традициями.
              </p>
              <p>
                Композитор был современником Достоевского, Толстого, входил в круг «Могучей кучки», 
                хотя и держался особняком от этого объединения. Его творчество оказало огромное 
                влияние на развитие мировой музыкальной культуры.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
              <div className="bg-gray-50 rounded-xl p-6">
                <h4 className="font-semibold text-gray-900 mb-2">Влияние на культуру</h4>
                <p className="text-sm text-gray-600">
                  Музыка Чайковского стала частью мирового культурного наследия и продолжает 
                  вдохновлять композиторов по всему миру.
                </p>
              </div>
              <div className="bg-gray-50 rounded-xl p-6">
                <h4 className="font-semibold text-gray-900 mb-2">Современное значение</h4>
                <p className="text-sm text-gray-600">
                  Произведения композитора входят в репертуар ведущих театров и концертных залов, 
                  являются образцом музыкального искусства.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
