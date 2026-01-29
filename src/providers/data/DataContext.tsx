import { createContext, ReactNode, useContext, useMemo } from 'react';
import type { IDataProvider } from './IDataProvider';
import { getDataProviderMode } from './providerMode';
import { LocalDataProvider } from './local/LocalDataProvider';
import { SupabaseDataProvider } from './supabase/SupabaseDataProvider';
import { supabase } from '../../supabase/client';

const DataContext = createContext<IDataProvider | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const provider = useMemo<IDataProvider>(() => {
    const mode = getDataProviderMode();
    return mode === 'local' ? new LocalDataProvider() : new SupabaseDataProvider(supabase);
  }, []);

  return <DataContext.Provider value={provider}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
