import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { supabase } from '../../supabase/client';

export type AppRole = 'owner' | 'admin' | 'tech';

export type AuthUser = {
  id: string;
  email: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  isLoading: boolean;
  signInWithPassword: (email: string, password: string) => Promise<{ ok: true } | { ok: false; message: string }>;
  signUpWithPassword: (email: string, password: string) => Promise<{ ok: true } | { ok: false; message: string }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  function clearSupabaseAuthStorage() {
    try {
      const prefixes = ['sb-'];
      for (const store of [window.localStorage, window.sessionStorage]) {
        const keys: string[] = [];
        for (let i = 0; i < store.length; i++) {
          const k = store.key(i);
          if (!k) continue;
          if (prefixes.some((p) => k.startsWith(p)) && k.includes('auth')) keys.push(k);
        }
        for (const k of keys) store.removeItem(k);
      }
    } catch {
      // ignore
    }
  }

  async function hardResetToLogin() {
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore
    }
    clearSupabaseAuthStorage();
    setUser(null);
    setIsLoading(false);
    navigate('/login', { replace: true });
  }

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          const msg = (error.message ?? '').toLowerCase();
          // If the refresh token is invalid/missing, Supabase can't restore the session.
          // Never hang the app — force a clean logout and return to login.
          if (msg.includes('refresh token') || msg.includes('invalid refresh')) {
            await hardResetToLogin();
            return;
          }
        }
        const sessionUser = data.session?.user ?? null;
        if (!mounted) return;
        setUser(sessionUser ? { id: sessionUser.id, email: sessionUser.email ?? '' } : null);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    init();

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      // Supabase emits this when refresh fails (v2). Treat it like a forced logout.
      if (event === 'TOKEN_REFRESH_FAILED') {
        void hardResetToLogin();
        return;
      }
      const sessionUser = session?.user ?? null;
      setUser(sessionUser ? { id: sessionUser.id, email: sessionUser.email ?? '' } : null);
      setIsLoading(false);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      async signInWithPassword(email, password) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) return { ok: false, message: error.message };
        return { ok: true };
      },
      async signUpWithPassword(email, password) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) return { ok: false, message: error.message };
        return { ok: true };
      },
      async signOut() {
        await supabase.auth.signOut();
      },
    }),
    [user, isLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}


