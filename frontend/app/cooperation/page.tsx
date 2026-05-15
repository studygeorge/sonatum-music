import Link from 'next/link';

const CARDS = [
  {
    href: '/b2b',
    title: 'Для бизнеса и учебных заведений',
    desc: 'Лицензии для рекламы, кино, заведений, учебных программ. Корпоративные подписки.',
  },
  {
    href: '/artists/join',
    title: 'Артистам',
    desc: 'Опубликуйте свои треки и ноты, получайте отчисления, найдите аудиторию.',
  },
  {
    href: '/legal/copyright',
    title: 'Правообладателям',
    desc: 'Сообщить о нарушении авторских прав, заявить контент, оформить эксклюзив.',
  },
];

export default function CooperationPage() {
  return (
    <main className="min-h-screen pt-10 md:pt-14 pb-24 px-6 md:px-12 max-w-6xl mx-auto">
      <h1 className="text-4xl lg:text-5xl font-bold tracking-tight mb-3">Сотрудничество</h1>
      <p className="text-lg text-[var(--text-secondary)] mb-12 max-w-2xl">
        Выберите направление — мы поможем вам разместить, защитить или лицензировать
        музыку на платформе «Сонатум».
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {CARDS.map(c => (
          <Link href={c.href} key={c.href} className="group">
            <div className="apple-card hover-scale p-8 h-full flex flex-col">
              <h2 className="text-xl font-bold tracking-tight mb-3 group-hover:text-[var(--accent)] transition-colors">
                {c.title}
              </h2>
              <p className="text-[var(--text-secondary)] text-sm leading-relaxed flex-grow">
                {c.desc}
              </p>
              <span className="text-sm font-semibold text-[var(--accent)] mt-6">
                Перейти к заявке →
              </span>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
