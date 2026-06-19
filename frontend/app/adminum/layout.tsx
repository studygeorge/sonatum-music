'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // client side protection
    if (pathname && !pathname.includes('/login')) {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/adminum/login');
      }
    }
  }, [pathname, router]);

  if (!mounted) return null;

  // Don't render layout elements on login page
  if (pathname === '/adminum/login') {
    return <>{children}</>;
  }

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/adminum/login');
  };

  return (
     <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row text-black">
        {/* Sidebar */}
        <aside className="w-full md:w-64 bg-white border-r border-[var(--border)] shrink-0 hidden md:flex flex-col">
          <div className="p-6 border-b border-[var(--border)] mb-4">
             <Link href="/adminum" className="font-bold text-xl tracking-tight text-[var(--text-primary)]">
               Sonatum Admin
             </Link>
          </div>
          <nav className="flex-grow flex flex-col px-4 gap-2">
            {[
              { id: '/adminum', label: 'Главная' },
              { id: '/admin/tracks', label: 'Треки (Заглушка)' },
            ].map(item => (
              <Link
                key={item.id}
                href={item.id}
                className={`px-4 py-3 rounded-xl font-medium transition-colors ${
                  pathname === item.id || (pathname !== '/adminum' && pathname.startsWith(item.id))
                    ? 'bg-[var(--text-primary)] text-white shadow-md' 
                    : 'text-[var(--text-secondary)] hover:bg-[var(--hover)] hover:text-[var(--text-primary)]'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="p-4 border-t border-[var(--border)]">
             <button 
               onClick={handleLogout}
               className="w-full text-left px-4 py-3 rounded-xl font-medium text-[var(--text-primary)] hover:bg-[var(--hover)] transition-colors"
             >
               Выйти из Админки
             </button>
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-grow flex flex-col">
          <header className="h-16 bg-white border-b border-[var(--border)] flex items-center px-6 justify-between md:hidden">
             <Link href="/adminum" className="font-bold text-xl tracking-tight text-[var(--text-primary)]">Sonatum Admin</Link>
             <button onClick={handleLogout} className="text-sm font-medium text-[var(--text-primary)]">Выйти</button>
          </header>
          <main className="flex-grow p-6 md:p-8 overflow-y-auto w-full relative">
            <div className="max-w-5xl mx-auto">
               {children}
            </div>
          </main>
        </div>
     </div>
  );
}
