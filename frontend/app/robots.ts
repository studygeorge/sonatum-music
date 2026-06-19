import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://sonatum-music.ru';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin/',
          '/adminum/',
          '/api/',
          '/profile/',
          '/author/',
          '/edu/',
          '/auth/',
          '/_next/',
          '/uploads/receipts/',  // чеки ФНС
          '/uploads/student-docs/',
        ],
      },
      {
        userAgent: ['Yandex', 'YandexBot'],
        allow: '/',
        disallow: ['/admin/', '/api/'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
