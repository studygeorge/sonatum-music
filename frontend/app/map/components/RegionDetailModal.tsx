'use client';

import { useEffect, useState } from 'react';
import { RegionData } from '../data/regionsData';

interface Section { title: string; body: string }
interface RegionPayload {
  id: string;
  name: string;
  slug: string;
  type: string;
  identityColor?: string | null;
  historicalData?: {
    summary?: string;
    sections?: Section[];
    source?: string;
  } | null;
  artists?: Array<{ id: string; name: string; slug: string; avatar: string | null; authorType: string }>;
}

interface RegionDetailModalProps {
  region: RegionData;
  onClose: () => void;
}

export default function RegionDetailModal({ region, onClose }: RegionDetailModalProps) {
  const [data, setData] = useState<RegionPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onEsc);
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', onEsc);
    };
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const key = encodeURIComponent(region.name);
        const res = await fetch(`/api/map/regions/${key}`);
        const json = await res.json();
        if (cancelled) return;
        if (res.ok && json.success) setData(json.data);
        else setError(json.error || 'Регион не найден');
      } catch {
        if (!cancelled) setError('Сеть недоступна');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [region.name]);

  const accent = data?.identityColor || '#0039a6';
  const sections = (data?.historicalData?.sections || []).filter(s => s.body && s.body.trim());

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Закрыть">×</button>

        <div className="modal-scroll-wrapper">
          <header
            className="modal-hero"
            style={{ background: `linear-gradient(135deg, ${accent}, #1c1c1e)` }}
          >
            <div className="modal-hero__type">{data?.type || region.type || 'Регион'}</div>
            <h1 className="modal-hero__name">{region.name}</h1>
            {data?.historicalData?.summary && (
              <p className="modal-hero__summary">{data.historicalData.summary}</p>
            )}
          </header>

          {loading && <p className="modal-status">Загрузка справки…</p>}

          {!loading && error && (
            <div style={{ padding: 32 }}>
              <h2 style={{ fontSize: 20, marginBottom: 8 }}>Информация в разработке</h2>
              <p style={{ color: '#666', fontSize: 14 }}>{error}</p>
            </div>
          )}

          {!loading && data && sections.length === 0 && (
            <div style={{ padding: 32 }}>
              <p style={{ color: '#666' }}>
                Подробная справка по региону «{region.name}» сейчас собирается редакцией Сонатум.
              </p>
            </div>
          )}

          {!loading && sections.length > 0 && (
            <div className="modal-body">
              {sections.map((s, i) => (
                <section key={i} className="modal-section">
                  <h2 className="modal-section__title">
                    <span className="modal-section__num" style={{ color: accent }}>{String(i + 1).padStart(2, '0')}</span>
                    {s.title}
                  </h2>
                  <p className="modal-section__body">{s.body}</p>
                </section>
              ))}
              {data.historicalData?.source && (
                <p className="modal-source">Источник: {data.historicalData.source}</p>
              )}
            </div>
          )}

          {data?.artists && data.artists.length > 0 && (
            <div className="modal-body">
              <h2 className="modal-section__title">Авторы региона</h2>
              <div className="region-artists-grid">
                {data.artists.map(a => (
                  <a
                    key={a.id}
                    href={`/artist/${a.slug || a.id}`}
                    className="region-artists-grid__item"
                  >
                    {a.avatar ? (
                      <img src={a.avatar} alt={a.name} />
                    ) : (
                      <div className="region-artists-grid__placeholder">{a.name[0]}</div>
                    )}
                    <span>{a.name}</span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        <style jsx>{`
          .modal-status { padding: 32px; text-align: center; color: #666; }
          .modal-hero {
            padding: 56px 48px 40px;
            color: #fff;
            border-radius: 24px 24px 0 0;
          }
          .modal-hero__type {
            text-transform: uppercase;
            letter-spacing: 2px;
            font-size: 11px;
            opacity: 0.8;
            margin-bottom: 12px;
          }
          .modal-hero__name {
            font-size: clamp(28px, 5vw, 48px);
            font-weight: 800;
            line-height: 1.1;
            margin: 0 0 16px;
          }
          .modal-hero__summary {
            max-width: 760px;
            line-height: 1.6;
            font-size: 15px;
            opacity: 0.92;
          }
          .modal-body {
            padding: 32px 48px 48px;
            display: flex;
            flex-direction: column;
            gap: 28px;
          }
          .modal-section {
            border-top: 1px solid #eee;
            padding-top: 20px;
          }
          .modal-section:first-child { border-top: 0; padding-top: 0; }
          .modal-section__title {
            font-size: 19px;
            font-weight: 700;
            color: #1c1c1e;
            margin: 0 0 10px;
            display: flex;
            gap: 14px;
            align-items: baseline;
          }
          .modal-section__num {
            font-size: 13px;
            font-weight: 800;
            letter-spacing: 1.5px;
            opacity: 0.7;
            min-width: 28px;
          }
          .modal-section__body {
            font-size: 15px;
            line-height: 1.7;
            color: #3a3a3c;
            margin: 0;
          }
          .modal-source {
            margin-top: 8px;
            font-size: 12px;
            color: #86868b;
            font-style: italic;
          }
          .region-artists-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
            gap: 16px;
          }
          .region-artists-grid__item {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 8px;
            text-decoration: none;
            color: #1c1c1e;
            font-size: 13px;
            text-align: center;
          }
          .region-artists-grid__item img {
            width: 80px; height: 80px; border-radius: 50%; object-fit: cover;
          }
          .region-artists-grid__placeholder {
            width: 80px; height: 80px; border-radius: 50%;
            background: #eee; display: flex; align-items: center; justify-content: center;
            font-size: 32px; font-weight: 700; color: #999;
          }
          @media (max-width: 768px) {
            .modal-hero { padding: 40px 24px 28px; }
            .modal-body { padding: 24px; }
          }
        `}</style>
      </div>
    </div>
  );
}
