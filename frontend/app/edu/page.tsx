'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { authStorage } from '@/app/lib/auth';

export default function EduOverviewPage() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch('/api/edu/me', { headers: { Authorization: `Bearer ${authStorage.getToken() || ''}` } })
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setData(j);
      });
  }, []);

  if (!data?.institution) return null;
  const i = data.institution;
  const isAdmin = data.myRole === 'ADMIN';

  return (
    <div className="space-y-6 animate-fadeInUp">
      <section
        className="relative rounded-3xl overflow-hidden p-7 md:p-10 text-white"
        style={{ background: 'linear-gradient(135deg, #1d4cb8 0%, #2f9e8f 55%, #e6e6e6 100%)' }}>
        <div className="relative z-10 max-w-2xl">
          <div className="text-xs uppercase tracking-widest font-semibold mb-2 opacity-90">
            Учебное заведение
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">{i.fullName}</h1>
          <p className="text-sm md:text-base text-white/85 mt-2">
            {isAdmin ? 'Кабинет администратора' : data.myRole === 'TEACHER' ? 'Преподавательский доступ' : 'Студенческий доступ'}
          </p>
        </div>
      </section>
      {isAdmin && data.stats && (
        <div className="grid sm:grid-cols-3 gap-3">
          <Stat label="Всего пользователей" value={data.stats.totalMembers} />
          <Stat label="Преподавателей" value={data.stats.teachers} />
          <Stat label="Учащихся" value={data.stats.students} />
        </div>
      )}

      <section className="apple-card p-6">
        <h2 className="text-lg font-bold tracking-tight mb-3">Что доступно</h2>
        <ul className="space-y-2 text-sm">
          <li className="flex items-start gap-2"><span className="text-green-600"></span>Полный каталог музыки</li>
          <li className="flex items-start gap-2"><span className="text-green-600"></span>Тексты произведений</li>
          {i.withSheets && (
            <li className="flex items-start gap-2"><span className="text-green-600"></span>Ноты (PDF)</li>
          )}
          {isAdmin && (
            <>
              <li className="flex items-start gap-2"><span className="text-green-600"></span>Управление пользователями</li>
              <li className="flex items-start gap-2"><span className="text-green-600"></span>Создание учебных плейлистов</li>
              <li className="flex items-start gap-2"><span className="text-green-600"></span>Статистика и отчётность</li>
            </>
          )}
        </ul>
      </section>
      {isAdmin && (
        <section className="apple-card p-6">
          <h2 className="text-lg font-bold tracking-tight mb-3">Быстрые действия</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <Link href="/edu/users" className="rounded-2xl border border-[var(--border)] bg-white p-4 hover:scale-[1.01] transition-transform">
                            <div className="font-semibold">Управление пользователями</div>
              <div className="text-xs text-[var(--text-secondary)] mt-1">
                Добавляйте преподавателей и учащихся
              </div>
            </Link>
            <Link href="/edu/stats" className="rounded-2xl border border-[var(--border)] bg-white p-4 hover:scale-[1.01] transition-transform">
                            <div className="font-semibold">Статистика</div>
              <div className="text-xs text-[var(--text-secondary)] mt-1">
                Прослушивания, популярные треки
              </div>
            </Link>
          </div>
        </section>
      )}

      {isAdmin && i.annualFee && (
        <section className="apple-card p-6">
          <h2 className="text-lg font-bold tracking-tight mb-3">Лицензия</h2>
          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <Info label="Стоимость" value={`${i.annualFee.toLocaleString('ru-RU')} ₽/год`} />
            <Info label="Преподавателей в плане" value={i.teacherCount} />
            <Info label="Учащихся в плане" value={i.studentCount} />
            <Info label="Доступ к нотам" value={i.withSheets ? 'Включён' : 'Не включён'} />
            {i.paidAt && <Info label="Оплачено" value={new Date(i.paidAt).toLocaleDateString('ru-RU')} />}
            {i.expiresAt && (
              <Info label="Действует до" value={new Date(i.expiresAt).toLocaleDateString('ru-RU')} />
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div className="apple-card p-5">
      <div className="text-xs text-[var(--text-secondary)] mb-1.5">{label}</div>
      <div className="text-2xl font-black tabular-nums tracking-tight">{value}</div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <span className="text-[var(--text-secondary)]">{label}:</span>{' '}
      <span className="font-medium">{value}</span>
    </div>
  );
}
