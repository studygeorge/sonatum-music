'use client';

import { useEffect, useMemo, useRef } from 'react';

interface YearTimelineProps {
  minYear: number;
  maxYear: number;
  year: number;
  yearsWithEvents: number[];
  onChange: (year: number) => void;
  filterEmptyYears: boolean;
  onToggleFilterEmptyYears: () => void;
  onPrevEvent: () => void;
  onNextEvent: () => void;
}

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

export default function YearTimeline({
  minYear,
  maxYear,
  year,
  yearsWithEvents,
  onChange,
  filterEmptyYears,
}: YearTimelineProps) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const tickingRef = useRef(false);
  const ignoreScrollRef = useRef(false);

  const yearsSet = useMemo(() => new Set(yearsWithEvents), [yearsWithEvents]);

  const allYears = useMemo(() => {
    if (filterEmptyYears) return yearsWithEvents.slice().sort((a, b) => a - b);
    const arr: number[] = [];
    for (let y = minYear; y <= maxYear; y += 1) arr.push(y);
    return arr;
  }, [filterEmptyYears, yearsWithEvents, minYear, maxYear]);

  const scrollToYear = (y: number, behavior: ScrollBehavior = 'smooth') => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const el = itemRefs.current.get(y);
    if (!el) return;

    const targetLeft = el.offsetLeft + el.offsetWidth / 2 - scroller.clientWidth / 2;
    scroller.scrollTo({ left: targetLeft, behavior });
  };

  useEffect(() => {
    ignoreScrollRef.current = true;
    scrollToYear(year, 'auto');
    setTimeout(() => {
      ignoreScrollRef.current = false;
    }, 100);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterEmptyYears, minYear, maxYear]);

  useEffect(() => {
    ignoreScrollRef.current = true;
    scrollToYear(year, 'smooth');
    setTimeout(() => {
      ignoreScrollRef.current = false;
    }, 600);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const getClosestYearToCenter = () => {
      const centerX = scroller.scrollLeft + scroller.clientWidth / 2;

      let bestYear = year;
      let bestDist = Infinity;

      for (const y of allYears) {
        const el = itemRefs.current.get(y);
        if (!el) continue;
        const itemCenter = el.offsetLeft + el.offsetWidth / 2;
        const dist = Math.abs(itemCenter - centerX);
        if (dist < bestDist) {
          bestDist = dist;
          bestYear = y;
        }
      }

      return bestYear;
    };

    const onScroll = () => {
      if (tickingRef.current || ignoreScrollRef.current) return;
      tickingRef.current = true;

      requestAnimationFrame(() => {
        tickingRef.current = false;
        if (ignoreScrollRef.current) return;
        const closest = getClosestYearToCenter();
        if (closest !== year) onChange(closest);
      });
    };

    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => scroller.removeEventListener('scroll', onScroll);
  }, [year, allYears, onChange]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const onWheel = (e: WheelEvent) => {
      if (!e.shiftKey) return;
      e.preventDefault();
      const delta = e.deltaY > 0 ? 1 : -1;

      if (filterEmptyYears) {
        const idx = allYears.indexOf(year);
        const nextIdx = clamp(idx + delta, 0, allYears.length - 1);
        const nextYear = allYears[nextIdx];
        if (typeof nextYear === 'number') onChange(nextYear);
        return;
      }

      onChange(clamp(year + delta, minYear, maxYear));
    };

    scroller.addEventListener('wheel', onWheel, { passive: false });
    return () => scroller.removeEventListener('wheel', onWheel as any);
  }, [year, minYear, maxYear, onChange, filterEmptyYears, allYears]);

  const hasEvent = yearsSet.has(year);

  const handleYearClick = (y: number) => {
    ignoreScrollRef.current = true;
    onChange(y);
    setTimeout(() => {
      ignoreScrollRef.current = false;
    }, 600);
  };

  return (
    <>
      <div className="yearstrip">
        <div className="yearstrip__viewport" aria-label="Лента годов">
          <div className={`yearstrip__centerHalo ${hasEvent ? 'has-event' : ''}`} aria-hidden="true" />
          <div className="yearstrip__centerLine" aria-hidden="true" />

          <div className="yearstrip__scroller" ref={scrollerRef} role="listbox">
            <div className="yearstrip__pad" aria-hidden="true" />
            {allYears.map((y) => (
              <div
                key={y}
                ref={(el) => {
                  if (el) itemRefs.current.set(y, el);
                  else itemRefs.current.delete(y);
                }}
                className={`yearstrip__item ${y === year ? 'is-active' : ''} ${yearsSet.has(y) ? 'has-event' : ''}`}
                onClick={() => handleYearClick(y)}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  handleYearClick(y);
                }}
                role="option"
                aria-selected={y === year}
                tabIndex={0}
              >
                <span className="yearstrip__digits">{y}</span>
              </div>
            ))}
            <div className="yearstrip__pad" aria-hidden="true" />
          </div>
        </div>
      </div>

      <style jsx global>{`
        .yearstrip {
          border-radius: 16px;
          border: 1px solid rgba(0, 0, 0, 0.08);
          background: rgba(255, 255, 255, 0.78);
          padding: 14px;
          margin: 10px 0 18px 0;
          box-shadow: 0 10px 28px rgba(0, 0, 0, 0.08);
        }

        .yearstrip__viewport {
          position: relative;
          border-radius: 14px;
          background: linear-gradient(180deg, rgba(0, 0, 0, 0.03), rgba(0, 0, 0, 0.015));
          overflow: hidden;
          transform: perspective(1100px) rotateX(7deg);
          -webkit-mask-image: linear-gradient(to right, transparent 0%, #000 18%, #000 82%, transparent 100%);
          mask-image: linear-gradient(to right, transparent 0%, #000 18%, #000 82%, transparent 100%);
        }

        .yearstrip__scroller {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 0;
          overflow-x: auto;
          overflow-y: hidden;
          scroll-snap-type: x mandatory;
          scroll-behavior: smooth;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
          will-change: scroll-position;
        }

        .yearstrip__scroller::-webkit-scrollbar {
          display: none;
        }

        .yearstrip__pad {
          flex: 0 0 45%;
        }

        .yearstrip__item {
          scroll-snap-align: center;
          flex: 0 0 auto;
          width: 88px;
          height: 58px;
          border-radius: 16px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0.32;
          filter: blur(0.7px) saturate(0.85);
          transition: transform 140ms ease, opacity 140ms ease, filter 140ms ease;
          user-select: none;
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
        }

        .yearstrip__item:hover {
          opacity: 0.58;
          filter: blur(0.4px) saturate(0.92);
        }

        .yearstrip__item:active {
          opacity: 0.78;
          transform: scale(0.96);
        }

        .yearstrip__digits {
          font-size: 20px;
          font-weight: 950;
          letter-spacing: 0.08em;
          color: rgba(45, 55, 72, 0.62);
          transform: scale(0.92);
          transition: transform 140ms ease, color 140ms ease;
          pointer-events: none;
        }

        .yearstrip__item.has-event .yearstrip__digits {
          color: rgba(45, 55, 72, 0.72);
        }

        .yearstrip__item.is-active {
          opacity: 1;
          filter: none;
          transform: translateY(-1px);
        }

        .yearstrip__item.is-active .yearstrip__digits {
          color: rgba(26, 32, 44, 0.95);
          transform: scale(1.18);
        }

        .yearstrip__centerHalo {
          position: absolute;
          left: 50%;
          top: 6px;
          bottom: 6px;
          width: 112px;
          transform: translateX(-50%);
          border-radius: 18px;
          background: radial-gradient(closest-side, rgba(0, 0, 0, 0.08), rgba(0, 0, 0, 0.02), transparent 70%);
          pointer-events: none;
          z-index: 3;
        }

        .yearstrip__centerHalo.has-event {
          background: radial-gradient(
            closest-side,
            rgba(120, 163, 255, 0.22),
            rgba(120, 163, 255, 0.06),
            transparent 70%
          );
        }

        .yearstrip__centerLine {
          position: absolute;
          left: 50%;
          top: 0;
          bottom: 0;
          width: 2px;
          transform: translateX(-50%);
          background: rgba(0, 0, 0, 0.06);
          pointer-events: none;
          z-index: 3;
        }

        @media (max-width: 768px) {
          .yearstrip__viewport {
            transform: none;
          }
          .yearstrip__pad {
            flex-basis: 41%;
          }
          .yearstrip__item {
            width: 84px;
            height: 60px;
          }
        }
      `}</style>
    </>
  );
}
