export type DataProviderMode = 'supabase' | 'local';

export function getDataProviderMode(): DataProviderMode {
  const mode = (import.meta.env.VITE_DATA_PROVIDER || 'supabase') as DataProviderMode;
  if (import.meta.env.MODE === 'production' && mode === 'local') {
    // Hard safety: production builds should not use local storage.
    return 'supabase';
  }
  return mode;
}
