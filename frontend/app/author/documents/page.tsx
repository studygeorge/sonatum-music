'use client';
import Link from 'next/link';
export default function Page() {
  return (
    <div className="space-y-6 animate-fadeInUp">
      <section className="relative rounded-3xl overflow-hidden p-7 md:p-10 text-white"
        style={{ background: 'linear-gradient(135deg, #1d4cb8 0%, #2f9e8f 55%, #e6e6e6 100%)' }}>
        <div className="relative z-10 max-w-2xl">
          <div className="text-xs uppercase tracking-widest font-semibold mb-2 opacity-90"></div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">Документы</h1>
        </div>
      </section>
      <div className="apple-card p-10 text-center">
                <h2 className="text-xl font-bold mb-2">Раздел в разработке</h2>
        <p className="text-sm text-[var(--text-secondary)] max-w-md mx-auto mb-5">Скоро: лицензионный договор-оферта, акты, налоговые чеки самозанятого, отчёты по продажам.</p>
        <Link href="/author" className="px-5 py-2.5 rounded-full bg-[var(--text-primary)] text-white text-sm font-medium inline-block">Назад в кабинет</Link>
      </div>
    </div>
  );
}
