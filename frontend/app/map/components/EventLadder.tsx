'use client';

import { useMemo, useState } from 'react';

type TimelineEvent = {
  id: string;
  year: number;
  title: string;
  description: string;
  sources?: { title: string; url: string }[];
};

interface EventLadderProps {
  events: TimelineEvent[];
  onJumpToYear: (year: number) => void;
}

export default function EventLadder({ events, onJumpToYear }: EventLadderProps) {
  const [openId, setOpenId] = useState<string | null>(null);

  const rows = useMemo(() => {
    const sorted = [...events].sort((a, b) => a.year - b.year);
    const out: Array<
      | { type: 'event'; event: TimelineEvent }
      | { type: 'gap'; fromYear: number; toYear: number }
    > = [];

    for (let i = 0; i < sorted.length; i++) {
      const cur = sorted[i];
      out.push({ type: 'event', event: cur });

      const next = sorted[i + 1];
      if (!next) continue;

      const gap = next.year - cur.year;
      if (gap >= 2) {
        out.push({ type: 'gap', fromYear: cur.year + 1, toYear: next.year - 1 });
      }
    }

    return out;
  }, [events]);

  return (
    <>
      <div className="ladder">
        <div className="ladder__axis" aria-hidden="true" />
        <div className="ladder__list">
          {rows.map((row, idx) => {
            if (row.type === 'gap') {
              return (
                <button
                  key={`gap-${row.fromYear}-${row.toYear}-${idx}`}
                  className="ladder__gap"
                  type="button"
                  onClick={() => onJumpToYear(row.toYear)}
                  aria-label="Перейти к следующему событию"
                >
                  <span className="ladder__dot" aria-hidden="true" />
                  <span className="ladder__gapText">…</span>
                </button>
              );
            }

            const ev = row.event;
            const isOpen = openId === ev.id;

            return (
              <div key={ev.id} className="ladder__row">
                <button
                  type="button"
                  className="ladder__left"
                  onClick={() => onJumpToYear(ev.year)}
                  aria-label={`Перейти к году ${ev.year}`}
                >
                  <span className="ladder__dot" aria-hidden="true" />
                  <span className="ladder__year">{ev.year}</span>
                </button>

                <div className="ladder__right">
                  <button
                    type="button"
                    className="ladder__title"
                    onClick={() => setOpenId(isOpen ? null : ev.id)}
                    aria-label="Открыть описание события"
                  >
                    <span className="ladder__titleText">{ev.title}</span>
                    <span className={`ladder__chev ${isOpen ? 'is-open' : ''}`} aria-hidden="true">
                      ▾
                    </span>
                  </button>

                  {isOpen ? (
                    <div className="ladder__detail">
                      <p className="ladder__desc">{ev.description}</p>
                      {ev.sources?.length ? (
                        <div className="ladder__sources">
                          {ev.sources.map((s) => (
                            <a key={s.url} className="ladder__src" href={s.url} target="_blank" rel="noreferrer">
                              {s.title}
                            </a>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <style jsx global>{`
        .ladder {
          position: relative;
          border-radius: 16px;
          border: 1px solid rgba(0,0,0,0.08);
          background: rgba(255,255,255,0.78);
          padding: 12px;
          box-shadow: 0 10px 28px rgba(0,0,0,0.08);
        }

        .ladder__axis {
          position: absolute;
          left: 18px;
          top: 14px;
          bottom: 14px;
          width: 2px;
          background: rgba(0,0,0,0.08);
        }

        .ladder__list {
          display: grid;
          gap: 10px;
          padding-left: 14px;
        }

        .ladder__row {
          display: grid;
          grid-template-columns: 86px 1fr;
          gap: 10px;
          align-items: start;
        }

        .ladder__left {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          justify-content: flex-start;
          border: 0;
          background: transparent;
          cursor: pointer;
          padding: 8px 6px;
          border-radius: 12px;
        }

        .ladder__left:hover {
          background: rgba(0,0,0,0.04);
        }

        .ladder__dot {
          width: 10px;
          height: 10px;
          border-radius: 999px;
          background: rgba(120,163,255,0.95);
          box-shadow: 0 0 0 6px rgba(120,163,255,0.15);
        }

        .ladder__year {
          font-size: 14px;
          font-weight: 900;
          letter-spacing: 0.06em;
          color: rgba(26,32,44,0.90);
        }

        .ladder__right {
          min-width: 0;
        }

        .ladder__title {
          width: 100%;
          border: 1px solid rgba(0,0,0,0.08);
          background: rgba(255,255,255,0.86);
          border-radius: 14px;
          padding: 10px 12px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .ladder__title:hover {
          background: rgba(255,255,255,1);
        }

        .ladder__titleText {
          font-size: 14px;
          font-weight: 800;
          color: rgba(45,55,72,0.86);
          text-align: left;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .ladder__chev {
          color: rgba(45,55,72,0.55);
          font-weight: 900;
          transform: translateY(-1px) rotate(0deg);
          transition: transform 140ms ease;
        }

        .ladder__chev.is-open {
          transform: translateY(-1px) rotate(180deg);
        }

        .ladder__detail {
          margin-top: 8px;
          padding: 12px;
          border-radius: 14px;
          border: 1px solid rgba(0,0,0,0.06);
          background: rgba(0,0,0,0.02);
        }

        .ladder__desc {
          margin: 0;
          font-size: 14px;
          line-height: 1.7;
          color: rgba(45,55,72,0.80);
        }

        .ladder__sources {
          margin-top: 10px;
          display: grid;
          gap: 6px;
        }

        .ladder__src {
          font-size: 13px;
          font-weight: 800;
          color: rgba(26,32,44,0.85);
          text-decoration: none;
        }

        .ladder__src:hover {
          text-decoration: underline;
        }

        .ladder__gap {
          display: grid;
          grid-template-columns: 86px 1fr;
          gap: 10px;
          align-items: center;
          border: 0;
          background: transparent;
          cursor: pointer;
          padding: 4px 0;
        }

        .ladder__gap .ladder__dot {
          background: rgba(0,0,0,0.20);
          box-shadow: none;
          margin-left: 6px;
        }

        .ladder__gapText {
          font-size: 16px;
          font-weight: 900;
          color: rgba(45,55,72,0.45);
          letter-spacing: 0.2em;
          user-select: none;
        }
      `}</style>
    </>
  );
}
