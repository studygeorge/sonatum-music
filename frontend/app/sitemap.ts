import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://sonatum-music.ru';
const API_URL = process.env.NEXT_PUBLIC_API_URL || SITE_URL;

export const revalidate = 3600; // sitemap пересоздаём раз в час

async function fetchTracks(): Promise<Array<{ slug: string; updatedAt: string }>> {
  try {
    const r = await fetch(`${API_URL}/api/tracks/search?limit=500`, { next: { revalidate: 3600 } });
    const j = await r.json();
    return (j.data || []).map((t: any) => ({ slug: t.slug || t.id, updatedAt: t.updatedAt || t.createdAt }));
  } catch { return []; }
}

async function fetchArtists(): Promise<Array<{ slug: string }>> {
  try {
    const r = await fetch(`${API_URL}/api/artists?limit=500`, { next: { revalidate: 3600 } });
    const j = await r.json();
    return (j.data || []).map((a: any) => ({ slug: a.slug })).filter((a: any) => a.slug);
  } catch { return []; }
}

async function fetchRegions(): Promise<Array<{ slug: string }>> {
  try {
    const r = await fetch(`${API_URL}/api/regions`, { next: { revalidate: 86400 } });
    const j = await r.json();
    return (j.data || []).map((r: any) => ({ slug: r.slug }));
  } catch { return []; }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [tracks, artists, regions] = await Promise.all([fetchTracks(), fetchArtists(), fetchRegions()]);
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}`, lastModified: now, changeFrequency: 'daily', priority: 1.0 },
    { url: `${SITE_URL}/catalog`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE_URL}/map`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE_URL}/artists`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: `${SITE_URL}/sheets`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${SITE_URL}/login`, lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${SITE_URL}/register`, lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${SITE_URL}/legal/terms`, lastModified: now, changeFrequency: 'monthly', priority: 0.2 },
    { url: `${SITE_URL}/legal/privacy`, lastModified: now, changeFrequency: 'monthly', priority: 0.2 },
    { url: `${SITE_URL}/legal/copyright`, lastModified: now, changeFrequency: 'monthly', priority: 0.2 },
  ];

  const trackPages: MetadataRoute.Sitemap = tracks.map((t) => ({
    url: `${SITE_URL}/tracks/${t.slug}`,
    lastModified: t.updatedAt ? new Date(t.updatedAt) : now,
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }));

  const artistPages: MetadataRoute.Sitemap = artists.map((a) => ({
    url: `${SITE_URL}/artists/${a.slug}`,
    lastModified: now,
    changeFrequency: 'daily' as const,
    priority: 0.8,
  }));

  const regionPages: MetadataRoute.Sitemap = regions.map((r) => ({
    url: `${SITE_URL}/map/${r.slug}`,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }));

  return [...staticPages, ...artistPages, ...trackPages, ...regionPages];
}
