'use client';

import { useEffect, useState, ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Простая обёртка вокруг createPortal(document.body).
 * Используется, чтобы вырвать модалку из дерева DOM и избежать
 * проблем с position:fixed внутри предков с transform/filter/backdrop-filter
 * (например, плеер сверху страницы создавал новый containing-block).
 */
export default function Portal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(<>{children}</>, document.body);
}
