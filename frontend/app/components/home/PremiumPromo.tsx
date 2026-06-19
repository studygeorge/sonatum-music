'use client';

import { authStorage } from '@/app/lib/auth';

import { toast } from '@/app/components/Toast';
export default function PremiumPromo() {
  return (
    <section className="relative">
      <div
        className="relative rounded-3xl overflow-hidden p-8 md:p-12 text-white"
        style={{
          background:
            'linear-gradient(135deg, #1d4cb8 0%, #2c5fc7 35%, #c91c1c 100%)',
        }}
      >
        {/* Декоративные белые блобы для свечения */}
        <div
          className="absolute -top-24 -right-16 w-96 h-96 rounded-full blur-3xl opacity-25"
          style={{ background: '#ffffff' }}
        />
        <div
          className="absolute -bottom-24 left-1/4 w-80 h-80 rounded-full blur-3xl opacity-20"
          style={{ background: '#ffffff' }}
        />

        <div className="relative z-10 grid md:grid-cols-2 gap-10 items-center">
          {/* Левая часть */}
          <div>
            <div className="inline-block px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-xs font-bold tracking-wider uppercase mb-5 border border-white/30 text-white">
              Sonatum Premium
            </div>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4 leading-tight text-white">
              Слушайте без границ
            </h2>
            <p className="text-base md:text-lg text-white/90 mb-8 max-w-md leading-relaxed">
              Нотный архив, тексты произведений и каталог без рекламы.
            </p>
            <div className="flex flex-wrap gap-3 mb-6">
              <button
                onClick={async () => {
                  const token = authStorage.getToken();
                  if (!token) {
                    window.location.href = '/(auth)/login';
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
                    } else {
                      toast.error(j?.error || 'Не удалось перейти к оплате');
                    }
                  } catch {
                    toast.error('Ошибка сети');
                  }
                }}
                className="bg-white text-[#1d4cb8] px-7 py-3.5 rounded-full font-bold text-[15px] hover:bg-white/90 transition-all shadow-lg"
              >
                Оформить подписку
              </button>
            </div>
            <p className="text-xs text-white/70">
              299 ₽/мес · Можно отменить в любой момент
            </p>
          </div>

          {/* Правая часть — список фич без эмодзи */}
          <ul className="space-y-3">
            {[
              'Полный нотный архив и тексты произведений',
              'Без рекламы',
              'Безлимит плейлистов и истории',
            ].map(f => (
              <li
                key={f}
                className="flex items-center gap-3 p-4 rounded-2xl bg-white/12 backdrop-blur-sm border border-white/20"
              >
                <span className="w-2 h-2 rounded-full bg-white shrink-0" />
                <span className="text-[15px] text-white font-medium">{f}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
