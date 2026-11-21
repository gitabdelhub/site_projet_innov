import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = (): boolean => {
  return !!(
    supabaseUrl &&
    supabaseUrl !== 'your_supabase_project_url' &&
    supabaseUrl !== 'YOUR_SUPABASE_URL' &&
    supabaseUrl.startsWith('https://') &&
    supabaseAnonKey &&
    supabaseAnonKey !== 'your_supabase_anon_key' &&
    supabaseAnonKey !== 'YOUR_SUPABASE_ANON_KEY' &&
    supabaseAnonKey.length > 20
  );
};

// Only create a real client if credentials are valid; otherwise use a safe fallback URL
// that won't throw on initialization.
const safeUrl = isSupabaseConfigured() ? supabaseUrl : 'https://placeholder.supabase.co';
const safeKey = isSupabaseConfigured() ? supabaseAnonKey : 'placeholder-key-that-is-long-enough-to-not-crash';

export const supabase = createClient(safeUrl, safeKey);
