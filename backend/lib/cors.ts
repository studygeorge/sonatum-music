// backend/lib/cors.ts

export function getCorsHeaders(origin?: string): Record<string, string> {
  const allowedOrigins = [
    'http://localhost:3000',
    'http://sonatum-music.ru',
    'https://sonatum-music.ru',
    'http://www.sonatum-music.ru',
    'https://www.sonatum-music.ru',
  ];

  const requestOrigin = origin || '';
  const isAllowed = allowedOrigins.includes(requestOrigin);

  return {
    'Access-Control-Allow-Origin': isAllowed ? requestOrigin : allowedOrigins[0],
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
  };
}
