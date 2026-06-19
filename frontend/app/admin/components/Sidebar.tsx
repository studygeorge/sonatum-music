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
  FileText,
  GraduationCap,
  Banknote,
  Wallet,
  AlertTriangle,
  BarChart3,
  Flag
} from 'lucide-react';

const menuItems = [
  { icon: LayoutDashboard, label: 'Главная', href: '/admin/dashboard' },
  { icon: BarChart3, label: 'Финансы', href: '/admin/finance' },
  { icon: Users, label: 'Пользователи', href: '/admin/users' },
  { icon: Music, label: 'Треки', href: '/admin/tracks' },
  { icon: Mic2, label: 'Артисты', href: '/admin/artists' },
  { icon: FolderTree, label: "Жанры", href: "/admin/genres" },
  { icon: GraduationCap, label: "Студенты", href: "/admin/student-verifications" },
  { icon: Banknote, label: "B2B-начисления", href: "/admin/manual-payouts" },
  { icon: Wallet, label: "Выплаты", href: "/admin/payouts" },
  { icon: Flag, label: 'Жалобы', href: '/admin/reports' },
  { icon: AlertTriangle, label: 'Ошибки', href: '/admin/errors' },
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
      <nav className="flex-1 space-y-2 pt-2">
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
