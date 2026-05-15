'use client';

import { useEffect, useState } from 'react';
import { authStorage } from '@/app/lib/auth';

type License = {
  code: string;
  name: string;
  shortName: string;
  audience: string;
  description: string;
  price: number;
  commissionPct: number;
  isB2B: boolean;
  requiresManager: boolean;
};

export default function LicenseMarketplace({
  trackId,
  trackTitle,
}: {
  trackId: string;
  trackTitle: string;
}) {
  const [licenses, setLicenses] = useState<License[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeLicense, setActiveLicense] = useState<License | null>(null);
  const [modal, setModal] = useState<'PURCHASE' | 'B2B' | 'EXCLUSIVE' | 'DONE' | null>(null);

  // Form fields
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [project, setProject] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [resultMessage, setResultMessage] = useState('');

  useEffect(() => {
    fetch(`/api/tracks/${trackId}/licenses`)
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setLicenses(j.data || []);
      })
      .finally(() => setLoading(false));
  }, [trackId]);

  const openModal = (l: License) => {
    setActiveLicense(l);
    setError('');
    setResultMessage('');
    // pre-fill email from logged-in user if available
    const u = authStorage.getUser?.();
    if (u?.email) setEmail(u.email);
    if (u?.firstName || u?.lastName) setName(`${u.firstName || ''} ${u.lastName || ''}`.trim());
    if (l.code === 'EXCLUSIVE') setModal('EXCLUSIVE');
    else if (l.requiresManager) setModal('B2B');
    else setModal('PURCHASE');
  };

  const submit = async () => {
    if (!activeLicense) return;
    setError('');
    if (!email.trim()) {
      setError('Укажите email');
      return;
    }
    if ((modal === 'B2B' || modal === 'EXCLUSIVE') && !project.trim()) {
      setError('Опишите проект');
      return;
    }
    setSubmitting(true);
    try {
      const token = authStorage.getToken();
      const r = await fetch('/api/payments/license-init', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          trackId,
          licenseCode: activeLicense.code,
          buyerEmail: email.trim(),
          buyerName: name.trim() || undefined,
          buyerCompany: company.trim() || undefined,
          projectDescription: project.trim() || undefined,
        }),
      });
      const j = await r.json();
      if (!j.success) {
        setError(j.error || 'Ошибка');
        return;
      }
      if (j.mode === 'DIRECT' && j.paymentUrl) {
        window.location.href = j.paymentUrl;
        return;
      }
      setResultMessage(j.message || 'Запрос отправлен');
      setModal('DONE');
    } catch (e: any) {
      setError(e?.message || 'Ошибка сети');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return null;
  if (licenses.length === 0) return null;

  return (
    <section className="apple-card p-5 md:p-6 mt-6">
      <div className="flex items-end justify-between mb-4 flex-wrap gap-3">
        <h2 className="text-xl md:text-2xl font-bold tracking-tight">Лицензии</h2>
        <p className="text-xs text-[var(--text-secondary)] max-w-md">
          Выберите подходящий тип использования. Платформа выпускает короткие договоры
          для обычных лицензий, B2B и эксклюзив — через менеджера или напрямую с автором.
        </p>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {licenses.map((l) => (
          <button
            key={l.code}
            onClick={() => openModal(l)}
            className="text-left apple-card p-4 hover:scale-[1.01] transition-transform">
            <div className="flex items-baseline justify-between gap-2 mb-1">
              <span className="font-semibold text-sm">{l.shortName || l.name}</span>
              {l.code !== 'EXCLUSIVE' ? (
                <span className="text-base font-bold tabular-nums whitespace-nowrap">
                  {Math.round(l.price).toLocaleString('ru-RU')} ₽
                </span>
              ) : (
                <span className="text-xs text-[var(--text-secondary)]">по запросу</span>
              )}
            </div>
            <p className="text-xs text-[var(--text-secondary)] leading-snug line-clamp-3 mb-2">
              {l.description}
            </p>
            <div className="flex items-center gap-1 flex-wrap">
              {l.isB2B && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                  B2B
                </span>
              )}
              {l.requiresManager && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                  через менеджера
                </span>
              )}
              {l.audience && (
                <span className="text-[10px] text-[var(--text-secondary)] truncate">
                  {l.audience}
                </span>
              )}
            </div>
          </button>
        ))}
      </div>
      {/* Modal */}
      {modal && activeLicense && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md"
          onClick={() => !submitting && setModal(null)}>
          <div
            className="apple-card max-w-lg w-full p-6 shadow-2xl animate-fadeInUp max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h3 className="text-xl font-bold tracking-tight">
                  {activeLicense.name}
                </h3>
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                  Трек: «{trackTitle}»
                </p>
              </div>
              <button
                onClick={() => !submitting && setModal(null)}
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-2xl leading-none"
                aria-label="Закрыть">
                
              </button>
            </div>
            {modal === 'DONE' ? (
              <>
                <div className="text-center py-6">
                                    <p className="text-base font-medium mb-2">Готово</p>
                  <p className="text-sm text-[var(--text-secondary)]">{resultMessage}</p>
                </div>
                <button
                  onClick={() => setModal(null)}
                  className="w-full px-6 py-3 rounded-full bg-[var(--text-primary)] text-white font-medium hover:opacity-90 transition-opacity">
                  Закрыть
                </button>
              </>
            ) : (
              <>
                <p className="text-sm text-[var(--text-secondary)] mb-4">
                  {activeLicense.description}
                </p>
                {modal === 'EXCLUSIVE' && (
                  <div className="apple-card p-3 bg-amber-50 border-amber-200 mb-4">
                    <p className="text-xs text-amber-900 leading-snug">
                      «Сонатум» <strong>не продаёт</strong> исключительные права. Мы только помогаем связаться с автором. Дальнейшие переговоры и оплата происходят за пределами платформы.
                    </p>
                  </div>
                )}

                {modal === 'PURCHASE' && activeLicense.code !== 'EXCLUSIVE' && (
                  <div className="flex items-baseline justify-between mb-4 pb-3 border-b border-[var(--border)]">
                    <span className="text-sm text-[var(--text-secondary)]">К оплате</span>
                    <span className="text-2xl font-black tabular-nums">
                      {Math.round(activeLicense.price).toLocaleString('ru-RU')} ₽
                    </span>
                  </div>
                )}

                {error && (
                  <div className="apple-card p-3 bg-red-50 border-red-200 text-sm text-red-600 mb-3">
                    {error}
                  </div>
                )}

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">Email *</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-white outline-none focus:ring-2 focus:ring-[var(--accent)] text-sm"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium mb-1">Ваше имя</label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-white outline-none focus:ring-2 focus:ring-[var(--accent)] text-sm"
                      />
                    </div>
                    {(modal === 'B2B' || modal === 'EXCLUSIVE') && (
                      <div>
                        <label className="block text-xs font-medium mb-1">Компания</label>
                        <input
                          type="text"
                          value={company}
                          onChange={(e) => setCompany(e.target.value)}
                          className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-white outline-none focus:ring-2 focus:ring-[var(--accent)] text-sm"
                        />
                      </div>
                    )}
                  </div>
                  {(modal === 'B2B' || modal === 'EXCLUSIVE') && (
                    <div>
                      <label className="block text-xs font-medium mb-1">
                        Описание проекта *
                      </label>
                      <textarea
                        rows={4}
                        value={project}
                        onChange={(e) => setProject(e.target.value)}
                        placeholder={
                          modal === 'EXCLUSIVE'
                            ? 'Для каких целей нужны исключительные права, бюджет, сроки…'
                            : 'Тип проекта, бюджет, территория, медиа…'
                        }
                        className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-white outline-none focus:ring-2 focus:ring-[var(--accent)] text-sm resize-none"
                      />
                    </div>
                  )}
                </div>
                <button
                  onClick={submit}
                  disabled={submitting}
                  className="w-full mt-5 px-6 py-3 rounded-full bg-[var(--text-primary)] text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity">
                  {submitting
                    ? 'Отправляем…'
                    : modal === 'PURCHASE'
                    ? 'Перейти к оплате'
                    : modal === 'B2B'
                    ? 'Отправить менеджеру'
                    : 'Запросить контакт автора'}
                </button>
                <p className="text-[11px] text-[var(--text-secondary)] mt-3 text-center">
                  {modal === 'PURCHASE'
                    ? 'После оплаты вы получите ссылку на скачивание и PDF лицензии на email.'
                    : modal === 'B2B'
                    ? 'Менеджер свяжется в течение 1 рабочего дня, обсудит условия и пришлёт счёт.'
                    : 'Платформа не участвует в сделке — только передаёт ваш запрос автору.'}
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
