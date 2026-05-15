'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/app/lib/api';
import { authStorage } from '@/app/lib/auth';
import { Shield, Lock, Mail } from 'lucide-react';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    console.log('[ADMIN LOGIN] Attempting login:', email);

    try {
      const response = await api.login(email, password);
      
      console.log('[ADMIN LOGIN] Full API response:', response);
      
      if (response.success && response.data) {
        const responseData = response.data as any;
        
        let token, user;
        
        // Обработка вложенности
        if (responseData.data && typeof responseData.data === 'object') {
          token = responseData.data.token;
          user = responseData.data.user;
        } else {
          token = responseData.token;
          user = responseData.user;
        }
        
        console.log('[ADMIN LOGIN] Extracted data:', { 
          hasToken: !!token, 
          hasUser: !!user,
          userRole: user?.role 
        });
        
        if (!token || !user) {
          console.error('[ADMIN LOGIN] Missing token or user in response');
          setError('Ошибка: неполные данные от сервера');
          setLoading(false);
          return;
        }
        
        // ✅ ПРОВЕРКА РОЛИ
        if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
          console.warn('[ADMIN LOGIN] Access denied for role:', user.role);
          setError('Доступ запрещён. Требуются права администратора.');
          setLoading(false);
          return;
        }
        
        console.log('[ADMIN LOGIN] Role check passed:', user.role);
        
        // ✅ СОХРАНЕНИЕ В LOCALSTORAGE
        console.log('[ADMIN LOGIN] Saving to localStorage...');
        authStorage.setToken(token);
        authStorage.setUser(user);
        
        // Проверка сохранения
        const savedToken = authStorage.getToken();
        const savedUser = authStorage.getUser();
        
        console.log('[ADMIN LOGIN] Verification after save:', { 
          savedToken: savedToken?.substring(0, 20) + '...', 
          savedUser: savedUser?.email,
          savedRole: savedUser?.role
        });
        
        if (!savedToken || !savedUser) {
          console.error('[ADMIN LOGIN] localStorage save failed!');
          setError('Ошибка сохранения данных в браузере');
          setLoading(false);
          return;
        }
        
        console.log('[ADMIN LOGIN] ✅ Success! Redirecting to /admin/dashboard');
        
        // ✅ ПОЛНЫЙ РЕДИРЕКТ НА ДАШБОРД
        setTimeout(() => {
          window.location.href = '/admin/dashboard';
        }, 500);
        
      } else {
        console.error('[ADMIN LOGIN] Login failed:', response.error);
        setError(response.error || 'Неверный email или пароль');
        setLoading(false);
      }
    } catch (err) {
      console.error('[ADMIN LOGIN] Exception:', err);
      setError('Произошла ошибка. Попробуйте снова.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="w-full max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gray-900 mb-4">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-semibold text-gray-900 mb-2">
            Панель администратора
          </h1>
          <p className="text-gray-600">
            Войдите используя учётные данные администратора
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-3xl shadow-xl p-8">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
              <p className="text-red-600 text-sm font-medium">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-300 focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 outline-none transition-all"
                  placeholder="admin@sonatum.music"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Пароль
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-300 focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 outline-none transition-all"
                  placeholder="••••••••"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-gray-900 hover:bg-gray-800 text-white font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Вход...
                </span>
              ) : (
                'Войти в панель'
              )}
            </button>
          </form>

          {/* Debug info */}
          <div className="mt-4 p-3 bg-gray-50 rounded-xl text-xs text-gray-600">
            <p><strong>Тестовый админ:</strong></p>
            <p>Email: admin@sonatum.music</p>
            <p>Password: Admin123!</p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-6">
          <a 
            href="/" 
            className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            ← Вернуться на главную
          </a>
        </div>
      </div>
    </div>
  );
}
