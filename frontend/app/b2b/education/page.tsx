'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';

export default function EducationPage() {
  const [fullName, setFullName] = useState('');
  const [shortName, setShortName] = useState('');
  const [inn, setInn] = useState('');
  const [legalAddress, setLegalAddress] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactRole, setContactRole] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [teacherCount, setTeacherCount] = useState<number>(10);
  const [studentCount, setStudentCount] = useState<number>(100);
  const [withSheets, setWithSheets] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<{ id: string; fee: number; message: string } | null>(null);

  // Расчёт стоимости на клиенте (синхронен с backend)
  const calculateFee = () => {
    let total = 25000;
    if (teacherCount> 10) total += (teacherCount - 10) * 1500;
    if (studentCount> 100) total += Math.floor((studentCount - 100) / 100) * 10000;
    if (withSheets) total += 10000;
    return total;
  };
  const fee = calculateFee();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!fullName.trim() || !contactName.trim() || !contactEmail.trim()) {
      setError('Заполните название, контактное лицо и email');
      return;
    }
    setSubmitting(true);
    try {
      const r = await fetch('/api/edu-institutions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName,
          shortName,
          inn,
          legalAddress,
          contactName,
          contactRole,
          contactEmail,
          contactPhone,
          teacherCount,
          studentCount,
          withSheets,
        }),
      });
      const j = await r.json();
      if (!j.success) {
        setError(j.error || 'Ошибка');
        return;
      }
      setSuccess({ id: j.id, fee: j.annualFee, message: j.message });
    } catch (e: any) {
      setError(e?.message || 'Ошибка сети');
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <main className="min-h-screen pt-14 pb-24 px-6 max-w-2xl mx-auto">
        <div className="apple-card p-10 text-center animate-fadeInUp">
                    <h1 className="text-3xl font-bold tracking-tight mb-3">Заявка отправлена</h1>
          <p className="text-[var(--text-secondary)] mb-4">{success.message}</p>
          <div className="rounded-2xl border border-[var(--border)] bg-white p-4 bg-[var(--hover)] inline-block mb-6">
            <div className="text-xs text-[var(--text-secondary)]">Предварительная стоимость</div>
            <div className="text-3xl font-black tabular-nums">{success.fee.toLocaleString('ru-RU')} ₽/год</div>
          </div>
          <div>
            <Link
              href="/"
              className="px-6 py-3 rounded-full bg-[var(--text-primary)] text-white font-medium inline-block">
              На главную
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen pt-10 md:pt-14 pb-24 px-6 md:px-12 max-w-5xl mx-auto">
      <section
        className="relative rounded-3xl overflow-hidden p-8 md:p-12 text-white mb-8 md:mb-12"
        style={{ background: 'linear-gradient(135deg, #1d4cb8 0%, #d52b1e 55%, #e6e6e6 100%)' }}>
        <div className="relative z-10 max-w-2xl">
          <div className="text-xs uppercase tracking-widest font-semibold mb-3 opacity-90">
            Учебным заведениям
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-3 text-white">
            Музыка для образования
          </h1>
          <p className="text-base md:text-lg text-white/85 max-w-xl">
            Музыкальные школы, колледжи искусств, консерватории, вузы — годовой доступ к каталогу для преподавателей и студентов.
          </p>
        </div>
      </section>
      <section className="grid md:grid-cols-2 gap-6 mb-10">
        <div className="apple-card p-6">
          <h2 className="text-xl font-bold tracking-tight mb-3">Что входит</h2>
          <ul className="space-y-2 text-sm">
            {[
              'Полный доступ к каталогу для преподавателей и студентов',
              'Ноты и тексты всех произведений',
              'Учебные плейлисты и методические материалы',
              'Управление пользователями (добавление/удаление)',
              'Статистика использования',
              'Закрывающие документы за период',
            ].map((line, i) => (
              <li key={i} className="flex items-start gap-2">
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="apple-card p-6">
          <h2 className="text-xl font-bold tracking-tight mb-3">Стоимость</h2>
          <p className="text-sm text-[var(--text-secondary)] mb-4">
            Базовая лицензия для учебного заведения — от 25 000 ₽/год.
          </p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Базовая лицензия (до 10 преподавателей, до 100 учащихся)</span>
              <span className="font-semibold tabular-nums">25 000 ₽</span>
            </div>
            <div className="flex justify-between text-[var(--text-secondary)]">
              <span>Каждый доп. преподаватель</span>
              <span className="tabular-nums">+1 500 ₽</span>
            </div>
            <div className="flex justify-between text-[var(--text-secondary)]">
              <span>Каждые +100 учащихся</span>
              <span className="tabular-nums">+10 000 ₽</span>
            </div>
            <div className="flex justify-between text-[var(--text-secondary)]">
              <span>Доступ к нотам</span>
              <span className="tabular-nums">+10 000 ₽</span>
            </div>
          </div>
        </div>
      </section>
      <form onSubmit={submit} className="apple-card p-6 md:p-8 space-y-5">
        <h2 className="text-2xl font-bold tracking-tight">Заявка на подключение</h2>
        <div className="space-y-3">
          <h3 className="font-semibold text-sm text-[var(--text-secondary)] uppercase tracking-wider">
            Данные организации
          </h3>
          <div>
            <label className="block text-sm font-medium mb-1.5">Полное наименование *</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-white text-sm"
              required
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1.5">Сокращённое название</label>
              <input
                type="text"
                value={shortName}
                onChange={(e) => setShortName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-white text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">ИНН</label>
              <input
                type="text"
                value={inn}
                onChange={(e) => setInn(e.target.value.replace(/\D/g, '').slice(0, 12))}
                className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-white text-sm tabular-nums"
                maxLength={12}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Юридический адрес</label>
            <input
              type="text"
              value={legalAddress}
              onChange={(e) => setLegalAddress(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-white text-sm"
            />
          </div>
        </div>
        <div className="space-y-3 pt-4 border-t border-[var(--border)]">
          <h3 className="font-semibold text-sm text-[var(--text-secondary)] uppercase tracking-wider">
            Объём подключения
          </h3>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1.5">Количество преподавателей</label>
              <input
                type="number"
                min={0}
                value={teacherCount}
                onChange={(e) => setTeacherCount(parseInt(e.target.value) || 0)}
                className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-white text-sm tabular-nums"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Количество учащихся</label>
              <input
                type="number"
                min={0}
                value={studentCount}
                onChange={(e) => setStudentCount(parseInt(e.target.value) || 0)}
                className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-white text-sm tabular-nums"
              />
            </div>
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={withSheets}
              onChange={(e) => setWithSheets(e.target.checked)}
              className="accent-[var(--text-primary)]"
            />
            <span className="text-sm">Нужен доступ к нотам (PDF)</span>
          </label>
          <div className="apple-card p-4 bg-[var(--hover)] flex items-baseline justify-between">
            <span className="text-sm text-[var(--text-secondary)]">Итого предварительно:</span>
            <span className="text-2xl font-black tabular-nums">{fee.toLocaleString('ru-RU')} ₽/год</span>
          </div>
        </div>
        <div className="space-y-3 pt-4 border-t border-[var(--border)]">
          <h3 className="font-semibold text-sm text-[var(--text-secondary)] uppercase tracking-wider">
            Контактное лицо
          </h3>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1.5">ФИО *</label>
              <input
                type="text"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-white text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Должность</label>
              <input
                type="text"
                value={contactRole}
                onChange={(e) => setContactRole(e.target.value)}
                placeholder="Директор / Зав. кафедрой / Завуч"
                className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-white text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Email *</label>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-white text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Телефон</label>
              <input
                type="tel"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-white text-sm"
              />
            </div>
          </div>
        </div>
        {error && (
          <div className="apple-card p-3 bg-red-50 border-red-200 text-sm text-red-600">{error}</div>
        )}

        <div className="flex justify-end pt-4 border-t border-[var(--border)]">
          <button
            type="submit"
            disabled={submitting}
            className="px-8 py-3 rounded-full bg-[var(--text-primary)] text-white font-medium disabled:opacity-40 hover:opacity-90">
            {submitting ? 'Отправляем…' : 'Отправить заявку'}
          </button>
        </div>
      </form>
    </main>
  );
}
