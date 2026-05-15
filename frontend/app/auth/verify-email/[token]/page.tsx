"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

export default function VerifyEmailPage() {
  const params = useParams();
  const token = typeof params?.token === "string" ? params.token : "";
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [message, setMessage] = useState("");
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    (async () => {
      try {
        const res = await fetch("/api/auth/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const json = await res.json();
        if (res.ok && json.success) {
          setStatus("ok");
          setMessage(json?.data?.email || "");
        } else {
          setStatus("error");
          setMessage(json?.error || "Ссылка недействительна");
        }
      } catch {
        setStatus("error");
        setMessage("Сеть недоступна. Попробуйте позже.");
      }
    })();
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-6">
      <div className="w-full max-w-sm animate-fadeInUp">
        <div className="apple-card p-8 text-center">
          {status === "loading" && (
            <>
              <h1 className="text-2xl font-bold mb-2">Подтверждаем email…</h1>
              <p className="text-[var(--text-secondary)] text-sm">Минутку, проверяем ссылку.</p>
            </>
          )}
          {status === "ok" && (
            <>
              <h1 className="text-2xl font-bold mb-2">Email подтверждён</h1>
              <p className="text-[var(--text-secondary)] text-sm mb-6">
                {message ? `Адрес ${message} активирован.` : "Адрес активирован."} Теперь можно войти.
              </p>
              <Link
                href="/login"
                className="inline-block px-6 py-3 rounded-full bg-[var(--text-primary)] text-white text-sm font-semibold"
              >
                Войти
              </Link>
            </>
          )}
          {status === "error" && (
            <>
              <h1 className="text-2xl font-bold mb-2">Не получилось</h1>
              <p className="text-red-600 text-sm mb-6">{message}</p>
              <Link
                href="/login"
                className="inline-block px-6 py-3 rounded-full bg-[var(--text-primary)] text-white text-sm font-semibold"
              >
                На страницу входа
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
