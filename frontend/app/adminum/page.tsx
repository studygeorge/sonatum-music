'use client';

import React from 'react';

export default function AdminDashboard() {
  return (
    <div className="animate-fadeInUp text-[var(--text-primary)]">
      <h1 className="text-3xl font-bold mb-8">Сводка (Dashboard)</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        {[
          { title: 'Активных артистов', value: '42' },
          { title: 'Новых треков', value: '15' },
          { title: 'Ожидают лицензию', value: '5' },
        ].map((stat, idx) => (
          <div key={idx} className="apple-card p-6 border-none bg-white shadow-sm">
            <h3 className="text-[var(--text-secondary)] text-sm font-semibold tracking-wider uppercase mb-2">{stat.title}</h3>
            <p className="text-3xl md:text-4xl font-bold">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="apple-card p-6 md:p-10 bg-white border-none shadow-sm">
        <h2 className="text-2xl font-bold mb-4">Добро пожаловать в новую Admin Panel!</h2>
        <p className="text-[var(--text-secondary)] leading-relaxed max-w-2xl text-lg">
          Вы успешно авторизовались через Telegram. Здесь вы можете управлять контентом, модерацией и просматривать статистику ресурса. Эта область надежно защищена и доступна только авторизованным администраторам.
        </p>
      </div>
    </div>
  );
}
