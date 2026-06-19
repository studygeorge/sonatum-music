'use client';

import { useEffect, useState } from 'react';
import { authStorage } from '@/app/lib/auth';

type Setting = {
  key: string;
  label: string;
  type: 'number' | 'string';
  unit?: string;
  hint?: string;
  value: string | null;
  updatedAt: string | null;
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const token = () => authStorage.getToken() || '';

  const load = () => {
    setLoading(true);
    fetch('/api/admin/settings', { headers: { Authorization: `Bearer ${token()}` } })
      .then((r) => r.json())
      .then((j) => {
        if (j.success) {
          setSettings(j.data);
          // Заполняем драфты текущими значениями
          const d: Record<string, string> = {};
          j.data.forEach((s: Setting) => { d[s.key] = s.value || ''; });
          setDrafts(d);
        } else {
          setError(j.error || 'Ошибка');
        }
      })
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const save = async (key: string) => {
    setSavingKey(key);
    setBanner(null);
    setError(null);
    try {
      const r = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ key, value: drafts[key] }),
      });
      const j = await r.json();
      if (j.success) {
        setBanner(`«${settings.find((s) => s.key === key)?.label}» сохранено`);
        setTimeout(() => setBanner(null), 2500);
        load();
      } else {
        setError(j.error || 'Ошибка');
      }
    } finally { setSavingKey(null); }
  };

  const logout = () => { authStorage.clear(); window.location.href = '/'; };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-gray-900 mb-2">Настройки платформы</h1>
        <p className="text-gray-600">Глобальные параметры: цены подписок, комиссии, длительность пробного периода.</p>
      </div>

      {banner && (
        <div className="mb-4 p-3 rounded-xl bg-black text-white text-sm">{banner}</div>
      )}
      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
      )}

      <div className="space-y-6">
        {/* Аккаунт — быстрый выход */}
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Аккаунт</h2>
          <p className="text-gray-600 mb-4">Завершить сессию и выйти из админ-панели.</p>
          <button
            onClick={logout}
            className="px-5 py-2.5 rounded-full bg-white border border-black text-black hover:bg-gray-100 font-medium text-sm transition-colors">
            Выйти из аккаунта
          </button>
        </div>

        {/* Настройки */}
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Цены и комиссии</h2>
          {loading ? (
            <p className="text-sm text-gray-500">Загрузка…</p>
          ) : (
            <div className="space-y-4">
              {settings.map((s) => (
                <div key={s.key} className="grid sm:grid-cols-[1fr_auto] gap-3 items-start py-3 border-b border-gray-100 last:border-0">
                  <div>
                    <div className="font-medium text-sm text-gray-900">{s.label}</div>
                    {s.hint && <div className="text-xs text-gray-500 mt-0.5">{s.hint}</div>}
                    {s.updatedAt && (
                      <div className="text-[10px] text-gray-400 mt-1">
                        Обновлено {new Date(s.updatedAt).toLocaleString('ru-RU')}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 items-center shrink-0">
                    <div className="relative">
                      <input
                        type={s.type === 'number' ? 'number' : 'text'}
                        value={drafts[s.key] || ''}
                        onChange={(e) => setDrafts({ ...drafts, [s.key]: e.target.value })}
                        className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm w-32 text-right pr-9 focus:border-black outline-none"
                      />
                      {s.unit && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">{s.unit}</span>
                      )}
                    </div>
                    <button
                      onClick={() => save(s.key)}
                      disabled={savingKey === s.key || drafts[s.key] === (s.value || '')}
                      className="px-3 py-2 rounded-lg bg-gray-900 text-white text-xs font-semibold disabled:opacity-40">
                      {savingKey === s.key ? '…' : 'Сохранить'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Управление</h2>
          <p className="text-gray-600 text-sm">
            Другие разделы — в боковом меню админки: пользователи, треки, артисты, события, жанры, финансы.
          </p>
        </div>
      </div>
    </div>
  );
}
