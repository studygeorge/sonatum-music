'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { authStorage } from '@/app/lib/auth';

export default function EventDetailPage({ params }: { params: { id: string } }) {
  const [ev, setEv] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [attending, setAttending] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/events/${params.id}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setEv(j.data);
      })
      .finally(() => setLoading(false));
  }, [params.id]);

  const toggleAttend = async () => {
    const token = authStorage.getToken();
    if (!token) {
      window.location.href = '/login';
      return;
    }
    setBusy(true);
    const method = attending ? 'DELETE' : 'POST';
    const r = await fetch(`/api/events/${params.id}/attend`, {
      method,
      headers: { Authorization: `Bearer ${token}` },
    });
    const j = await r.json();
    if (j.success) {
      setAttending(j.attending);
      setEv((prev: any) => ({
        ...prev,
        attendeesCount: prev.attendeesCount + (j.attending ? 1 : -1),
      }));
    }
    setBusy(false);
  };

  const share = () => {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: ev?.title, url });
    } else {
      navigator.clipboard.writeText(url);
      alert('Ссылка скопирована');
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen pt-20 text-center text-[var(--text-secondary)]">
        Загрузка…
      </main>
    );
  }
  if (!ev) {
    return (
      <main className="min-h-screen pt-20 px-6 max-w-2xl mx-auto">
        <div className="apple-card p-10 text-center">
                    <h1 className="text-xl font-bold mb-2">Событие не найдено</h1>
          <Link href="/events" className="text-[var(--accent)] hover:underline">
            Назад к афише
          </Link>
        </div>
      </main>
    );
  }

  const startDate = new Date(ev.startsAt);
  const fmtFull = startDate.toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const fmtTime = startDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

  return (
    <main className="min-h-screen pt-10 pb-24 px-6 md:px-12 max-w-5xl mx-auto space-y-8">
      <div>
        <Link href="/events" className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
          Все события
        </Link>
      </div>
      <section className="apple-card overflow-hidden animate-fadeInUp">
        {ev.posterUrl ? (
          <div className="aspect-[16/9] md:aspect-[21/9] bg-gray-100">
            <img src={ev.posterUrl} alt={ev.title} className="w-full h-full object-cover" />
          </div>
        ) : (
          <div
            className="aspect-[16/9] md:aspect-[21/9] flex items-center justify-center text-7xl text-white"
            style={{ background: 'linear-gradient(135deg, #1d4cb8 0%, #d52b1e 55%, #e6e6e6 100%)' }}>
          </div>
        )}

        <div className="p-6 md:p-10">
          <h1 className="text-3xl md:text-5xl font-black tracking-tight mb-4 text-white">{ev.title}</h1>
          <div className="grid sm:grid-cols-2 gap-x-8 gap-y-3 text-sm mb-6">
            <Info icon="" label="Дата" value={`${fmtFull} в ${fmtTime}`} />
            <Info
              icon=""
              label="Место"
              value={
                ev.isOnline
                  ? 'Онлайн-событие'
                  : [ev.venueName, ev.venueCity, ev.venueAddress].filter(Boolean).join(', ') || '—'
              }
            />
            {ev.ticketPrice && (
              <Info icon="" label="Цена билета" value={`${Math.round(ev.ticketPrice).toLocaleString('ru-RU')} ₽`} />
            )}
            {ev.attendeesCount> 0 && (
              <Info icon="" label="Собираются" value={`${ev.attendeesCount} человек`} />
            )}
          </div>
          {ev.description && (
            <div className="mb-6 text-[var(--text-primary)] whitespace-pre-line leading-relaxed">
              {ev.description}
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              onClick={toggleAttend}
              disabled={busy}
              className={`px-6 py-3 rounded-full font-semibold text-sm transition-colors disabled:opacity-50 ${
                attending
                  ? 'bg-[var(--text-primary)] text-white'
                  : 'bg-[#e8e6e1] text-[#1c1c1e] hover:bg-[#dfdcd5]'
              }`}>
              {attending ? ' Я буду' : 'Буду'}
            </button>
            {ev.ticketUrl && (
              <a
                href={ev.ticketUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-3 rounded-full bg-[var(--accent)] text-white font-semibold text-sm hover:opacity-90 transition-opacity">
                Купить билет
              </a>
            )}
            {ev.isOnline && ev.onlineUrl && (
              <a
                href={ev.onlineUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-3 rounded-full bg-[var(--text-primary)] text-white font-semibold text-sm hover:opacity-90 transition-opacity">
                Открыть трансляцию
              </a>
            )}
            <button
              onClick={share}
              className="px-6 py-3 rounded-full bg-[var(--hover)] text-[var(--text-primary)] font-semibold text-sm hover:bg-[var(--border)] transition-colors">
              Поделиться
            </button>
          </div>
        </div>
      </section>
      <section className="apple-card p-6">
        <h2 className="text-lg font-bold mb-3">Об авторе</h2>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-[var(--text-primary)] text-white flex items-center justify-center overflow-hidden">
            {ev.artistAvatar ? (
              <img src={ev.artistAvatar} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="font-bold">{ev.authorName?.[0] || 'A'}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold">{ev.authorName}</div>
            {(ev.artistSlug || ev.collectiveSlug) && (
              <Link
                href={ev.artistSlug ? `/artist/${ev.artistSlug}` : `/artist/${ev.collectiveSlug}`}
                className="text-xs text-[var(--accent)] hover:underline">
                Открыть профиль автора 
              </Link>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

function Info({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-xl shrink-0">{icon}</span>
      <div className="min-w-0">
        <div className="text-xs text-[var(--text-secondary)]">{label}</div>
        <div className="font-medium">{value}</div>
      </div>
    </div>
  );
}
