'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { authStorage } from '@/app/lib/auth';

import { toast } from '@/app/components/Toast';
type Event = {
  id: string;
  posterUrl: string | null;
  title: string;
  startsAt: string;
  venueCity: string | null;
  venueName: string | null;
  isOnline: boolean;
  authorName: string;
  attendeesCount: number;
};

function fmtDay(d: string) {
  return new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' });
}

function fmtFull(d: string) {
  return new Date(d).toLocaleDateString('ru-RU', {
    day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit',
  });
}

export default function HomeEvents({ events }: { events: Event[] }) {
  if (!events || events.length === 0) return null;
  return (
    <section>
      <div className="flex flex-wrap justify-between items-end mb-6 gap-2">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Ближайшие события</h2>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Концерты, премьеры и мастер-классы
          </p>
        </div>
        <Link href="/events" className="text-[var(--accent)] font-medium hover:underline whitespace-nowrap">
          Вся афиша
        </Link>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {events.slice(0, 4).map((e) => (
          <EventCard key={e.id} ev={e} />
        ))}
      </div>
    </section>
  );
}

function EventCard({ ev }: { ev: Event }) {
  const [attending, setAttending] = useState(false);
  const [count, setCount] = useState(ev.attendeesCount || 0);
  const [busy, setBusy] = useState(false);

  // При маунте подтянуть состояние «я уже отметился?» с бэка (если залогинен)
  useEffect(() => {
    const token = authStorage.getToken();
    if (!token) return;
    fetch(`/api/events/${ev.id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(j => {
        if (j?.success && j.data) {
          setAttending(!!j.data.attending);
          setCount(j.data.attendeesCount || 0);
        }
      })
      .catch(() => {});
  }, [ev.id]);

  const toggleAttend = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const token = authStorage.getToken();
    if (!token) {
      window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
      return;
    }
    setBusy(true);
    try {
      const r = await fetch(`/api/events/${ev.id}/attend`, {
        method: attending ? 'DELETE' : 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await r.json();
      if (j?.success) {
        setAttending(j.attending);
        setCount((c) => c + (j.attending ? 1 : -1));
      }
    } finally { setBusy(false); }
  };

  const share = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/events/${ev.id}`;
    if (navigator.share) {
      try { await navigator.share({ title: ev.title, url }); return; } catch {}
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.error('Ссылка скопирована');
    } catch {
      prompt('Скопируйте ссылку:', url);
    }
  };

  return (
    <div className="apple-card overflow-hidden hover-scale group flex flex-col">
      <Link href={`/events/${ev.id}`} className="block">
        <div className="aspect-video bg-gray-100 relative overflow-hidden">
          {ev.posterUrl ? (
            <img
              src={ev.posterUrl}
              alt={ev.title}
              loading="lazy"
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center text-4xl"
              style={{ background: 'linear-gradient(135deg, rgba(29,76,184,0.15) 0%, rgba(213,43,30,0.15) 100%)' }}
            />
          )}
          <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-md rounded-full px-3 py-1 text-xs font-bold tabular-nums">
            {fmtDay(ev.startsAt)}
          </div>
        </div>
        <div className="p-4 pb-2">
          <h3 className="font-bold text-sm leading-snug line-clamp-2 mb-2">{ev.title}</h3>
          <p className="text-xs text-[var(--text-secondary)] mb-1.5">{fmtFull(ev.startsAt)}</p>
          <p className="text-[11px] text-[var(--text-secondary)] truncate">
            {ev.isOnline ? 'Онлайн' : [ev.venueName, ev.venueCity].filter(Boolean).join(', ') || '—'}
          </p>
        </div>
      </Link>
      <div className="px-4 pb-3 flex items-center gap-2">
        <button
          onClick={toggleAttend}
          disabled={busy}
          className={`flex-1 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors disabled:opacity-60 ${
            attending
              ? 'bg-[var(--text-primary)] text-white'
              : 'bg-[var(--hover)] text-[var(--text-primary)] hover:bg-[var(--border)]'
          }`}>
          {attending ? `✓ Иду${count > 0 ? ` · ${count}` : ''}` : `Буду${count > 0 ? ` · ${count}` : ''}`}
        </button>
        <button
          onClick={share}
          title="Поделиться"
          className="px-3 py-1.5 rounded-full text-xs font-semibold bg-[var(--hover)] text-[var(--text-primary)] hover:bg-[var(--border)] transition-colors">
          ↗
        </button>
      </div>
    </div>
  );
}
