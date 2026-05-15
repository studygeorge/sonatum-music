'use client';

import { useEffect, useState } from 'react';
import { authStorage } from '@/app/lib/auth';
import { adminApi } from '@/app/lib/adminApi';
import StatsCard from '../components/StatsCard';
import { Users, Music, Mic2, Clock } from 'lucide-react';

interface Stats {
  overview: {
    totalUsers: number;
    totalArtists: number;
    totalTracks: number;
    totalPurchases: number;
    pendingTracks: number;
    activeUsers: number;
    totalRevenue: number;
  };
  usersByRole: Record<string, number>;
  tracksByStatus: Record<string, number>;
  topGenres: Array<{
    name: string;
    slug: string;
    color: string;
    trackCount: number;
    artistCount: number;
  }>;
  recentActivity: Array<{
    id: string;
    title: string;
    artist: string;
    status: string;
    createdAt: string;
  }>;
}

export default function AdminDashboard() {
  const [user, setUser] = useState<any>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUser(authStorage.getUser());
    (async () => {
      try {
        const r = await adminApi.stats.get();
        if (r.success && r.data) setStats(r.data as Stats);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="w-8 h-8 border-4 border-gray-200 border-t-[var(--text-primary)] rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">Дашборд</h1>
        <p className="text-[13px] text-[var(--text-secondary)] mt-1">
          {user?.firstName || user?.email || 'Администратор'}
        </p>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Пользователи"
          value={stats?.overview.totalUsers.toLocaleString() || '0'}
          icon={Users}
          trend={{ value: `${stats?.overview.activeUsers || 0} активных`, positive: true }}
        />
        <StatsCard
          title="Треки"
          value={stats?.overview.totalTracks.toLocaleString() || '0'}
          icon={Music}
        />
        <StatsCard
          title="Артисты"
          value={stats?.overview.totalArtists.toLocaleString() || '0'}
          icon={Mic2}
        />
        <StatsCard
          title="На модерации"
          value={stats?.overview.pendingTracks.toString() || '0'}
          icon={Clock}
        />
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Доход">
          <p className="text-2xl font-bold tabular-nums">
            {stats?.overview.totalRevenue.toLocaleString('ru-RU') || 0} ₽
          </p>
          <p className="text-[12px] text-[var(--text-secondary)] mt-1">
            Покупок: {stats?.overview.totalPurchases || 0}
          </p>
        </Card>

        <Card title="По ролям">
          <ul className="space-y-1.5 text-[13px]">
            {stats?.usersByRole &&
              Object.entries(stats.usersByRole).map(([role, count]) => (
                <li key={role} className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">{role}</span>
                  <span className="tabular-nums">{count}</span>
                </li>
              ))}
          </ul>
        </Card>

        <Card title="Треки по статусу">
          <ul className="space-y-1.5 text-[13px]">
            {stats?.tracksByStatus &&
              Object.entries(stats.tracksByStatus).map(([status, count]) => (
                <li key={status} className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">{status}</span>
                  <span className="tabular-nums">{count}</span>
                </li>
              ))}
          </ul>
        </Card>
      </div>

      {/* Recent activity */}
      <Card title="Последние треки">
        {stats?.recentActivity && stats.recentActivity.length > 0 ? (
          <ul className="divide-y divide-[var(--border)]">
            {stats.recentActivity.map((t) => (
              <li key={t.id} className="py-2.5 flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium text-[var(--text-primary)] truncate">{t.title}</div>
                  <div className="text-[12px] text-[var(--text-secondary)] truncate">{t.artist}</div>
                </div>
                <span className="text-[11px] text-[var(--text-secondary)] uppercase tracking-wider tabular-nums shrink-0">
                  {t.status}
                </span>
                <span className="text-[11px] text-[var(--text-secondary)] tabular-nums shrink-0">
                  {new Date(t.createdAt).toLocaleDateString('ru-RU')}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-[var(--text-secondary)] text-center py-6">
            Нет недавней активности
          </p>
        )}
      </Card>

      {/* Top genres */}
      {stats?.topGenres && stats.topGenres.length > 0 && (
        <Card title="Популярные жанры">
          <ul className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
            {stats.topGenres.map((g) => (
              <li
                key={g.slug}
                className="p-3 rounded-lg border border-[var(--border)] bg-[var(--background)]"
              >
                <div className="text-[13px] font-medium truncate">{g.name}</div>
                <div className="text-[11px] text-[var(--text-secondary)] mt-1 tabular-nums">
                  {g.trackCount} треков · {g.artistCount} арт.
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="apple-card p-5">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-3">
        {title}
      </h3>
      {children}
    </div>
  );
}
