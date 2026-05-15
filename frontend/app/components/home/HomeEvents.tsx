import Link from 'next/link';

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
  const dt = new Date(d);
  return dt.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' });
}

function fmtFull(d: string) {
  const dt = new Date(d);
  return dt.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
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
        <Link
          href="/events"
          className="text-[var(--accent)] font-medium hover:underline whitespace-nowrap">
          Вся афиша
        </Link>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {events.slice(0, 4).map((e) => (
          <Link
            key={e.id}
            href={`/events/${e.id}`}
            className="apple-card overflow-hidden hover-scale group">
            <div className="aspect-video bg-gray-100 relative overflow-hidden">
              {e.posterUrl ? (
                <img
                  src={e.posterUrl}
                  alt={e.title}
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center text-4xl"
                  style={{
                    background:
                      'linear-gradient(135deg, rgba(29,76,184,0.15) 0%, rgba(213,43,30,0.15) 100%)',
                  }}>
                </div>
              )}
              <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-md rounded-full px-3 py-1 text-xs font-bold tabular-nums">
                {fmtDay(e.startsAt)}
              </div>
            </div>
            <div className="p-4">
              <h3 className="font-bold text-sm leading-snug line-clamp-2 mb-2">{e.title}</h3>
              <p className="text-xs text-[var(--text-secondary)] mb-1.5">{fmtFull(e.startsAt)}</p>
              <p className="text-[11px] text-[var(--text-secondary)] truncate">
                 {e.isOnline ? 'Онлайн' : [e.venueName, e.venueCity].filter(Boolean).join(', ') || '—'}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
