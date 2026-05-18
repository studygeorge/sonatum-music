'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { authStorage } from '@/app/lib/auth';
import { 
  LayoutDashboard, 
  Users, 
  Music, 
  Mic2, 
  FolderTree,
  Settings,
  LogOut,
  Shield,
  FileText
} from 'lucide-react';

const menuItems = [
  { icon: LayoutDashboard, label: 'Главная', href: '/admin/dashboard' },
  { icon: Users, label: 'Пользователи', href: '/admin/users' },
  { icon: Music, label: 'Треки', href: '/admin/tracks' },
  { icon: Mic2, label: 'Артисты', href: '/admin/artists' },
  { icon: FolderTree, label: 'Жанры', href: '/admin/genres' },
  { icon: Settings, label: 'Настройки', href: '/admin/settings' },
];

export default function Sidebar() {
  const pathname = usePathname();

  const handleLogout = () => {
    console.log('[SIDEBAR] Logging out...');
    authStorage.clear();
    // ✅ ИСПРАВЛЕНО: редирект на правильный путь
    window.location.href = '/admin-auth/login';
  };

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-gray-900 text-white p-6 flex flex-col">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
          <Shield className="w-6 h-6" />
        </div>
        <div>
          <h1 className="font-semibold text-lg">Сонатум</h1>
          <p className="text-xs text-gray-400">Админ-панель</p>
        </div>
      </div>

      <nav className="flex-1 space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                isActive
                  ? 'bg-white text-gray-900'
                  : 'text-gray-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <button
        onClick={handleLogout}
        className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-300 hover:bg-white/10 hover:text-white transition-all"
      >
        <LogOut className="w-5 h-5" />
        <span className="font-medium">Выйти</span>
      </button>
    </aside>
  );
}
