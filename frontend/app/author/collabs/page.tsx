'use client';

import { useEffect, useRef, useState, FormEvent } from 'react';
import { authStorage } from '@/app/lib/auth';

import Portal from "@/app/components/Portal";
import { toast } from '@/app/components/Toast';
type Tab = 'BROWSE' | 'MINE' | 'INBOX' | 'ARCHIVE';

const ROLES = [
  { v: 'COAUTHOR', l: 'Соавтора (композитор, автор текстов)' },
  { v: 'PERFORMER', l: 'Соисполнителя (вокалист, инструменталист)' },
  { v: 'ARRANGER', l: 'Аранжировщика' },
  { v: 'SOUND_ENGINEER', l: 'Звукорежиссёра' },
];
const PURPOSES = [
  { v: 'NEW_PROJECT', l: 'Нового проекта' },
  { v: 'RECORDING', l: 'Записи существующего произведения' },
  { v: 'CONCERT', l: 'Концертного выступления' },
  { v: 'EXPERIMENT', l: 'Эксперимента / джема' },
];
const BUDGETS = [
  { v: 'NEGOTIABLE', l: 'Оплата обсуждается' },
  { v: 'FREE', l: 'Бесплатно' },
  { v: 'ROYALTY', l: 'Роялти (процент от продаж)' },
];

const roleLabel = (v: string) => ROLES.find((r) => r.v === v)?.l.split(' (')[0] || v;
const purposeLabel = (v: string) => PURPOSES.find((p) => p.v === v)?.l || v;
const budgetLabel = (v: string) => BUDGETS.find((b) => b.v === v)?.l || v;

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' });

export default function CollabsPage() {
  const [tab, setTab] = useState<Tab>('BROWSE');
  const [mine, setMine] = useState<any[]>([]);
  const [browse, setBrowse] = useState<any[]>([]);
  const [inbox, setInbox] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [activeReq, setActiveReq] = useState<any | null>(null);
  const [filterRole, setFilterRole] = useState('');
  const [filterBudget, setFilterBudget] = useState('');
  const [openChat, setOpenChat] = useState<null | { requestId: string; peerId: string; peerName: string }>(null);
  const [filterCity, setFilterCity] = useState('');

  const token = () => authStorage.getToken() || '';

  const loadAll = async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (filterRole) qs.set('lookingFor', filterRole);
      if (filterBudget) qs.set('budget', filterBudget);
      if (filterCity) qs.set('city', filterCity);
      const [mineRes, browseRes, inboxRes] = await Promise.all([
        fetch('/api/collabs?mine=1', { headers: { Authorization: `Bearer ${token()}` } }).then((r) => r.json()),
        fetch(`/api/collabs?${qs}`).then((r) => r.json()),
        fetch('/api/collabs/inbox', { headers: { Authorization: `Bearer ${token()}` } }).then((r) => r.json()),
      ]);
      if (mineRes.success) setMine(mineRes.data);
      if (browseRes.success) setBrowse(browseRes.data);
      if (inboxRes.success) setInbox(inboxRes.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, [filterRole, filterBudget, filterCity]);

  const archive = async (id: string) => {
    await fetch(`/api/collabs/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
      body: JSON.stringify({ status: 'ARCHIVED' }),
    });
    loadAll();
  };

  const remove = async (id: string) => {
    if (!confirm('Удалить заявку?')) return;
    await fetch(`/api/collabs/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token()}` },
    });
    loadAll();
  };

  const counts = {
    BROWSE: browse.length,
    MINE: mine.filter((c) => c.status === 'ACTIVE').length,
    INBOX: inbox.filter((m) => !m.isRead).length,
    ARCHIVE: mine.filter((c) => c.status !== 'ACTIVE').length,
  };

  return (
    <div className="space-y-6 animate-fadeInUp">
      <section
        className="relative rounded-3xl overflow-hidden p-7 md:p-10 text-white flex items-end justify-between gap-4 flex-wrap"
        style={{ background: 'linear-gradient(135deg, #1d4cb8 0%, #2f9e8f 55%, #e6e6e6 100%)' }}
      >
        <div className="relative z-10 max-w-xl">
          <div className="text-xs uppercase tracking-widest font-semibold mb-2 opacity-90">
            Творческая лаборатория
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">Поиск соавторов</h1>
          <p className="text-sm md:text-base text-white/85 mt-2">
            Найдите композитора, исполнителя, аранжировщика или звукорежиссёра для совместного проекта.
          </p>
        </div>
        <button
          onClick={() => {
            setShowCreate((v) => !v);
            if (showCreate) return;
            setTab('MINE');
            window.scrollTo({ top: 200, behavior: 'smooth' });
          }}
          className="px-5 py-3 rounded-full bg-white text-[#1d4cb8] font-semibold text-sm whitespace-nowrap shrink-0 hover:opacity-90 transition-opacity"
        >
          {showCreate ? 'Свернуть форму' : 'Создать заявку'}
        </button>
      </section>

      {showCreate && (
        <CreateCollabInline
          onCancel={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            loadAll();
          }}
        />
      )}

      <div className="flex gap-2 overflow-x-auto">
        {[
          { v: 'BROWSE', l: `Найти соавтора · ${counts.BROWSE}` },
          { v: 'MINE', l: `Мои заявки · ${counts.MINE}` },
          { v: 'INBOX', l: `Предложения мне${counts.INBOX > 0 ? ` · ${counts.INBOX}` : ''}` },
          { v: 'ARCHIVE', l: `Архив · ${counts.ARCHIVE}` },
        ].map((t) => (
          <button
            key={t.v}
            onClick={() => setTab(t.v as Tab)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              tab === t.v
                ? 'bg-[var(--text-primary)] text-white'
                : 'bg-[var(--hover)] text-[var(--text-primary)] hover:bg-[var(--border)]'
            }`}
          >
            {t.l}
          </button>
        ))}
      </div>

      {tab === 'BROWSE' && (
        <>
          <div className="apple-card p-4 grid sm:grid-cols-3 gap-2">
            <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)} className="px-3 py-2 rounded-xl border border-[var(--border)] bg-white text-sm outline-none">
              <option value="">Все роли</option>
              {ROLES.map((r) => <option key={r.v} value={r.v}>{r.l}</option>)}
            </select>
            <select value={filterBudget} onChange={(e) => setFilterBudget(e.target.value)} className="px-3 py-2 rounded-xl border border-[var(--border)] bg-white text-sm outline-none">
              <option value="">Любой бюджет</option>
              {BUDGETS.map((b) => <option key={b.v} value={b.v}>{b.l}</option>)}
            </select>
            <input
              type="text"
              value={filterCity}
              onChange={(e) => setFilterCity(e.target.value)}
              placeholder="Город"
              className="px-3 py-2 rounded-xl border border-[var(--border)] bg-white text-sm outline-none"
            />
          </div>

          {loading ? (
            <div className="text-center text-[var(--text-secondary)] py-10">Загрузка…</div>
          ) : browse.length === 0 ? (
            <div className="apple-card p-10 text-center text-[var(--text-secondary)]">
              Пока нет заявок по вашим фильтрам.
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {browse.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setActiveReq(c)}
                  className="text-left apple-card p-5 hover:scale-[1.01] transition-transform"
                >
                  <div className="flex items-baseline justify-between gap-2 mb-2">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--text-primary)] text-white">
                      Ищу {roleLabel(c.lookingFor)}
                    </span>
                    <span className="text-xs text-[var(--text-secondary)]">до {fmtDate(c.activeUntil)}</span>
                  </div>
                  <h3 className="font-bold text-base mb-1">{c.genre}</h3>
                  <p className="text-sm text-[var(--text-secondary)] line-clamp-2 mb-3">{c.description}</p>
                  <div className="text-xs text-[var(--text-secondary)] flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-[var(--text-primary)]">{c.authorName}</span>
                    {c.city && <span>· {c.city}</span>}
                    <span>· {budgetLabel(c.budgetKind)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'MINE' && (
        loading ? (
          <div className="text-center text-[var(--text-secondary)] py-10">Загрузка…</div>
        ) : mine.filter((c) => c.status === 'ACTIVE').length === 0 ? (
          <div className="apple-card p-10 text-center text-[var(--text-secondary)]">
            {showCreate ? 'Заполните форму выше — после публикации заявка появится здесь.' : 'У вас нет активных заявок. Нажмите «Создать заявку» вверху.'}
          </div>
        ) : (
          <div className="space-y-3">
            {mine.filter((c) => c.status === 'ACTIVE').map((c) => (
              <div key={c.id} className="apple-card p-5">
                <div className="flex items-baseline justify-between gap-2 mb-2 flex-wrap">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--text-primary)] text-white">
                    Ищу {roleLabel(c.lookingFor)}
                  </span>
                  <span className="text-xs text-[var(--text-secondary)]">
                    {c.viewsCount} просмотров · до {fmtDate(c.activeUntil)}
                  </span>
                </div>
                <h3 className="font-bold text-base mb-1">{c.genre}</h3>
                <p className="text-sm text-[var(--text-secondary)] mb-3">{c.description}</p>
                <div className="flex gap-2 pt-3 border-t border-[var(--border)]">
                  <button onClick={() => archive(c.id)} className="text-xs px-3 py-1.5 rounded-full bg-[var(--hover)] hover:bg-[var(--border)]">
                    В архив
                  </button>
                  <button onClick={() => remove(c.id)} className="text-xs px-3 py-1.5 rounded-full bg-red-50 text-red-600 hover:bg-red-100">
                    Удалить
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {tab === 'INBOX' && (
        loading ? (
          <div className="text-center text-[var(--text-secondary)] py-10">Загрузка…</div>
        ) : inbox.length === 0 ? (
          <div className="apple-card p-10 text-center text-[var(--text-secondary)]">
            Пока нет входящих предложений.
          </div>
        ) : (
          <div className="space-y-3">
            {inbox.map((m) => (
              <div key={m.id} className={`apple-card p-5 ${!m.isRead ? 'border-l-4 border-l-[var(--accent)]' : ''}`}>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-[var(--text-primary)] text-white flex items-center justify-center overflow-hidden shrink-0">
                    {m.fromAvatar ? (
                      <img src={m.fromAvatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="font-bold text-sm">{m.fromName?.[0] || '?'}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{m.fromName}</span>
                      <span className="text-xs text-[var(--text-secondary)]">отклик на «ищу {roleLabel(m.lookingFor)}»</span>
                      <span className="text-xs text-[var(--text-secondary)] ml-auto">{fmtDate(m.createdAt)}</span>
                    </div>
                    <p className="text-sm mt-2 whitespace-pre-line">{m.body}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        onClick={() => setOpenChat({ requestId: m.requestId, peerId: m.fromUserId, peerName: m.fromName })}
                        className="px-4 py-1.5 rounded-full bg-[var(--text-primary)] text-white text-xs font-semibold">
                        Ответить
                      </button>
                      <button
                        onClick={async () => {
                          const reason = prompt('Опишите кратко суть жалобы:');
                          if (!reason) return;
                          const r = await fetch('/api/reports', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
                            body: JSON.stringify({
                              targetType: 'USER',
                              targetId: m.fromUserId,
                              reason: 'INAPPROPRIATE',
                              comment: reason,
                            }),
                          });
                          const j = await r.json();
                          toast.error(j.success ? 'Жалоба отправлена администратору' : (j.error || 'Ошибка'));
                        }}
                        className="px-4 py-1.5 rounded-full bg-white border border-[var(--border)] text-[var(--text-primary)] text-xs font-semibold hover:bg-gray-100">
                        Пожаловаться
                      </button>
                      <button
                        onClick={async () => {
                          if (!confirm(`Заблокировать ${m.fromName}? Вы больше не будете получать его заявок и сообщений.`)) return;
                          const r = await fetch('/api/users/me/blocks', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
                            body: JSON.stringify({ userId: m.fromUserId }),
                          });
                          const j = await r.json();
                          if (j.success) { toast.error(j.message || 'Заблокирован'); loadAll(); }
                          else toast.error(j.error || 'Ошибка');
                        }}
                        className="px-4 py-1.5 rounded-full bg-white border border-black text-black text-xs font-semibold hover:bg-gray-100">
                        В чёрный список
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {openChat && (
        <ChatDrawer
          requestId={openChat.requestId}
          peerId={openChat.peerId}
          peerName={openChat.peerName}
          isAuthor={true}
          onClose={() => { setOpenChat(null); loadAll(); }}
        />
      )}

      {tab === 'ARCHIVE' && (
        loading ? (
          <div className="text-center text-[var(--text-secondary)] py-10">Загрузка…</div>
        ) : mine.filter((c) => c.status !== 'ACTIVE').length === 0 ? (
          <div className="apple-card p-10 text-center text-[var(--text-secondary)]">
            Архив пуст.
          </div>
        ) : (
          <div className="space-y-3">
            {mine.filter((c) => c.status !== 'ACTIVE').map((c) => (
              <div key={c.id} className="apple-card p-5 opacity-70">
                <div className="flex items-baseline justify-between gap-2 mb-1">
                  <span className="text-xs text-[var(--text-secondary)]">{c.status === 'ARCHIVED' ? 'В архиве' : 'Истёкла'}</span>
                  <span className="text-xs text-[var(--text-secondary)]">{fmtDate(c.createdAt)}</span>
                </div>
                <h3 className="font-bold text-base">{c.genre}</h3>
                <p className="text-sm text-[var(--text-secondary)] line-clamp-2 mt-1">{c.description}</p>
              </div>
            ))}
          </div>
        )
      )}

      {activeReq && (
        <ReplySection req={activeReq} onClose={() => setActiveReq(null)} onSent={() => { setActiveReq(null); loadAll(); }} />
      )}
    </div>
  );
}

function CreateCollabInline({ onCancel, onCreated }: { onCancel: () => void; onCreated: () => void }) {
  const [lookingFor, setLookingFor] = useState('COAUTHOR');
  const [purpose, setPurpose] = useState('NEW_PROJECT');
  const [genre, setGenre] = useState('');
  const [description, setDescription] = useState('');
  const [candidateWishes, setCandidateWishes] = useState('');
  const [budgetKind, setBudgetKind] = useState('NEGOTIABLE');
  const [city, setCity] = useState('');
  const defaultUntil = new Date(Date.now() + 30 * 86400000).toISOString().substring(0, 10);
  const [activeUntil, setActiveUntil] = useState(defaultUntil);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!genre.trim() || !description.trim()) {
      setError('Заполните жанр и описание');
      return;
    }
    setSubmitting(true);
    try {
      const r = await fetch('/api/collabs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStorage.getToken() || ''}` },
        body: JSON.stringify({ lookingFor, purpose, genre: genre.trim(), description: description.trim(), candidateWishes: candidateWishes.trim() || undefined, budgetKind, activeUntil, city: city.trim() || undefined }),
      });
      const j = await r.json();
      if (!j.success) { setError(j.error || 'Ошибка'); return; }
      onCreated();
    } catch (err: any) {
      setError(err?.message || 'Ошибка сети');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="apple-card p-5 md:p-7 animate-fadeInUp">
      <div className="flex items-baseline justify-between mb-4 gap-3 flex-wrap">
        <h2 className="text-xl font-bold tracking-tight">Новая заявка</h2>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          Свернуть
        </button>
      </div>
      <form onSubmit={submit} className="grid sm:grid-cols-2 gap-4">
        {error && (
          <div className="sm:col-span-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1.5">Я ищу *</label>
          <select value={lookingFor} onChange={(e) => setLookingFor(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-white text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]">
            {ROLES.map((r) => <option key={r.v} value={r.v}>{r.l}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Для чего *</label>
          <select value={purpose} onChange={(e) => setPurpose(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-white text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]">
            {PURPOSES.map((p) => <option key={p.v} value={p.v}>{p.l}</option>)}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm font-medium mb-1.5">Жанр / стиль *</label>
          <input type="text" value={genre} onChange={(e) => setGenre(e.target.value)} placeholder="Академическая, фолк, духовная…" className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-white text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]" />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm font-medium mb-1.5">Описание проекта *</label>
          <textarea rows={5} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Над чем работаете, что хотите создать, какой результат…" className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-white text-sm resize-none outline-none focus:ring-2 focus:ring-[var(--accent)]" />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm font-medium mb-1.5">Пожелания к кандидату</label>
          <input type="text" value={candidateWishes} onChange={(e) => setCandidateWishes(e.target.value)} placeholder="Опыт, инструмент, стиль…" className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-white text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]" />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Бюджет *</label>
          <select value={budgetKind} onChange={(e) => setBudgetKind(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-white text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]">
            {BUDGETS.map((b) => <option key={b.v} value={b.v}>{b.l}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Актуально до *</label>
          <input type="date" value={activeUntil} onChange={(e) => setActiveUntil(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-white text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]" />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm font-medium mb-1.5">Город</label>
          <input type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Тула" className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-white text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]" />
        </div>

        <div className="sm:col-span-2 flex justify-end gap-2 pt-3 border-t border-[var(--border)]">
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-3 rounded-full bg-[var(--hover)] text-[var(--text-primary)] font-medium text-sm hover:bg-[var(--border)] transition-colors"
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-8 py-3 rounded-full bg-[var(--text-primary)] text-white font-medium text-sm disabled:opacity-40 hover:opacity-90 transition-opacity"
          >
            {submitting ? 'Публикуем…' : 'Опубликовать'}
          </button>
        </div>
      </form>
    </section>
  );
}

function ReplySection({ req, onClose, onSent }: { req: any; onClose: () => void; onSent: () => void }) {
  const [msg, setMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    if (!msg.trim()) { setError('Введите сообщение'); return; }
    setSending(true);
    try {
      const r = await fetch(`/api/collabs/${req.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStorage.getToken() || ''}` },
        body: JSON.stringify({ body: msg.trim() }),
      });
      const j = await r.json();
      if (!j.success) { setError(j.error || 'Ошибка'); return; }
      onSent();
    } catch (e: any) {
      setError(e?.message || 'Ошибка сети');
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="apple-card p-5 md:p-7 animate-fadeInUp">
      <div className="flex items-baseline justify-between mb-3 gap-3 flex-wrap">
        <div>
          <div className="text-xs text-[var(--text-secondary)]">{purposeLabel(req.purpose)}</div>
          <h3 className="text-lg font-bold tracking-tight">Ищу {roleLabel(req.lookingFor)}</h3>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">{req.authorName} · {budgetLabel(req.budgetKind)}{req.city && ` · ${req.city}`}</p>
        </div>
        <button onClick={onClose} className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
          Свернуть
        </button>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--hover)] p-4 mb-4">
        <div className="text-xs text-[var(--text-secondary)] mb-1">Жанр</div>
        <div className="font-semibold mb-3">{req.genre}</div>
        <div className="text-xs text-[var(--text-secondary)] mb-1">Описание</div>
        <p className="text-sm whitespace-pre-line">{req.description}</p>
        {req.candidateWishes && (
          <>
            <div className="text-xs text-[var(--text-secondary)] mb-1 mt-3">Пожелания</div>
            <p className="text-sm whitespace-pre-line">{req.candidateWishes}</p>
          </>
        )}
      </div>

      <label className="block text-sm font-medium mb-1.5">Ваше сообщение</label>
      <textarea rows={4} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Расскажите о себе и своём предложении…" className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-white text-sm resize-none outline-none focus:ring-2 focus:ring-[var(--accent)]" />
      <p className="text-[11px] text-[var(--text-secondary)] mt-1.5">
        Ваш email скрыт до момента, пока автор сам не ответит.
      </p>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600 mt-3">{error}</div>}

      <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-[var(--border)]">
        <button onClick={onClose} className="px-6 py-3 rounded-full bg-[var(--hover)] text-sm font-medium hover:bg-[var(--border)]">Отмена</button>
        <button onClick={submit} disabled={sending} className="px-8 py-3 rounded-full bg-[var(--text-primary)] text-white text-sm font-medium disabled:opacity-40">
          {sending ? 'Отправляем…' : 'Предложить сотрудничество'}
        </button>
      </div>
    </section>
  );
}

function ChatDrawer({
  requestId, peerId, peerName, isAuthor, onClose,
}: {
  requestId: string;
  peerId: string;
  peerName: string;
  isAuthor: boolean;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const token = () => authStorage.getToken() || '';

  const load = async () => {
    try {
      const r = await fetch(`/api/collabs/${requestId}/messages`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      const j = await r.json();
      if (j.success) {
        const filtered = (j.data || []).filter((m: any) =>
          m.fromUserId === peerId || m.toUserId === peerId
        );
        setMessages(filtered);
        setTimeout(() => { listRef.current?.scrollTo(0, listRef.current.scrollHeight); }, 50);
      }
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [requestId, peerId]);

  const send = async () => {
    if (!text.trim()) return;
    setError(null);
    setSending(true);
    try {
      const url = isAuthor
        ? `/api/collabs/${requestId}/messages?peer=${encodeURIComponent(peerId)}`
        : `/api/collabs/${requestId}/messages`;
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ body: text.trim() }),
      });
      const j = await r.json();
      if (j.success) {
        setText('');
        await load();
      } else {
        setError(j.error || 'Не удалось отправить');
      }
    } finally { setSending(false); }
  };

  return (
<Portal>
    <div className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/45 backdrop-blur-md" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-lg sm:rounded-3xl shadow-2xl flex flex-col"
        style={{ maxHeight: '85vh', height: '85vh' }}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <div>
            <div className="font-bold text-sm">Чат с {peerName}</div>
            <div className="text-[11px] text-[var(--text-secondary)]">Внутренние сообщения по заявке</div>
          </div>
          <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-2xl leading-none px-2">×</button>
        </div>

        <div ref={listRef} className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {loading ? (
            <p className="text-sm text-[var(--text-secondary)] text-center">Загрузка…</p>
          ) : messages.length === 0 ? (
            <p className="text-sm text-[var(--text-secondary)] text-center">Пока сообщений нет. Напишите первое.</p>
          ) : messages.map((m) => {
            const own = m.fromUserId !== peerId;
            return (
              <div key={m.id} className={`flex ${own ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[78%] px-3 py-2 rounded-2xl text-sm ${
                  own ? 'bg-[var(--text-primary)] text-white rounded-br-md' : 'bg-[var(--hover)] text-[var(--text-primary)] rounded-bl-md'
                }`}>
                  <div className="whitespace-pre-wrap break-words">{m.body}</div>
                  <div className={`text-[10px] mt-1 ${own ? 'text-white/60' : 'text-[var(--text-secondary)]'}`}>
                    {new Date(m.createdAt).toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {error && <div className="mx-4 mb-2 p-2 rounded-lg bg-red-50 text-xs text-red-700">{error}</div>}

        <div className="p-3 border-t border-[var(--border)] flex gap-2 items-end">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); } }}
            rows={2}
            placeholder="Ваше сообщение… (Cmd/Ctrl+Enter — отправить)"
            className="flex-1 px-3 py-2 rounded-xl border border-[var(--border)] focus:border-black focus:outline-none text-sm resize-none"
          />
          <button onClick={send} disabled={sending || !text.trim()}
            className="px-5 py-2.5 rounded-full bg-[var(--text-primary)] text-white text-sm font-semibold disabled:opacity-60 whitespace-nowrap">
            {sending ? '…' : 'Отправить'}
          </button>
        </div>
      </div>
    </div>
</Portal>
  );
}
