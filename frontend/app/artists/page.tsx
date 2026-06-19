import Link from 'next/link';

export const revalidate = 60;

const FEED_BASE =
  process.env.INTERNAL_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'https://sonatum-music.ru';

async function getArtists() {
  try {
    const r = await fetch(`${FEED_BASE}/api/artists?limit=60`, {
      next: { revalidate: 60, tags: ['artists'] },
    });
    if (!r.ok) return [];
    const j = await r.json();
    return j?.data?.artists || j?.data || [];
  } catch {
    return [];
  }
}

export default async function ArtistsListPage() {
  const artists = await getArtists();

  return (
    <main className="min-h-screen pt-10 md:pt-14 pb-24 px-6 md:px-12 max-w-7xl mx-auto space-y-10">
      <section
        className="relative rounded-3xl overflow-hidden p-10 md:p-14 text-white"
        style={{ background: 'linear-gradient(135deg, #1d4cb8 0%, #2f9e8f 55%, #e6e6e6 100%)' }}>
        <div className="relative z-10 max-w-2xl">
          <div className="text-xs uppercase tracking-widest font-semibold mb-3 opacity-90">
            Артисты
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-4 text-white">
            Все артисты
          </h1>
          <p className="text-lg md:text-xl text-white/85 max-w-xl">
            Российская академическая и современная музыка от композиторов, исполнителей и коллективов «Сонатум».
          </p>
          <Link
            href="/artists/join"
            className="inline-block mt-6 px-6 py-3 rounded-full bg-white text-[#1d4cb8] font-semibold text-sm hover:opacity-90">
            Стать автором
          </Link>
        </div>
      </section>
      <section>
        <div className="flex items-end justify-between mb-6">
          <h2 className="text-3xl font-bold tracking-tight">Каталог</h2>
          <span className="text-sm text-[var(--text-secondary)]">{artists.length}</span>
        </div>
        {artists.length === 0 ? (
          <div className="apple-card p-10 text-center text-[var(--text-secondary)]">
            Пока нет данных. Авторы публикуют свои профили постепенно.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {artists.map((a: any) => (
              <Link
                key={a.id}
                href={`/artist/${a.slug || a.id}`}
                className="apple-card hover-scale p-4 text-center group">
                <div className="aspect-square rounded-full bg-gray-100 mb-3 overflow-hidden">
                  {a.avatar ? (
                    <img
                      src={a.avatar}
                      alt={a.name}
                      loading="lazy"
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-[#1d4cb8]/10 to-[#2f9e8f]/10 flex items-center justify-center text-3xl text-[var(--text-secondary)]">
                      {(a.name || '?').charAt(0)}
                    </div>
                  )}
                </div>
                <h3 className="font-semibold text-sm truncate">{a.name}</h3>
                {a.region && (
                  <p className="text-[11px] text-[var(--text-secondary)] mt-0.5 truncate">{a.region}</p>
                )}
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
