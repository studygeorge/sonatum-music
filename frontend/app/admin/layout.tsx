'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { authStorage } from '@/app/lib/auth';
import Sidebar from './components/Sidebar';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('[ADMIN LAYOUT] ==> Current path:', pathname);
    
    const checkAuth = () => {
      const token = authStorage.getToken();
      const user = authStorage.getUser();

      console.log('[ADMIN LAYOUT] Auth check:', { 
        hasToken: !!token, 
        hasUser: !!user, 
        role: user?.role,
        pathname 
      });

      if (!token || !user) {
        console.log('[ADMIN LAYOUT] ❌ No auth, redirecting to /admin-auth/login');
        authStorage.clear();
        setIsAuthorized(false);
        setLoading(false);
        // ✅ ИСПРАВЛЕНО: редирект на правильный путь
        window.location.href = '/admin-auth/login';
        return;
      }

      if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
        console.log('[ADMIN LAYOUT] ❌ Insufficient permissions:', user.role);
        authStorage.clear();
        setIsAuthorized(false);
        setLoading(false);
        // ✅ ИСПРАВЛЕНО: редирект на правильный путь
        window.location.href = '/admin-auth/login';
        return;
      }

      console.log('[ADMIN LAYOUT] ✅ Access granted:', user.email, user.role);
      setIsAuthorized(true);
      setLoading(false);
    };

    const timer = setTimeout(checkAuth, 200);
    
    return () => clearTimeout(timer);
  }, [pathname]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-gray-300 border-t-gray-900 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Проверка доступа...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return null;
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 ml-64 p-8">
        {children}
      </main>
    </div>
  );
}
