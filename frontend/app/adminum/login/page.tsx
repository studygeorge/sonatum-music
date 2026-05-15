'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLogin() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      router.push('/adminum');
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email');
    const password = formData.get('password');
    
    try {
      const res = await fetch(`/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      
      if (res.ok && data.token) {
        localStorage.setItem('token', data.token);
        window.location.href = '/adminum';
      } else {
        setError(data.error || 'Неверный email или пароль');
        setLoading(false);
      }
    } catch (err) {
      setError('Ошибка подключения к серверу');
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-6">
      <div className="bg-white p-8 md:p-12 rounded-3xl shadow-xl w-full max-w-md border border-[var(--border)] animate-fadeInUp">
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-[var(--text-primary)] rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-md">
             <span className="text-white font-bold text-2xl">S</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Админ-панель</h1>
          <p className="text-[var(--text-secondary)]">Sonatum Music Platform</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-medium mb-8 border border-red-100 text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">Email администратора</label>
            <input 
              name="email" 
              type="email" 
              placeholder="admin@sonatum.music" 
              required 
              disabled={loading}
              autoComplete="email"
              className="w-full p-3 rounded-xl border border-[var(--border)] bg-[var(--background)] outline-none focus:ring-2 focus:ring-[var(--accent)] text-sm" 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">Пароль</label>
            <input 
              name="password" 
              type="password" 
              placeholder="••••••••" 
              required 
              disabled={loading}
              className="w-full p-3 rounded-xl border border-[var(--border)] bg-[var(--background)] outline-none focus:ring-2 focus:ring-[var(--accent)] text-sm" 
            />
          </div>
          
          <button 
            type="submit" 
            disabled={loading}
            className={`apple-button w-full text-base py-3 mt-4 ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            {loading ? 'Вход...' : 'Войти в панель'}
          </button>
        </form>
      </div>
    </main>
  );
}
