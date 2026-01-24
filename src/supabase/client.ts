// src/supabase/client.ts

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * IMPORTANT
 * - These values are injected at build time by Vite.
 * - They MUST exist in Netlify environment variables.
 * - anon key is safe for client-side usage (RLS protects data).
 */
if (!supabaseUrl || !supabaseAnonKey) {
  // Do NOT throw hard here in production builds, or the app will blank-screen.
  // Log instead so the UI can still render a meaningful error boundary.
  console.error(
    'Supabase env vars missing. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
  );
}

export const supabase = createClient(
  supabaseUrl ?? '',
  supabaseAnonKey ?? '',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);
