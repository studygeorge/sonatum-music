'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { authStorage } from '@/app/lib/auth';

type Inst = {
  id: string;
  fullName: string;
  shortName: string | null;
  inn: string | null;
  legalAddress: string | null;
  contactName: string | null;
  contactRole: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  status: string;
  teacherCount: number;
  studentCount: number;
  withSheets: boolean;
  annualFee: number | null;
  paidAt: string | null;
  expiresAt: string | null;
};

type EduMe = { myRole: 'ADMIN' | 'TEACHER' | 'STUDENT' | null } | null;

export default function EduSettingsPage() {
  const [me, setMe] = useState<EduMe>(null);
  const [inst, setInst] = useState<Inst | null>(null);
  const [form, setForm] = useState<Partial<Inst>>({});
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const token = () => authStorage.getToken() || '';

  useEffect(() => {
    fetch('/api/edu/me', { headers: { Authorization: `Bearer ${token()}` } })
      .then((r) => r.json())
      .then((j) => setMe(j.success ? { myRole: j.myRole } : null));

    fetch('/api/edu/institution', { headers: { Authorization: `Bearer ${token()}` } })
      .then((r) => r.json())
      .then((j) => {
        if (j.success) {
          setInst(j.data);
          setForm(j.data);
        }
      });
  }, []);

  const isAdmin = me?.myRole === 'ADMIN';

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setBanner(null);
    try {
      const r = await fetch('/api/edu/institution', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token()}`,
        },
        body: JSON.stringify({
          fullName: form.fullName,
          shortName: form.shortName,
          inn: form.inn,
          legalAddress: form.legalAddress,
          contactName: form.contactName,
          contactRole: form.contactRole,
          contactEmail: form.contactEmail,
          contactPhone: form.contactPhone,
        }),
      });
      const j = await r.json();
      if (j.success) {
        setBanner('Реквизиты сохранены');
        setInst((prev) => (prev ? { ...prev, ...form } : prev));
      } else {
        setError(j.error || 'Не удалось сохранить');
      }
    } catch (e: any) {
      setError(e?.message || 'Ошибка сети');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    authStorage.clear();
    window.location.href = '/';
  };

  return (
    <div className="space-y-6 animate-fadeInUp">
      <section
        className="relative rounded-3xl overflow-hidden p-7 md:p-10 text-white"
        style={{ background: 'linear-gradient(135deg, #1d4cb8 0%, #2f9e8f 55%, #e6e6e6 100%)' }}>
        <div className="relative z-10 max-w-2xl">
          <div className="text-xs uppercase tracking-widest font-semibold mb-2 opacity-90">
            Кабинет
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">Настройки</h1>
        </div>
      </section>

      {banner && (
        <div className="apple-card p-4 text-sm">{banner}</div>
      )}
      {error && (
        <div className="apple-card p-4 text-sm border border-black">{error}</div>
      )}

      {/* Лицензия */}
      {inst && (
        <section className="apple-card p-6 md:p-8">
          <h2 className="text-xl font-bold tracking-tight mb-1">Лицензия</h2>
          <p className="text-sm text-[var(--text-secondary)] mb-4">
            Текущий тариф и срок действия подписки учреждения.
          </p>
          <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <Row label="Статус" value={
              inst.status === 'ACTIVE' ? 'Активна' :
              inst.status === 'APPROVED' ? 'Ожидает оплаты' :
              inst.status
            } />
            <Row label="Преподавателей" value={String(inst.teacherCount)} />
            <Row label="Учащихся" value={String(inst.studentCount)} />
            <Row label="Нотный архив" value={inst.withSheets ? 'Включён' : 'Не включён'} />
            <Row label="Годовая плата" value={inst.annualFee ? `${inst.annualFee.toLocaleString('ru-RU')} ₽` : '—'} />
            <Row label="Оплачено" value={inst.paidAt ? new Date(inst.paidAt).toLocaleDateString('ru-RU') : '—'} />
            <Row label="Действует до" value={inst.expiresAt ? new Date(inst.expiresAt).toLocaleDateString('ru-RU') : '—'} />
          </dl>
          {isAdmin && (
            <div className="mt-5 flex flex-wrap gap-2">
              <Link href="/b2b/education" className="px-5 py-2.5 rounded-full bg-[var(--text-primary)] text-white text-sm font-medium">
                Обновить лицензию
              </Link>
              <Link href="/edu/documents" className="px-5 py-2.5 rounded-full bg-white border border-black text-black hover:bg-gray-100 text-sm font-medium">
                Документы и счета
              </Link>
            </div>
          )}
        </section>
      )}

      {/* Реквизиты и контакты */}
      {inst && isAdmin && (
        <form onSubmit={handleSave} className="apple-card p-6 md:p-8 space-y-5">
          <div>
            <h2 className="text-xl font-bold tracking-tight mb-1">Реквизиты и контактные данные</h2>
            <p className="text-sm text-[var(--text-secondary)]">
              Эти данные используются в договоре, счетах и актах.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Полное наименование" value={form.fullName || ''} onChange={(v) => setForm({ ...form, fullName: v })} required />
            <Field label="Краткое наименование" value={form.shortName || ''} onChange={(v) => setForm({ ...form, shortName: v })} />
            <Field label="ИНН" value={form.inn || ''} onChange={(v) => setForm({ ...form, inn: v.replace(/\D/g, '').slice(0, 12) })} />
            <Field label="Юридический адрес" value={form.legalAddress || ''} onChange={(v) => setForm({ ...form, legalAddress: v })} />
          </div>

          <div className="pt-4 border-t border-[var(--border)]">
            <h3 className="text-base font-bold tracking-tight mb-3">Контактное лицо</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="ФИО" value={form.contactName || ''} onChange={(v) => setForm({ ...form, contactName: v })} />
              <Field label="Должность" value={form.contactRole || ''} onChange={(v) => setForm({ ...form, contactRole: v })} />
              <Field label="Email" type="email" value={form.contactEmail || ''} onChange={(v) => setForm({ ...form, contactEmail: v })} />
              <Field label="Телефон" type="tel" value={form.contactPhone || ''} onChange={(v) => setForm({ ...form, contactPhone: v })} />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 rounded-full bg-[var(--text-primary)] text-white text-sm font-medium disabled:opacity-60">
              {saving ? 'Сохранение…' : 'Сохранить'}
            </button>
            <button
              type="button"
              onClick={() => setForm(inst)}
              className="px-5 py-2.5 rounded-full bg-white border border-[var(--border)] text-black hover:bg-gray-100 text-sm font-medium">
              Сбросить
            </button>
          </div>
        </form>
      )}

      {/* Аккаунт — быстрый выход */}
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-[var(--text-secondary)]">{label}</dt>
      <dd className="font-semibold text-right">{value}</dd>
    </div>
  );
}

function Field({
  label, value, onChange, type = 'text', required,
}: {
  label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5 block">{label}</span>
      <input
        type={type}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[var(--border)] focus:border-black focus:outline-none text-sm"
      />
    </label>
  );
}
