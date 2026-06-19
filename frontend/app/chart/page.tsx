import Link from 'next/link';
import ChartRow from './ChartRow';

export const revalidate = 86400;

const FEED_BASE =
  process.env.INTERNAL_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'https://sonatum-music.ru';

async function getChart() {
  try {
    const [tracksRes, artistsRes] = await Promise.all([
      fetch(`${FEED_BASE}/api/catalog?sortBy=popularity&sortOrder=desc&limit=10`, {
        next: { revalidate: 86400 },
      }),
      fetch(`${FEED_BASE}/api/artists?limit=10`, { next: { revalidate: 86400 } }),
    ]);
    const tracksJson = tracksRes.ok ? await tracksRes.json() : null;
    const artistsJson = artistsRes.ok ? await artistsRes.json() : null;
    return {
      tracks: (Array.isArray(tracksJson?.data?.tracks) ? tracksJson.data.tracks : Array.isArray(tracksJson?.data) ? tracksJson.data : []).slice(0, 10),
      artists: (Array.isArray(artistsJson?.data?.artists) ? artistsJson.data.artists : Array.isArray(artistsJson?.data) ? artistsJson.data : []).slice(0, 10),
    };
  } catch {
    return { tracks: [], artists: [] };
  }
}

export default async function ChartPage() {
  const { tracks, artists } = await getChart();
  const updated = new Date().toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  return (
    <main className="min-h-screen pt-10 md:pt-14 pb-24 px-6 md:px-12 max-w-7xl mx-auto space-y-6 md:space-y-12">
      {/* Hero */}
      <section
        className="relative rounded-3xl overflow-hidden p-10 md:p-14 text-white"
        style={{
          background:
            'linear-gradient(135deg, #1d4cb8 0%, #2f9e8f 55%, #e6e6e6 100%)',
        }}
      >
        <div
          className="absolute top-0 right-0 w-96 h-96 rounded-full blur-3xl opacity-35"
          style={{ background: '#3a78dc', transform: 'translate(30%, -30%)' }}
        />
        <div
          className="absolute bottom-0 left-1/3 w-80 h-80 rounded-full blur-3xl opacity-30"
          style={{ background: '#3aa8c9', transform: 'translateY(40%)' }}
        />
        <div className="relative z-10 max-w-2xl">
          <div className="text-white text-xs uppercase tracking-widest font-semibold mb-4 opacity-90 drop-shadow-[0_1px_4px_rgba(0,0,0,0.25)]">
            Sonatum Charts
          </div>
          <h1 className="text-white text-5xl md:text-7xl font-black tracking-tight mb-4 drop-shadow-[0_2px_8px_rgba(0,0,0,0.3)]">
            Главный чарт
          </h1>
          <p className="text-lg md:text-xl text-white max-w-xl drop-shadow-[0_1px_4px_rgba(0,0,0,0.25)]">
            Самые слушаемые треки на платформе. Обновляется ежедневно.
          </p>
          <p className="text-xs text-white/85 mt-6 drop-shadow-[0_1px_3px_rgba(0,0,0,0.2)]">Обновлено {updated}</p>
        </div>
      </section>

      {/* Топ-10 треков */}
      <section>
        <div className="flex items-end justify-between mb-6">
          <h2 className="text-3xl font-bold tracking-tight">Топ-10 треков</h2>
          <Link
            href="/catalog?sort=popularity"
            className="text-sm font-medium text-[var(--accent)] hover:underline"
          >
            Весь каталог
          </Link>
        </div>

        {tracks.length === 0 ? (
          <div className="apple-card p-10 text-center text-[var(--text-secondary)]">
            Пока нет данных для чарта.
          </div>
        ) : (
          <div className="apple-card overflow-hidden p-2">
            {tracks.map((t: any, i: number) => (
              <ChartRow key={t.id} track={t} rank={i + 1} />
            ))}
          </div>
        )}
      </section>

      {/* Топ артистов */}
      {artists.length > 0 && (
        <section>
          <div className="flex items-end justify-between mb-6">
            <h2 className="text-3xl font-bold tracking-tight">Артисты недели</h2>
            <Link
              href="/artists"
              className="text-sm font-medium text-[var(--accent)] hover:underline"
            >
              Все артисты
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {artists.filter((a: any) => !!a.avatar).map((a: any, i: number) => (
              <Link
                key={a.id}
                href={`/artist/${a.slug || a.id}`}
                className="apple-card hover-scale p-4 text-center group"
              >
                <div className="aspect-square rounded-full bg-gray-100 mb-3 overflow-hidden relative">
                  <span className="absolute top-1 left-1 z-10 bg-[var(--text-primary)] text-white text-[11px] font-bold rounded-full w-6 h-6 flex items-center justify-center tabular-nums">
                    {i + 1}
                  </span>
                  {a.avatar ? (
                    <img
                      src={a.avatar}
                      alt={a.name}
                      loading="lazy"
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-[#1d4cb8]/10 to-[#c91c1c]/10" />
                  )}
                </div>
                <h3 className="font-semibold text-sm truncate">{a.name}</h3>

              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
