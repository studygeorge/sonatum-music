'use client';

import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { createPortal } from 'react-dom';

export type ToastKind = 'success' | 'error' | 'info';

type Toast = {
  id: string;
  kind: ToastKind;
  title?: string;
  message: string;
  duration: number;
};

type Ctx = {
  show: (msg: string, opts?: { kind?: ToastKind; title?: string; duration?: number }) => void;
  success: (msg: string, title?: string) => void;
  error: (msg: string, title?: string) => void;
  info: (msg: string, title?: string) => void;
};

const ToastContext = createContext<Ctx | null>(null);

let counter = 0;

// Глобальная обёртка — чтобы можно было звать `toast.error(...)` без useToast()
// в коллбэках вне React-контекста. Регистрируется ToastProvider'ом.
let _global: Ctx | null = null;
export const toast = {
  show: (m: string, opts?: { kind?: ToastKind; title?: string; duration?: number }) => _global?.show(m, opts) ?? window.alert(m),
  success: (m: string, t?: string) => _global?.success(m, t) ?? window.alert(m),
  error:   (m: string, t?: string) => _global?.error(m, t) ?? window.alert(m),
  info:    (m: string, t?: string) => _global?.info(m, t) ?? window.alert(m),
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const remove = useCallback((id: string) => {
    setToasts((arr) => arr.filter((t) => t.id !== id));
  }, []);

  const show = useCallback((msg: string, opts?: { kind?: ToastKind; title?: string; duration?: number }) => {
    const id = `t${++counter}`;
    const kind = opts?.kind || 'info';
    const duration = opts?.duration ?? (kind === 'error' ? 6000 : 4000);
    setToasts((arr) => [...arr, { id, kind, title: opts?.title, message: msg, duration }]);
    if (duration > 0) {
      setTimeout(() => remove(id), duration);
    }
  }, [remove]);

  const ctx: Ctx = {
    show,
    success: (m, t) => show(m, { kind: 'success', title: t }),
    error:   (m, t) => show(m, { kind: 'error',   title: t }),
    info:    (m, t) => show(m, { kind: 'info',    title: t }),
  };

  // Регистрируем глобальный singleton
  useEffect(() => { _global = ctx; return () => { _global = null; }; }, [ctx]);

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      {mounted && createPortal(
        <div style={{
          position: 'fixed',
          bottom: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 3000,
          display: 'flex',
          flexDirection: 'column-reverse',
          gap: 8,
          width: 'calc(100% - 32px)',
          maxWidth: 420,
          pointerEvents: 'none',
        }}>
          {toasts.map((t) => (
            <ToastCard key={t.id} t={t} onClose={() => remove(t.id)} />
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): Ctx {
  const c = useContext(ToastContext);
  if (!c) {
    // Без провайдера — фолбэк на alert/console чтобы старые места не падали.
    return {
      show: (m) => { try { window.alert(m); } catch {} },
      success: (m) => { console.log('[toast]', m); },
      error:   (m) => { try { window.alert(m); } catch {} },
      info:    (m) => { console.log('[toast]', m); },
    };
  }
  return c;
}

function ToastCard({ t, onClose }: { t: Toast; onClose: () => void }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { const id = requestAnimationFrame(() => setVisible(true)); return () => cancelAnimationFrame(id); }, []);

  const colors: Record<ToastKind, { bg: string; fg: string; accent: string; icon: string }> = {
    success: { bg: '#1c1c1e', fg: '#fff',     accent: '#fff',   icon: '✓' },
    error:   { bg: '#fff',    fg: '#1c1c1e',  accent: '#2f9e8f', icon: '!' },
    info:    { bg: '#fff',    fg: '#1c1c1e',  accent: '#1d4cb8', icon: 'i' },
  };
  const c = colors[t.kind];

  return (
    <div
      style={{
        background: c.bg,
        color: c.fg,
        borderRadius: 16,
        padding: '12px 16px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.06)',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        pointerEvents: 'auto',
        cursor: 'pointer',
        transform: visible ? 'translateY(0)' : 'translateY(20px)',
        opacity: visible ? 1 : 0,
        transition: 'transform 240ms cubic-bezier(.2,.8,.2,1), opacity 200ms ease',
        border: t.kind === 'error' ? `1px solid ${c.accent}` : 'none',
      }}
      onClick={onClose}>
      <div
        style={{
          width: 24, height: 24, borderRadius: '50%',
          background: c.accent, color: c.bg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 800, fontSize: 14, flexShrink: 0,
        }}>
        {c.icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {t.title && <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{t.title}</div>}
        <div style={{ fontSize: 13, lineHeight: 1.4 }}>{t.message}</div>
      </div>
    </div>
  );
}
