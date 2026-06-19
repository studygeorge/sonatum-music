'use client';

import { useEffect, useState } from 'react';
import { authStorage } from '@/app/lib/auth';

type Method = 'TBANK_CARD_NEW' | 'TBANK_CARD_EXISTING' | 'OTHER_BANK';

type SeData = {
  user: { id: string; firstName: string; lastName: string; email: string; balance: number };
  selfEmployed: {
    status: 'NOT_REGISTERED' | 'DRAFT' | 'ACTIVE' | 'SUSPENDED' | 'REJECTED' | 'UNKNOWN';
    recipientId?: string;
    method?: Method;
    cardHolder?: boolean;
    accountNumber?: string;
    fullName?: string;
    inn?: string;
  };
  tbankMock: boolean;
};

const STATUS_LABEL: Record<string, { l: string; c: string }> = {
  NOT_REGISTERED: { l: 'Не подключено', c: 'bg-[var(--hover)] text-[var(--text-secondary)]' },
  DRAFT:          { l: 'Ожидает подтверждения от Т-Банка', c: 'bg-[var(--hover)] text-[var(--text-primary)] border border-[var(--text-primary)]' },
  ACTIVE:         { l: 'Активно', c: 'bg-[var(--text-primary)] text-white' },
  SUSPENDED:      { l: 'Приостановлено', c: 'bg-white text-[var(--text-primary)] border border-[var(--text-primary)]' },
  REJECTED:       { l: 'Отклонено', c: 'bg-white text-[var(--text-primary)] border border-[var(--text-primary)]' },
  UNKNOWN:        { l: 'Проверяем…', c: 'bg-[var(--hover)] text-[var(--text-secondary)]' },
};

export default function PayoutSetupPage() {
  const [data, setData] = useState<SeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [method, setMethod] = useState<Method>('TBANK_CARD_NEW');
  const [fullName, setFullName] = useState('');
  const [inn, setInn] = useState('');
  const [account, setAccount] = useState('');
  const [bik, setBik] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [okMsg, setOkMsg] = useState('');

  const load = () => {
    setLoading(true);
    fetch('/api/author/payout/self-employed', {
      headers: { Authorization: `Bearer ${authStorage.getToken()}` },
    })
      .then((r) => r.json())
      .then((j) => {
        if (j.success) {
          setData(j.data);
          if (j.data.selfEmployed.method) setMethod(j.data.selfEmployed.method);
          if (j.data.selfEmployed.fullName) setFullName(j.data.selfEmployed.fullName);
          if (j.data.selfEmployed.inn) setInn(j.data.selfEmployed.inn);
          if (j.data.selfEmployed.bik) setBik(j.data.selfEmployed.bik);
        }
      })
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(''); setOkMsg(''); setBusy(true);
    try {
      const r = await fetch('/api/author/payout/self-employed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStorage.getToken()}` },
        body: JSON.stringify({ method, fullName: fullName.trim(), inn: inn.trim(), accountNumber: account.trim(), bik: bik.trim() }),
      });
      const j = await r.json();
      if (j.success) {
        setOkMsg(j.data?.nextStep || 'Заявка отправлена');
        load();
      } else setErr(j.error || 'Ошибка');
    } finally { setBusy(false); }
  };

  const refresh = async () => {
    setBusy(true);
    try {
      await fetch('/api/author/payout/self-employed', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${authStorage.getToken()}` },
      });
      load();
    } finally { setBusy(false); }
  };

  if (loading || !data) {
    return <div className="apple-card p-10 text-center text-sm text-[var(--text-secondary)]">Загрузка…</div>;
  }

  const se = data.selfEmployed;
  const isActive = se.status === 'ACTIVE';
  const isDraft = se.status === 'DRAFT';
  const isConfigured = !!se.method && !!se.fullName && !!se.accountNumber;

  return (
    <div className="space-y-6">
      <section
        className="relative rounded-3xl overflow-hidden p-7 md:p-10 flex items-end justify-between gap-4 flex-wrap"
        style={{ background: 'linear-gradient(135deg, #1d4cb8 0%, #2f9e8f 55%, #e6e6e6 100%)' }}>
        <div className="relative z-10 max-w-xl">
          <div className="text-xs uppercase tracking-widest font-semibold mb-2 text-white/90">
            Выплаты самозанятым
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">Подключение выплат</h1>
          <p className="text-sm md:text-base text-white/90 mt-2 max-w-lg">
            Сонатум перечисляет вознаграждение через Т-Банк. По закону вы должны быть зарегистрированы как самозанятый в «Мой налог».
          </p>
        </div>
      </section>

      {/* Текущий статус */}
      <div className="apple-card p-5 md:p-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="text-xs uppercase tracking-widest font-bold text-[var(--text-secondary)]">Статус</div>
            <div className="flex items-center gap-2 mt-1">
              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_LABEL[se.status].c}`}>
                {STATUS_LABEL[se.status].l}
              </span>
              {data.tbankMock && (
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-[var(--hover)] text-[var(--text-secondary)]">
                  T-Bank API в режиме MOCK (нет токена)
                </span>
              )}
            </div>
            {se.fullName && (
              <div className="text-xs text-[var(--text-secondary)] mt-2">
                {se.fullName} · ИНН {se.inn} · счёт {se.accountNumber}
              </div>
            )}
          </div>
          {isConfigured && (
            <button onClick={refresh} disabled={busy}
              className="px-4 py-2 rounded-full bg-[var(--hover)] hover:bg-gray-200 text-sm font-medium disabled:opacity-50">
              {busy ? '…' : 'Проверить статус'}
            </button>
          )}
        </div>
        {isDraft && (
          <p className="text-xs text-[var(--text-secondary)] mt-3 leading-relaxed">
            Откройте приложение «Мой налог» → раздел «Партнёры» (или «Доступ к данным»). Там появится запрос от Т-Банка на получение ваших данных. Одобрите его — и через 15 минут статус сменится на «Активно». Если не появляется в течение часа — проверьте что статус самозанятого в «Мой налог» уже активен (новые регистрации обрабатываются ФНС до суток).
          </p>
        )}
        {isActive && se.cardHolder === false && (
          <p className="text-xs text-[var(--text-secondary)] mt-3 leading-relaxed">
            Вы получаете выплаты на карту другого банка. <b>Налог НПД 6% нужно платить самостоятельно</b> через «Мой налог». Если хотите чтобы налог удерживался автоматически — переключитесь на карту Т-Банка.
          </p>
        )}
      </div>

      {/* Форма (если не активно — даём перенастроить) */}
      {!isActive && (
        <form onSubmit={submit} className="apple-card p-6 md:p-8 space-y-5">
          <h2 className="text-2xl font-bold tracking-tight">Способ получения</h2>

          <div className="space-y-2">
            <MethodCard
              chosen={method === 'TBANK_CARD_NEW'}
              onClick={() => setMethod('TBANK_CARD_NEW')}
              badge="Рекомендуем"
              title="Выпустить карту Т-Банка"
              desc="Т-Банк бесплатно выпустит карту, сам зарегистрирует вас в «Мой налог», и будет автоматически удерживать НПД 6% — вам не нужно платить налог вручную."
              pros={['Налог удерживается автоматически', 'Чеки ФНС формируются сами', 'Карта бесплатная']}
            />
            <MethodCard
              chosen={method === 'TBANK_CARD_EXISTING'}
              onClick={() => setMethod('TBANK_CARD_EXISTING')}
              title="Уже есть карта Т-Банка"
              desc="Используем вашу действующую карту. Налог удерживается автоматически."
              pros={['Налог удерживается автоматически', 'Чеки ФНС формируются сами']}
            />
            <MethodCard
              chosen={method === 'OTHER_BANK'}
              onClick={() => setMethod('OTHER_BANK')}
              title="Карта другого банка"
              desc="Получайте на счёт любого банка. Самозанятость нужно зарегистрировать самостоятельно в «Мой налог»."
              pros={['Любой банк']}
              cons={['НПД 6% платите сами через «Мой налог»', 'Чеки формируете самостоятельно']}
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">ФИО полностью</label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Иванов Иван Иванович"
                required
                className="w-full p-3 rounded-xl border border-[var(--border)] bg-white text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">ИНН (12 цифр)</label>
              <input
                value={inn}
                onChange={(e) => setInn(e.target.value.replace(/\D/g, '').slice(0, 12))}
                placeholder="123456789012"
                required
                inputMode="numeric"
                className="w-full p-3 rounded-xl border border-[var(--border)] bg-white text-sm"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
                {method === 'OTHER_BANK' ? 'Номер счёта (20 цифр)' : 'Номер карты или счёта'}
              </label>
              <input
                value={account}
                onChange={(e) => setAccount(e.target.value.replace(/\s/g, ''))}
                placeholder="4081 7810 ..."
                required
                inputMode="numeric"
                className="w-full p-3 rounded-xl border border-[var(--border)] bg-white text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
                БИК банка (9 цифр)
              </label>
              <input
                value={bik}
                onChange={(e) => setBik(e.target.value.replace(/\D/g, '').slice(0, 9))}
                placeholder="044525974"
                required
                inputMode="numeric"
                className="w-full p-3 rounded-xl border border-[var(--border)] bg-white text-sm"
              />
              <p className="text-[10px] text-[var(--text-secondary)] mt-1">9 цифр БИК вашего банка. Тинькофф: 044525974, Сбер: 044525225</p>
            </div>
          </div>

          {err && <div className="apple-card p-3 bg-[var(--hover)] text-sm">{err}</div>}
          {okMsg && <div className="apple-card p-3 text-sm" style={{ borderColor: '#1c1c1e' }}>{okMsg}</div>}

          <button type="submit" disabled={busy} className="apple-button">
            {busy ? 'Отправляем…' : isConfigured ? 'Обновить данные' : 'Подключить выплаты'}
          </button>
        </form>
      )}

      {/* Инструкция */}
      <div className="apple-card p-6 md:p-8">
        <h2 className="text-xl font-bold mb-4">Как это работает</h2>
        <ol className="space-y-3 text-sm">
          <Step n={1} title="Регистрация в «Мой налог»">
            Если вы ещё не самозанятый — зарегистрируйтесь в приложении «Мой налог» (потребуются паспорт и ИНН). При способе «Карта Т-Банка» этот шаг банк сделает за вас.
          </Step>
          <Step n={2} title="Реквизиты на платформе">
            Заполните форму выше: ФИО, ИНН и номер счёта/карты.
          </Step>
          <Step n={3} title="Подтверждение от банка">
            На ваш номер придёт SMS-ссылка от Т-Банка. Перейдите по ней и подтвердите статус. Это нужно сделать один раз.
          </Step>
          <Step n={4} title="Первая выплата">
            Когда баланс достигнет 1 000 ₽, нажмите «Запросить выплату» на странице «Финансы».
            {' '}{ /* taxHolding note */ }
            Если у вас карта Т-Банка, налог НПД 6% будет удержан автоматически — вы получите чистую сумму.
          </Step>
          <Step n={5} title="Чек">
            Чек ФНС придёт вам на почту и сохранится в истории выплат.
          </Step>
        </ol>
      </div>
    </div>
  );
}

function MethodCard({
  chosen, onClick, badge, title, desc, pros, cons,
}: {
  chosen: boolean; onClick: () => void;
  badge?: string; title: string; desc: string;
  pros?: string[]; cons?: string[];
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left p-4 rounded-2xl border transition-colors ${
        chosen
          ? 'border-[var(--text-primary)] bg-[var(--hover)]'
          : 'border-[var(--border)] bg-white hover:border-[var(--text-primary)]'
      }`}>
      <div className="flex items-center gap-2 mb-1">
        <input type="radio" readOnly checked={chosen} className="accent-[var(--text-primary)]" />
        <span className="font-semibold text-sm">{title}</span>
        {badge && <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--text-primary)] text-white font-semibold">{badge}</span>}
      </div>
      <p className="text-xs text-[var(--text-secondary)] leading-snug mb-2 ml-6">{desc}</p>
      {pros && pros.length > 0 && (
        <ul className="ml-6 text-[11px] space-y-0.5">
          {pros.map((p, i) => (
            <li key={i} className="text-[var(--text-secondary)]">✓ {p}</li>
          ))}
          {cons?.map((c, i) => (
            <li key={i} className="text-[var(--text-secondary)]">{c}</li>
          ))}
        </ul>
      )}
    </button>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <div className="w-7 h-7 rounded-full bg-[var(--text-primary)] text-white flex items-center justify-center text-xs font-bold shrink-0">{n}</div>
      <div className="flex-1">
        <div className="font-semibold text-sm">{title}</div>
        <div className="text-xs text-[var(--text-secondary)] mt-0.5 leading-relaxed">{children}</div>
      </div>
    </li>
  );
}
