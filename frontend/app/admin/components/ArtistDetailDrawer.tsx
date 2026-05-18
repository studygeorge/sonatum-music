'use client';

import { useEffect, useState } from 'react';
import { adminApi } from '@/app/lib/adminApi';
import { X, ExternalLink, Mail, MapPin, Calendar, ShieldCheck, Music, FileText, AlertTriangle, Briefcase, TrendingUp, Loader } from 'lucide-react';

interface Props {
  artistId: string | null;
  onClose: () => void;
}

// Словари переводов и стилей
const STATUS_LABEL: Record<string, string> = {
  PUBLISHED: 'Опубликован',
  APPROVED:  'Одобрено',
  ACTIVE:    'Активен',
  RESOLVED:  'Решено',
  PENDING:   'На модерации',
  DRAFT:     'Черновик',
  ARCHIVED:  'В архиве',
  CANCELED:  'Отменён',
  DELETED:   'Удалён',
  REJECTED:  'Отклонён',
  SUSPENDED: 'Заблокирован',
  EXPIRED:   'Истёк',
  PAST_DUE:  'Просрочен',
};

const TIER_LABEL: Record<string, string> = {
  FREE:    'Бесплатно',
  PREMIUM: 'Премиум',
  STUDENT: 'Студент',
  B2B:     'B2B',
};

const TX_TYPE_LABEL: Record<string, string> = {
  EARNING:    'Доход',
  WITHDRAWAL: 'Вывод',
  PURCHASE:   'Покупка',
};

const REPORT_TARGET_LABEL: Record<string, string> = {
  TRACK:   'трек',
  COMMENT: 'комментарий',
  USER:    'пользователь',
};

const REPORT_REASON_LABEL: Record<string, string> = {
  COPYRIGHT:     'Авторские права',
  INAPPROPRIATE: 'Неприемлемый контент',
  METADATA:      'Неверные метаданные',
  TECHNICAL:     'Технические проблемы',
  OTHER:         'Другое',
};

const B2B_TYPE_LABEL: Record<string, string> = {
  LICENSE:  'Лицензия',
  ACADEMIC: 'Образование',
  OTHER:    'Другое',
};

const AUDIO_TYPE_LABEL: Record<string, string> = {
  FULL:         'Полная',
  INSTRUMENTAL: 'Минусовка',
  BOTH:         'Полная + минусовка',
};

const VERIFY_LABEL: Record<string, string> = {
  PENDING:  'На проверке',
  APPROVED: 'Одобрено',
  REJECTED: 'Отклонено',
};

type StatusBadgeProps = { status?: string; labels?: Record<string, string> };
function StatusBadge({ status, labels }: StatusBadgeProps) {
  if (!status) return null;
  // Монохромный стиль:
  // - "положительные" → залитый чёрный с белым текстом
  // - "ожидающие" → залитый средне-серый
  // - "негативные" → outline (рамка)
  // - "нейтральные" → светло-серый
  const styles: Record<string, string> = {
    PUBLISHED: 'bg-black text-white',
    APPROVED:  'bg-black text-white',
    ACTIVE:    'bg-black text-white',
    RESOLVED:  'bg-black text-white',
    PENDING:   'bg-gray-700 text-white',
    DRAFT:     'bg-gray-200 text-gray-900',
    ARCHIVED:  'bg-gray-200 text-gray-500',
    CANCELED:  'bg-gray-200 text-gray-500',
    DELETED:   'bg-gray-200 text-gray-500',
    REJECTED:  'border border-black text-black bg-white',
    SUSPENDED: 'border border-black text-black bg-white',
    EXPIRED:   'border border-black text-black bg-white',
    PAST_DUE:  'border border-black text-black bg-white',
  };
  const cls = styles[status] || 'bg-gray-200 text-gray-900';
  const dict = labels || STATUS_LABEL;
  const label = dict[status] || status;
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>{label}</span>;
}

function fmtDate(s?: string | Date | null) {
  if (!s) return '—';
  try { return new Date(s).toLocaleDateString('ru-RU'); } catch { return '—'; }
}
function fmtDuration(sec: number) {
  if (!sec) return '0:00';
  const m = Math.floor(sec / 60); const r = sec % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

export default function ArtistDetailDrawer({ artistId, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (!artistId) return;
    setLoading(true);
    setError('');
    setData(null);
    adminApi.artists.getById(artistId).then((res) => {
      if (res.success) setData(res.data);
      else setError(res.error || 'Ошибка загрузки');
      setLoading(false);
    });
  }, [artistId]);

  if (!artistId) return null;

  const a = data?.artist;
  const u = a?.user;
  const social = (a?.socialLinks || {}) as Record<string, string>;
  const payment = (a?.paymentInfo || {}) as any;
  const counts = a?._count || {};
  const totals = data?.totals || {};
  const tbs = data?.tracksByStatus || {};

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div className="relative ml-auto h-full w-full max-w-3xl bg-white shadow-2xl overflow-y-auto">
        {/* Sticky header */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">
            {loading ? 'Загрузка...' : (a?.name || 'Профиль артиста')}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X size={20} />
          </button>
        </div>

        {loading && (
          <div className="p-10 flex items-center justify-center text-gray-400">
            <Loader className="animate-spin mr-2" size={20} /> Загрузка профиля...
          </div>
        )}
        {error && <div className="p-6 text-black border-l-4 border-black bg-gray-100 m-6 rounded">{error}</div>}

        {a && (
          <div className="p-6 space-y-7">
            {/* HEADER ARTIST CARD */}
            <section className="flex gap-4 items-start">
              {a.avatar ? (
                <img src={a.avatar} alt={a.name} className="w-24 h-24 rounded-2xl object-cover border border-gray-200" />
              ) : (
                <div className="w-24 h-24 rounded-2xl bg-gray-100 border border-gray-200 flex items-center justify-center text-3xl font-bold text-gray-400">
                  {a.name?.[0] || '?'}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-2xl font-bold text-gray-900">{a.name}</h3>
                  {a.verified && <ShieldCheck size={20} className="text-black" />}
                  <span className="text-xs text-gray-500">/{a.slug}</span>
                </div>
                <p className="text-sm text-gray-500 mt-0.5">
                  {a.authorType === 'COMPOSER' && 'Композитор'}
                  {a.authorType === 'PERFORMER' && 'Исполнитель'}
                  {a.authorType === 'BOTH' && 'Полнотворческий проект'}
                  {a.isSelfEmployedVerified && ' · самозанятый ✓'}
                </p>
                {a.bio && <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">{a.bio}</p>}
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-500">
                  {(a.city || a.region) && (
                    <span className="inline-flex items-center gap-1"><MapPin size={12} />{[a.city, a.region].filter(Boolean).join(', ')}</span>
                  )}
                  {a.foundedYear && <span className="inline-flex items-center gap-1"><Calendar size={12} />{a.foundedYear}</span>}
                  <span>Подписчиков: <b className="text-gray-700">{a.followers || 0}</b></span>
                  <span>Регистрация: {fmtDate(a.createdAt)}</span>
                </div>
              </div>
            </section>

            {/* CONTACTS — только то что реально нужно для связи */}
            <section>
              <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-3">Контакты</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-gray-50 rounded-lg p-3 col-span-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs text-gray-500">Email</div>
                    <a href={`mailto:${u?.email}`} className="font-medium text-gray-900 break-all hover:underline">{u?.email || '—'}</a>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <StatusBadge status={u?.status} />
                    {u?.emailVerified && <span className="text-xs text-gray-500">подтверждён</span>}
                  </div>
                </div>
                {[u?.firstName, u?.lastName].filter(Boolean).length > 0 && (
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs text-gray-500">ФИО</div>
                    <div className="font-medium text-gray-900">{[u?.firstName, u?.lastName].filter(Boolean).join(' ')}</div>
                  </div>
                )}
                {u?.nickname && (
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs text-gray-500">Псевдоним</div>
                    <div className="font-medium text-gray-900">{u.nickname}</div>
                  </div>
                )}
                {u?.lastLoginAt && (
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs text-gray-500">Последний вход</div>
                    <div className="font-medium text-gray-900">{fmtDate(u.lastLoginAt)}</div>
                  </div>
                )}
              </div>

              {/* Social links */}
              {Object.keys(social).length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {Object.entries(social).map(([k, v]) =>
                    v ? (
                      <a key={k} href={String(v)} target="_blank" rel="noreferrer"
                         className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-900 hover:bg-gray-200 border border-gray-200">
                        {k} <ExternalLink size={10} />
                      </a>
                    ) : null
                  )}
                </div>
              )}
            </section>

            {/* PAYMENT/PAYOUT */}
            {(a.canSellMusic || Object.keys(payment).length > 0) && (
              <section>
                <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Briefcase size={14} /> Выплаты и продажи
                </h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs text-gray-500">Может продавать музыку</div>
                    <div className="font-medium text-gray-900">{a.canSellMusic ? 'Да' : 'Нет'}</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs text-gray-500">Статус самозанятого</div>
                    <div className="font-medium text-gray-900">{a.isSelfEmployedVerified ? 'Подтверждён' : 'Не подтверждён'}</div>
                  </div>
                  {payment.inn && (
                    <div className="bg-gray-50 rounded-lg p-3 col-span-2">
                      <div className="text-xs text-gray-500">ИНН</div>
                      <div className="font-mono text-gray-900">{payment.inn}</div>
                    </div>
                  )}
                  {payment.phone && (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="text-xs text-gray-500">Телефон СБП</div>
                      <div className="font-mono text-gray-900">{payment.phone}</div>
                    </div>
                  )}
                  {payment.legalName && (
                    <div className="bg-gray-50 rounded-lg p-3 col-span-2">
                      <div className="text-xs text-gray-500">Юр. лицо / ИП</div>
                      <div className="text-gray-900">{payment.legalName} {payment.legalInn ? `· ИНН ${payment.legalInn}` : ''} {payment.legalKpp ? `· КПП ${payment.legalKpp}` : ''}</div>
                      {payment.accountNumber && <div className="text-xs text-gray-500 mt-1">Р/с: {payment.accountNumber} {payment.bankName ? `· ${payment.bankName}` : ''}</div>}
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* SUBSCRIPTION */}
            {u?.subscription && (
              <section>
                <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-3">Подписка</h4>
                <div className="bg-gray-50 rounded-lg p-3 flex items-center gap-3 text-sm border border-gray-200 flex-wrap">
                  <span className="px-2 py-0.5 rounded bg-black text-white font-bold text-xs">
                    {TIER_LABEL[u.subscription.tier] || u.subscription.tier}
                  </span>
                  <StatusBadge status={u.subscription.status} />
                  <span className="text-gray-500">с {fmtDate(u.subscription.startDate)}</span>
                  {u.subscription.endDate && <span className="text-gray-500">до {fmtDate(u.subscription.endDate)}</span>}
                  <span className="ml-auto font-medium">{Number(u.subscription.price || 0)} ₽/мес</span>
                </div>
              </section>
            )}

            {/* STATS — одна сводка без дублей */}
            <section>
              <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                <TrendingUp size={14} /> Статистика
              </h4>
              {/* Главные показатели — всего треков, прослушиваний, продаж */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-black text-white rounded-lg p-3">
                  <div className="text-2xl font-bold">{counts.tracks || 0}</div>
                  <div className="text-xs text-gray-300">всего треков</div>
                </div>
                <div className="bg-gray-100 border border-gray-200 rounded-lg p-3">
                  <div className="text-2xl font-bold text-gray-900">{totals.plays || 0}</div>
                  <div className="text-xs text-gray-500">прослушиваний</div>
                </div>
                <div className="bg-gray-100 border border-gray-200 rounded-lg p-3">
                  <div className="text-2xl font-bold text-gray-900">{totals.purchases || 0}</div>
                  <div className="text-xs text-gray-500">продаж</div>
                </div>
              </div>
              {/* Разбивка треков по статусам — показываем только ненулевые */}
              {(['PENDING', 'PUBLISHED', 'REJECTED', 'DRAFT', 'ARCHIVED'] as const).some((s) => tbs[s]) && (
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  {(['PENDING', 'PUBLISHED', 'REJECTED', 'DRAFT', 'ARCHIVED'] as const).map((s) =>
                    tbs[s] ? (
                      <span key={s} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-gray-100 border border-gray-200">
                        <span className="font-bold text-gray-900">{tbs[s]}</span>
                        <span className="text-gray-600">{STATUS_LABEL[s] || s}</span>
                      </span>
                    ) : null
                  )}
                </div>
              )}
            </section>

            {/* TRACKS */}
            <section>
              <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Music size={14} /> Все треки ({data.tracks?.length || 0})
              </h4>
              {data.tracks?.length ? (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                      <tr>
                        <th className="text-left px-3 py-2">Название</th>
                        <th className="text-left px-3 py-2">Версия</th>
                        <th className="text-left px-3 py-2">Статус</th>
                        <th className="text-right px-3 py-2">Длит.</th>
                        <th className="text-right px-3 py-2">Цена</th>
                        <th className="text-right px-3 py-2">Прослуш. / Лайки</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.tracks.map((t: any) => (
                        <tr key={t.id} className="border-t border-gray-100 hover:bg-gray-50">
                          <td className="px-3 py-2">
                            <a href={`/tracks/${t.slug || t.id}`} target="_blank" rel="noreferrer" className="text-gray-900 hover:underline">{t.title}</a>
                            <div className="text-xs text-gray-400">{fmtDate(t.createdAt)}</div>
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-600">{AUDIO_TYPE_LABEL[t.audioType] || 'Полная'}</td>
                          <td className="px-3 py-2"><StatusBadge status={t.status} /></td>
                          <td className="px-3 py-2 text-right tabular-nums">{fmtDuration(t.duration)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{t.price ? `${Number(t.price)} ₽` : t.isFree ? 'бесплатно' : '—'}</td>
                          <td className="px-3 py-2 text-right text-xs text-gray-500 tabular-nums">{t.playCount || 0} / {t.likeCount || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-gray-400 text-sm">Треков нет</div>
              )}
            </section>

            {/* SHEETS */}
            {data.sheets?.length > 0 && (
              <section>
                <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <FileText size={14} /> Ноты ({data.sheets.length})
                </h4>
                <div className="space-y-2">
                  {data.sheets.map((s: any) => (
                    <div key={s.id} className="border border-gray-200 rounded-lg p-3 flex items-center gap-3 text-sm">
                      <FileText size={18} className="text-gray-400" />
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{s.title}</div>
                        <div className="text-xs text-gray-500">
                          {s.instrument} · {({BEGINNER:'начальный', INTERMEDIATE:'средний', ADVANCED:'продвинутый'} as any)[s.difficulty] || s.difficulty} · {s.isPublicDomain ? 'общественное достояние' : (s.price ? `${Number(s.price)} ₽` : 'бесплатно')}
                        </div>
                      </div>
                      <StatusBadge status={s.verifyStatus} labels={VERIFY_LABEL} />
                      {s.pdfUrl && <a href={s.pdfUrl} target="_blank" rel="noreferrer" className="text-xs text-black underline hover:no-underline">PDF</a>}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ALBUMS */}
            {data.albums?.length > 0 && (
              <section>
                <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-3">Альбомы ({data.albums.length})</h4>
                <div className="grid grid-cols-3 gap-3">
                  {data.albums.map((al: any) => (
                    <div key={al.id} className="border border-gray-200 rounded-lg p-3 text-sm">
                      <div className="font-medium text-gray-900 truncate">{al.title}</div>
                      <div className="text-xs text-gray-500">{al._count?.tracks || 0} треков · {fmtDate(al.releaseDate)}</div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* B2B REQUESTS */}
            {data.b2bRequests?.length > 0 && (
              <section>
                <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-3">B2B заявки ({data.b2bRequests.length})</h4>
                <div className="space-y-2">
                  {data.b2bRequests.map((r: any) => (
                    <div key={r.id} className="border border-gray-200 rounded-lg p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <div className="font-medium">{r.companyName || '—'} <span className="text-xs text-gray-500">· {B2B_TYPE_LABEL[r.requestType] || r.requestType}</span></div>
                        <StatusBadge status={r.status} />
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        <a href={`mailto:${r.email}`} className="hover:underline">{r.email}</a>
                        {r.phone && ` · ${r.phone}`} · {fmtDate(r.createdAt)}
                      </div>
                      {r.message && <div className="text-sm text-gray-700 mt-1 whitespace-pre-wrap line-clamp-3">{r.message}</div>}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* REPORTS */}
            {data.reports?.length > 0 && (
              <section>
                <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <AlertTriangle size={14} className="text-black" /> Жалобы ({data.reports.length})
                </h4>
                <div className="space-y-2">
                  {data.reports.map((r: any) => (
                    <div key={r.id} className="border-2 border-black rounded-lg p-3 text-sm bg-white">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-900">
                          {REPORT_REASON_LABEL[r.reason] || r.reason}
                          {' · '}
                          <span className="text-gray-600 font-normal">{REPORT_TARGET_LABEL[r.targetType] || r.targetType}</span>
                        </span>
                        <StatusBadge status={r.status} />
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        от {r.reporter?.username || r.reporter?.email || r.reporterId} · {fmtDate(r.createdAt)}
                      </div>
                      {r.details && <div className="text-sm text-gray-700 mt-1 whitespace-pre-wrap line-clamp-3">{r.details}</div>}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* TRANSACTIONS */}
            {data.transactions?.length > 0 && (
              <section>
                <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-3">Финансовая история ({data.transactions.length})</h4>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                      <tr>
                        <th className="text-left px-3 py-2">Тип</th>
                        <th className="text-left px-3 py-2">Описание</th>
                        <th className="text-right px-3 py-2">Сумма</th>
                        <th className="text-right px-3 py-2">Дата</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.transactions.map((tx: any) => (
                        <tr key={tx.id} className="border-t border-gray-100">
                          <td className="px-3 py-2 text-xs text-gray-700">{TX_TYPE_LABEL[tx.type] || tx.type}</td>
                          <td className="px-3 py-2 text-xs text-gray-700">{tx.description || '—'}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-gray-900 font-medium">
                            {tx.type === 'WITHDRAWAL' ? '−' : '+'}{Number(tx.amount).toLocaleString('ru-RU')} ₽
                          </td>
                          <td className="px-3 py-2 text-right text-xs text-gray-500">{fmtDate(tx.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* QUICK ACTIONS */}
            <section className="border-t border-gray-200 pt-4 flex flex-wrap gap-2">
              <a href={`/artist/${a.slug}`} target="_blank" rel="noreferrer"
                 className="inline-flex items-center gap-1 text-sm px-4 py-2 rounded-lg bg-black text-white hover:bg-gray-800">
                Открыть публичный профиль <ExternalLink size={14} />
              </a>
              <a href={`mailto:${u?.email}`}
                 className="inline-flex items-center gap-1 text-sm px-4 py-2 rounded-lg bg-gray-100 text-gray-900 hover:bg-gray-200 border border-gray-200">
                <Mail size={14} /> Написать на {u?.email}
              </a>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
