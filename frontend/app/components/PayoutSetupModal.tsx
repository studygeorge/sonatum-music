'use client';
import Portal from '@/app/components/Portal';

import { useEffect, useState } from 'react';
import { authStorage } from '@/app/lib/auth';

type Eligibility = {
  canSetupPayout: boolean;
  allConditionsMet: boolean;
  conditions: {
    accountAge: { ok: boolean; daysLeft: number; required: string; accountAgeDays: number };
    tracks: { ok: boolean; tracksLeft: number; required: string; publishedTracks: number };
    selfEmployed: { ok: boolean; required: string; hint: string };
  };
};

export default function PayoutSetupModal({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: () => void;
}) {
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0);
  const [tin, setTin] = useState('');
  const [sbpPhone, setSbpPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [eligibility, setEligibility] = useState<Eligibility | null>(null);
  const [loadingElig, setLoadingElig] = useState(true);

  useEffect(() => {
    fetch('/api/author/payout/eligibility', {
      headers: { Authorization: `Bearer ${authStorage.getToken() || ''}` },
    })
      .then((r) => r.json())
      .then((j) => { if (j.success) setEligibility(j.data); })
      .finally(() => setLoadingElig(false));
  }, []);

  const submit = async () => {
    setError('');
    setSubmitting(true);
    try {
      const r = await fetch('/api/author/payout/setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authStorage.getToken() || ''}`,
        },
        body: JSON.stringify({ tin: tin.trim(), sbpPhone: sbpPhone.trim() }),
      });
      const j = await r.json();
      if (!j.success) {
        setError(j.error || 'Ошибка');
        return;
      }
      onDone();
    } catch (e: any) {
      setError(e?.message || 'Ошибка сети');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Portal>
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/45 backdrop-blur-md"
      onClick={() => !submitting && onClose()}>
      <div
        className="apple-card max-w-lg w-full p-6 shadow-2xl animate-fadeInUp"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold tracking-tight">Подключение выплат</h3>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              {step === 0 ? 'Проверка условий' : `Шаг ${step} из 3`}
            </p>
          </div>
          <button onClick={onClose} className="text-2xl leading-none text-[var(--text-secondary)]">
            
          </button>
        </div>
        {/* Прогресс */}
        {step > 0 && (
          <div className="flex items-center justify-center gap-2 mb-5">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                    step >= s ? 'bg-[var(--text-primary)] text-white' : 'bg-[var(--border)] text-[var(--text-secondary)]'
                  }`}>
                  {s}
                </div>
                {s < 3 && (
                  <div className={`w-8 h-px ${step > s ? 'bg-[var(--text-primary)]' : 'bg-[var(--border)]'}`} />
                )}
              </div>
            ))}
          </div>
        )}

        {/* ШАГ 0: Eligibility — проверка условий из ТЗ */}
        {step === 0 && (
          <>
            {loadingElig ? (
              <p className="text-sm text-[var(--text-secondary)] py-6 text-center">Проверяем условия…</p>
            ) : !eligibility ? (
              <p className="text-sm text-red-600 py-6">Не удалось загрузить статус. Попробуйте позже.</p>
            ) : (
              <>
                <h4 className="font-semibold mb-1">Условия для подключения выплат</h4>
                <p className="text-sm text-[var(--text-secondary)] mb-4">
                  Чтобы выводить деньги, нужно выполнить 3 условия из правил платформы.
                </p>
                <ul className="space-y-3 mb-5">
                  <ConditionRow
                    ok={eligibility.conditions.accountAge.ok}
                    title="Возраст аккаунта ≥ 3 месяцев"
                    hint={eligibility.conditions.accountAge.ok
                      ? `Выполнено (${eligibility.conditions.accountAge.accountAgeDays} дней с регистрации)`
                      : `Осталось ~${Math.ceil(eligibility.conditions.accountAge.daysLeft / 30)} мес. (сейчас ${eligibility.conditions.accountAge.accountAgeDays} дней)`}
                  />
                  <ConditionRow
                    ok={eligibility.conditions.tracks.ok}
                    title="Не менее 3 опубликованных треков"
                    hint={eligibility.conditions.tracks.ok
                      ? `Выполнено (${eligibility.conditions.tracks.publishedTracks} треков)`
                      : `Осталось загрузить ещё ${eligibility.conditions.tracks.tracksLeft} (сейчас ${eligibility.conditions.tracks.publishedTracks})`}
                  />
                  <ConditionRow
                    ok={eligibility.conditions.selfEmployed.ok}
                    title="Статус самозанятого"
                    hint={eligibility.conditions.selfEmployed.ok
                      ? 'Подтверждён'
                      : eligibility.conditions.selfEmployed.hint}
                  />
                </ul>
                <div className="flex justify-end gap-2">
                  <button onClick={onClose} className="px-5 py-2.5 rounded-full bg-[var(--hover)] text-sm font-medium">
                    Закрыть
                  </button>
                  <button
                    onClick={() => setStep(1)}
                    disabled={!eligibility.canSetupPayout}
                    className="px-6 py-3 rounded-full bg-[var(--text-primary)] text-white font-medium text-sm disabled:opacity-40">
                    {eligibility.canSetupPayout ? 'Продолжить' : 'Сначала выполните условия'}
                  </button>
                </div>
              </>
            )}
          </>
        )}

        {step === 1 && (
          <>
            <h4 className="font-semibold mb-2">Подтверждение статуса самозанятого</h4>
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              Для получения выплат на платформе нужен статус самозанятого (НПД). Если у вас его ещё нет — зарегистрируйтесь в приложении «Мой налог» ФНС России.
            </p>
            <a
              href="https://npd.nalog.ru/app/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-[var(--accent)] hover:underline block mb-4">
               Как зарегистрироваться в приложении «Мой налог»
            </a>
            <div className="flex justify-end">
              <button
                onClick={() => setStep(2)}
                className="px-6 py-3 rounded-full bg-[var(--text-primary)] text-white font-medium text-sm hover:opacity-90">
                У меня уже есть статус
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h4 className="font-semibold mb-2">Ваш ИНН</h4>
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              Введите ИНН — мы используем его для отметки об оплате налогов (3% самозанятого с продаж физлицам, 6% с юрлиц).
            </p>
            <input
              type="text"
              value={tin}
              onChange={(e) => setTin(e.target.value.replace(/\D/g, '').slice(0, 12))}
              placeholder="000000000000"
              className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-white text-sm tabular-nums mb-4"
              maxLength={12}
            />
            <div className="flex justify-between">
              <button onClick={() => setStep(1)} className="px-5 py-2.5 rounded-full bg-[var(--hover)] text-sm font-medium">
                Назад
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={tin.length !== 12}
                className="px-6 py-3 rounded-full bg-[var(--text-primary)] text-white font-medium text-sm disabled:opacity-40">
                Дальше
              </button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h4 className="font-semibold mb-2">Реквизиты СБП</h4>
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              Номер телефона для перевода через СБП. На него будут поступать ваши выводы средств.
            </p>
            <input
              type="tel"
              value={sbpPhone}
              onChange={(e) => setSbpPhone(e.target.value)}
              placeholder="+79991234567"
              className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-white text-sm mb-4"
            />
            {error && (
              <div className="apple-card p-3 bg-red-50 border-red-200 text-sm text-red-600 mb-3">
                {error}
              </div>
            )}
            <p className="text-xs text-[var(--text-secondary)] mb-4">
              Подтверждая, я согласен, что данные соответствуют моему статусу самозанятого в приложении «Мой налог».
            </p>
            <div className="flex justify-between">
              <button onClick={() => setStep(2)} className="px-5 py-2.5 rounded-full bg-[var(--hover)] text-sm font-medium">
                Назад
              </button>
              <button
                onClick={submit}
                disabled={submitting || !sbpPhone}
                className="px-6 py-3 rounded-full bg-[var(--text-primary)] text-white font-medium text-sm disabled:opacity-40">
                {submitting ? 'Подключаем…' : 'Подключить выплаты'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
    </Portal>
  );
}

function ConditionRow({ ok, title, hint }: { ok: boolean; title: string; hint: string }) {
  return (
    <li className="flex items-start gap-3 p-3 rounded-xl border border-[var(--border)]">
      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
        ok ? 'bg-black text-white' : 'bg-white border-2 border-[var(--border)] text-[var(--text-secondary)]'
      }`}>
        {ok ? '✓' : '○'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm">{title}</div>
        <div className="text-xs text-[var(--text-secondary)] mt-0.5">{hint}</div>
      </div>
    </li>
  );
}
