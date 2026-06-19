import Link from 'next/link';
import { User as UserIcon } from 'lucide-react';
import HomeTracksGrid from './components/home/HomeTracksGrid';
import HomeChart from './components/home/HomeChart';
import HomeReleases from './components/home/HomeReleases';
import HomeEvents from './components/home/HomeEvents';
import HeroCarousel from './components/home/HeroCarousel';
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
      <HeroCarousel
        tracks={[
          ...(data?.personalMix || []),
          ...(data?.chart || []),
          ...(data?.radar || []),
          ...(data?.newReleases || []),
        ]}
      />

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

      {/* Раздел «Новинки» объединён с «Новые релизы» выше. Радар-треки
          теперь идут в «Радар талантов» (треки с малым числом прослушиваний). */}
      {data?.radar?.length > 0 && (
        <HomeTracksGrid
          title="Радар талантов"
          tracks={data.radar}
          cols={6}
          rightLink={{ href: '/catalog?sort=radar', label: 'Все треки радара' }}
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
          <div className="flex items-center gap-4 md:gap-6 shrink-0">
            <img
              src="/partners/fasie.png"
              alt="Фонд содействия инновациям"
              className="h-16 md:h-20 w-auto select-none"
              loading="lazy"
            />
            <img
              src="/partners/platforma.svg"
              alt="Платформа университетского технологического предпринимательства"
              className="h-16 md:h-20 w-auto select-none"
              loading="lazy"
            />
          </div>
          <p className="text-sm md:text-base text-[var(--text-secondary)] leading-snug">
            Проект реализован при поддержке{" "}
            <span className="font-semibold text-[var(--text-primary)]">
              Фонда содействия инновациям
            </span>{" "}
            в рамках программы «Студенческий стартап» мероприятия «Платформа университетского
            технологического предпринимательства» федерального проекта «Технологии».
          </p>
        </div>
      </section>
    </main>
  );
}
