'use client';

import { useEffect, useState, FormEvent } from 'react';
import { authStorage } from '@/app/lib/auth';
import Portal from '@/app/components/Portal';

type Member = {
  id: string;
  email: string;
  fullName: string | null;
  role: string;
  userId: string | null;
  avatar: string | null;
  joinedAt: string | null;
  createdAt: string;
};

const ROLE_LABEL: Record<string, { l: string; c: string }> = {
  ADMIN: { l: 'Администратор', c: 'bg-purple-100 text-purple-700' },
  TEACHER: { l: 'Преподаватель', c: 'bg-blue-100 text-blue-700' },
  STUDENT: { l: 'Учащийся', c: 'bg-gray-100 text-gray-700' },
};

export default function EduUsersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [myRole, setMyRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [filterRole, setFilterRole] = useState<'ALL' | 'TEACHER' | 'STUDENT'>('ALL');

  const load = () => {
    fetch('/api/edu/members', {
      headers: { Authorization: `Bearer ${authStorage.getToken() || ''}` },
    })
      .then((r) => r.json())
      .then((j) => {
        if (j.success) {
          setMembers(j.data || []);
          setMyRole(j.myRole);
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => load(), []);

  const remove = async (id: string) => {
    if (!confirm('Удалить пользователя из учреждения?')) return;
    await fetch(`/api/edu/members?id=${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authStorage.getToken() || ''}` },
    });
    load();
  };

  const isAdmin = myRole === 'ADMIN';
  const filtered = filterRole === 'ALL' ? members : members.filter((m) => m.role === filterRole);
  const counts = {
    teachers: members.filter((m) => m.role === 'TEACHER').length,
    students: members.filter((m) => m.role === 'STUDENT').length,
  };

  return (
    <div className="space-y-6 animate-fadeInUp">
      <section
        className="relative rounded-3xl overflow-hidden p-7 md:p-10 text-white flex items-end justify-between gap-4 flex-wrap"
        style={{ background: 'linear-gradient(135deg, #1d4cb8 0%, #2f9e8f 55%, #e6e6e6 100%)' }}>
        <div className="relative z-10 max-w-xl">
          <div className="text-xs uppercase tracking-widest font-semibold mb-2 opacity-90">
            Управление доступом
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">Пользователи</h1>
          <p className="text-sm md:text-base text-white/85 mt-2">
            {counts.teachers} преподавателей · {counts.students} учащихся
          </p>
        </div>
        {isAdmin && (
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setImportOpen(true)}
              className="px-5 py-3 rounded-full bg-white/20 hover:bg-white/30 border border-white/40 text-white font-semibold text-sm whitespace-nowrap">
              Импорт CSV
            </button>
            <button
              onClick={() => setAddOpen(true)}
              className="px-5 py-3 rounded-full bg-white text-[#1d4cb8] font-semibold text-sm whitespace-nowrap">
              + Добавить
            </button>
          </div>
        )}
      </section>
      <div className="flex gap-2 overflow-x-auto">
        {[
          { v: 'ALL', l: `Все · ${members.length}` },
          { v: 'TEACHER', l: `Преподаватели · ${counts.teachers}` },
          { v: 'STUDENT', l: `Учащиеся · ${counts.students}` },
        ].map((f) => (
          <button
            key={f.v}
            onClick={() => setFilterRole(f.v as any)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              filterRole === f.v
                ? 'bg-[var(--text-primary)] text-white'
                : 'bg-[var(--hover)] text-[var(--text-primary)]'
            }`}>
            {f.l}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="text-center text-[var(--text-secondary)] py-10">Загрузка…</div>
      ) : filtered.length === 0 ? (
        <div className="apple-card p-10 text-center text-[var(--text-secondary)]">
          {isAdmin ? 'Никого нет. Добавьте первого пользователя.' : 'Пока никого нет.'}
        </div>
      ) : (
        <div className="apple-card overflow-hidden">
          {filtered.map((m) => {
            const r = ROLE_LABEL[m.role] || ROLE_LABEL.STUDENT;
            return (
              <div
                key={m.id}
                className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--hover)]">
                <div className="w-9 h-9 rounded-full bg-[var(--text-primary)] text-white flex items-center justify-center overflow-hidden shrink-0">
                  {m.avatar ? (
                    <img src={m.avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-sm font-bold">{(m.fullName || m.email)[0]?.toUpperCase()}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm truncate">{m.fullName || m.email.split('@')[0]}</span>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full ${r.c} shrink-0`}>{r.l}</span>
                    {!m.userId && (
                      <span className="text-[11px] text-amber-700 shrink-0">приглашение отправлено</span>
                    )}
                  </div>
                  <div className="text-xs text-[var(--text-secondary)] truncate">{m.email}</div>
                </div>
                {isAdmin && (
                  <button
                    onClick={() => remove(m.id)}
                    className="text-xs text-red-500 hover:underline shrink-0"
                    title="Удалить из учреждения">
                    Удалить
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {addOpen && (
        <AddMemberModal
          onClose={() => setAddOpen(false)}
          onAdded={() => {
            setAddOpen(false);
            load();
          }}
        />
      )}

      {importOpen && (
        <ImportCsvModal
          onClose={() => setImportOpen(false)}
          onDone={() => {
            setImportOpen(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function ImportCsvModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [csv, setCsv] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ added: number; skipped: number; skippedDetails?: { email: string; reason: string }[] } | null>(null);

  const onFile = (f: File | null) => {
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) { setError('Файл больше 2 МБ'); return; }
    const reader = new FileReader();
    reader.onload = () => setCsv(String(reader.result || ''));
    reader.readAsText(f, 'utf-8');
  };

  const submit = async () => {
    setError(''); setSubmitting(true);
    try {
      const r = await fetch('/api/edu/members/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStorage.getToken() || ''}` },
        body: JSON.stringify({ csv }),
      });
      const j = await r.json();
      if (!j.success) { setError(j.error || 'Ошибка'); return; }
      setResult({ added: j.added, skipped: j.skipped, skippedDetails: j.skippedDetails });
    } catch (e: any) {
      setError(e?.message || 'Ошибка');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Portal>
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/45 backdrop-blur-md" onClick={() => !submitting && onClose()}>
      <div className="apple-card max-w-lg w-full p-6 shadow-2xl animate-fadeInUp" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-xl font-bold tracking-tight">Импорт CSV</h3>
          <button onClick={onClose} className="text-2xl leading-none"></button>
        </div>

        {result ? (
          <div className="space-y-3">
            <div className="apple-card p-4 bg-emerald-50 border-emerald-200">
              <div className="text-sm font-semibold text-emerald-800">Готово</div>
              <div className="text-sm text-emerald-900 mt-1">
                Добавлено: <b>{result.added}</b>, пропущено: <b>{result.skipped}</b>
              </div>
            </div>
            {result.skippedDetails && result.skippedDetails.length > 0 && (
              <div className="text-xs text-[var(--text-secondary)] max-h-40 overflow-auto bg-[var(--hover)] rounded-xl p-3">
                {result.skippedDetails.map((s, i) => (
                  <div key={i}>{s.email} — {s.reason}</div>
                ))}
              </div>
            )}
            <div className="flex justify-end pt-3 border-t border-[var(--border)]">
              <button onClick={onDone} className="px-6 py-2.5 rounded-full bg-[var(--text-primary)] text-white text-sm font-medium">
                Готово
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {error && <div className="apple-card p-3 bg-red-50 border-red-200 text-sm text-red-600">{error}</div>}
            <div className="text-xs text-[var(--text-secondary)] bg-[var(--hover)] p-3 rounded-xl space-y-1">
              <div>Формат CSV: <code>email,fullName,role</code></div>
              <div><b>role</b>: TEACHER или STUDENT (по умолчанию STUDENT)</div>
              <div>Разделитель: запятая, точка с запятой или таб. Кодировка UTF-8.</div>
              <div className="pt-1">Пример:<br /><code>ivanov@example.com,Иванов Иван,STUDENT</code></div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Загрузить файл</label>
              <input
                type="file"
                accept=".csv,text/csv,text/plain"
                onChange={(e) => onFile(e.target.files?.[0] || null)}
                className="text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">или вставьте текст</label>
              <textarea
                value={csv}
                onChange={(e) => setCsv(e.target.value)}
                placeholder="email,fullName,role&#10;ivanov@example.com,Иванов Иван,STUDENT"
                rows={6}
                className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-white text-xs font-mono"
              />
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border)]">
              <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-full bg-[var(--hover)] text-sm font-medium">Отмена</button>
              <button type="button" onClick={submit} disabled={submitting || !csv.trim()} className="px-6 py-2.5 rounded-full bg-[var(--text-primary)] text-white text-sm font-medium disabled:opacity-40">
                {submitting ? 'Импорт…' : 'Импортировать'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
    </Portal>
  );
}

function AddMemberModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'TEACHER' | 'STUDENT'>('STUDENT');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const r = await fetch('/api/edu/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStorage.getToken() || ''}` },
        body: JSON.stringify({ email: email.trim(), fullName: fullName.trim() || undefined, role }),
      });
      const j = await r.json();
      if (!j.success) { setError(j.error || 'Ошибка'); return; }
      onAdded();
    } catch (e: any) {
      setError(e?.message || 'Ошибка');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Portal>
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/45 backdrop-blur-md" onClick={() => !submitting && onClose()}>
      <div className="apple-card max-w-md w-full p-6 shadow-2xl animate-fadeInUp" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-xl font-bold tracking-tight">Добавить пользователя</h3>
          <button onClick={onClose} className="text-2xl leading-none"></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          {error && <div className="apple-card p-3 bg-red-50 border-red-200 text-sm text-red-600">{error}</div>}
          <div>
            <label className="block text-sm font-medium mb-1">Email *</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-white text-sm" required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">ФИО</label>
            <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-white text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Роль *</label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setRole('TEACHER')} className={`px-4 py-2.5 rounded-xl text-sm font-medium ${role === 'TEACHER' ? 'bg-[var(--text-primary)] text-white' : 'bg-[var(--hover)]'}`}>
                Преподаватель
              </button>
              <button type="button" onClick={() => setRole('STUDENT')} className={`px-4 py-2.5 rounded-xl text-sm font-medium ${role === 'STUDENT' ? 'bg-[var(--text-primary)] text-white' : 'bg-[var(--hover)]'}`}>
                Учащийся
              </button>
            </div>
          </div>
          <p className="text-xs text-[var(--text-secondary)] bg-[var(--hover)] p-3 rounded-xl">
            Если пользователь уже зарегистрирован на платформе — он получит доступ автоматически. Иначе ему придёт приглашение при первой регистрации по этому email.
          </p>
          <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border)]">
            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-full bg-[var(--hover)] text-sm font-medium">Отмена</button>
            <button type="submit" disabled={submitting || !email} className="px-6 py-2.5 rounded-full bg-[var(--text-primary)] text-white text-sm font-medium disabled:opacity-40">
              {submitting ? 'Добавляем…' : 'Добавить'}
            </button>
          </div>
        </form>
      </div>
    </div>
    </Portal>
  );
}
