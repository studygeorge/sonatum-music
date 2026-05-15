'use client';

import React, { useState, useEffect } from 'react';
import { usePlayer } from '@/context/PlayerContext';
import Link from 'next/link';

// Конфигурация фильтров на основе ТЗ
const FILTER_CONFIG: Record<string, { label: string, key: string, options: string[] }[]> = {
  all: [], // Во вкладке Все фильтры скрыты для простоты
  duhovnaya: [
    { label: 'Подкатегория', key: 'subcategory', options: ['Знаменный распев (крюковое пение)', 'Духовные концерты', 'Колокольные звоны', 'Современное церковное пение', 'Другие конфессии России'] },
    { label: 'Конфессия', key: 'confession', options: ['Православие', 'Католичество', 'Протестантизм', 'Иудаизм', 'Ислам', 'Буддизм'] },
    { label: 'Язык исполнения', key: 'language', options: ['Церковнославянский', 'Русский', 'Латынь'] },
    { label: 'Эпоха', key: 'era', options: ['Древнерусская', 'XVIII век', 'Золотой век', 'Серебряный век', 'Современность'] },
    { label: 'Стиль / Исполнение', key: 'performanceStyle', options: ['Малый распев', 'Столповой распев', 'Большой распев', 'Академическое церковное пение', 'Современные интерпретации'] },
    { label: 'Тип хора', key: 'choirType', options: ['Мужской хор', 'Женский хор', 'Смешанный хор'] }
  ],
  narodnaya: [
    { label: 'Подкатегория', key: 'subcategory', options: ['Обрядовая песня', 'Бытовая лирика', 'Былины и исторические песни', 'Инструментальная традиция', 'Региональные школы'] },
    { label: 'Настроение', key: 'mood', options: ['Лирические / грустные', 'Задорные / весёлые', 'Энергичная', 'Торжественная'] },
    { label: 'Регион', key: 'regionFilter', options: ['Северная школа', 'Южная школа', 'Поволжская школа', 'Уральская школа', 'Сибирская школа', 'Центр'] },
    { label: 'Инструменты', key: 'instruments', options: ['Гусли', 'Балалайка', 'Гармонь', 'Жалейка', 'Баян', 'Домбра'] },
  ],
  classical: [
    { label: 'Подкатегория', key: 'subcategory', options: ['Инструментальная сольная музыка', 'Камерная музыка', 'Симфоническая музыка', 'Вокальная музыка', 'Танцевальная музыка', 'Опера и балет'] },
    { label: 'Эпоха', key: 'era', options: ['Золотой век', 'Могучая кучка', 'Вторая половина XIX века', 'Серебряный век', 'Советский период', 'Современность'] },
    { label: 'Инструменты', key: 'instruments', options: ['Фортепиано', 'Скрипка', 'Виолончель'] },
    { label: 'Форма', key: 'style', options: ['Соната', 'Симфония', 'Романс', 'Оперная ария'] },
  ],
  modern: [
    { label: 'Подкатегория', key: 'subcategory', options: ['Авторская песня и барды', 'Рок', 'Хип-хоп и рэп', 'Поп и эстрада', 'Электроника', 'Фолк', 'Джаз'] },
    { label: 'Эпоха', key: 'era', options: ['Подпольный период (1980–1985)', 'Перестройка и расцвет (1986–1991)', '2010-е'] },
    { label: 'Тематика', key: 'theme', options: ['Социальная критика', 'Лирическая', 'Философская', 'Городская лирика'] },
    { label: 'Регион', key: 'regionFilter', options: ['Москва', 'Санкт-Петербург', 'Юг России'] },
  ],
};

const TAB_LABELS: Record<string, string> = {
  'all': 'Всё',
  'duhovnaya': 'Духовная музыка',
  'narodnaya': 'Народная музыка',
  'classical': 'Академическая музыка',
  'modern': 'Современная музыка',
};

const TAB_KEYS = Object.keys(TAB_LABELS);

export default function CatalogPage() {
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Состояние выбранных фильтров ключ => значение
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  
  const { playTrack } = usePlayer();
  const [tracks, setTracks] = useState<any[]>([]);

  // При смене вкладки, сбрасываем фильтры
  useEffect(() => {
    setActiveFilters({});
  }, [activeTab]);

  useEffect(() => {
    const fetchCatalog = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (searchQuery) params.append('search', searchQuery);
        
        if (activeTab !== 'all') {
          // Маппинг вкладок на корневые slug
          const tabToGenreMap: Record<string, string> = {
            'duhovnaya': 'duhovnaya',
            'narodnaya': 'narodnaya',
            'classical': 'classical',
            'modern': 'modern'
          };
          if (tabToGenreMap[activeTab]) {
            params.append('genres', tabToGenreMap[activeTab]);
          }
        }

        // Применяем активные фильтры
        Object.entries(activeFilters).forEach(([key, value]) => {
          if (value) params.append(key, value);
        });
        
        const response = await fetch(`/api/catalog?${params.toString()}`);
        const json = await response.json();
        
        if (json.success) {
          setTracks(json.data.tracks || []);
        } else {
          console.error('Failed to fetch catalog:', json.error);
        }
      } catch (error) {
        console.error('Error fetching catalog:', error);
      } finally {
        setLoading(false);
      }
    };
    
    const timer = setTimeout(() => {
      fetchCatalog();
    }, 300);
    
    return () => clearTimeout(timer);
  }, [activeTab, searchQuery, activeFilters]);

  const toggleFilter = (key: string, option: string) => {
    setActiveFilters(prev => {
      const next = { ...prev };
      if (next[key] === option) {
        delete next[key]; // снимаем выбор
      } else {
        next[key] = option; // ставим выбор
      }
      return next;
    });
  };

  const clearFilters = () => {
    setActiveFilters({});
    setFiltersOpen(false);
  };

  const formatTime = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  const currentFilterConfig = FILTER_CONFIG[activeTab] || [];

  return (
    <main className="min-h-screen pt-0 md:pt-16 pb-12 px-6 md:px-12 max-w-7xl mx-auto animate-fadeInUp">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-6">
        <div>
          <h1 className="text-4xl lg:text-5xl font-bold tracking-tight mb-4">Каталог музыки</h1>
          <p className="text-lg text-[var(--text-secondary)]">Исследуйте самую полную коллекцию отечественного национального наследия</p>
        </div>
        
        <div className="w-full md:w-auto flex flex-col sm:flex-row gap-4">
          <input 
            type="text" 
            placeholder="Поиск по названию или автору..." 
            className="apple-card px-6 py-3 w-full sm:w-80 outline-none focus:ring-2 focus:ring-[var(--accent)] border-none bg-white/50 backdrop-blur-md"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {activeTab !== 'all' && (
            <button 
              className={`apple-button-secondary whitespace-nowrap ${filtersOpen ? 'bg-[var(--text-primary)] text-white' : ''} ${Object.keys(activeFilters).length > 0 && !filtersOpen ? 'border-[var(--accent)] text-[var(--accent)]' : ''}`}
              onClick={() => setFiltersOpen(!filtersOpen)}
            >
              {filtersOpen ? 'Скрыть фильтры' : `Фильтры ${Object.keys(activeFilters).length > 0 ? `(${Object.keys(activeFilters).length})` : ''}`}
            </button>
          )}
        </div>
      </div>

      {/* Таксономия вкладок */}
      <div className="flex overflow-x-auto gap-4 mb-8 pb-2 hide-scrollbar">
        {TAB_KEYS.map(tab => (
          <button
            key={tab}
            className={`px-6 py-3 rounded-full font-medium transition-all whitespace-nowrap ${
              activeTab === tab 
                ? 'bg-[var(--text-primary)] text-white shadow-md' 
                : 'bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--border)] hover:bg-[var(--hover)]'
            }`}
            onClick={() => setActiveTab(tab)}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* Динамическая панель расширенных фильтров */}
      {filtersOpen && activeTab !== 'all' && currentFilterConfig.length > 0 && (
        <div className="apple-card p-6 md:p-8 mb-10 liquid-glass animate-fadeInUp">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {currentFilterConfig.map(filterGroup => (
              <div key={filterGroup.key}>
                <h3 className="font-semibold mb-4 text-[var(--text-secondary)]">{filterGroup.label}</h3>
                <div className="flex flex-col gap-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                  {filterGroup.options.map(opt => (
                    <label key={opt} className="flex items-center gap-3 cursor-pointer group">
                      <div 
                        className={`w-5 h-5 flex items-center justify-center rounded-md border transition-colors ${
                          activeFilters[filterGroup.key] === opt 
                            ? 'bg-[var(--accent)] border-[var(--accent)] text-white' 
                            : 'border-[var(--border)] bg-white group-hover:border-[var(--text-primary)]'
                        }`}
                      >
                        {activeFilters[filterGroup.key] === opt && <span className="text-xs">✓</span>}
                      </div>
                      <span className={`text-sm ${activeFilters[filterGroup.key] === opt ? 'text-[var(--text-primary)] font-medium' : 'text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]'}`}>
                        {opt}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-8 pt-6 border-t border-[var(--border)] flex justify-end gap-4">
            <button className="apple-button-secondary" onClick={clearFilters}>Сбросить всё</button>
            <button className="apple-button" onClick={() => setFiltersOpen(false)}>Готово</button>
          </div>
        </div>
      )}

      {/* Список треков */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="w-8 h-8 rounded-full border-4 border-[var(--border)] border-t-[var(--accent)] animate-spin"></div>
        </div>
      ) : tracks.length === 0 ? (
        <div className="text-center py-20 text-[var(--text-secondary)] apple-card">
          По вашему запросу ничего не найдено. Нажмите "Сбросить всё", чтобы очистить фильтры.
        </div>
      ) : (
        <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-[var(--border)] animate-fadeInUp">
          <div className="flex items-center gap-4 px-4 pb-4 border-b border-[var(--border)] text-[var(--text-secondary)] text-sm font-medium">
            <div className="w-8 flex-shrink-0 text-center">#</div>
            <div className="w-12 flex-shrink-0"></div>
            <div className="flex-grow">НАЗВАНИЕ</div>
            <div className="hidden md:block w-48 shrink-0">ИСПОЛНИТЕЛЬ</div>
            <div className="hidden lg:block w-32 shrink-0">ПОДРАЗДЕЛ</div>
            <div className="w-20 flex-shrink-0 text-right">ВРЕМЯ</div>
          </div>
          
          <div className="flex flex-col">
            {tracks.map((track, index) => (
              <div 
                key={track.id} 
                className="flex items-center gap-4 p-4 hover:bg-[var(--hover)] transition-colors group border-b border-[var(--border)] last:border-0"
              >
                <div 
                  className="w-8 flex-shrink-0 flex justify-center items-center text-[var(--text-secondary)] group-hover:text-[var(--accent)] transition-colors cursor-pointer"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); playTrack(track); }}
                  title="Слушать"
                >
                  <span className="group-hover:hidden tabular-nums font-medium">{index + 1}</span>
                  <span className="hidden group-hover:inline font-bold text-lg drop-shadow-sm">▶</span>
                </div>
                
                <Link href={`/tracks/${track.slug || track.id}`} className="w-12 h-12 bg-[var(--surface)] border border-[var(--border)] rounded-lg overflow-hidden shrink-0 cursor-pointer block relative">
                  {track.cover && <img src={track.cover} alt="Cover" className="w-full h-full object-cover" />}
                  <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                </Link>
                
                <div className="flex-grow min-w-0 flex flex-col justify-center">
                  <h4 className="font-semibold truncate text-[var(--text-primary)]">
                    <Link href={`/tracks/${track.slug || track.id}`} className="hover:text-[var(--accent)] transition-colors">
                      {track.title}
                    </Link>
                  </h4>
                  <p className="text-sm truncate sm:hidden">
                    <Link href={`/artist/${track.artist?.slug || track.artist?.id || '1'}`} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:underline transition-all">
                      {track.artist?.name || 'Неизвестный исполнитель'}
                    </Link>
                  </p>
                </div>
                
                <div className="hidden md:flex items-center w-48 shrink-0">
                  <p className="truncate text-sm">
                    <Link href={`/artist/${track.artist?.slug || track.artist?.id || '1'}`} className="text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors">
                      {track.artist?.name || 'Неизвестный исполнитель'}
                    </Link>
                  </p>
                </div>

                <div className="hidden lg:flex items-center w-32 shrink-0">
                  <span className="text-xs font-medium px-2 py-1 bg-[var(--surface)] text-[var(--text-secondary)] rounded-md truncate">
                    {track.metadata?.subcategory || 'Трек'}
                  </span>
                </div>
                
                <div className="w-20 shrink-0 text-right text-[var(--text-secondary)] tabular-nums group-hover:text-[var(--text-primary)] text-sm">
                  {formatTime(track.duration)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
