'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Music, Globe, User } from 'lucide-react';

interface NavItem {
  id: string;
  icon: React.ReactNode;
  label: string;
  path: string;
}

export default function LiquidGlassNav() {
  const router = useRouter();
  const pathname = usePathname();

  // Скрываем нижнее меню по событию (например, когда на карте открыта панель региона).
  const [navHidden, setNavHidden] = useState(false);
  useEffect(() => {
    const onVis = (e: any) => setNavHidden(!!e?.detail?.hidden);
    window.addEventListener('sonatum:nav-visibility', onVis);
    return () => window.removeEventListener('sonatum:nav-visibility', onVis);
  }, []);

  // Не показываем плавающую навигацию в админке — у неё свой sidebar.
  if (pathname?.startsWith('/admin') || pathname?.startsWith('/adminum')) {
    return null;
  }

  const navItems: NavItem[] = [
    { id: 'music', icon: <Music size={20} />, label: 'Музыка', path: '/' },
    { id: 'map', icon: <Globe size={20} />, label: 'Карта', path: '/map' },
    { id: 'profile', icon: <User size={20} />, label: 'Профиль', path: '/profile' },
  ];

  // Активная вкладка с учётом подмаршрутов (профиль активен для /profile, /author/*, /edu/*)
  const isProfileArea = !!pathname && (
    pathname === '/profile' ||
    pathname.startsWith('/author') ||
    pathname.startsWith('/edu')
  );
  const isMapArea = pathname === '/map' || pathname?.startsWith('/map/');
  const isMusicArea = !isProfileArea && !isMapArea;
  const activeIndex = isProfileArea ? 2 : isMapArea ? 1 : 0;
  
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const handleNavClick = (path: string) => {
    router.push(path);
  };

  return (
    <>
      <style jsx>{`
        /* Navigation Container */
        .liquid-glass-nav {
          background: rgba(255, 255, 255, 0.15);
          backdrop-filter: blur(30px) saturate(200%);
          -webkit-backdrop-filter: blur(30px) saturate(200%);
          border: 1.5px solid rgba(255, 255, 255, 0.4);
          box-shadow: 
            0 8px 32px rgba(31, 38, 135, 0.15),
            0 4px 16px rgba(31, 38, 135, 0.1),
            inset 0 0 0 1px rgba(255, 255, 255, 0.3);
        }

        /* Glass Edge Refraction Effect */
        .glass-edge-refraction {
          position: absolute;
          inset: 0;
          border-radius: 9999px;
          background: 
            radial-gradient(circle at 10% 20%, rgba(255, 255, 255, 0.6) 0%, transparent 50%),
            radial-gradient(circle at 90% 80%, rgba(255, 255, 255, 0.4) 0%, transparent 50%),
            linear-gradient(135deg, rgba(255, 255, 255, 0.4) 0%, transparent 30%, transparent 70%, rgba(255, 255, 255, 0.2) 100%);
          pointer-events: none;
          z-index: 1;
        }

        /* Navigation Items Container */
        .nav-items-container {
          position: relative;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          width: 100%;
          height: 100%;
          z-index: 2;
        }

        /* Navigation Button */
        .nav-button-item {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 3px;
          color: #86868b;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          cursor: pointer;
          border: none;
          background: transparent;
          -webkit-tap-highlight-color: transparent;
          padding: 4px 0;
          width: 100%;
          height: 100%;
        }

        .nav-button-item[data-active="true"] {
          color: #1d1d1f;
        }

        .nav-button-item:hover {
          color: #4a4a4a;
        }

        .nav-button-item:active {
          transform: scale(0.98);
        }

        /* Icon */
        .nav-icon {
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 20px;
          height: 20px;
          flex-shrink: 0;
        }

        .nav-icon-active {
          filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.12));
        }

        /* Label */
        .nav-label {
          font-size: 10px;
          font-weight: 500;
          letter-spacing: -0.02em;
          white-space: nowrap;
          transition: all 0.3s ease;
          line-height: 1;
        }

        .nav-button-item[data-active="true"] .nav-label {
          font-weight: 600;
        }

        /* Icon Position Adjustments */
        .nav-button-item:nth-child(1) .nav-content {
          transform: translateX(-1px);
        }

        .nav-button-item:nth-child(3) .nav-content {
          transform: translateX(1px);
        }

        .nav-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
        }

        /* Active Blob - Pure White */
        .active-blob {
          background: rgba(255, 255, 255, 0.95);
          box-shadow: 
            0 4px 20px rgba(0, 0, 0, 0.08),
            0 2px 8px rgba(0, 0, 0, 0.06),
            inset 0 1px 0 rgba(255, 255, 255, 1);
        }

        /* Light Refraction on Active */
        .refraction-overlay {
          background: linear-gradient(
            135deg,
            rgba(255, 255, 255, 0.8) 0%,
            rgba(255, 255, 255, 0.3) 40%,
            transparent 60%,
            rgba(255, 255, 255, 0.2) 100%
          );
        }
      `}</style>

      <nav className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[300] w-[calc(100%-48px)] max-w-[400px] transition-all duration-300 ${navHidden ? 'translate-y-[200%] opacity-0 pointer-events-none md:translate-y-0 md:opacity-100 md:pointer-events-auto' : ''}`}>
        <div className="relative">
          {/* Glass Container */}
          <div className="liquid-glass-nav relative rounded-full px-1 py-2 overflow-hidden">
            {/* Glass Edge Refraction */}
            <div className="glass-edge-refraction" />

            {/* Animated Background Blob */}
            <div
              className="active-blob absolute top-1/2 -translate-y-1/2 rounded-full transition-all duration-500 ease-out"
              style={{
                width: `calc(33.333% - 6px)`,
                left: `calc(${activeIndex * 33.333}% + 3px)`,
                height: 'calc(100% - 8px)',
                zIndex: 1,
              }}
            />
            
            {/* Light Refraction Effect on Active */}
            <div
              className="refraction-overlay absolute top-1/2 -translate-y-1/2 rounded-full transition-all duration-500 ease-out pointer-events-none"
              style={{
                left: `calc(${activeIndex * 33.333}% + 4px)`,
                width: `calc(33.333% - 8px)`,
                height: 'calc(100% - 12px)',
                zIndex: 2,
              }}
            />

            {/* Navigation Items */}
            <div className="nav-items-container" style={{ height: '52px' }}>
              {navItems.map((item, index) => (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.path)}
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  className="nav-button-item"
                  data-active={pathname === item.path}
                >
                  <div className="nav-content">
                    <div className={`nav-icon ${pathname === item.path ? 'nav-icon-active' : ''}`}>
                      {item.icon}
                    </div>
                    <span className="nav-label">
                      {item.label}
                    </span>
                  </div>
                </button>
              ))}
            </div>

            {/* Subtle Shadow */}
            <div className="absolute -inset-1 bg-gradient-to-b from-gray-100/30 to-gray-200/30 rounded-full blur-xl -z-10 opacity-25" />
          </div>
        </div>
      </nav>
    </>
  );
}
