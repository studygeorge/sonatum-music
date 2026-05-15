'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { RegionData } from '../data/regionsData';
import YearTimelineComponent from './YearTimeline';
import {
  loadRegionTimeline,
  getEventsForYear,
  getNearestYearWithEvents,
  getYearsWithEvents,
} from '../data/timeline';

type PanelMode = 'drawer' | 'sheet';
type SheetState = 'closed' | 'peek' | 'full';
type DrawerState = 'closed' | 'open';

interface RegionDetailsPanelProps {
  region: RegionData | null;
  onClose: () => void;
  forceMode?: PanelMode;
}

function usePanelMode(forceMode?: PanelMode): PanelMode {
  const [mode, setMode] = useState<PanelMode>('drawer');

  useEffect(() => {
    if (forceMode) return;

    const decide = () => {
      const isCoarsePointer =
        typeof window !== 'undefined' && window.matchMedia
          ? window.matchMedia('(pointer: coarse)').matches
          : false;

      const isNarrow =
        typeof window !== 'undefined' && window.matchMedia
          ? window.matchMedia('(max-width: 768px)').matches
          : false;

      setMode(isNarrow || isCoarsePointer ? 'sheet' : 'drawer');
    };

    decide();
    window.addEventListener('resize', decide);
    return () => window.removeEventListener('resize', decide);
  }, [forceMode]);

  return forceMode ?? mode;
}

export default function RegionDetailsPanel({ region, onClose, forceMode }: RegionDetailsPanelProps) {
  const mode = usePanelMode(forceMode);

  const [drawerState, setDrawerState] = useState<DrawerState>('closed');
  const [sheetState, setSheetState] = useState<SheetState>('closed');

  const dragRef = useRef<{
    active: boolean;
    startY: number;
    startState: SheetState;
  }>({ active: false, startY: 0, startState: 'peek' });

  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timeline, setTimeline] = useState<any>(null);
  const [year, setYear] = useState<number>(1900);

  const [filterEmptyYears, setFilterEmptyYears] = useState<boolean>(false);
  const savedYearRef = useRef<number | null>(null);

  useEffect(() => {
    if (!region) {
      setTimeline(null);
      setTimelineLoading(false);
      setYear(1900);
      return;
    }

    let alive = true;
    setTimelineLoading(true);

    loadRegionTimeline(region.name)
      .then((t) => {
        if (!alive) return;
        setTimeline(t);
        setYear(t?.defaultYear ?? 1900);
      })
      .catch(() => {
        if (!alive) return;
        setTimeline(null);
      })
      .finally(() => {
        if (!alive) return;
        setTimelineLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [region?.name]);

  const yearsWithEvents = useMemo<number[]>(() => {
    if (!timeline) return [];
    return getYearsWithEvents(timeline);
  }, [timeline]);

  const eventsForYear = useMemo(() => {
    if (!timeline) return [];
    return getEventsForYear(timeline, year);
  }, [timeline, year]);

  const nearestEventYear = useMemo<number | null>(() => {
    if (!timeline) return null;
    return getNearestYearWithEvents(timeline, year);
  }, [timeline, year]);

  useEffect(() => {
    if (!region) {
      setDrawerState('closed');
      setSheetState('closed');
      return;
    }

    if (mode === 'drawer') setDrawerState('open');
    if (mode === 'sheet') setSheetState('peek');
  }, [region, mode]);

  useEffect(() => {
    const isOpen = mode === 'drawer' ? drawerState === 'open' : sheetState !== 'closed';
    if (!isOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [drawerState, sheetState, mode, onClose]);

  useEffect(() => {
    const isSheetOpen = mode === 'sheet' && sheetState !== 'closed';
    if (!isSheetOpen) return;

    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mode, sheetState]);

  useEffect(() => {
    if (mode !== 'sheet') return;
    if (sheetState === 'closed') return;

    if (eventsForYear.length > 0 && sheetState === 'peek') {
      setSheetState('full');
    }
  }, [eventsForYear.length, mode, sheetState]);

  const handleToggleFilterEmptyYears = () => {
    setFilterEmptyYears((prev) => {
      const newVal = !prev;

      if (newVal) {
        savedYearRef.current = year;

        if (yearsWithEvents.length > 0) {
          const earliestYear = Math.min(...yearsWithEvents);
          setYear(earliestYear);
        }
      } else {
        if (savedYearRef.current !== null) {
          setYear(savedYearRef.current);
          savedYearRef.current = null;
        }
      }

      return newVal;
    });
  };

  if (!region) return null;

  const renderTimelineContent = () => {
    if (timelineLoading) {
      return <div className="region-panel__placeholder">Загрузка материалов…</div>;
    }

    if (!timeline) {
      return (
        <div className="region-panel__placeholder">
          Информация о регионе «{region.name}» находится в разработке.
        </div>
      );
    }

    return (
      <>
        {mode === 'drawer' && (
          <div className="region-panel__controls">
            <button
              type="button"
              className={`region-panel__switch-btn ${filterEmptyYears ? 'is-on' : ''}`}
              onClick={handleToggleFilterEmptyYears}
              aria-label="Только события"
            >
              <span className="region-panel__switch-track" aria-hidden="true">
                <span className="region-panel__switch-knob" />
              </span>
              <span className="region-panel__switch-label">Только события</span>
            </button>

            {nearestEventYear !== null && nearestEventYear !== year && (
              <button
                type="button"
                className="region-panel__nearest-btn"
                onClick={() => setYear(nearestEventYear)}
                aria-label={`Перейти к ближайшему событию (${nearestEventYear})`}
              >
                К ближайшему ({nearestEventYear})
              </button>
            )}
          </div>
        )}

        <YearTimelineComponent
          minYear={timeline.minYear}
          maxYear={timeline.maxYear}
          year={year}
          yearsWithEvents={yearsWithEvents}
          onChange={setYear}
          filterEmptyYears={filterEmptyYears}
          onToggleFilterEmptyYears={handleToggleFilterEmptyYears}
          onPrevEvent={() => {}}
          onNextEvent={() => {}}
        />

        {eventsForYear.length === 0 ? (
          <div className="region-panel__placeholder">Материала за {year} год нет.</div>
        ) : (
          eventsForYear.map((ev: any) => (
            <section key={ev.id} className="modal-section">
              <h2 className="section-title">{ev.title}</h2>
              <p className="section-text">{ev.description}</p>

              {ev.sources?.length ? (
                <div className="region-panel__sources">
                  {ev.sources.map((s: any) => (
                    <a key={s.url} className="region-panel__source" href={s.url} target="_blank" rel="noreferrer">
                      {s.title}
                    </a>
                  ))}
                </div>
              ) : null}
            </section>
          ))
        )}

        <style jsx>{`
          .region-panel__controls {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 12px;
            flex-wrap: wrap;
          }

          .region-panel__switch-btn {
            appearance: none;
            border: 1px solid rgba(255, 255, 255, 0.14);
            background: rgba(18, 20, 26, 0.44);
            color: rgba(255, 255, 255, 0.92);
            border-radius: 999px;
            padding: 10px 14px;
            display: inline-flex;
            align-items: center;
            gap: 10px;
            cursor: pointer;
            user-select: none;
            transition: transform 120ms ease, background 180ms ease, border-color 180ms ease;
          }

          .region-panel__switch-btn:hover {
            transform: translateY(-1px);
            background: rgba(24, 28, 36, 0.56);
            border-color: rgba(255, 255, 255, 0.2);
          }

          .region-panel__switch-btn:active {
            transform: translateY(0px);
          }

          .region-panel__switch-track {
            width: 42px;
            height: 24px;
            border-radius: 999px;
            position: relative;
            background: rgba(255, 255, 255, 0.08);
            border: 1px solid rgba(255, 255, 255, 0.12);
            box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.28);
          }

          .region-panel__switch-knob {
            width: 18px;
            height: 18px;
            border-radius: 999px;
            position: absolute;
            top: 50%;
            left: 3px;
            transform: translateY(-50%);
            background: rgba(255, 255, 255, 0.9);
            box-shadow: 0 10px 18px rgba(0, 0, 0, 0.18);
            transition: left 160ms ease, background 160ms ease, box-shadow 160ms ease;
          }

          .region-panel__switch-btn.is-on .region-panel__switch-knob {
            left: 21px;
            background: rgba(255, 255, 255, 0.96);
            box-shadow: 0 14px 26px rgba(0, 0, 0, 0.28);
          }

          .region-panel__switch-label {
            font-weight: 850;
            font-size: 13px;
            letter-spacing: 0.01em;
            line-height: 1;
            opacity: 0.92;
          }

          .region-panel__nearest-btn {
            appearance: none;
            border: 1px solid rgba(255, 255, 255, 0.18);
            background: rgba(30, 34, 44, 0.52);
            color: rgba(255, 255, 255, 0.94);
            border-radius: 12px;
            padding: 10px 14px;
            font-weight: 850;
            font-size: 13px;
            cursor: pointer;
            user-select: none;
            transition: transform 120ms ease, background 180ms ease, border-color 180ms ease;
          }

          .region-panel__nearest-btn:hover {
            transform: translateY(-1px);
            background: rgba(38, 44, 56, 0.64);
            border-color: rgba(255, 255, 255, 0.26);
          }

          .region-panel__nearest-btn:active {
            transform: translateY(0px);
          }

          .region-panel__sources {
            margin-top: 10px;
            display: grid;
            gap: 6px;
          }

          .region-panel__source {
            font-weight: 850;
            text-decoration: none;
          }

          .region-panel__source:hover {
            text-decoration: underline;
            text-underline-offset: 3px;
          }
        `}</style>
      </>
    );
  };

  if (mode === 'drawer') {
    const isOpen = drawerState === 'open';

    return (
      <aside
        className={`region-panel region-panel--drawer ${isOpen ? 'is-open' : 'is-closed'}`}
        aria-hidden={!isOpen}
      >
        <button
          className="region-panel__handle"
          type="button"
          onClick={() => setDrawerState(isOpen ? 'closed' : 'open')}
          aria-label={isOpen ? 'Свернуть панель' : 'Развернуть панель'}
        >
          <span className="region-panel__handle-bar" />
        </button>

        <div className="region-panel__inner">
          <div className="region-panel__top">
            <div className="region-panel__badge" style={{ backgroundColor: region.color }} />
            <div className="region-panel__titlewrap">
              <div className="region-panel__title">{timeline?.regionName ?? region.name}</div>
              <div className="region-panel__subtitle">
                {timeline ? 'История музыки по годам' : 'Материал готовится'}
              </div>
            </div>

            <button
              className="region-panel__close"
              type="button"
              onClick={() => {
                setDrawerState('closed');
                onClose();
              }}
              aria-label="Закрыть"
            >
              ×
            </button>
          </div>

          <div className="region-panel__content">{renderTimelineContent()}</div>
        </div>
      </aside>
    );
  }

  const isOpen = sheetState !== 'closed';

  const onStartDrag = (clientY: number) => {
    dragRef.current.active = true;
    dragRef.current.startY = clientY;
    dragRef.current.startState = sheetState;
  };

  const onMoveDrag = (clientY: number) => {
    if (!dragRef.current.active) return;
    const dy = clientY - dragRef.current.startY;

    if (dy > 60) {
      if (sheetState === 'full') setSheetState('peek');
      else if (sheetState === 'peek') setSheetState('closed');
      dragRef.current.active = false;
      return;
    }

    if (dy < -60) {
      if (sheetState === 'peek') setSheetState('full');
      dragRef.current.active = false;
    }
  };

  const onEndDrag = () => {
    dragRef.current.active = false;
  };

  return (
    <>
      <div
        className={`region-panel__backdrop ${isOpen ? 'is-visible' : ''}`}
        onClick={() => {
          setSheetState('closed');
          onClose();
        }}
      />

      <aside
        className={`region-panel region-panel--sheet ${sheetState === 'peek' ? 'is-peek' : ''} ${
          sheetState === 'full' ? 'is-full' : ''
        } ${sheetState === 'closed' ? 'is-closed' : ''}`}
        aria-hidden={!isOpen}
      >
        <button
          className="region-panel__sheet-grabber"
          type="button"
          aria-label="Переместить панель"
          onPointerDown={(e) => {
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            onStartDrag(e.clientY);
          }}
          onPointerMove={(e) => onMoveDrag(e.clientY)}
          onPointerUp={() => onEndDrag()}
          onPointerCancel={() => onEndDrag()}
          onDoubleClick={() => setSheetState(sheetState === 'full' ? 'peek' : 'full')}
        >
          <span className="region-panel__handle-bar" />
        </button>

        <div className="region-panel__inner">
          <div className="region-panel__top">
            <div className="region-panel__badge" style={{ backgroundColor: region.color }} />
            <div className="region-panel__titlewrap">
              <div className="region-panel__title">{timeline?.regionName ?? region.name}</div>
              <div className="region-panel__subtitle">
                {timeline
                  ? sheetState === 'full'
                    ? 'История музыки по годам'
                    : 'Потяните вверх для чтения'
                  : 'Материал готовится'}
              </div>
            </div>

            <button
              type="button"
              className={`region-panel__switch-compact ${filterEmptyYears ? 'is-on' : ''}`}
              onClick={handleToggleFilterEmptyYears}
              aria-label="Только события"
            >
              <span className="region-panel__switch-track-mini" aria-hidden="true">
                <span className="region-panel__switch-knob-mini" />
              </span>
            </button>
          </div>

          <div className="region-panel__content">{renderTimelineContent()}</div>
        </div>

        <style jsx>{`
          .region-panel__sheet-grabber {
            appearance: none;
            border: none;
            background: transparent;
            width: 100%;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: grab;
            position: absolute;
            top: 0;
            left: 0;
            z-index: 10;
            padding: 6px 0;
          }

          .region-panel__sheet-grabber:active {
            cursor: grabbing;
          }

          .region-panel__handle-bar {
            width: 38px;
            height: 4px;
            border-radius: 999px;
            background: rgba(0, 0, 0, 0.16);
            transition: background 180ms ease, width 180ms ease;
          }

          .region-panel__sheet-grabber:hover .region-panel__handle-bar {
            background: rgba(0, 0, 0, 0.24);
            width: 48px;
          }

          .region-panel__top {
            padding-top: 32px;
            position: relative;
          }

          .region-panel__switch-compact {
            appearance: none;
            border: none;
            background: transparent;
            padding: 4px;
            position: absolute;
            top: 32px;
            right: 10px;
            cursor: pointer;
            z-index: 5;
          }

          .region-panel__switch-track-mini {
            width: 40px;
            height: 22px;
            border-radius: 999px;
            position: relative;
            background: rgba(0, 0, 0, 0.08);
            border: 1px solid rgba(0, 0, 0, 0.10);
            box-shadow: none;
            display: block;
          }

          .region-panel__switch-knob-mini {
            width: 18px;
            height: 18px;
            border-radius: 999px;
            position: absolute;
            top: 1px;
            left: 1px;
            background: rgba(255, 255, 255, 1);
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.14);
            transition: left 160ms ease, background 160ms ease, box-shadow 160ms ease;
          }

          .region-panel__switch-compact.is-on .region-panel__switch-track-mini {
            background: rgba(52, 199, 89, 1);
            border-color: rgba(52, 199, 89, 1);
          }

          .region-panel__switch-compact.is-on .region-panel__switch-knob-mini {
            left: 19px;
            background: rgba(255, 255, 255, 1);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);
          }
        `}</style>
      </aside>
    </>
  );
}
