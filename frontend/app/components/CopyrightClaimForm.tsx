"use client";

import React, { useState } from "react";

type FormState = {
  claimantName: string;
  claimantOrg: string;
  email: string;
  phone: string;
  workTitle: string;
  workAuthor: string;
  infringingUrl: string;
  description: string;
  agree: boolean;
};

const initial: FormState = {
  claimantName: "",
  claimantOrg: "",
  email: "",
  phone: "",
  workTitle: "",
  workAuthor: "",
  infringingUrl: "",
  description: "",
  agree: false,
};

export function CopyrightClaimForm() {
  const [data, setData] = useState<FormState>(initial);
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setData((d) => ({ ...d, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg(null);
    try {
      const res = await fetch("/api/copyright-claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setErrorMsg(json.error || "Не удалось отправить жалобу");
        setStatus("error");
        return;
      }
      setStatus("ok");
      setData(initial);
    } catch (err) {
      setErrorMsg("Сеть недоступна. Попробуйте позже.");
      setStatus("error");
    }
  };

  if (status === "ok") {
    return (
      <div className="mt-12 p-8 rounded-2xl bg-green-50 border border-green-200">
        <h3 className="text-xl font-bold mb-2 text-green-800">Жалоба отправлена</h3>
        <p className="text-green-700">
          Спасибо. Мы свяжемся с вами по указанному email в течение 5 рабочих дней.
        </p>
      </div>
    );
  }

  const cls =
    "w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-white focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition";

  return (
    <form onSubmit={submit} className="mt-12 space-y-5">
      <h2 className="text-xl md:text-2xl font-bold mb-2">Форма жалобы</h2>
      <p className="text-sm text-[var(--text-secondary)] mb-4">
        Все поля, отмеченные *, обязательны. Скан доверенности и иные приложения вышлите
        на info@sonatum-music.ru, указав в теме номер этой жалобы.
      </p>

      <div className="grid md:grid-cols-2 gap-4">
        <label className="block">
          <span className="block text-sm font-medium mb-2">ФИО заявителя *</span>
          <input
            required
            type="text"
            value={data.claimantName}
            onChange={(e) => set("claimantName", e.target.value)}
            className={cls}
          />
        </label>
        <label className="block">
          <span className="block text-sm font-medium mb-2">Организация / должность</span>
          <input
            type="text"
            value={data.claimantOrg}
            onChange={(e) => set("claimantOrg", e.target.value)}
            className={cls}
          />
        </label>
        <label className="block">
          <span className="block text-sm font-medium mb-2">Email *</span>
          <input
            required
            type="email"
            value={data.email}
            onChange={(e) => set("email", e.target.value)}
            className={cls}
          />
        </label>
        <label className="block">
          <span className="block text-sm font-medium mb-2">Телефон</span>
          <input
            type="tel"
            value={data.phone}
            onChange={(e) => set("phone", e.target.value)}
            className={cls}
          />
        </label>
      </div>

      <label className="block">
        <span className="block text-sm font-medium mb-2">Название произведения *</span>
        <input
          required
          type="text"
          value={data.workTitle}
          onChange={(e) => set("workTitle", e.target.value)}
          className={cls}
        />
      </label>

      <label className="block">
        <span className="block text-sm font-medium mb-2">
          Автор произведения / правообладатель *
        </span>
        <input
          required
          type="text"
          value={data.workAuthor}
          onChange={(e) => set("workAuthor", e.target.value)}
          className={cls}
        />
      </label>

      <label className="block">
        <span className="block text-sm font-medium mb-2">
          Ссылка на спорный материал на sonatum-music.ru *
        </span>
        <input
          required
          type="url"
          placeholder="https://sonatum-music.ru/tracks/..."
          value={data.infringingUrl}
          onChange={(e) => set("infringingUrl", e.target.value)}
          className={cls}
        />
      </label>

      <label className="block">
        <span className="block text-sm font-medium mb-2">
          Описание нарушения *
        </span>
        <textarea
          required
          rows={5}
          value={data.description}
          onChange={(e) => set("description", e.target.value)}
          className={cls}
        />
      </label>

      <label className="flex items-start gap-3 text-sm">
        <input
          required
          type="checkbox"
          checked={data.agree}
          onChange={(e) => set("agree", e.target.checked)}
          className="mt-1 shrink-0"
        />
        <span className="text-[var(--text-secondary)]">
          Подтверждаю достоверность сведений и согласен на обработку персональных данных
          в соответствии с <a href="/legal/personal-data" className="underline">Политикой обработки ПД</a>.
        </span>
      </label>

      {status === "error" && errorMsg && (
        <p className="text-sm text-red-600">{errorMsg}</p>
      )}

      <button
        type="submit"
        disabled={status === "loading"}
        className="px-8 py-4 rounded-full bg-[var(--text-primary)] text-white font-semibold hover:opacity-90 transition disabled:opacity-50"
      >
        {status === "loading" ? "Отправка..." : "Отправить жалобу"}
      </button>
    </form>
  );
}
