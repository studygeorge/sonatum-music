'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { authStorage } from '@/app/lib/auth';
import { api } from '@/app/lib/api';
import Link from 'next/link';

import { toast } from '@/app/components/Toast';
type AuthorSub = {
  tier: string;
  status: string;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
};

function AuthorSettingsPageInner() {
  const sp = useSearchParams();
  const [sub, setSub] = useState<AuthorSub | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  // Мгновенный выход без подтверждения
  const handleLogout = async () => {
    try { await (api as any).logout?.(); } catch {}
    authStorage.clear();
    window.location.href = '/';
  };

  useEffect(() => {
    if (sp.get('profi') === 'ok') setBanner('Подписка ПРОФИ активирована.');
    if (sp.get('profi') === 'fail') setBanner('Оплата не прошла, попробуйте ещё раз.');
    fetch('/api/author-subscriptions/init', {
      headers: { Authorization: `Bearer ${authStorage.getToken() || ''}` },
    })
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setSub(j.data);
      })
      .finally(() => setLoading(false));
  }, [sp]);

  const subscribe = async () => {
    setSubmitting(true);
    try {
      const r = await fetch('/api/author-subscriptions/init', {
        method: 'POST',
        headers: { Authorization: `Bearer ${authStorage.getToken() || ''}` },
      });
      const j = await r.json();
      if (!j.success) {
        toast.error(j.error || 'Ошибка');
        return;
      }
      if (j.paymentUrl) window.location.href = j.paymentUrl;
    } finally {
      setSubmitting(false);
    }
  };

  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' }) : '—';

  return (
    <div className="space-y-6 animate-fadeInUp">
      <section
        className="relative rounded-3xl overflow-hidden p-7 md:p-10 text-white"
        style={{ background: 'linear-gradient(135deg, #1d4cb8 0%, #2f9e8f 55%, #e6e6e6 100%)' }}>
        <div className="relative z-10 max-w-2xl">
          <div className="text-xs uppercase tracking-widest font-semibold mb-2 opacity-90">
            Настройки автора
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">Подписка и монетизация</h1>
          <p className="text-sm md:text-base text-white/85 mt-2">
            Подписка ПРОФИ, цены по умолчанию, приватность.
          </p>
        </div>
      </section>
      {banner && (
        <div className="apple-card p-4 bg-gray-50 border border-gray-300 text-sm text-gray-900">
          {banner}
        </div>
      )}

      {/* ПРОФИ-подписка */}
      <section className="apple-card overflow-hidden">
        <div
          className="p-6 md:p-8 text-white"
          style={{
            background: sub?.isActive
              ? 'linear-gradient(135deg, #1d4cb8 0%, #2c5fc7 100%)'
              : 'linear-gradient(135deg, #1d1d1f 0%, #3a3a3c 100%)',
          }}>
          <div className="flex items-baseline justify-between gap-3 flex-wrap mb-3">
            <div>
              <div className="text-xs uppercase tracking-widest font-semibold opacity-80">
                Тариф для авторов
              </div>
              <h2 className="text-2xl md:text-3xl font-black tracking-tight mt-1 text-white">
                {sub?.isActive ? 'ПРОФИ активна' : 'ПРОФИ'}
              </h2>
            </div>
            <div className="text-right">
              <div className="text-2xl md:text-3xl font-black tabular-nums">299 ₽</div>
              <div className="text-xs opacity-80">в месяц</div>
            </div>
          </div>
          {sub?.isActive && (
            <p className="text-sm text-white/90 mb-3">
              Действует до <strong>{fmtDate(sub.endsAt)}</strong>
            </p>
          )}
          {!sub?.isActive && !loading && (
            <button
              onClick={subscribe}
              disabled={submitting}
              className="px-7 py-3 rounded-full bg-white text-[#1d4cb8] font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50">
              {submitting ? 'Загрузка…' : 'Оформить ПРОФИ за 299 ₽/мес'}
            </button>
          )}
        </div>
        <div className="p-6 md:p-8 grid sm:grid-cols-2 gap-4">
          <Feature title="Расширенная аналитика" desc="Города и регионы, демография, динамика по дням, выгрузка PDF/Excel" />
          <Feature title="Приоритетная модерация" desc="Треки и события до 3 дней (вместо 7)" />
          <Feature title="Бесплатные афиши" desc="Создавайте события без оплаты 250 ₽" />
          <Feature title="Премиум-бейдж" desc="Значок «ПРОФИ» в публичном профиле" />
          <Feature title="Повышенные позиции" desc="Выделение в поиске и каталоге" />
          <Feature title="Загрузка с автопубликацией" desc="Планируйте релизы на будущее" />
        </div>
      </section>
      {/* Монетизация по умолчанию */}
      <section className="apple-card p-6 md:p-8">
        <h2 className="text-xl font-bold tracking-tight mb-2">Монетизация новых треков</h2>
        <p className="text-sm text-[var(--text-secondary)] mb-5">
          Эти настройки применяются ко всем новым загрузкам по умолчанию (можно менять для каждого трека отдельно).
        </p>
        <SettingPlaceholder
          title="Автоматически включать монетизацию"
          desc="Новые треки сразу доступны для покупки лицензий"
        />
        <SettingPlaceholder
          title="Стандартная цена трека"
          desc="99 ₽ (можно поменять при загрузке)"
        />
        <SettingPlaceholder
          title="Запросы на эксклюзив"
          desc="Появится кнопка «Запросить исключительную лицензию» на странице трека"
        />
        <p className="text-xs text-[var(--text-secondary)] mt-4">
          Скоро: возможность менять глобальные значения здесь.
        </p>
      </section>
      {/* Приватность исключительных лицензий */}
      <ExclusivePrivacy />

      {/* Чёрный список */}
      <BlockedUsers />

      {/* Выход из аккаунта */}
      <section className="apple-card p-6 md:p-8">
        <h2 className="text-xl font-bold tracking-tight mb-2">Аккаунт</h2>
        <p className="text-sm text-[var(--text-secondary)] mb-4">
          Завершить сессию и выйти из аккаунта.
        </p>
        <button
          onClick={handleLogout}
          className="px-5 py-2.5 rounded-full bg-white border border-black text-black hover:bg-gray-100 font-medium text-sm transition-colors"
        >
          Выйти из аккаунта
        </button>
      </section>

    </div>
  );
}

function Feature({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-6 h-6 rounded-full bg-white/20 text-white flex items-center justify-center shrink-0 text-sm">
      </div>
      <div>
        <div className="font-semibold text-sm">{title}</div>
        <div className="text-xs opacity-80 mt-0.5">{desc}</div>
      </div>
    </div>
  );
}

function SettingPlaceholder({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-[var(--border)] last:border-b-0">
      <div className="flex-1 min-w-0 mr-3">
        <div className="font-medium text-sm">{title}</div>
        <div className="text-xs text-[var(--text-secondary)] mt-0.5">{desc}</div>
      </div>
      <div className="w-10 h-6 rounded-full bg-[var(--text-primary)]/20 relative shrink-0">
        <div className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-white shadow" />
      </div>
    </div>
  );
}

export default function AuthorSettingsPage() {
  return (
    <Suspense fallback={<div className="text-sm text-[var(--text-secondary)] py-6">Загрузка…</div>}>
      <AuthorSettingsPageInner />
    </Suspense>
  );
}

const EXCLUSIVE_MODES = [
  { v: 'SHOW_CONTACTS', label: 'Показывать мои контакты', desc: 'Покупатель свяжется напрямую (email/телефон/Telegram). Платформа в переговорах не участвует.' },
  { v: 'ANONYMOUS', label: 'Только анонимная форма', desc: 'Сообщение придёт вам через платформу. Email скрыт до момента ответа.' },
  { v: 'DISABLED', label: 'Не получать такие запросы', desc: 'Кнопка «Запросить исключительную лицензию» не показывается на ваших треках.' },
];

function ExclusivePrivacy() {
  const [mode, setMode] = useState<string>('ANONYMOUS');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [telegram, setTelegram] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  const token = () => authStorage.getToken() || '';

  useEffect(() => {
    fetch('/api/author/me', { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.json())
      .then(j => {
        if (j.success && j.data?.artist) {
          setMode(j.data.artist.exclusiveMode || 'ANONYMOUS');
          setEmail(j.data.artist.exclusiveContactEmail || '');
          setPhone(j.data.artist.exclusiveContactPhone || '');
          setTelegram(j.data.artist.exclusiveContactTelegram || '');
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    setBanner(null);
    try {
      const r = await fetch('/api/author/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({
          exclusiveMode: mode,
          exclusiveContactEmail: email.trim() || null,
          exclusiveContactPhone: phone.trim() || null,
          exclusiveContactTelegram: telegram.trim() || null,
        }),
      });
      const j = await r.json();
      if (j.success) {
        setBanner('Настройки сохранены');
        setTimeout(() => setBanner(null), 2500);
      }
    } finally { setSaving(false); }
  };

  if (loading) return <div className="apple-card p-6 text-sm text-[var(--text-secondary)]">Загрузка настроек приватности…</div>;

  return (
    <section className="apple-card p-6 md:p-8">
      <div className="flex items-center justify-between mb-2 gap-3 flex-wrap">
        <h2 className="text-xl font-bold tracking-tight">Приватность исключительных запросов</h2>
        {banner && <span className="text-xs text-[var(--text-secondary)]">{banner}</span>}
      </div>
      <p className="text-sm text-[var(--text-secondary)] mb-5">
        Как бизнес-клиенты могут связаться с вами по поводу <b>исключительных лицензий</b>.
        Платформа не продаёт эксклюзивные права — только передаёт ваш контакт или сообщение.
      </p>

      <div className="space-y-2 mb-5">
        {EXCLUSIVE_MODES.map((m) => (
          <label key={m.v}
            className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
              mode === m.v ? 'border-black bg-black/[0.03]' : 'border-[var(--border)] bg-white hover:border-[var(--text-primary)]'
            }`}>
            <input type="radio" checked={mode === m.v} onChange={() => setMode(m.v)} className="mt-1" />
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm">{m.label}</div>
              <div className="text-xs text-[var(--text-secondary)] mt-0.5 leading-snug">{m.desc}</div>
            </div>
          </label>
        ))}
      </div>

      {mode === 'SHOW_CONTACTS' && (
        <div className="grid sm:grid-cols-3 gap-3 mb-5">
          <Field label="Email для запросов" value={email} onChange={setEmail} type="email" />
          <Field label="Телефон" value={phone} onChange={setPhone} type="tel" />
          <Field label="Telegram (@username)" value={telegram} onChange={setTelegram} />
        </div>
      )}

      <button onClick={save} disabled={saving}
        className="px-5 py-2.5 rounded-full bg-[var(--text-primary)] text-white text-sm font-medium disabled:opacity-60">
        {saving ? 'Сохраняем…' : 'Сохранить'}
      </button>
    </section>
  );
}

function BlockedUsers() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const token = () => authStorage.getToken() || '';

  const load = () => {
    setLoading(true);
    fetch('/api/users/me/blocks', { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.json())
      .then(j => { if (j.success) setItems(j.data || []); })
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const unblock = async (userId: string) => {
    if (!confirm('Убрать из чёрного списка?')) return;
    await fetch(`/api/users/me/blocks?userId=${encodeURIComponent(userId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token()}` },
    });
    load();
  };

  return (
    <section className="apple-card p-6 md:p-8">
      <h2 className="text-xl font-bold tracking-tight mb-2">Чёрный список</h2>
      <p className="text-sm text-[var(--text-secondary)] mb-5">
        Заблокированные пользователи не видят ваши заявки в коллаборациях и не могут вам писать.
      </p>
      {loading ? (
        <p className="text-sm text-[var(--text-secondary)]">Загрузка…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-[var(--text-secondary)]">Список пуст.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((u) => (
            <li key={u.id} className="flex items-center gap-3 p-3 rounded-xl border border-[var(--border)]">
              <div className="w-9 h-9 rounded-full bg-black/[0.06] flex items-center justify-center text-sm font-bold">
                {(u.name?.[0] || u.username?.[0] || '?').toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm truncate">{u.name}</div>
                <div className="text-xs text-[var(--text-secondary)] truncate">{u.email}</div>
              </div>
              <button onClick={() => unblock(u.userId)}
                className="px-3 py-1.5 rounded-full bg-white border border-[var(--border)] text-xs font-semibold hover:bg-gray-100">
                Разблокировать
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Field({
  label, value, onChange, type = 'text',
}: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5 block">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[var(--border)] focus:border-black focus:outline-none text-sm"
      />
    </label>
  );
}
