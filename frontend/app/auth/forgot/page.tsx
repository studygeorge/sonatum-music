"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [error, setError] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setStatus("loading");
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error || "Не удалось отправить ссылку");
        setStatus("error");
        return;
      }
      setStatus("ok");
    } catch {
      setError("Сеть недоступна. Попробуйте позже.");
      setStatus("error");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-6">
      <div className="w-full max-w-sm animate-fadeInUp">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Восстановление пароля</h1>
          <p className="text-[var(--text-secondary)] text-sm mt-1">
            Введите email — мы пришлём ссылку для смены пароля
          </p>
        </div>

        <div className="apple-card p-7">
          {status === "ok" ? (
            <div className="text-center py-4">
              <h2 className="text-lg font-semibold mb-2">Письмо отправлено</h2>
              <p className="text-sm text-[var(--text-secondary)]">
                Если такой email зарегистрирован, через минуту придёт ссылка для смены пароля.
                Проверьте папку «Спам».
              </p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600">
                  {error}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="your@email.com"
                  className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-white/80 backdrop-blur focus:outline-none focus:ring-2 focus:ring-indigo-400 transition"
                />
              </div>
              <button
                type="submit"
                disabled={status === "loading"}
                className="w-full py-3.5 rounded-xl bg-[var(--text-primary)] text-white text-sm font-semibold hover:opacity-90 disabled:opacity-60 transition"
              >
                {status === "loading" ? "Отправка..." : "Отправить ссылку"}
              </button>
            </form>
          )}
        </div>

        <p className="text-center mt-5 text-sm text-[var(--text-secondary)]">
          Вспомнили пароль?{" "}
          <Link href="/login" className="text-indigo-500 font-medium hover:underline">
            Войти
          </Link>
        </p>
      </div>
    </div>
  );
}
