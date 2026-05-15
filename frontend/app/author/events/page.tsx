'use client';

import { useEffect, useState, FormEvent } from 'react';
import Link from 'next/link';
import { authStorage } from '@/app/lib/auth';

type Event = {
  id: string;
  posterUrl: string | null;
  title: string;
  startsAt: string;
  venueCity: string | null;
  venueName: string | null;
  venueAddress: string | null;
  isOnline: boolean;
  onlineUrl: string | null;
  description: string | null;
  ticketPrice: number | null;
  ticketUrl: string | null;
  status: string;
  rejectionReason: string | null;
  paidPublication: boolean;
  attendeesCount: number;
};

const STATUS_LABEL: Record<string, { l: string; c: string }> = {
  DRAFT: { l: 'Черновик', c: 'bg-gray-100 text-gray-700' },
  PENDING: { l: 'На модерации', c: 'bg-amber-100 text-amber-700' },
  APPROVED: { l: 'Опубликовано', c: 'bg-green-100 text-green-700' },
  REJECTED: { l: 'Отклонено', c: 'bg-red-100 text-red-700' },
};

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function AuthorEventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  const load = () => {
    fetch('/api/events?mine=1', {
      headers: { Authorization: `Bearer ${authStorage.getToken() || ''}` },
    })
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setEvents(j.data || []);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => load(), []);

  const removeEvent = async (id: string) => {
    if (!confirm('Удалить событие?')) return;
    await fetch(`/api/events/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authStorage.getToken() || ''}` },
    });
    load();
  };

  return (
    <div className="space-y-6 animate-fadeInUp">
      <section
        className="relative rounded-3xl overflow-hidden p-7 md:p-10 text-white flex items-end justify-between gap-4 flex-wrap"
        style={{ background: 'linear-gradient(135deg, #1d4cb8 0%, #d52b1e 55%, #e6e6e6 100%)' }}>
        <div className="relative z-10 max-w-xl">
          <div className="text-xs uppercase tracking-widest font-semibold mb-2 opacity-90">
            События
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">Афиша</h1>
          <p className="text-sm md:text-base text-white/85 mt-2">
            Концерты, премьеры, мастер-классы. После модерации появятся на главной.
          </p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="px-5 py-3 rounded-full bg-white text-[#1d4cb8] font-semibold text-sm whitespace-nowrap shrink-0 hover:opacity-90 transition-opacity">
          + Создать событие
        </button>
      </section>
      {loading ? (
        <div className="text-center text-[var(--text-secondary)] py-12">Загрузка…</div>
      ) : events.length === 0 ? (
        <div className="apple-card p-12 text-center">
                    <h3 className="font-semibold mb-1">Пока нет событий</h3>
          <p className="text-sm text-[var(--text-secondary)] mb-5">
            Создайте первое событие — концерт, премьеру или мастер-класс.
          </p>
          <button
            onClick={() => setCreateOpen(true)}
            className="px-6 py-3 rounded-full bg-[var(--text-primary)] text-white font-medium hover:opacity-90 transition-opacity">
            Создать событие
          </button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {events.map((e) => {
            const s = STATUS_LABEL[e.status] || STATUS_LABEL.DRAFT;
            return (
              <div key={e.id} className="apple-card overflow-hidden">
                {e.posterUrl && (
                  <div className="aspect-video bg-gray-100">
                    <img src={e.posterUrl} alt={e.title} className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="p-4">
                  <div className="flex items-baseline gap-2 mb-1">
                    <h3 className="font-bold text-base truncate flex-1">{e.title}</h3>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full ${s.c} shrink-0`}>{s.l}</span>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] mb-2">{fmtDate(e.startsAt)}</p>
                  {(e.venueName || e.venueCity) && (
                    <p className="text-xs text-[var(--text-secondary)]">
                       {[e.venueName, e.venueCity].filter(Boolean).join(', ')}
                    </p>
                  )}
                  {e.rejectionReason && e.status === 'REJECTED' && (
                    <p className="text-xs text-red-600 mt-2 bg-red-50 p-2 rounded-lg">
                      Причина отказа: {e.rejectionReason}
                    </p>
                  )}
                  {!e.paidPublication && e.status === 'PENDING' && (
                    <p className="text-xs text-amber-700 mt-2 bg-amber-50 p-2 rounded-lg">
                      Требуется оплата 250 ₽ для публикации (или подписка ПРОФИ).
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[var(--border)]">
                    <span className="text-xs text-[var(--text-secondary)] flex-1">
                       {e.attendeesCount} собираются
                    </span>
                    {e.status === 'APPROVED' && (
                      <Link
                        href={`/events/${e.id}`}
                        className="text-xs text-[var(--accent)] hover:underline">
                        Открыть
                      </Link>
                    )}
                    <button
                      onClick={() => removeEvent(e.id)}
                      className="text-xs text-red-500 hover:underline">
                      Удалить
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}


    </div>
  );
}

function CreateEventInline({ onCancel, onCreated }: { onCancel: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [venueCity, setVenueCity] = useState('');
  const [venueName, setVenueName] = useState('');
  const [venueAddress, setVenueAddress] = useState('');
  const [isOnline, setIsOnline] = useState(false);
  const [onlineUrl, setOnlineUrl] = useState('');
  const [description, setDescription] = useState('');
  const [ticketPrice, setTicketPrice] = useState('');
  const [ticketUrl, setTicketUrl] = useState('');
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!title.trim()) {
      setError('Укажите название');
      return;
    }
    if (!startsAt) {
      setError('Укажите дату начала');
      return;
    }
    setSubmitting(true);
    try {
      const token = authStorage.getToken() || '';
      let posterUrl: string | null = null;
      if (posterFile) {
        const fd = new FormData();
        fd.append('file', posterFile);
        fd.append('artistSlug', 'events');
        fd.append('trackSlug', `poster-${Date.now()}`);
        const pr = await fetch('/api/upload/cover', { method: 'POST', body: fd });
        const pj = await pr.json();
        if (pj.success) posterUrl = pj.url || pj.coverUrl || pj.data?.url || null;
      }

      const r = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: title.trim(),
          startsAt: new Date(startsAt).toISOString(),
          venueCity: venueCity || undefined,
          venueName: venueName || undefined,
          venueAddress: venueAddress || undefined,
          isOnline,
          onlineUrl: onlineUrl || undefined,
          description: description || undefined,
          ticketPrice: ticketPrice ? Number(ticketPrice) : undefined,
          ticketUrl: ticketUrl || undefined,
          posterUrl,
        }),
      });
      const j = await r.json();
      if (!j.success) {
        setError(j.error || 'Ошибка');
        return;
      }
      onCreated();
    } catch (err: any) {
      setError(err?.message || 'Ошибка сети');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="apple-card p-5 md:p-7 animate-fadeInUp">
        <div className="flex items-start justify-between mb-5">
          <h3 className="text-xl font-bold tracking-tight">Создать событие</h3>
          <button onClick={onClose} className="text-2xl leading-none text-[var(--text-secondary)] hover:text-[var(--text-primary)]"></button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          {error && <div className="apple-card p-3 bg-red-50 border-red-200 text-sm text-red-600">{error}</div>}

          <div>
            <label className="block text-sm font-medium mb-1.5">Постер (опционально)</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setPosterFile(e.target.files?.[0] || null)}
              className="block w-full text-sm file:mr-3 file:px-4 file:py-2 file:rounded-full file:border-0 file:bg-[var(--hover)] hover:file:bg-[var(--border)] file:font-medium"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Название *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Концерт «Северный ветер»"
              className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-white outline-none focus:ring-2 focus:ring-[var(--accent)] text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Дата и время начала *</label>
            <input
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-white outline-none focus:ring-2 focus:ring-[var(--accent)] text-sm"
              required
            />
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isOnline}
              onChange={(e) => setIsOnline(e.target.checked)}
              className="accent-[var(--text-primary)]"
            />
            <span className="text-sm">Онлайн-событие</span>
          </label>
          {isOnline ? (
            <div>
              <label className="block text-sm font-medium mb-1.5">Ссылка на трансляцию</label>
              <input
                type="url"
                value={onlineUrl}
                onChange={(e) => setOnlineUrl(e.target.value)}
                placeholder="https://…"
                className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-white outline-none focus:ring-2 focus:ring-[var(--accent)] text-sm"
              />
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1.5">Город</label>
                <input
                  type="text"
                  value={venueCity}
                  onChange={(e) => setVenueCity(e.target.value)}
                  placeholder="Тула"
                  className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-white outline-none focus:ring-2 focus:ring-[var(--accent)] text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Место</label>
                <input
                  type="text"
                  value={venueName}
                  onChange={(e) => setVenueName(e.target.value)}
                  placeholder="Филармония"
                  className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-white outline-none focus:ring-2 focus:ring-[var(--accent)] text-sm"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium mb-1.5">Адрес</label>
                <input
                  type="text"
                  value={venueAddress}
                  onChange={(e) => setVenueAddress(e.target.value)}
                  placeholder="ул. Менделеевская, 7"
                  className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-white outline-none focus:ring-2 focus:ring-[var(--accent)] text-sm"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1.5">Описание программы</label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-white outline-none focus:ring-2 focus:ring-[var(--accent)] text-sm resize-none"
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1.5">Цена билета</label>
              <input
                type="number"
                min={0}
                value={ticketPrice}
                onChange={(e) => setTicketPrice(e.target.value)}
                placeholder="500"
                className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-white outline-none focus:ring-2 focus:ring-[var(--accent)] text-sm tabular-nums"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Ссылка на покупку билетов</label>
              <input
                type="url"
                value={ticketUrl}
                onChange={(e) => setTicketUrl(e.target.value)}
                placeholder="https://…"
                className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-white outline-none focus:ring-2 focus:ring-[var(--accent)] text-sm"
              />
            </div>
          </div>
          <p className="text-xs text-[var(--text-secondary)] bg-[var(--hover)] p-3 rounded-xl">
            После создания событие пойдёт на модерацию. Бесплатно для авторов с подпиской ПРОФИ, иначе 250 ₽ за публикацию.
          </p>
          <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border)]">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 rounded-full bg-[var(--hover)] text-[var(--text-primary)] font-medium hover:bg-[var(--border)] transition-colors">
              Отмена
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-8 py-3 rounded-full bg-[var(--text-primary)] text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity">
              {submitting ? 'Создаём…' : 'Отправить на модерацию'}
            </button>
          </div>
        </form>
    </section>
  );
}
