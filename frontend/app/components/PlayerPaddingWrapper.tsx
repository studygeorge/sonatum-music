'use client';

import { usePlayer } from '../context/PlayerContext';
import { usePathname } from 'next/navigation';

const PLAYER_OPEN_HEIGHT = 96;
const PLAYER_COLLAPSED_HEIGHT = 28;

const AUTH_PAGES = ['/login', '/register'];

export default function PlayerPaddingWrapper({ children }: { children: React.ReactNode }) {
  const { isCollapsed } = usePlayer();
  const pathname = usePathname();

  const isAuthPage = AUTH_PAGES.includes(pathname);
  const isAdmin = pathname?.startsWith('/admin') || pathname?.startsWith('/adminum');
  if (isAdmin) return <>{children}</>;

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        .dynamic-player-padding {
          transition: padding-top 0.5s cubic-bezier(0.32, 0.72, 0, 1);
        }
        /* Mobile (default) */
        .dynamic-player-padding[data-collapsed="true"][data-auth="false"] { padding-top: 32px; }
        .dynamic-player-padding[data-collapsed="false"][data-auth="false"] { padding-top: 160px; }
        
        /* Desktop */
        @media (min-width: 768px) {
          .dynamic-player-padding[data-collapsed="false"][data-auth="false"] { padding-top: 112px; }
        }

        /* Auth Pages */
        .dynamic-player-padding[data-auth="true"][data-collapsed="true"] { padding-top: 4px; }
        .dynamic-player-padding[data-auth="true"][data-collapsed="false"] { padding-top: 8px; }
      `}} />
      <div
        className="flex-grow dynamic-player-padding"
        data-collapsed={isCollapsed}
        data-auth={isAuthPage}
      >
        {children}
      </div>
    </>
  );
}
