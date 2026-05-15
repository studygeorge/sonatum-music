"use client";

import { useState, FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

export default function ResetPasswordPage() {
  const params = useParams();
  const router = useRouter();
  const token = typeof params?.token === "string" ? params.token : "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [error, setError] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Пароль должен быть не короче 8 символов");
      return;
    }
    if (password !== confirm) {
      setError("Пароли не совпадают");
      return;
    }
    setStatus("loading");
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error || "Не удалось сменить пароль");
        setStatus("error");
        return;
      }
      setStatus("ok");
      setTimeout(() => router.push("/login"), 2200);
    } catch {
      setError("Сеть недоступна. Попробуйте позже.");
      setStatus("error");
    }
  };

  if (status === "ok") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="apple-card p-8 max-w-sm text-center">
          <h1 className="text-2xl font-bold mb-2">Пароль изменён</h1>
          <p className="text-[var(--text-secondary)] text-sm">
            Сейчас перенаправим на страницу входа...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-6">
      <div className="w-full max-w-sm animate-fadeInUp">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Новый пароль</h1>
          <p className="text-[var(--text-secondary)] text-sm mt-1">
            Введите пароль, которым будете заходить
          </p>
        </div>

        <div className="apple-card p-7">
          <form onSubmit={submit} className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600">
                {error}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium mb-1.5">Новый пароль</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="Минимум 8 символов"
                className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-white/80 backdrop-blur focus:outline-none focus:ring-2 focus:ring-indigo-400 transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Повторите пароль</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="Минимум 8 символов"
                className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-white/80 backdrop-blur focus:outline-none focus:ring-2 focus:ring-indigo-400 transition"
              />
            </div>
            <button
              type="submit"
              disabled={status === "loading"}
              className="w-full py-3.5 rounded-xl bg-[var(--text-primary)] text-white text-sm font-semibold hover:opacity-90 disabled:opacity-60 transition"
            >
              {status === "loading" ? "Сохранение..." : "Сменить пароль"}
            </button>
          </form>
        </div>

        <p className="text-center mt-5 text-sm text-[var(--text-secondary)]">
          <Link href="/login" className="text-indigo-500 font-medium hover:underline">
            Назад ко входу
          </Link>
        </p>
      </div>
    </div>
  );
}
