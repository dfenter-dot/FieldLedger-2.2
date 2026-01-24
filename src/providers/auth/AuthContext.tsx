import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import type { AppUser, Permissions, Role } from './types';
import { getDataProviderMode } from '../data/providerMode';

type AuthContextValue = {
  user: AppUser | null;
  has: (perm: keyof Permissions) => boolean;
  // In v0.1 these are stubs. Supabase auth wiring will implement them.
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function buildMockUser(role: Role, isAppOwner: boolean): AppUser {
  const basePerms: Permissions =
    role === 'admin'
      ? {
          'admin.access': true,
          'discount.apply': true,
          'materials.edit_user': true,
          'materials.override_app': true,
          'assemblies.edit_user': true,
          'assemblies.override_app': true,
        }
      : {
          'discount.apply': true,
        };

  return {
    id: isAppOwner ? 'app-owner' : 'mock-user',
    email: isAppOwner ? 'owner@fieldledger.test' : 'tech@fieldledger.test',
    companyId: 'mock-company',
    role,
    permissions: basePerms,
    isAppOwner,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);

  useEffect(() => {
    // Local provider mode is intended for StackBlitz testing:
    // - autologin as App Owner Admin by default
    // - no external auth required
    const mode = getDataProviderMode();
    if (mode === 'local') {
      setUser(buildMockUser('admin', true));
    } else {
      // Supabase auth will set real user here.
      // For now, we still set a safe "admin" placeholder so the app can compile and run.
      setUser(buildMockUser('admin', false));
    }
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    has: (perm) => Boolean(user?.permissions?.[perm] ?? false),
    signOut: async () => {
      setUser(null);
    },
  }), [user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
