// Минимальный неблокирующий toast вместо browser alert().
// Использование: toast('Текст уведомления');  или  toast('Ошибка', 'error')
// Без зависимостей, без React-контекста — чистый DOM, чтобы можно было звать
// из любого хендлера и не возиться с провайдерами.

type ToastKind = 'success' | 'error' | 'info';

const HOST_ID = 'sonatum-admin-toast-host';

function ensureHost(): HTMLElement {
  if (typeof document === 'undefined') return null as any;
  let host = document.getElementById(HOST_ID);
  if (!host) {
    host = document.createElement('div');
    host.id = HOST_ID;
    host.style.cssText = [
      'position:fixed',
      'right:1.25rem',
      'bottom:1.25rem',
      'z-index:9999',
      'display:flex',
      'flex-direction:column',
      'gap:.5rem',
      'pointer-events:none',
      'max-width:24rem',
    ].join(';');
    document.body.appendChild(host);
  }
  return host;
}

export function toast(message: string, kind: ToastKind = 'info', ttl = 3000) {
  if (typeof document === 'undefined') return;
  const host = ensureHost();
  const el = document.createElement('div');

  // Монохромные стили — чёрный/серый/белый.
  const base = [
    'pointer-events:auto',
    'padding:.75rem 1rem',
    'border-radius:.75rem',
    'box-shadow:0 8px 24px rgba(0,0,0,.15)',
    'font-size:.875rem',
    'line-height:1.3',
    'font-weight:500',
    'transform:translateY(.5rem)',
    'opacity:0',
    'transition:opacity .2s ease, transform .2s ease',
    'max-width:24rem',
    'word-break:break-word',
  ];

  if (kind === 'error') {
    base.push('background:#fff', 'color:#000', 'border:2px solid #000');
  } else if (kind === 'success') {
    base.push('background:#000', 'color:#fff');
  } else {
    base.push('background:#1f2937', 'color:#fff'); // gray-800
  }

  el.style.cssText = base.join(';');
  el.textContent = message;
  host.appendChild(el);

  // Запускаем появление
  requestAnimationFrame(() => {
    el.style.opacity = '1';
    el.style.transform = 'translateY(0)';
  });

  const remove = () => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(.5rem)';
    setTimeout(() => el.remove(), 200);
  };

  setTimeout(remove, ttl);
  el.addEventListener('click', remove);
}
