'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { api } from '@/app/lib/api';
import { authStorage } from '@/app/lib/auth';
import Link from 'next/link';

// Тот же красивый full-screen viewer, что используется на странице трека.
// dynamic + ssr:false — react-pdf требует canvas/DOMMatrix.
const SheetMusicViewer = dynamic(
  () => import('@/app/components/SheetMusicViewer'),
  { ssr: false, loading: () => <FullScreenSpinner label="Открываем партитуру…" /> }
);

function FullScreenSpinner({ label }: { label: string }) {
  return (
    <div className="fixed inset-0 z-[99999] bg-[#fdfdfd] flex flex-col items-center justify-center gap-4">
      <div className="w-10 h-10 rounded-full border-4 border-gray-200 border-t-[var(--accent)] animate-spin" />
      <span className="text-sm text-[var(--text-secondary)]">{label}</span>
    </div>
  );
}

export default function SheetViewerPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [sheet, setSheet] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [needPremium, setNeedPremium] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.getSheetMusic(params.id);
        if (cancelled) return;
        if (res.success && res.data) {
          setSheet(res.data);
        } else if (res.error === "PREMIUM_REQUIRED") {
          setNeedPremium(true);
        } else {
          setNotFound(true);
        }
      } catch {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [params.id]);

  const checkoutPremium = async () => {
    const token = authStorage.getToken();
    if (!token) {
      router.push('/(auth)/login');
      return;
    }
    try {
      const r = await fetch('/api/payments/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tier: 'PREMIUM' }),
      });
      const j = await r.json();
      if (j?.success && j?.paymentUrl) {
        window.location.href = j.paymentUrl;
        return;
      }
      alert(j?.error || 'Не удалось перейти к оплате');
    } catch {
      alert('Ошибка сети');
    }
  };

  if (loading) return <FullScreenSpinner label="Загружаем ноту…" />;

  if (needPremium) {
    return (
      <div className="fixed inset-0 z-[99999] bg-[#fdfdfd] flex flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-2xl font-bold">Ноты доступны по подписке</h1>
        <p className="text-[var(--text-secondary)] max-w-md">Полный нотный архив открывается с тарифом Sonatum Premium. Оформите подписку, чтобы читать ноты онлайн.</p>
        <div className="flex gap-3 mt-4">
          <button onClick={checkoutPremium} className="apple-button">Оформить Premium</button>
          <Link href="/sheets" className="apple-button-secondary">Назад в архив</Link>
        </div>
      </div>
    );
  }
  if (notFound || !sheet) {
    return (
      <div className="fixed inset-0 z-[99999] bg-[#fdfdfd] flex flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-2xl font-bold">Партитура не найдена</h1>
        <p className="text-[var(--text-secondary)]">Возможно, она была удалена или ссылка устарела.</p>
        <button
          onClick={() => router.push('/sheets')}
          className="apple-button mt-4"
        >
          Вернуться в архив
        </button>
      </div>
    );
  }

  const composerName = sheet.composer?.name || sheet.composer || '';
  const title = composerName ? `${composerName} — ${sheet.title}` : sheet.title;

  return (
    <SheetMusicViewer
      sheetId={sheet.id}
      pdfUrl={sheet.pdfUrl}
      title={title}
      onClose={() => router.push('/sheets')}
    />
  );
}
