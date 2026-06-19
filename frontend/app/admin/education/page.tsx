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
  contactName: string;
  contactRole: string | null;
  contactEmail: string;
  contactPhone: string | null;
  status: string;
  teacherCount: number;
  studentCount: number;
  withSheets: boolean;
  annualFee: number | null;
  paidAt: string | null;
  expiresAt: string | null;
  createdAt: string;
};

const STATUS_LABEL: Record<string, { l: string; c: string }> = {
  PENDING: { l: 'Заявка', c: 'bg-amber-100 text-amber-700' },
  APPROVED: { l: 'Одобрено', c: 'bg-blue-100 text-blue-700' },
  ACTIVE: { l: 'Активно', c: 'bg-green-100 text-green-700' },
  REJECTED: { l: 'Отклонено', c: 'bg-red-100 text-red-700' },
  EXPIRED: { l: 'Истекло', c: 'bg-gray-100 text-gray-700' },
};

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export default function AdminEducationPage() {
  const [items, setItems] = useState<Inst[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'PENDING' | 'APPROVED' | 'ACTIVE' | 'ALL'>('PENDING');

  const load = () => {
    const qs = filter === 'ALL' ? '?admin=1' : `?admin=1&status=${filter}`;
    fetch(`/api/edu-institutions${qs}`, {
      headers: { Authorization: `Bearer ${authStorage.getToken() || ''}` },
    })
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setItems(j.data || []);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setLoading(true);
    load();
  }, [filter]);

  const action = async (id: string, act: string, months?: number) => {
    await fetch(`/api/edu-institutions/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authStorage.getToken() || ''}`,
      },
      body: JSON.stringify({ action: act, months }),
    });
    load();
  };

  return (
    <main className="min-h-screen pt-6 md:pt-10 pb-20 px-4 md:px-8 max-w-7xl mx-auto space-y-6">
      <section
        className="relative rounded-3xl overflow-hidden p-7 md:p-10 text-white"
        style={{ background: 'linear-gradient(135deg, #1d4cb8 0%, #2f9e8f 55%, #e6e6e6 100%)' }}>
        <div className="relative z-10 max-w-2xl">
          <div className="text-xs uppercase tracking-widest font-semibold mb-2 opacity-90">
            Админ · Учебные заведения
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">B2B Образование</h1>
          <p className="text-sm md:text-base text-white/85 mt-2">
            Заявки от школ, колледжей и вузов на годовой доступ.
          </p>
        </div>
      </section>
      <div className="flex gap-2 overflow-x-auto">
        {[
          { v: 'PENDING', l: 'Новые заявки' },
          { v: 'APPROVED', l: 'Ожидают оплаты' },
          { v: 'ACTIVE', l: 'Активные' },
          { v: 'ALL', l: 'Все' },
        ].map((f) => (
          <button
            key={f.v}
            onClick={() => setFilter(f.v as any)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              filter === f.v
                ? 'bg-[var(--text-primary)] text-white'
                : 'bg-[var(--hover)] text-[var(--text-primary)] hover:bg-[var(--border)]'
            }`}>
            {f.l}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="text-center text-[var(--text-secondary)] py-12">Загрузка…</div>
      ) : items.length === 0 ? (
        <div className="apple-card p-10 text-center text-[var(--text-secondary)]">Нет заявок</div>
      ) : (
        <div className="space-y-3">
          {items.map((i) => {
            const s = STATUS_LABEL[i.status] || STATUS_LABEL.PENDING;
            return (
              <div key={i.id} className="rounded-2xl border border-[var(--border)] bg-white p-5">
                <div className="flex items-baseline gap-2 mb-2 flex-wrap">
                  <h3 className="font-bold text-base flex-1">{i.fullName}</h3>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full ${s.c}`}>{s.l}</span>
                  <span className="text-sm font-bold tabular-nums ml-2">
                    {i.annualFee ? `${i.annualFee.toLocaleString('ru-RU')} ₽/год` : '—'}
                  </span>
                </div>
                <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-xs text-[var(--text-secondary)] mb-3">
                  {i.inn && <Info label="ИНН" value={i.inn} />}
                  {i.legalAddress && <Info label="Адрес" value={i.legalAddress} />}
                  <Info label="Преподавателей" value={String(i.teacherCount)} />
                  <Info label="Учащихся" value={String(i.studentCount)} />
                  <Info label="Доступ к нотам" value={i.withSheets ? 'Да' : 'Нет'} />
                  <Info label="Подана" value={fmtDate(i.createdAt)} />
                  {i.paidAt && <Info label="Оплачено" value={fmtDate(i.paidAt)} />}
                  {i.expiresAt && <Info label="Действует до" value={fmtDate(i.expiresAt)} />}
                </div>
                <div className="border-t border-[var(--border)] pt-3 text-xs">
                  <strong>Контакт:</strong> {i.contactName}
                  {i.contactRole && ` (${i.contactRole})`} · {i.contactEmail}
                  {i.contactPhone && ` · ${i.contactPhone}`}
                </div>
                <div className="flex gap-2 mt-3 flex-wrap">
                  {i.status === 'PENDING' && (
                    <>
                      <button
                        onClick={() => action(i.id, 'APPROVE')}
                        className="px-4 py-2 rounded-full bg-blue-600 text-white text-sm font-medium hover:bg-blue-700">
                         Одобрить (выставить счёт)
                      </button>
                      <button
                        onClick={() => action(i.id, 'REJECT')}
                        className="px-4 py-2 rounded-full bg-[var(--hover)] text-[var(--text-primary)] text-sm font-medium hover:bg-[var(--border)]">
                        Отклонить
                      </button>
                    </>
                  )}
                  {i.status === 'APPROVED' && (
                    <>
                      <button
                        onClick={() => action(i.id, 'MARK_PAID', 12)}
                        className="px-4 py-2 rounded-full bg-green-600 text-white text-sm font-medium hover:bg-green-700">
                         Отметить оплаченным (12 мес)
                      </button>
                      <button
                        onClick={() => action(i.id, 'MARK_PAID', 6)}
                        className="px-4 py-2 rounded-full bg-[var(--hover)] text-[var(--text-primary)] text-sm font-medium">
                        Оплачено (6 мес)
                      </button>
                    </>
                  )}
                  {i.status === 'ACTIVE' && (
                    <button
                      onClick={() => action(i.id, 'EXPIRE')}
                      className="px-4 py-2 rounded-full bg-[var(--hover)] text-[var(--text-primary)] text-sm font-medium">
                      Прекратить досрочно
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="text-center pt-4">
        <Link href="/admin" className="text-sm text-[var(--accent)] hover:underline">
          Назад в админ-панель
        </Link>
      </div>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="font-medium">{label}:</span> {value}
    </div>
  );
}
