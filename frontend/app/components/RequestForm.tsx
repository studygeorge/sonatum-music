'use client';

import { useState } from 'react';

export type RequestField =
  | { kind: 'text'; name: string; label: string; required?: boolean; placeholder?: string }
  | { kind: 'email'; name: string; label: string; required?: boolean; placeholder?: string }
  | { kind: 'tel'; name: string; label: string; required?: boolean; placeholder?: string }
  | { kind: 'textarea'; name: string; label: string; required?: boolean; placeholder?: string };

type Props = {
  title: string;
  description?: string;
  fields: RequestField[];
  submitLabel?: string;
  /** Тип заявки для админки: B2B / ARTIST / COPYRIGHT / OTHER. */
  type?: 'B2B' | 'ARTIST' | 'COPYRIGHT' | 'OTHER';
  /** Endpoint API. По умолчанию /api/inquiries. null — без отправки (только подтверждение). */
  endpoint?: string | null;
};

export default function RequestForm({
  title,
  description,
  fields,
  submitLabel = 'Отправить заявку',
  type = 'OTHER',
  endpoint = '/api/inquiries',
}: Props) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (name: string, v: string) =>
    setValues(s => ({ ...s, [name]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (endpoint) {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type, payload: values }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || json?.success === false) {
          throw new Error(json?.error || 'Ошибка отправки');
        }
      }
      setDone(true);
    } catch (err: any) {
      setError(err?.message || 'Ошибка отправки');
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="apple-card p-8 md:p-10 text-center max-w-2xl mx-auto">
        <h2 className="text-2xl font-bold mb-3">Заявка отправлена</h2>
        <p className="text-[var(--text-secondary)]">
          Мы свяжемся с вами по указанным контактам в течение 1-3 рабочих дней.
        </p>
      </div>
    );
  }

  return (
    <div className="apple-card p-6 md:p-10 max-w-2xl mx-auto">
      <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-2">{title}</h2>
      {description && <p className="text-[var(--text-secondary)] mb-8">{description}</p>}

      <form className="space-y-5" onSubmit={submit}>
        {fields.map(f => (
          <div key={f.name}>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
              {f.label}
              {f.required && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            {f.kind === 'textarea' ? (
              <textarea
                required={f.required}
                value={values[f.name] || ''}
                onChange={e => set(f.name, e.target.value)}
                placeholder={f.placeholder}
                className="w-full p-3 rounded-xl border border-[var(--border)] bg-[var(--background)] focus:bg-white outline-none focus:ring-2 focus:ring-[var(--accent)] min-h-[120px]"
              />
            ) : (
              <input
                required={f.required}
                type={f.kind}
                value={values[f.name] || ''}
                onChange={e => set(f.name, e.target.value)}
                placeholder={f.placeholder}
                className="w-full p-3 rounded-xl border border-[var(--border)] bg-[var(--background)] focus:bg-white outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
            )}
          </div>
        ))}

        {error && (
          <div className="text-sm text-red-500">{error}</div>
        )}

        <button
          type="submit"
          disabled={busy}
          className="apple-button w-full disabled:opacity-50"
        >
          {busy ? 'Отправляем…' : submitLabel}
        </button>
      </form>
    </div>
  );
}
