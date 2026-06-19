'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { authStorage } from '@/app/lib/auth';

type Format = 'SOLO' | 'COLLECTIVE';
type Role = 'AUTHORIAL' | 'PERFORMING' | 'FULL_CREATIVE';
type PayeeType = 'LEGAL_ENTITY' | 'SOLE_PROP' | 'SELF_EMPLOYED';

const ROLES: { code: Role; title: string; tagline: string; bullets: string[]; for: string }[] = [
  {
    code: 'AUTHORIAL',
    title: 'Авторский',
    tagline: 'Я сочиняю музыку',
    bullets: [
      'Загружаю оригинальные произведения и ноты',
      'Получаю авторские отчисления',
    ],
    for: 'для композиторов и авторов песен',
  },
  {
    code: 'PERFORMING',
    title: 'Исполнительский',
    tagline: 'Я исполняю музыку других композиторов',
    bullets: [
      'Записываю каверы, указываю автора',
      'Получаю смежные права (исполнительские отчисления)',
    ],
    for: 'для оркестров, хоров, кавер-групп',
  },
  {
    code: 'FULL_CREATIVE',
    title: 'Полнотворческий',
    tagline: 'И сочиняю, и исполняю',
    bullets: [
      'Пишу и записываю свои песни',
      'Получаю и авторские, и смежные права',
    ],
    for: 'для рок-групп, фолк-ансамблей',
  },
];

export default function BecomeAuthorPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [format, setFormat] = useState<Format | null>(null);
  const [role, setRole] = useState<Role | null>(null);

  const [authChecked, setAuthChecked] = useState(false);
  const [needsLogin, setNeedsLogin] = useState(false);

  // form fields
  const [stageName, setStageName] = useState('');
  const [shortName, setShortName] = useState('');
  const [region, setRegion] = useState('');
  const [city, setCity] = useState('');
  const [bio, setBio] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [payeeType, setPayeeType] = useState<PayeeType | ''>('');
  const [legalName, setLegalName] = useState('');
  const [legalInn, setLegalInn] = useState('');
  const [legalKpp, setLegalKpp] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [bankName, setBankName] = useState('');
  const [agreeOffer, setAgreeOffer] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = authStorage.getToken();
    if (!token) {
      setNeedsLogin(true);
    }
    setAuthChecked(true);
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!format || !role) {
      setError('Выберите формат и роль');
      return;
    }
    if (!stageName.trim()) {
      setError('Укажите название');
      return;
    }
    if (!agreeOffer) {
      setError('Нужно согласие с лицензионным договором-офертой');
      return;
    }
    if (format === 'COLLECTIVE' && !payeeType) {
      setError('Выберите получателя выплат');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/artists/become-author', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authStorage.getToken() || ''}`,
        },
        body: JSON.stringify({
          format,
          role,
          stageName: stageName.trim(),
          shortName: shortName.trim() || undefined,
          region: region.trim() || undefined,
          city: city.trim() || undefined,
          bio: bio.trim() || undefined,
          contactEmail: contactEmail.trim() || undefined,
          contactPhone: contactPhone.trim() || undefined,
          payeeType: payeeType || undefined,
          legalName: legalName.trim() || undefined,
          legalInn: legalInn.trim() || undefined,
          legalKpp: legalKpp.trim() || undefined,
          accountNumber: accountNumber.trim() || undefined,
          bankName: bankName.trim() || undefined,
        }),
      });
      const j = await res.json();
      if (!j.success) {
        setError(j.error || 'Ошибка');
        return;
      }
      router.push('/author');
    } catch (err) {
      setError('Ошибка сети');
    } finally {
      setSubmitting(false);
    }
  };

  if (!authChecked) {
    return (
      <main className="min-h-screen pt-10 md:pt-14 pb-24 px-6 md:px-12 max-w-5xl mx-auto" />
    );
  }
  if (needsLogin) {
    return (
      <main className="min-h-screen pt-10 md:pt-14 pb-24 px-6 md:px-12 max-w-2xl mx-auto">
        <div className="apple-card p-10 text-center animate-fadeInUp">
          <h1 className="text-3xl font-bold tracking-tight mb-3">Войдите в аккаунт</h1>
          <p className="text-[var(--text-secondary)] mb-6">
            Чтобы стать автором на «Сонатум», нужно зайти в аккаунт или зарегистрироваться.
          </p>
          <div className="flex gap-3 justify-center">
            <Link
              href="/login"
              className="px-6 py-3 rounded-full bg-[var(--text-primary)] text-white font-medium hover:opacity-90 transition-opacity">
              Войти
            </Link>
            <Link
              href="/register"
              className="px-6 py-3 rounded-full bg-[var(--hover)] text-[var(--text-primary)] font-medium hover:bg-[var(--border)] transition-colors">
              Создать аккаунт
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen pt-10 md:pt-14 pb-24 px-6 md:px-12 max-w-5xl mx-auto">
      {/* Hero с фирменным градиентом */}
      <section
        className="relative rounded-3xl overflow-hidden p-8 md:p-12 text-white mb-8 md:mb-12"
        style={{
          background:
            'linear-gradient(135deg, #1d4cb8 0%, #2f9e8f 55%, #e6e6e6 100%)',
        }}>
        <div className="relative z-10 max-w-2xl">
          <div className="text-xs uppercase tracking-widest font-semibold mb-3 opacity-90">
            Стать автором
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-3 text-white">
            Загружайте свою музыку
          </h1>
          <p className="text-base md:text-lg text-white/85 max-w-xl">
            Публикуйте треки, продавайте лицензии и получайте отчисления за прослушивания на «Сонатум».
          </p>
        </div>
      </section>
      {/* Прогресс */}
      <div className="flex items-center justify-center gap-3 mb-8">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-3">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                step>= s
                  ? 'bg-[var(--text-primary)] text-white'
                  : 'bg-[var(--border)] text-[var(--text-secondary)]'
              }`}>
              {s}
            </div>
            {s < 3 && (
              <div
                className={`w-10 h-px transition-colors ${
                  step> s ? 'bg-[var(--text-primary)]' : 'bg-[var(--border)]'
                }`}
              />
            )}
          </div>
        ))}
      </div>
      {/* Шаг 1: Формат */}
      {step === 1 && (
        <section className="animate-fadeInUp">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-2 text-center">
            Кто вы?
          </h2>
          <p className="text-[var(--text-secondary)] text-center mb-8">
            Выберите формат вашего творческого проекта
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            <button
              onClick={() => setFormat('SOLO')}
              className={`text-left apple-card p-6 md:p-7 transition-all hover:scale-[1.01] ${
                format === 'SOLO' ? 'ring-2 ring-[var(--text-primary)]' : ''
              }`}>
              <h3 className="text-xl font-bold mb-2">Сольный проект</h3>
              <p className="text-sm text-[var(--text-secondary)] mb-4">
                Я — один артист, музыкант, композитор или исполнитель.
                Выступаю и публикуюсь под своим именем или псевдонимом.
              </p>
              <ul className="space-y-1.5 text-sm text-[var(--text-primary)]">
                <li>· Индивидуальный профиль</li>
                <li>· Личные выплаты на карту (СБП)</li>
                <li>· Персональная статистика</li>
              </ul>
              <p className="text-xs text-[var(--text-secondary)] mt-4">
                Только для самозанятых
              </p>
            </button>
            <button
              onClick={() => setFormat('COLLECTIVE')}
              className={`text-left apple-card p-6 md:p-7 transition-all hover:scale-[1.01] ${
                format === 'COLLECTIVE' ? 'ring-2 ring-[var(--text-primary)]' : ''
              }`}>
              <h3 className="text-xl font-bold mb-2">Коллектив</h3>
              <p className="text-sm text-[var(--text-secondary)] mb-4">
                Мы — группа, оркестр, ансамбль, хор или творческое
                объединение. У нас есть название, выступаем вместе.
              </p>
              <ul className="space-y-1.5 text-sm text-[var(--text-primary)]">
                <li>· Единый профиль коллектива</li>
                <li>· Выплаты на счёт организации или представителя</li>
                <li>· Управление составом участников</li>
              </ul>
              <p className="text-xs text-[var(--text-secondary)] mt-4">
                Юрлицо, ИП или представитель-самозанятый
              </p>
            </button>
          </div>
          <div className="flex justify-end mt-8">
            <button
              disabled={!format}
              onClick={() => setStep(2)}
              className="px-8 py-3 rounded-full bg-[var(--text-primary)] text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity">
              Дальше
            </button>
          </div>
        </section>
      )}

      {/* Шаг 2: Роль */}
      {step === 2 && (
        <section className="animate-fadeInUp">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-2 text-center">
            Что вы делаете?
          </h2>
          <p className="text-[var(--text-secondary)] text-center mb-8">
            Выберите вашу творческую роль
          </p>
          <div className="grid md:grid-cols-3 gap-4">
            {ROLES.map((r) => (
              <button
                key={r.code}
                onClick={() => setRole(r.code)}
                className={`text-left apple-card p-6 transition-all hover:scale-[1.01] ${
                  role === r.code ? 'ring-2 ring-[var(--text-primary)]' : ''
                }`}>
                <h3 className="text-lg font-bold mb-1">{r.title}</h3>
                <p className="text-sm text-[var(--text-secondary)] mb-3">{r.tagline}</p>
                <ul className="space-y-1.5 text-sm text-[var(--text-primary)] mb-4">
                  {r.bullets.map((b, i) => (
                    <li key={i}>· {b}</li>
                  ))}
                </ul>
                <p className="text-xs text-[var(--text-secondary)]">{r.for}</p>
              </button>
            ))}
          </div>
          <div className="flex justify-between mt-8">
            <button
              onClick={() => setStep(1)}
              className="px-6 py-3 rounded-full bg-[var(--hover)] text-[var(--text-primary)] font-medium hover:bg-[var(--border)] transition-colors">
              Назад
            </button>
            <button
              disabled={!role}
              onClick={() => setStep(3)}
              className="px-8 py-3 rounded-full bg-[var(--text-primary)] text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity">
              Дальше
            </button>
          </div>
        </section>
      )}

      {/* Шаг 3: Данные */}
      {step === 3 && (
        <section className="animate-fadeInUp">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-2 text-center">
            Расскажите о себе
          </h2>
          <p className="text-[var(--text-secondary)] text-center mb-8">
            {format === 'SOLO'
              ? 'Заполните данные сольного проекта'
              : 'Заполните данные коллектива'}
          </p>
          <form onSubmit={submit} className="apple-card p-6 md:p-8 max-w-2xl mx-auto space-y-5">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 text-sm text-red-600">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1.5">
                {format === 'SOLO' ? 'Сценическое имя' : 'Название коллектива'} *
              </label>
              <input
                type="text"
                value={stageName}
                onChange={(e) => setStageName(e.target.value)}
                placeholder={format === 'SOLO' ? 'Иван Соколов / Soko' : 'Хор Аметист'}
                className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-white outline-none focus:ring-2 focus:ring-[var(--accent)] text-sm"
                required
              />
            </div>
            {format === 'COLLECTIVE' && (
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Сокращённое название
                </label>
                <input
                  type="text"
                  value={shortName}
                  onChange={(e) => setShortName(e.target.value)}
                  placeholder="Аметист"
                  className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-white outline-none focus:ring-2 focus:ring-[var(--accent)] text-sm"
                />
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1.5">Регион</label>
                <input
                  type="text"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  placeholder="Тульская область"
                  className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-white outline-none focus:ring-2 focus:ring-[var(--accent)] text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Город</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Тула"
                  className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-white outline-none focus:ring-2 focus:ring-[var(--accent)] text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Краткая биография</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={4}
                placeholder="О вашем творчестве, опыте, стиле…"
                className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-white outline-none focus:ring-2 focus:ring-[var(--accent)] text-sm resize-none"
              />
            </div>
            {format === 'COLLECTIVE' && (
              <>
                <div className="pt-2 border-t border-[var(--border)]">
                  <h3 className="text-base font-semibold mb-3">Получатель выплат</h3>
                  <p className="text-xs text-[var(--text-secondary)] mb-3">
                    Все доходы коллектива поступают одному получателю. Платформа не распределяет деньги между участниками — это внутренняя задача коллектива.
                  </p>
                  <div className="grid gap-2">
                    {[
                      { v: 'LEGAL_ENTITY', l: 'Юридическое лицо', disabled: true },
                      { v: 'SOLE_PROP', l: 'ИП', disabled: true },
                      { v: 'SELF_EMPLOYED', l: 'Самозанятый-представитель', disabled: false },
                    ].map((o) => (
                      <label
                        key={o.v}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors ${
                          o.disabled
                            ? 'border-[var(--border)] opacity-60 cursor-not-allowed'
                            : payeeType === o.v
                              ? 'border-[var(--text-primary)] bg-[var(--hover)] cursor-pointer'
                              : 'border-[var(--border)] hover:bg-[var(--hover)] cursor-pointer'
                        }`}>
                        <input
                          type="radio"
                          name="payee"
                          disabled={o.disabled}
                          checked={payeeType === o.v}
                          onChange={() => !o.disabled && setPayeeType(o.v as PayeeType)}
                          className="accent-[var(--text-primary)]"
                        />
                        <span className="text-sm flex-1">{o.l}</span>
                        {o.disabled && (
                          <span className="text-[10px] text-[var(--text-secondary)]">скоро</span>
                        )}
                      </label>
                    ))}
                  </div>
                </div>
                {(payeeType === 'LEGAL_ENTITY' || payeeType === 'SOLE_PROP') && (
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium mb-1.5">
                        Название организации *
                      </label>
                      <input
                        type="text"
                        value={legalName}
                        onChange={(e) => setLegalName(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-white outline-none focus:ring-2 focus:ring-[var(--accent)] text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5">ИНН *</label>
                      <input
                        type="text"
                        value={legalInn}
                        onChange={(e) => setLegalInn(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-white outline-none focus:ring-2 focus:ring-[var(--accent)] text-sm"
                      />
                    </div>
                    {payeeType === 'LEGAL_ENTITY' && (
                      <div>
                        <label className="block text-sm font-medium mb-1.5">КПП</label>
                        <input
                          type="text"
                          value={legalKpp}
                          onChange={(e) => setLegalKpp(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-white outline-none focus:ring-2 focus:ring-[var(--accent)] text-sm"
                        />
                      </div>
                    )}
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium mb-1.5">
                        Расчётный счёт
                      </label>
                      <input
                        type="text"
                        value={accountNumber}
                        onChange={(e) => setAccountNumber(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-white outline-none focus:ring-2 focus:ring-[var(--accent)] text-sm"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium mb-1.5">Банк</label>
                      <input
                        type="text"
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-white outline-none focus:ring-2 focus:ring-[var(--accent)] text-sm"
                      />
                    </div>
                  </div>
                )}

                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">
                      Контактный email
                    </label>
                    <input
                      type="email"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-white outline-none focus:ring-2 focus:ring-[var(--accent)] text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">
                      Контактный телефон
                    </label>
                    <input
                      type="tel"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-white outline-none focus:ring-2 focus:ring-[var(--accent)] text-sm"
                    />
                  </div>
                </div>
              </>
            )}

            <label className="flex items-start gap-3 cursor-pointer pt-2">
              <input
                type="checkbox"
                checked={agreeOffer}
                onChange={(e) => setAgreeOffer(e.target.checked)}
                className="mt-1 accent-[var(--text-primary)]"
              />
              <span className="text-sm text-[var(--text-secondary)]">
                Я согласен с{' '}
                <Link
                  href="/legal/author-offer"
                  className="underline text-[var(--text-primary)]">
                  Лицензионным договором-офертой для авторов
                </Link>{' '}
                и подтверждаю, что обладаю правами на размещаемые произведения.
              </span>
            </label>
            <div className="flex justify-between pt-4 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-6 py-3 rounded-full bg-[var(--hover)] text-[var(--text-primary)] font-medium hover:bg-[var(--border)] transition-colors">
                Назад
              </button>
              <button
                type="submit"
                disabled={submitting || !stageName.trim() || !agreeOffer}
                className="px-8 py-3 rounded-full bg-[var(--text-primary)] text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity">
                {submitting ? 'Создаём…' : 'Создать профиль автора'}
              </button>
            </div>
          </form>
        </section>
      )}
    </main>
  );
}
