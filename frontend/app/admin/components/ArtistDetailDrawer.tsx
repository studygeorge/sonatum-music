'use client';

import { useEffect, useState } from 'react';
import { adminApi } from '@/app/lib/adminApi';
import { X, ExternalLink, Mail, MapPin, Calendar, ShieldCheck, Music, FileText, AlertTriangle, Briefcase, TrendingUp, Loader } from 'lucide-react';

interface Props {
  artistId: string | null;
  onClose: () => void;
}

type StatusBadgeProps = { status?: string };
function StatusBadge({ status }: StatusBadgeProps) {
  if (!status) return null;
  const styles: Record<string, string> = {
    PUBLISHED: 'bg-green-100 text-green-800',
    PENDING:   'bg-yellow-100 text-yellow-800',
    REJECTED:  'bg-red-100 text-red-800',
    DRAFT:     'bg-gray-100 text-gray-700',
    ARCHIVED:  'bg-gray-200 text-gray-700',
    ACTIVE:    'bg-green-100 text-green-800',
    APPROVED:  'bg-green-100 text-green-800',
    SUSPENDED: 'bg-red-100 text-red-800',
    DELETED:   'bg-gray-200 text-gray-500',
    CANCELED:  'bg-gray-200 text-gray-700',
    EXPIRED:   'bg-orange-100 text-orange-800',
    RESOLVED:  'bg-blue-100 text-blue-800',
  };
  const cls = styles[status] || 'bg-gray-100 text-gray-700';
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>{status}</span>;
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
        {error && <div className="p-6 text-red-600">{error}</div>}

        {a && (
          <div className="p-6 space-y-7">
            {/* HEADER ARTIST CARD */}
            <section className="flex gap-4 items-start">
              {a.avatar ? (
                <img src={a.avatar} alt={a.name} className="w-24 h-24 rounded-2xl object-cover border border-gray-200" />
              ) : (
                <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-purple-100 to-blue-100 flex items-center justify-center text-3xl font-bold text-gray-400">
                  {a.name?.[0] || '?'}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-2xl font-bold text-gray-900">{a.name}</h3>
                  {a.verified && <ShieldCheck size={20} className="text-blue-600" />}
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

            {/* CONTACTS */}
            <section>
              <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-3">Контакты</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-xs text-gray-500">Email</div>
                  <div className="font-medium text-gray-900 break-all">
                    <a href={`mailto:${u?.email}`} className="hover:underline">{u?.email || '—'}</a>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-xs text-gray-500">Логин</div>
                  <div className="font-medium text-gray-900">{u?.username || '—'}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-xs text-gray-500">ФИО</div>
                  <div className="font-medium text-gray-900">{[u?.firstName, u?.lastName].filter(Boolean).join(' ') || '—'}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-xs text-gray-500">Псевдоним</div>
                  <div className="font-medium text-gray-900">{u?.nickname || '—'}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-xs text-gray-500">Статус аккаунта</div>
                  <div className="font-medium"><StatusBadge status={u?.status} /></div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-xs text-gray-500">Email подтверждён</div>
                  <div className="font-medium text-gray-900">{u?.emailVerified ? fmtDate(u.emailVerified) : '—'}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-xs text-gray-500">Последний вход</div>
                  <div className="font-medium text-gray-900">{fmtDate(u?.lastLoginAt)}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-xs text-gray-500">Баланс</div>
                  <div className="font-medium text-gray-900">{Number(u?.balance || 0).toLocaleString('ru-RU')} ₽</div>
                </div>
              </div>

              {/* Social links */}
              {Object.keys(social).length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {Object.entries(social).map(([k, v]) =>
                    v ? (
                      <a key={k} href={String(v)} target="_blank" rel="noreferrer"
                         className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-700 hover:bg-blue-100">
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
                <div className="bg-gray-50 rounded-lg p-3 flex items-center gap-3 text-sm">
                  <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-700 font-bold text-xs">{u.subscription.tier}</span>
                  <StatusBadge status={u.subscription.status} />
                  <span className="text-gray-500">с {fmtDate(u.subscription.startDate)}</span>
                  {u.subscription.endDate && <span className="text-gray-500">до {fmtDate(u.subscription.endDate)}</span>}
                  <span className="ml-auto font-medium">{Number(u.subscription.price || 0)} ₽/мес</span>
                </div>
              </section>
            )}

            {/* STATS */}
            <section>
              <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                <TrendingUp size={14} /> Статистика
              </h4>
              <div className="grid grid-cols-4 gap-3 text-center">
                <div className="bg-blue-50 rounded-lg p-3">
                  <div className="text-2xl font-bold text-blue-700">{counts.tracks || 0}</div>
                  <div className="text-xs text-gray-500">треков</div>
                </div>
                <div className="bg-green-50 rounded-lg p-3">
                  <div className="text-2xl font-bold text-green-700">{totals.plays || 0}</div>
                  <div className="text-xs text-gray-500">прослушиваний</div>
                </div>
                <div className="bg-red-50 rounded-lg p-3">
                  <div className="text-2xl font-bold text-red-700">{totals.likes || 0}</div>
                  <div className="text-xs text-gray-500">лайков</div>
                </div>
                <div className="bg-yellow-50 rounded-lg p-3">
                  <div className="text-2xl font-bold text-yellow-700">{totals.purchases || 0}</div>
                  <div className="text-xs text-gray-500">покупок</div>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-5 gap-2 text-center text-xs">
                <div className="bg-gray-100 rounded p-2"><b>{tbs.DRAFT || 0}</b><br /><span className="text-gray-500">DRAFT</span></div>
                <div className="bg-yellow-100 rounded p-2"><b>{tbs.PENDING || 0}</b><br /><span className="text-gray-700">PENDING</span></div>
                <div className="bg-green-100 rounded p-2"><b>{tbs.PUBLISHED || 0}</b><br /><span className="text-gray-700">PUBLISHED</span></div>
                <div className="bg-red-100 rounded p-2"><b>{tbs.REJECTED || 0}</b><br /><span className="text-gray-700">REJECTED</span></div>
                <div className="bg-gray-200 rounded p-2"><b>{tbs.ARCHIVED || 0}</b><br /><span className="text-gray-500">ARCHIVED</span></div>
              </div>
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
                        <th className="text-left px-3 py-2">Тип</th>
                        <th className="text-left px-3 py-2">Статус</th>
                        <th className="text-right px-3 py-2">Длит.</th>
                        <th className="text-right px-3 py-2">Цена</th>
                        <th className="text-right px-3 py-2">▶ / ❤️</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.tracks.map((t: any) => (
                        <tr key={t.id} className="border-t border-gray-100 hover:bg-gray-50">
                          <td className="px-3 py-2">
                            <a href={`/tracks/${t.slug || t.id}`} target="_blank" rel="noreferrer" className="text-gray-900 hover:underline">{t.title}</a>
                            <div className="text-xs text-gray-400">{fmtDate(t.createdAt)}</div>
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-600">{t.audioType || 'FULL'}</td>
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
                        <div className="text-xs text-gray-500">{s.instrument} · {s.difficulty} · {s.isPublicDomain ? 'Public Domain' : (s.price ? `${Number(s.price)} ₽` : 'free')}</div>
                      </div>
                      <StatusBadge status={s.verifyStatus} />
                      {s.pdfUrl && <a href={s.pdfUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline">PDF</a>}
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
                        <div className="font-medium">{r.companyName || '—'} <span className="text-xs text-gray-500">{r.requestType}</span></div>
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
                  <AlertTriangle size={14} className="text-red-600" /> Жалобы ({data.reports.length})
                </h4>
                <div className="space-y-2">
                  {data.reports.map((r: any) => (
                    <div key={r.id} className="border border-red-200 bg-red-50/40 rounded-lg p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-red-900">{r.reason} · {r.targetType}</span>
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
                          <td className="px-3 py-2 text-xs text-gray-700">{tx.type}</td>
                          <td className="px-3 py-2 text-xs text-gray-700">{tx.description || '—'}</td>
                          <td className={`px-3 py-2 text-right tabular-nums ${tx.type === 'WITHDRAWAL' ? 'text-red-700' : 'text-green-700'}`}>
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
                 className="inline-flex items-center gap-1 text-sm px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700">
                Открыть публичный профиль <ExternalLink size={14} />
              </a>
              <a href={`mailto:${u?.email}`}
                 className="inline-flex items-center gap-1 text-sm px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200">
                <Mail size={14} /> Написать на {u?.email}
              </a>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
