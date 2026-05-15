import Link from 'next/link';

export const revalidate = 60;

const FEED_BASE =
  process.env.INTERNAL_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'https://sonatum-music.ru';

async function getEvents() {
  try {
    const r = await fetch(`${FEED_BASE}/api/events?limit=50`, {
      next: { revalidate: 60, tags: ['events'] },
    });
    if (!r.ok) return [];
    const j = await r.json();
    return j?.data || [];
  } catch {
    return [];
  }
}

function fmtDate(d: string) {
  const dt = new Date(d);
  return dt.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default async function EventsPage() {
  const events = await getEvents();

  return (
    <main className="min-h-screen pt-10 md:pt-14 pb-24 px-6 md:px-12 max-w-7xl mx-auto space-y-10">
      <section
        className="relative rounded-3xl overflow-hidden p-10 md:p-14 text-white"
        style={{ background: 'linear-gradient(135deg, #1d4cb8 0%, #d52b1e 55%, #e6e6e6 100%)' }}>
        <div className="relative z-10 max-w-2xl">
          <div className="text-xs uppercase tracking-widest font-semibold mb-3 opacity-90">
            Афиша
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-4 text-white">
            События Сонатум
          </h1>
          <p className="text-lg md:text-xl text-white/85 max-w-xl">
            Концерты, премьеры, мастер-классы. Российская академическая и современная музыка вживую.
          </p>
        </div>
      </section>
      <section>
        <div className="flex items-end justify-between mb-6">
          <h2 className="text-3xl font-bold tracking-tight">Ближайшие события</h2>
          <span className="text-sm text-[var(--text-secondary)]">{events.length}</span>
        </div>
        {events.length === 0 ? (
          <div className="apple-card p-10 text-center text-[var(--text-secondary)]">
            Пока нет ближайших событий. Авторы могут создать своё событие в кабинете.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {events.map((e: any) => (
              <Link
                key={e.id}
                href={`/events/${e.id}`}
                className="apple-card overflow-hidden hover-scale group">
                <div className="aspect-video bg-gray-100 relative overflow-hidden">
                  {e.posterUrl ? (
                    <img
                      src={e.posterUrl}
                      alt={e.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-[#1d4cb8]/15 to-[#d52b1e]/15 flex items-center justify-center text-5xl">
                    </div>
                  )}
                  <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-md rounded-full px-3 py-1 text-xs font-bold tabular-nums">
                    {new Date(e.startsAt).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })}
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="font-bold text-base line-clamp-2 mb-1.5">{e.title}</h3>
                  <p className="text-xs text-[var(--text-secondary)] mb-2">
                    {fmtDate(e.startsAt)}
                  </p>
                  {(e.venueName || e.venueCity || e.isOnline) && (
                    <p className="text-xs text-[var(--text-secondary)] line-clamp-1">
                       {e.isOnline ? 'Онлайн' : [e.venueName, e.venueCity].filter(Boolean).join(', ')}
                    </p>
                  )}
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--border)]">
                    <span className="text-xs text-[var(--text-secondary)]">
                      {e.authorName}
                    </span>
                    {e.attendeesCount> 0 && (
                      <span className="text-xs text-[var(--text-secondary)]">
                         {e.attendeesCount}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
