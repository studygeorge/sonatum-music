import Link from 'next/link';
import { User as UserIcon } from 'lucide-react';
import HomeTracksGrid from './components/home/HomeTracksGrid';
import HomeChart from './components/home/HomeChart';
import HomeReleases from './components/home/HomeReleases';
import HomeEvents from './components/home/HomeEvents';
import HeroPlayButton from './components/home/HeroPlayButton';
import PremiumPromo from './components/home/PremiumPromo';

// Кэш SSR: 60 сек ISR — главная редко меняется, БД задеваем раз в минуту.
export const revalidate = 60;

const FEED_BASE =
  process.env.INTERNAL_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'https://sonatum-music.ru';

async function getEvents() {
  try {
    const r = await fetch(`${FEED_BASE}/api/events?limit=8`, {
      next: { revalidate: 60, tags: ['events'] },
    });
    if (!r.ok) return [];
    const j = await r.json();
    return j?.data || [];
  } catch {
    return [];
  }
}

async function getFeed() {
  try {
    const res = await fetch(`${FEED_BASE}/api/home/feed`, {
      next: { revalidate: 60, tags: ['home-feed'] },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.success ? json.data : null;
  } catch {
    return null;
  }
}

export default async function HomePage() {
  const [data, events] = await Promise.all([getFeed(), getEvents()]);

  return (
    <main className="min-h-screen pt-4 md:pt-16 pb-12 px-6 md:px-12 max-w-7xl mx-auto space-y-8 md:space-y-16 overflow-x-hidden w-full">
      <section
        className="relative rounded-3xl overflow-hidden p-10 md:p-14 text-white min-h-[340px] flex items-center"
        style={{
          background:
            'linear-gradient(135deg, #1d4cb8 0%, #d52b1e 55%, #e6e6e6 100%)',
        }}
      >
        <div
          className="absolute top-0 right-0 w-96 h-96 rounded-full blur-3xl opacity-35"
          style={{ background: '#3a78dc', transform: 'translate(30%, -30%)' }}
        />
        <div
          className="absolute bottom-0 left-1/3 w-80 h-80 rounded-full blur-3xl opacity-30"
          style={{ background: '#e84545', transform: 'translateY(40%)' }}
        />

        <div className="relative z-10 max-w-2xl">
          <h1 className="text-white text-4xl md:text-5xl lg:text-6xl font-bold mb-6 tracking-tight">
            Откройте для себя богатство духовной музыки
          </h1>
          <p className="text-lg text-white/80 mb-8 max-w-xl">
            Исследуйте редкие звоны, старинные распевы и народные традиции. Все в безупречном качестве.
          </p>
          <div className="flex flex-wrap gap-4">
            <HeroPlayButton
              tracks={[
                ...(data?.personalMix || []),
                ...(data?.chart || []),
                ...(data?.radar || []),
                ...(data?.newReleases || []),
              ]}
            />
            <Link
              href="/catalog"
              className="bg-white/10 backdrop-blur-md text-white px-8 py-4 rounded-full font-semibold hover:bg-white/20 transition-colors duration-300 border border-white/20"
            >
              Каталог
            </Link>
          </div>
        </div>
      </section>

      {data?.personalMix?.length > 0 && (
        <HomeTracksGrid
          title="Специально для вас"
          tracks={data.personalMix}
          cols={5}
        />
      )}

      <section className="grid lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2 min-w-0">
          <div className="flex flex-wrap justify-between items-center mb-6 gap-2">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight break-words">
              Топ прослушиваний
            </h2>
            <Link
              href="/chart"
              className="text-[var(--accent)] font-medium hover:underline whitespace-nowrap"
            >
              Весь чарт
            </Link>
          </div>
          <HomeChart tracks={data?.chart || []} />
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap justify-between items-end mb-6 gap-2">
            <h2 className="text-2xl font-bold tracking-tight">Новые релизы</h2>
          </div>
          <HomeReleases tracks={data?.newReleases || []} />
        </div>
      </section>

      <PremiumPromo />

      <HomeEvents events={events} />

      {data?.radar?.length > 0 && (
        <HomeTracksGrid
          title="Новинки"
          tracks={data.radar}
          cols={6}
          rightLink={{ href: '/catalog?sort=fresh', label: 'Все новинки' }}
        />
      )}

      {data?.discoveries?.length > 0 && (
        <section>
          <div className="flex flex-wrap justify-between items-end mb-6 gap-2">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight break-words">
              Открытия недели
            </h2>
            <Link
              href="/artists"
              className="text-[var(--accent)] font-medium hover:underline whitespace-nowrap"
            >
              Все артисты
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
            {data.discoveries.map((a: any) => (
              <Link href={`/artist/${a.slug || a.id}`} key={a.id}>
                <div className="apple-card hover-scale p-4 cursor-pointer flex flex-col items-center text-center">
                  <div className="w-24 h-24 md:w-28 md:h-28 rounded-full bg-gray-100 mb-4 overflow-hidden flex items-center justify-center">
                    {a.avatar ? (
                      <img
                        src={a.avatar}
                        alt={a.name}
                        loading="lazy"
                        decoding="async"
                        width={112}
                        height={112}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <UserIcon size={48} strokeWidth={1.4} className="text-gray-300" />
                    )}
                  </div>
                  <h3 className="font-semibold text-base truncate w-full mb-1">
                    {a.name}
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)] truncate w-full">
                    {a.trackCount}{' '}
                    {a.trackCount === 1
                      ? 'трек'
                      : a.trackCount < 5
                      ? 'трека'
                      : 'треков'}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Поддержка Фонда содействия инновациям */}
      <section className="mt-8 md:mt-12">
        <div className="apple-card p-5 md:p-6 flex flex-col md:flex-row items-center gap-4 md:gap-6 text-center md:text-left">
          <img
            src="/partners/fasie.svg"
            alt="Фонд содействия инновациям"
            className="h-16 md:h-20 w-auto shrink-0 select-none"
            loading="lazy"
          />
          <p className="text-sm md:text-base text-[var(--text-secondary)] leading-snug">
            Проект создан при поддержке{" "}
            <span className="font-semibold text-[var(--text-primary)]">
              Фонда содействия инновациям
            </span>
          </p>
        </div>
      </section>
    </main>
  );
}
