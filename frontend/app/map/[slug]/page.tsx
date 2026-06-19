'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { usePlayer } from '@/app/context/PlayerContext';

export default function MapRegionPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { playTrack } = usePlayer();

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    fetch(`/api/regions/${slug}`)
      .then((r) => r.json())
      .then((j) => { if (j.success) setData(j.data); })
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return <div className="max-w-5xl mx-auto px-4 py-10 text-center text-[var(--text-secondary)]">Загрузка…</div>;
  }
  if (!data?.region) {
    return <div className="max-w-5xl mx-auto px-4 py-10 text-center text-[var(--text-secondary)]">Регион не найден.</div>;
  }

  const { region, artists, tracks } = data;

  return (
    <div className="space-y-8 max-w-6xl mx-auto px-4 md:px-6 py-8">
      <section
        className="relative rounded-3xl overflow-hidden p-8 md:p-12"
        style={{ background: 'linear-gradient(135deg, #1d4cb8 0%, #6d28d9 55%, #2f9e8f 100%)', color: '#fff' }}>
        <Link href="/map" className="inline-block text-sm mb-4" style={{ color: 'rgba(255,255,255,0.9)' }}>
          ← К карте
        </Link>
        <h1 className="text-3xl md:text-5xl font-black tracking-tight" style={{ color: '#fff' }}>{region.name}</h1>
        <p className="text-sm md:text-base mt-2" style={{ color: 'rgba(255,255,255,0.85)' }}>
          {region.type} · {artists.length} авторов · {tracks.length} треков
        </p>
      </section>

      {artists.length > 0 && (
        <section>
          <h2 className="text-2xl font-bold mb-4">Авторы региона</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {artists.map((a: any) => (
              <Link key={a.id} href={`/artists/${a.slug}`} className="apple-card p-4 text-center hover:scale-[1.02] transition-transform">
                <div className="w-20 h-20 rounded-full bg-gray-100 mx-auto mb-3 overflow-hidden">
                  {a.avatar ? (
                    <img src={a.avatar} alt={a.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-gray-400">
                      {a.name[0]?.toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="font-semibold text-sm truncate">{a.name}</div>
                <div className="text-xs text-[var(--text-secondary)]">{a.followers || 0} подписчиков</div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {tracks.length > 0 && (
        <section>
          <h2 className="text-2xl font-bold mb-4">Треки региона</h2>
          <div className="apple-card overflow-hidden">
            {tracks.map((t: any, i: number) => (
              <button
                key={t.id}
                onClick={() => t.audioUrl && playTrack(t, { tracks: tracks as any, index: i, source: `region:${region.slug}` })}
                className="w-full flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--hover)] text-left">
                <div className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden shrink-0">
                  {t.cover && <img src={t.cover} alt="" className="w-full h-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{t.title}</div>
                  <div className="text-xs text-[var(--text-secondary)] truncate">{t.artist?.name}</div>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {artists.length === 0 && tracks.length === 0 && (
        <div className="apple-card p-12 text-center text-[var(--text-secondary)]">
          В этом регионе пока нет публикаций. Зарегистрируйтесь как автор — будьте первым.
        </div>
      )}
    </div>
  );
}
