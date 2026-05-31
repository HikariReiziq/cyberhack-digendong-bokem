'use client';
import { createContext, useContext, useState, useEffect } from 'react';
import type { User, UserRole } from '@/types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (name: string, email: string, password: string, role: UserRole) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  canEdit: () => boolean;
  canDelete: () => boolean;
  canViewAudit: () => boolean;
  isAdmin: () => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = () => {
      const saved = localStorage.getItem('aromasys_user');
      if (saved) {
        try { setUser(JSON.parse(saved)); } catch {}
      }
    };

    const loadDbLanguage = async () => {
      const token = localStorage.getItem('aromasys_token');
      if (!token) return;
      // If the user already has a local language preference, respect it — don't let the DB override.
      // DB language is only applied on first login (no local pref set yet).
      const existingLang = localStorage.getItem('aromasys_language');
      if (existingLang === 'en' || existingLang === 'id') return;
      try {
        const res = await fetch(`${API_URL}/profile/settings/language`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        const dbLang = data.success && (data.settings?.language === 'en' || data.settings?.language === 'id')
          ? data.settings.language
          : 'en';
        localStorage.setItem('aromasys_language', dbLang);
        window.dispatchEvent(new Event('languageChange'));
      } catch (e) {
        console.error('Error fetching db language preference:', e);
      }
    };

    Promise.resolve().then(() => {
      loadUser();
      loadDbLanguage();
      setLoading(false);
    });

    window.addEventListener('aromasys_avatar_updated', loadUser);
    return () => {
      window.removeEventListener('aromasys_avatar_updated', loadUser);
    };
  }, []);

  async function login(email: string, password: string) {
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Email atau password salah' };
      }
      setUser(data.user);
      localStorage.setItem('aromasys_user', JSON.stringify(data.user));
      localStorage.setItem('aromasys_token', data.token);

      // Only apply DB language preference on login if no local pref exists yet.
      const existingLang = localStorage.getItem('aromasys_language');
      if (existingLang !== 'en' && existingLang !== 'id') {
        try {
          const langRes = await fetch(`${API_URL}/profile/settings/language`, {
            headers: { 'Authorization': `Bearer ${data.token}` }
          });
          const langData = await langRes.json();
          const dbLang = langData.success && (langData.settings?.language === 'en' || langData.settings?.language === 'id')
            ? langData.settings.language
            : 'en';
          localStorage.setItem('aromasys_language', dbLang);
          window.dispatchEvent(new Event('languageChange'));
        } catch {}
      }

      return { success: true };
    } catch {
      return { success: false, error: 'Gagal terhubung ke server.' };
    }
  }

  async function register(name: string, email: string, password: string, role: UserRole) {
    try {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, role }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Gagal mendaftar' };
      }
      setUser(data.user);
      localStorage.setItem('aromasys_user', JSON.stringify(data.user));
      localStorage.setItem('aromasys_token', data.token);
      return { success: true };
    } catch {
      return { success: false, error: 'Gagal terhubung ke server.' };
    }
  }

  function logout() {
    setUser(null);
    localStorage.removeItem('aromasys_user');
    localStorage.removeItem('aromasys_token');
    localStorage.removeItem('aromasys_notifications');
    localStorage.removeItem('sima_arome_user');
  }

  const _role = () => (user?.role || '').toLowerCase();
  const canEdit = () => !!(user && (_role() === 'qc' || _role() === 'admin'));
  const canDelete = () => !!(user && (_role() === 'qc' || _role() === 'admin'));
  const canViewAudit = () => !!(user && (_role() === 'ppic' || _role() === 'admin'));
  const isAdmin = () => !!(user && _role() === 'admin');

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, register, canEdit, canDelete, canViewAudit, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
