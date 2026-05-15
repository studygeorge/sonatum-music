'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { authStorage } from '@/app/lib/auth';

export default function AuthorOverviewPage() {
  const [me, setMe] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/author/me', {
      headers: { Authorization: `Bearer ${authStorage.getToken() || ''}` },
    })
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setMe(j.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return null;
  if (!me) return null;

  const displayName = me.artist?.name || me.collective?.name || 'Автор';
  const bio = me.artist?.bio || me.collective?.bio || '';

  return (
    <div className="space-y-6 animate-fadeInUp">
      <section
        className="relative rounded-3xl overflow-hidden p-7 md:p-10 text-white"
        style={{
          background: 'linear-gradient(135deg, #1d4cb8 0%, #d52b1e 55%, #e6e6e6 100%)',
        }}>
        <div className="relative z-10 max-w-2xl">
          <div className="text-xs uppercase tracking-widest font-semibold mb-2 opacity-90">
            Кабинет автора
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">
            {displayName}
          </h1>
          {bio && (
            <p className="text-sm md:text-base text-white/85 max-w-xl mt-3 line-clamp-2">
              {bio}
            </p>
          )}
        </div>
      </section>
      <div className="grid sm:grid-cols-3 gap-3">
        <StatCard label="Треков" value={me.stats.tracksCount} />
        <StatCard label="Доход с лицензий" value={`${Math.round(me.stats.totalSales).toLocaleString('ru-RU')} ₽`} />
        <StatCard label="Донаты" value={`${Math.round(me.stats.totalDonations).toLocaleString('ru-RU')} ₽`} />
      </div>
      <section>
        <div className="flex items-end justify-between mb-4">
          <h2 className="text-xl font-bold tracking-tight">Быстрые действия</h2>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <Link href="/author/upload" className="apple-card p-5 hover:scale-[1.01] transition-transform">
                        <div className="font-semibold mb-1">Загрузить новый трек</div>
            <div className="text-sm text-[var(--text-secondary)]">
              Оригинал, кавер или только ноты — выбираете тип и заполняете 3 шага.
            </div>
          </Link>
          <Link href="/author/finance" className="apple-card p-5 hover:scale-[1.01] transition-transform">
                        <div className="font-semibold mb-1">
              {me.user.payoutEnabled ? 'Управление выплатами' : 'Подключить выплаты'}
            </div>
            <div className="text-sm text-[var(--text-secondary)]">
              {me.user.payoutEnabled
                ? 'Вывод средств на карту через СБП.'
                : 'Подтвердите статус самозанятого и подключите СБП.'}
            </div>
          </Link>
          <Link href="/author/collabs" className="apple-card p-5 hover:scale-[1.01] transition-transform">
                        <div className="font-semibold mb-1">Найти соавтора</div>
            <div className="text-sm text-[var(--text-secondary)]">
              Творческая лаборатория — заявки на сотрудничество с другими авторами.
            </div>
          </Link>
          <Link href="/author/events" className="apple-card p-5 hover:scale-[1.01] transition-transform">
                        <div className="font-semibold mb-1">Создать событие</div>
            <div className="text-sm text-[var(--text-secondary)]">
              Концерт, премьера, мастер-класс — попадёт в афишу после модерации.
            </div>
          </Link>
        </div>
      </section>
      {me.artist && (
        <section className="apple-card p-6">
          <h2 className="text-xl font-bold tracking-tight mb-4">Профиль</h2>
          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <Info label="Сценическое имя" value={me.artist.name} />
            <Info label="Slug" value={me.artist.slug} />
            <Info label="Регион" value={me.artist.region || '—'} />
            <Info label="Город" value={me.artist.city || '—'} />
            <Info label="Подписчики" value={me.artist.followers ?? 0} />
            <Info label="Верифицирован" value={me.artist.verified ? 'Да' : 'Нет'} />
          </div>
          <Link
            href={`/artist/${me.artist.slug}`}
            className="inline-block mt-4 text-sm text-[var(--accent)] hover:underline">
            Открыть публичный профиль 
          </Link>
        </section>
      )}

      {me.collective && (
        <section className="apple-card p-6">
          <h2 className="text-xl font-bold tracking-tight mb-4">Коллектив</h2>
          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <Info label="Название" value={me.collective.name} />
            <Info label="Сокращение" value={me.collective.short_name || '—'} />
            <Info label="Получатель выплат" value={
              me.collective.payee_type === 'LEGAL_ENTITY' ? 'Юрлицо' :
              me.collective.payee_type === 'SOLE_PROP' ? 'ИП' :
              me.collective.payee_type === 'SELF_EMPLOYED' ? 'Самозанятый' : '—'
            } />
            <Info label="Регион" value={me.collective.region || '—'} />
            <Info label="ИНН" value={me.collective.legal_inn || '—'} />
            <Info label="Верифицирован" value={me.collective.verified ? 'Да' : 'Нет'} />
          </div>
        </section>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: any }) {
  return (
    <div className="apple-card p-5">
      <div className="text-xs text-[var(--text-secondary)] mb-1.5">{label}</div>
      <div className="text-2xl font-bold tracking-tight tabular-nums">{value}</div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <div className="text-xs text-[var(--text-secondary)] mb-0.5">{label}</div>
      <div className="font-medium">{String(value ?? '—')}</div>
    </div>
  );
}
