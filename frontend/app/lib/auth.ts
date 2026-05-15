'use client';

const TOKEN_KEY = 'sonatum_token';
const USER_KEY = 'sonatum_user';

export const authStorage = {
  getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(TOKEN_KEY);
  },

  setToken(token: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(TOKEN_KEY, token);
  },

  removeToken(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(TOKEN_KEY);
  },

  getUser(): any | null {
    if (typeof window === 'undefined') return null;
    const userStr = localStorage.getItem(USER_KEY);
    
    // ИСПРАВЛЕНИЕ: проверка на null, undefined и некорректные значения
    if (!userStr || userStr === 'undefined' || userStr === 'null') {
      return null;
    }
    
    try {
      const user = JSON.parse(userStr);
      return user;
    } catch (error) {
      console.error('Error parsing user from localStorage:', error, 'Value:', userStr);
      // Очистить битые данные
      localStorage.removeItem(USER_KEY);
      return null;
    }
  },

  setUser(user: any): void {
    if (typeof window === 'undefined') return;
    
    // ИСПРАВЛЕНИЕ: проверка что user не null/undefined
    if (!user) {
      console.warn('Attempted to set null/undefined user');
      localStorage.removeItem(USER_KEY);
      return;
    }
    
    try {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch (error) {
      console.error('Error saving user to localStorage:', error);
    }
  },

  removeUser(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(USER_KEY);
  },

  clear(): void {
    this.removeToken();
    this.removeUser();
  },
};

export function isAuthenticated(): boolean {
  return !!authStorage.getToken();
}

export function requireAuth(callback: () => void): void {
  if (!isAuthenticated()) {
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    return;
  }
  callback();
}