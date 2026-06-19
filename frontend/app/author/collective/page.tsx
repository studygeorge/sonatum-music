'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { authStorage } from '@/app/lib/auth';

type Member = {
  id: string;
  name: string;
  nickname?: string | null;
  role?: string | null;
  status?: 'LEADER' | 'PARTICIPANT' | 'SOLOIST' | null;
  email?: string | null;
  userId?: string | null;
  addedAt?: string;
};

type Collective = {
  id: string;
  name: string;
  slug: string;
  shortName: string | null;
  bio: string | null;
  region: string | null;
  roleType: 'AUTHOR' | 'PERFORMER' | 'BOTH' | null;
  payeeType: 'LEGAL_ENTITY' | 'SELF_EMPLOYED' | 'INDIVIDUAL_ENTREPRENEUR' | null;
  legalName: string | null;
  legalInn: string | null;
  legalKpp: string | null;
  accountNumber: string | null;
  bankName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  verified: boolean;
  members: Member[];
};

const PAYEE_LABEL: Record<string, string> = {
  LEGAL_ENTITY: 'Юридическое лицо',
  SELF_EMPLOYED: 'Самозанятый',
  INDIVIDUAL_ENTREPRENEUR: 'ИП',
};

const STATUS_LABEL: Record<string, string> = {
  LEADER: 'Лидер',
  PARTICIPANT: 'Участник',
  SOLOIST: 'Солист',
};

export default function AuthorCollectivePage() {
  const [col, setCol] = useState<Collective | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Collective>>({});

  // Add member form
  const [openAdd, setOpenAdd] = useState(false);
  const [mName, setMName] = useState('');
  const [mNick, setMNick] = useState('');
  const [mRole, setMRole] = useState('');
  const [mStatus, setMStatus] = useState<'LEADER' | 'PARTICIPANT' | 'SOLOIST'>('PARTICIPANT');
  const [mEmail, setMEmail] = useState('');

  const token = () => authStorage.getToken() || '';

  const load = () => {
    setLoading(true);
    fetch('/api/author/collective', { headers: { Authorization: `Bearer ${token()}` } })
      .then((r) => r.json())
      .then((j) => {
        if (j.success) {
          setCol(j.data);
          setForm(j.data || {});
        } else {
          setError(j.error || 'Ошибка загрузки');
        }
      })
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const saveSettings = async () => {
    setError(null);
    setBanner(null);
    try {
      const r = await fetch('/api/author/collective', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({
          name: form.name,
          shortName: form.shortName,
          bio: form.bio,
          region: form.region,
          roleType: form.roleType,
          payeeType: form.payeeType,
          legalName: form.legalName,
          legalInn: form.legalInn,
          legalKpp: form.legalKpp,
          accountNumber: form.accountNumber,
          bankName: form.bankName,
          contactEmail: form.contactEmail,
          contactPhone: form.contactPhone,
        }),
      });
      const j = await r.json();
      if (j.success) { setBanner('Данные коллектива сохранены'); load(); }
      else setError(j.error || 'Не удалось сохранить');
    } catch (e: any) { setError(e?.message || 'Ошибка'); }
  };

  const addMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!mName.trim()) { setError('Укажите имя'); return; }
    try {
      const r = await fetch('/api/author/collective/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({
          name: mName.trim(), nickname: mNick.trim() || undefined,
          role: mRole.trim() || undefined, status: mStatus,
          email: mEmail.trim() || undefined,
        }),
      });
      const j = await r.json();
      if (j.success) {
        setBanner(j.message || 'Участник добавлен');
        setMName(''); setMNick(''); setMRole(''); setMEmail('');
        setOpenAdd(false);
        load();
      } else setError(j.error || 'Ошибка');
    } catch (e: any) { setError(e?.message || 'Ошибка'); }
  };

  const removeMember = async (id: string) => {
    if (!confirm('Исключить участника из коллектива?')) return;
    try {
      const r = await fetch(`/api/author/collective/members?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token()}` },
      });
      const j = await r.json();
      if (j.success) load();
      else setError(j.error || 'Ошибка');
    } catch (e: any) { setError(e?.message || 'Ошибка'); }
  };

  if (loading) return <div className="apple-card p-10 text-center text-sm text-[var(--text-secondary)]">Загрузка…</div>;
  if (!col) {
    return (
      <div className="apple-card p-10 text-center">
        <h2 className="text-xl font-bold mb-2">У вас нет коллектива</h2>
        <p className="text-sm text-[var(--text-secondary)] max-w-md mx-auto mb-4">
          Этот раздел доступен только если ваш аккаунт зарегистрирован как коллектив (группа, оркестр, ансамбль).
        </p>
        <Link href="/author" className="text-sm underline">Назад в кабинет</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeInUp">
      <section
        className="relative rounded-3xl overflow-hidden p-7 md:p-10 text-white"
        style={{ background: 'linear-gradient(135deg, #1d4cb8 0%, #2f9e8f 55%, #e6e6e6 100%)' }}>
        <div className="relative z-10 max-w-2xl">
          <div className="text-xs uppercase tracking-widest font-semibold mb-2 opacity-90">Коллектив</div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">{col.name}</h1>
          <p className="text-sm md:text-base text-white/85 mt-2">
            Состав, получатель выплат, реквизиты для договоров.
          </p>
        </div>
      </section>

      {banner && <div className="apple-card p-4 text-sm">{banner}</div>}
      {error && <div className="apple-card p-4 text-sm border border-black">{error}</div>}

      {/* === Состав === */}
      <section className="apple-card p-6 md:p-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight">Состав</h2>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Список участников. Это <b>только информация</b> — без долей и выплат. Все деньги коллектива
              поступают единому получателю, указанному ниже. Распределение между участниками — ваша внутренняя задача.
            </p>
          </div>
          <button
            onClick={() => setOpenAdd((v) => !v)}
            className="px-4 py-2 rounded-full bg-[var(--text-primary)] text-white text-xs font-semibold whitespace-nowrap">
            {openAdd ? 'Скрыть' : '+ Добавить'}
          </button>
        </div>

        {openAdd && (
          <form onSubmit={addMember} className="rounded-2xl border border-[var(--border)] p-4 mb-4 space-y-3 bg-white">
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="ФИО участника" value={mName} onChange={setMName} required />
              <Field label="Псевдоним (ник)" value={mNick} onChange={setMNick} />
              <Field label="Инструмент / роль" value={mRole} onChange={setMRole} placeholder="вокал, гитара, автор песен…" />
              <label className="block">
                <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5 block">Статус</span>
                <select value={mStatus} onChange={(e) => setMStatus(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[var(--border)] focus:border-black focus:outline-none text-sm">
                  <option value="PARTICIPANT">Участник</option>
                  <option value="SOLOIST">Солист</option>
                  <option value="LEADER">Лидер</option>
                </select>
              </label>
              <Field label="Email (для авто-связи)" type="email" value={mEmail} onChange={setMEmail} />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="px-4 py-2 rounded-full bg-[var(--text-primary)] text-white text-xs font-semibold">Добавить</button>
              <button type="button" onClick={() => setOpenAdd(false)} className="px-4 py-2 rounded-full bg-white border border-[var(--border)] text-xs font-medium">Отмена</button>
            </div>
          </form>
        )}

        {col.members.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)]">Пока нет участников.</p>
        ) : (
          <ul className="space-y-2">
            {col.members.map((m) => (
              <li key={m.id} className="flex items-center gap-3 p-3 rounded-xl border border-[var(--border)] bg-white">
                <div className="w-10 h-10 rounded-full bg-black/5 flex items-center justify-center text-sm font-bold">
                  {(m.nickname?.[0] || m.name[0] || '?').toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm">
                    {m.name}
                    {m.nickname && <span className="text-[var(--text-secondary)] font-normal"> · @{m.nickname}</span>}
                  </div>
                  <div className="text-xs text-[var(--text-secondary)]">
                    {STATUS_LABEL[m.status || 'PARTICIPANT']}
                    {m.role && ` · ${m.role}`}
                    {m.email && ` · ${m.email}`}
                    {m.userId && ' · ✓ привязан'}
                  </div>
                </div>
                <button onClick={() => removeMember(m.id)}
                  className="px-3 py-1.5 rounded-full bg-white border border-[var(--border)] text-xs font-semibold hover:bg-gray-100">
                  Исключить
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* === Получатель выплат === */}
      <section className="apple-card p-6 md:p-8 space-y-5">
        <div>
          <h2 className="text-xl font-bold tracking-tight mb-1">Получатель выплат</h2>
          <p className="text-xs text-[var(--text-secondary)] leading-snug">
            ВСЕ доходы коллектива перечисляются <b>только одному получателю</b>. Платформа НЕ распределяет деньги
            между участниками. Это внутренняя задача коллектива.
          </p>
        </div>

        <div>
          <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2 block">Тип получателя</span>
          <div className="grid sm:grid-cols-3 gap-2">
            {(['LEGAL_ENTITY', 'INDIVIDUAL_ENTREPRENEUR', 'SELF_EMPLOYED'] as const).map((t) => {
              const disabled = t !== 'SELF_EMPLOYED';
              return (
                <button
                  key={t}
                  type="button"
                  disabled={disabled}
                  onClick={() => !disabled && setForm({ ...form, payeeType: t })}
                  className={`p-3 rounded-xl border text-left transition-all relative ${
                    disabled
                      ? 'border-[var(--border)] bg-[var(--hover)] text-[var(--text-secondary)] cursor-not-allowed opacity-60'
                      : form.payeeType === t
                        ? 'border-[var(--text-primary)] bg-[var(--text-primary)] text-white'
                        : 'border-[var(--border)] bg-white hover:border-[var(--text-primary)]'
                  }`}>
                  <div className="font-semibold text-sm">{PAYEE_LABEL[t]}</div>
                  {disabled && <div className="text-[10px] mt-1">скоро</div>}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <Field
            label="Название организации / ФИО"
            value={form.legalName || ''}
            onChange={(v) => setForm({ ...form, legalName: v })}
          />
          <Field
            label="ИНН (10 или 12 цифр)"
            value={form.legalInn || ''}
            onChange={(v) => setForm({ ...form, legalInn: v.replace(/\D/g, '').slice(0, 12) })}
          />
          {form.payeeType === 'LEGAL_ENTITY' && (
            <Field label="КПП" value={form.legalKpp || ''} onChange={(v) => setForm({ ...form, legalKpp: v.replace(/\D/g, '').slice(0, 9) })} />
          )}
          <Field label="Расчётный счёт" value={form.accountNumber || ''} onChange={(v) => setForm({ ...form, accountNumber: v.replace(/\D/g, '').slice(0, 20) })} />
          <Field label="Банк" value={form.bankName || ''} onChange={(v) => setForm({ ...form, bankName: v })} />
        </div>

        <div className="pt-3 border-t border-[var(--border)]">
          <h3 className="text-base font-bold tracking-tight mb-3">Представитель</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Email представителя" type="email" value={form.contactEmail || ''} onChange={(v) => setForm({ ...form, contactEmail: v })} />
            <Field label="Телефон" type="tel" value={form.contactPhone || ''} onChange={(v) => setForm({ ...form, contactPhone: v })} />
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={saveSettings}
            className="px-5 py-2.5 rounded-full bg-[var(--text-primary)] text-white text-sm font-medium">
            Сохранить
          </button>
          <button onClick={() => setForm(col)}
            className="px-5 py-2.5 rounded-full bg-white border border-[var(--border)] text-black text-sm font-medium">
            Сбросить
          </button>
        </div>
      </section>
    </div>
  );
}

function Field({
  label, value, onChange, type = 'text', required, placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; required?: boolean; placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5 block">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[var(--border)] focus:border-black focus:outline-none text-sm"
      />
    </label>
  );
}
