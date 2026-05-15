'use client';

import { useState } from 'react';

export default function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const menuItems = [
    { icon: '🏠', label: 'Главная', active: true },
    { icon: '🔍', label: 'Поиск', active: false },
    { icon: '📚', label: 'Моя библиотека', active: false },
    { icon: '➕', label: 'Создать плейлист', active: false },
    { icon: '❤️', label: 'Любимые треки', active: false },
  ];

  return (
    <aside
      className={`fixed left-0 top-0 h-full glass border-r border-white/20 transition-all duration-300 z-40 ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      <div className="p-4 h-full flex flex-col">
        {/* Логотип */}
        <div className="flex items-center justify-between mb-8">
          {!isCollapsed && (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold shadow-lg">
                S
              </div>
              <img src="/logo.png" alt="Сонатум" className="h-7 w-auto" />
            </div>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="w-10 h-10 rounded-xl glass hover:bg-white/40 flex items-center justify-center transition-all"
          >
            {isCollapsed ? '→' : '←'}
          </button>
        </div>

        {/* Меню */}
        <nav className="flex-1 space-y-2">
          {menuItems.map((item, index) => (
            <button
              key={index}
              className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all ${
                item.active
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg'
                  : 'glass hover:bg-white/40 text-slate-700'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              {!isCollapsed && (
                <span className="font-medium">{item.label}</span>
              )}
            </button>
          ))}
        </nav>

        {/* Плейлисты */}
        {!isCollapsed && (
          <div className="mt-6 space-y-2">
            <h3 className="text-sm font-semibold text-slate-600 px-4 mb-2">
              МОИ ПЛЕЙЛИСТЫ
            </h3>
            {['Любимое', 'Рок классика', 'Для работы', 'Вечер'].map(
              (playlist, index) => (
                <button
                  key={index}
                  className="w-full text-left px-4 py-2 rounded-lg hover:bg-white/20 text-slate-700 transition-all"
                >
                  {playlist}
                </button>
              )
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
