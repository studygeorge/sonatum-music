import React from "react";

export function LegalLayout({
  title,
  updatedAt,
  children,
}: {
  title: string;
  updatedAt: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen pt-32 pb-32 px-6 md:px-12 max-w-4xl mx-auto animate-fadeInUp">
      <div className="apple-card p-8 md:p-16">
        <h1 className="text-3xl md:text-4xl font-bold mb-4 break-words">{title}</h1>
        <p className="mb-10 text-sm font-medium text-[var(--text-secondary)]">
          Последнее обновление: {updatedAt}
        </p>
        <div className="text-[var(--text-primary)] text-base md:text-[17px]">{children}</div>
      </div>
    </main>
  );
}
