'use client';

import { useEffect, useState } from 'react';
import { authStorage } from '@/app/lib/auth';

import Portal from "@/app/components/Portal";
type License = {
  code: string;
  name: string;
  shortName: string;
  audience: string;
  description: string;
  rightsAllowed: string[];
  rightsForbidden: string[];
  territory: string;
  price: number;
  commissionPct: number;
  isB2B: boolean;
  requiresManager: boolean;
  periodDays?: number | null;
};

// Расшифровка кодов прав в человеко-читаемый русский (ст. 1270 ГК РФ).
const RIGHT_LABEL: Record<string, string> = {
  communication: 'Доведение до всеобщего сведения (интернет)',
  sync_video: 'Синхронизация с видеоматериалами',
  sync_audio: 'Синхронизация с аудиоматериалами',
  reproduction_montage: 'Воспроизведение (копирование для монтажа)',
  reproduction_production: 'Воспроизведение (копирование для производства)',
  reproduction_recording: 'Воспроизведение (копирование для записи)',
  public_performance: 'Публичное исполнение (живьём, в учреждении)',
  public_performance_theatre: 'Публичное исполнение в театре',
  public_performance_education: 'Публичное исполнение в учебных целях',
  modification: 'Переработка (кавер, ремикс, аранжировка)',
  distribution: 'Распространение (продажа носителей)',
  distribution_own: 'Распространение собственной записи',
  broadcast: 'Сообщение в эфир / по кабелю (ТВ, радио)',
  ad_tv: 'Использование в рекламе на ТВ/радио',
  personal_use: 'Личное некоммерческое прослушивание',
  monetization: 'Монетизация (стриминги, продажа)',
  attribution_required: 'Обязательно указывать автора',
};

function labelRight(code: string): string {
  return RIGHT_LABEL[code] || code.replace(/_/g, ' ');
}

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
  const [phone, setPhone] = useState('');
  const [project, setProject] = useState('');
  const [projectType, setProjectType] = useState('');
  const [budget, setBudget] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [resultMessage, setResultMessage] = useState('');

  const PROJECT_TYPES = [
    { id: 'AD', label: 'Рекламный ролик' },
    { id: 'FILM', label: 'Фильм' },
    { id: 'SERIES', label: 'Сериал' },
    { id: 'GAME', label: 'Видеоигра' },
    { id: 'PODCAST', label: 'Подкаст' },
    { id: 'EVENT', label: 'Корпоративное мероприятие' },
    { id: 'PRESENTATION', label: 'Презентация' },
    { id: 'OTHER', label: 'Другое' },
  ];

  const BUDGETS = [
    { id: 'UNDER_10K', label: 'До 10 000 ₽' },
    { id: '10_30K', label: '10 000 — 30 000 ₽' },
    { id: '30_70K', label: '30 000 — 70 000 ₽' },
    { id: 'OVER_70K', label: 'Свыше 70 000 ₽' },
  ];

  useEffect(() => {
    fetch(`/api/tracks/${trackId}/licenses`)
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setLicenses(j.data || []);
      })
      .finally(() => setLoading(false));
  }, [trackId]);

  // Внешнее открытие модалки конкретной лицензии — используется на странице трека
  // для прямого «Купить минусовку» и других call-to-action.
  useEffect(() => {
    const onOpen = (e: Event) => {
      const code = (e as CustomEvent).detail?.code;
      const lic = licenses.find((l) => l.code === code);
      if (lic) openModal(lic);
    };
    window.addEventListener('sonatum:open-license', onOpen);
    return () => window.removeEventListener('sonatum:open-license', onOpen);
  }, [licenses]);

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
    if (!email.trim()) { setError('Укажите email'); return; }
    if (modal === 'B2B') {
      if (!name.trim()) { setError('Укажите ваше имя'); return; }
      if (!projectType) { setError('Выберите тип проекта'); return; }
      if (!budget) { setError('Выберите бюджет'); return; }
    }
    if (modal === 'EXCLUSIVE' && !project.trim()) {
      setError('Опишите ваше предложение автору');
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
          buyerPhone: phone.trim() || undefined,
          projectDescription: project.trim() || undefined,
          projectType: projectType || undefined,
          budget: budget || undefined,
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
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-black text-white">
                  B2B
                </span>
              )}
              {l.requiresManager && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white border border-black text-black">
                  через менеджера
                </span>
              )}
              {l.territory && l.territory !== 'Мир' && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--hover)] text-[var(--text-secondary)]">
                  {l.territory}
                </span>
              )}
              {l.periodDays && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-medium">
                  абонемент · {l.periodDays} дн.
                </span>
              )}
            </div>
            {l.audience && (
              <div className="text-[10px] text-[var(--text-secondary)] mt-2 leading-snug">
                {l.audience}
              </div>
            )}
          </button>
        ))}
      </div>
      {/* Modal */}
      {modal && activeLicense && (
<Portal>
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/45 backdrop-blur-md"
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
                <p className="text-sm text-[var(--text-secondary)] mb-3">
                  {activeLicense.description}
                </p>

                {/* Подробные права из ТЗ — что разрешено / что запрещено */}
                {(activeLicense.rightsAllowed.length > 0 || activeLicense.rightsForbidden.length > 0) && (
                  <div className="rounded-2xl bg-[var(--hover)] p-3 mb-4 text-xs">
                    {activeLicense.audience && (
                      <div className="mb-2">
                        <span className="font-bold text-[var(--text-primary)]">Для кого: </span>
                        <span className="text-[var(--text-secondary)]">{activeLicense.audience}</span>
                      </div>
                    )}
                    <div className="grid sm:grid-cols-2 gap-2">
                      {activeLicense.rightsAllowed.length > 0 && (
                        <div>
                          <div className="font-bold text-[var(--text-primary)] mb-1">Разрешено</div>
                          <ul className="space-y-0.5">
                            {activeLicense.rightsAllowed.map((r) => (
                              <li key={r} className="flex items-start gap-1.5">
                                <span className="text-[var(--text-primary)] mt-0.5">✓</span>
                                <span className="text-[var(--text-secondary)] leading-snug">{labelRight(r)}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {activeLicense.rightsForbidden.length > 0 && (
                        <div>
                          <div className="font-bold text-[var(--text-primary)] mb-1">Запрещено</div>
                          <ul className="space-y-0.5">
                            {activeLicense.rightsForbidden.map((r) => (
                              <li key={r} className="flex items-start gap-1.5">
                                <span className="text-[var(--text-primary)] mt-0.5">✗</span>
                                <span className="text-[var(--text-secondary)] leading-snug">{labelRight(r)}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                    <div className="mt-2 pt-2 border-t border-[var(--border)]">
                      <span className="font-bold text-[var(--text-primary)]">Территория: </span>
                      <span className="text-[var(--text-secondary)]">{activeLicense.territory}</span>
                    </div>
                    {activeLicense.periodDays && (
                      <div className="mt-2 pt-2 border-t border-[var(--border)]">
                        <span className="font-bold text-[var(--text-primary)]">Срок действия: </span>
                        <span className="text-[var(--text-secondary)]">
                          абонемент на {activeLicense.periodDays} дн. с момента оплаты — неограниченное количество исполнений
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {modal === 'EXCLUSIVE' && (
                  <div className="rounded-2xl border-2 border-black bg-[var(--hover)] p-3 mb-4">
                    <p className="text-xs text-[var(--text-primary)] leading-snug">
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
                  {modal === 'B2B' && (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-medium mb-1">Тип проекта *</label>
                          <select
                            value={projectType}
                            onChange={(e) => setProjectType(e.target.value)}
                            className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border)] bg-white outline-none focus:ring-2 focus:ring-[var(--accent)] text-sm">
                            <option value="">— выберите —</option>
                            {PROJECT_TYPES.map((p) => (
                              <option key={p.id} value={p.id}>{p.label}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1">Бюджет *</label>
                          <select
                            value={budget}
                            onChange={(e) => setBudget(e.target.value)}
                            className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border)] bg-white outline-none focus:ring-2 focus:ring-[var(--accent)] text-sm">
                            <option value="">— выберите —</option>
                            {BUDGETS.map((b) => (
                              <option key={b.id} value={b.id}>{b.label}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">Телефон</label>
                        <input
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="+7 ___ ___-__-__"
                          className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-white outline-none focus:ring-2 focus:ring-[var(--accent)] text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">Описание проекта</label>
                        <textarea
                          rows={3}
                          value={project}
                          onChange={(e) => setProject(e.target.value)}
                          placeholder="Что за проект, территория, срок использования, медиа…"
                          className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-white outline-none focus:ring-2 focus:ring-[var(--accent)] text-sm resize-none"
                        />
                      </div>
                    </>
                  )}
                  {modal === 'EXCLUSIVE' && (
                    <div>
                      <label className="block text-xs font-medium mb-1">
                        Ваше сообщение автору *
                      </label>
                      <textarea
                        rows={4}
                        value={project}
                        onChange={(e) => setProject(e.target.value)}
                        placeholder="Для каких целей нужны исключительные права, бюджет, сроки…"
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
</Portal>
      )}
    </section>
  );
}
