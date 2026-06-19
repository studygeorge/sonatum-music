'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Script from 'next/script';
import { createPortal } from 'react-dom';
import { authStorage } from '@/app/lib/auth';

import { toast } from '@/app/components/Toast';
const VK_APP_ID = 54606219;

declare global {
  interface Window {
    VKIDSDK?: any;
    __VKID_INITED?: boolean;
  }
}

/**
 * Кнопка-виджет «Войти через ВКонтакте» через VK ID OneTap SDK.
 * Возвращает access_token нашему /api/auth/vk и сохраняет сессионный токен.
 */
export default function VKAuthButton() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const initedRef = useRef(false);
  const failTimerRef = useRef<any>(null);
  const [working, setWorking] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const tryInit = () => {
      if (initedRef.current) return;
      const VKID = window.VKIDSDK;
      if (!VKID || !containerRef.current) return;
      initedRef.current = true;

      try {
        if (!window.__VKID_INITED) {
          VKID.Config.init({
            app: VK_APP_ID,
            redirectUrl: window.location.origin + '/',
            responseMode: VKID.ConfigResponseMode.Callback,
            source: VKID.ConfigSource.LOWCODE,
            // Пустой scope = базовый профиль + email (если у юзера прикреплён)
            scope: '',
          });
          window.__VKID_INITED = true;
        }
      } catch (e) {
        console.error('[VKID] init error:', e);
        return;
      }

      const oneTap = new VKID.OneTap();
      try { containerRef.current.innerHTML = ''; } catch {}
      oneTap.render({
        container: containerRef.current,
        showAlternativeLogin: true,
        scheme: 'light',
        lang: 0, // ru
      })
      .on(VKID.WidgetEvents.ERROR, (err: any) => console.error('[VKID] widget error:', err))
      .on(VKID.OneTapInternalEvents.LOGIN_SUCCESS, async (payload: any) => {
        // Сразу показываем full-screen overlay — пользователь не должен видеть форму /login
        setWorking(true);
        try {
          const code = payload.code;
          const deviceId = payload.device_id;
          const data = await VKID.Auth.exchangeCode(code, deviceId);
          const r = await fetch('/api/auth/vk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              access_token: data.access_token,
              user_id: data.user_id,
              email: data.email,
              first_name: data.user?.first_name,
              last_name: data.user?.last_name,
              avatar: data.user?.avatar,
            }),
          });
          const j = await r.json();
          if (j.success) {
            authStorage.setToken(j.data.token);
            authStorage.setUser(j.data.user);
            // Hard-navigation вместо router.push — мгновенно убирает форму с экрана
            if (j.data.needsOnboarding) {
              const q = new URLSearchParams();
              if (j.data.onboardingHints?.email) q.set('email', '1');
              if (j.data.onboardingHints?.name) q.set('name', '1');
              window.location.replace(`/auth/onboarding?${q.toString()}`);
            } else {
              window.location.replace('/profile');
            }
          } else {
            setWorking(false);
            toast.error(j.error || 'Не удалось войти через ВК');
          }
        } catch (e: any) {
          console.error('[VKID] exchange error:', e);
          setWorking(false);
          toast.error('Ошибка авторизации ВК. Попробуйте ещё раз.');
        }
      });
    };

    // SDK мог уже загрузиться
    if (window.VKIDSDK) tryInit();
    else {
      const t = setInterval(() => {
        if (window.VKIDSDK) { clearInterval(t); tryInit(); }
      }, 200);
      // Если SDK не подгрузился за 5 сек — показываем подсказку
      failTimerRef.current = setTimeout(() => {
        if (!window.VKIDSDK && containerRef.current) {
          containerRef.current.innerHTML = `
            <div style="padding:14px;border:1px solid var(--border);border-radius:14px;font-size:13px;color:var(--text-secondary);text-align:center;">
              Не удалось загрузить кнопку ВКонтакте.<br/>
              Проверьте, что в браузере не включён блокировщик рекламы или VPN, режущий <code>id.vk.ru</code>.
            </div>`;
        }
      }, 5000);
      return () => {
        clearInterval(t);
        if (failTimerRef.current) clearTimeout(failTimerRef.current);
      };
    }
  }, [router]);

  return (
    <>
      <Script
        src="https://unpkg.com/@vkid/sdk@<3.0.0/dist-sdk/umd/index.js"
        strategy="afterInteractive"
      />
      <div ref={containerRef} style={{ width: '100%', minHeight: 48 }} />

      {mounted && working && createPortal(
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 2000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(255,255,255,0.96)',
            backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
          }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              border: '3px solid #e5e5e7', borderTopColor: '#1c1c1e',
              animation: 'sonatum-spin 0.9s linear infinite',
              margin: '0 auto 16px',
            }} />
            <div style={{ fontSize: 14, color: '#1c1c1e', fontWeight: 600 }}>
              Входим в Сонатум…
            </div>
          </div>
          <style>{`@keyframes sonatum-spin { to { transform: rotate(360deg); } }`}</style>
        </div>,
        document.body
      )}
    </>
  );
}
