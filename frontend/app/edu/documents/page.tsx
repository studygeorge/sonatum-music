'use client';

import { useEffect, useState } from 'react';
import { authStorage } from '@/app/lib/auth';

type Doc = {
  kind: 'CONTRACT' | 'INVOICE' | 'ACT';
  title: string;
  description: string;
  number: string;
  issuedAt: string | null;
  downloadUrl: string;
};

type DocRequest = {
  id: string;
  periodFrom: string;
  periodTo: string;
  contactEmail: string;
  comment: string | null;
  status: 'PENDING' | 'SENT' | 'REJECTED';
  createdAt: string;
  fulfilledAt: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'В обработке',
  SENT: 'Отправлено',
  REJECTED: 'Отклонено',
};

export default function EduDocumentsPage() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [requests, setRequests] = useState<DocRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

  const [periodFrom, setPeriodFrom] = useState(monthAgo);
  const [periodTo, setPeriodTo] = useState(today);
  const [contactEmail, setContactEmail] = useState('');
  const [comment, setComment] = useState('');

  const token = () => authStorage.getToken() || '';

  const load = () => {
    setLoading(true);
    fetch('/api/edu/documents', { headers: { Authorization: `Bearer ${token()}` } })
      .then((r) => r.json())
      .then((j) => {
        if (j.success) {
          setDocs(j.data.documents);
          setRequests(j.data.requests);
        } else {
          setError(j.error || 'Ошибка загрузки');
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const submitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setBanner(null);
    try {
      const r = await fetch('/api/edu/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ periodFrom, periodTo, contactEmail: contactEmail || undefined, comment }),
      });
      const j = await r.json();
      if (j.success) {
        setBanner(j.message);
        setComment('');
        load();
      } else {
        setError(j.error || 'Не удалось отправить запрос');
      }
    } catch (e: any) {
      setError(e?.message || 'Ошибка сети');
    } finally {
      setSubmitting(false);
    }
  };

  const downloadDoc = async (url: string, filename: string) => {
    try {
      const r = await fetch(url, { headers: { Authorization: `Bearer ${token()}` } });
      if (!r.ok) { setError('Не удалось скачать документ'); return; }
      const blob = await r.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e: any) {
      setError(e?.message || 'Ошибка');
    }
  };

  return (
    <div className="space-y-6 animate-fadeInUp">
      <section
        className="relative rounded-3xl overflow-hidden p-7 md:p-10 text-white"
        style={{ background: 'linear-gradient(135deg, #1d4cb8 0%, #2f9e8f 55%, #e6e6e6 100%)' }}>
        <div className="relative z-10 max-w-2xl">
          <div className="text-xs uppercase tracking-widest font-semibold mb-2 opacity-90">Кабинет</div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">Документы</h1>
          <p className="text-sm md:text-base text-white/85 mt-2">
            Лицензионный договор, счета и акты оказанных услуг.
          </p>
        </div>
      </section>

      {banner && <div className="apple-card p-4 text-sm">{banner}</div>}
      {error && <div className="apple-card p-4 text-sm border border-black">{error}</div>}

      {/* Постоянные документы */}
      <section className="apple-card p-6 md:p-8">
        <h2 className="text-xl font-bold tracking-tight mb-1">Основные документы</h2>
        <p className="text-sm text-[var(--text-secondary)] mb-4">
          Подготовленные на основе ваших реквизитов и текущей лицензии.
        </p>
        {loading ? (
          <p className="text-sm text-[var(--text-secondary)]">Загрузка…</p>
        ) : (
          <div className="space-y-3">
            {docs.map((d) => (
              <div key={d.kind} className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-2xl border border-[var(--border)] bg-white">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm">
                    {d.title} <span className="text-[var(--text-secondary)]">№ {d.number}</span>
                  </div>
                  <div className="text-xs text-[var(--text-secondary)] mt-0.5 leading-snug">{d.description}</div>
                  {d.issuedAt && (
                    <div className="text-[11px] text-[var(--text-secondary)] mt-1">
                      выпущен {new Date(d.issuedAt).toLocaleDateString('ru-RU')}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => downloadDoc(d.downloadUrl, `sonatum-${d.kind.toLowerCase()}-${d.number}.pdf`)}
                  className="px-4 py-2 rounded-full bg-[var(--text-primary)] text-white text-xs font-medium whitespace-nowrap"
                >
                  Скачать PDF
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Запрос закрывающих за период */}
      <section className="apple-card p-6 md:p-8">
        <h2 className="text-xl font-bold tracking-tight mb-1">Запросить закрывающие за период</h2>
        <p className="text-sm text-[var(--text-secondary)] mb-4">
          Мы подготовим пакет (счёт, акт, договор при необходимости) за выбранный период
          и отправим на указанный email в течение 3 рабочих дней.
        </p>
        <form onSubmit={submitRequest} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5 block">С даты</span>
              <input type="date" value={periodFrom} onChange={(e) => setPeriodFrom(e.target.value)} required
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[var(--border)] focus:border-black focus:outline-none text-sm" />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5 block">По дату</span>
              <input type="date" value={periodTo} onChange={(e) => setPeriodTo(e.target.value)} required
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[var(--border)] focus:border-black focus:outline-none text-sm" />
            </label>
          </div>
          <label className="block">
            <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5 block">Email для отправки</span>
            <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)}
              placeholder="Оставьте пустым, чтобы использовать контактный email учреждения"
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[var(--border)] focus:border-black focus:outline-none text-sm" />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5 block">Комментарий (необязательно)</span>
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3}
              placeholder="Например: нужен оригинальный экземпляр с подписью"
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[var(--border)] focus:border-black focus:outline-none text-sm resize-none" />
          </label>
          <button type="submit" disabled={submitting}
            className="px-5 py-2.5 rounded-full bg-[var(--text-primary)] text-white text-sm font-medium disabled:opacity-60">
            {submitting ? 'Отправляем…' : 'Отправить запрос'}
          </button>
        </form>
      </section>

      {/* История запросов */}
      {requests.length > 0 && (
        <section className="apple-card p-6 md:p-8">
          <h2 className="text-xl font-bold tracking-tight mb-4">История запросов</h2>
          <div className="space-y-3">
            {requests.map((r) => (
              <div key={r.id} className="p-4 rounded-2xl border border-[var(--border)] bg-white">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-semibold text-sm">
                    {new Date(r.periodFrom).toLocaleDateString('ru-RU')} — {new Date(r.periodTo).toLocaleDateString('ru-RU')}
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-black/5 text-[var(--text-primary)]">
                    {STATUS_LABEL[r.status] || r.status}
                  </span>
                </div>
                <div className="text-xs text-[var(--text-secondary)] mt-1">
                  Email: {r.contactEmail} · создан {new Date(r.createdAt).toLocaleString('ru-RU')}
                </div>
                {r.comment && (
                  <div className="text-xs mt-2 text-[var(--text-secondary)]">«{r.comment}»</div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
