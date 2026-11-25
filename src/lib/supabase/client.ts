import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? '';
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ?? '';

export const isSupabaseConfigured: boolean = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl.startsWith('https://')
);

export const supabaseConfigStatus = {
  hasUrl: Boolean(supabaseUrl),
  hasAnonKey: Boolean(supabaseAnonKey),
  isReady: isSupabaseConfigured,
  missingVariables: [
    ...(!supabaseUrl ? ['VITE_SUPABASE_URL'] : []),
    ...(!supabaseAnonKey ? ['VITE_SUPABASE_ANON_KEY'] : []),
  ],
};

let cachedClient: SupabaseClient | null = null;

/**
 * Retourne le client Supabase navigateur uniquement configuré avec la clé publique ANON.
 * Aucune clé secrète (service_role) n'est jamais utilisée côté frontend.
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured) {
    return null;
  }
  if (!cachedClient) {
    cachedClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return cachedClient;
}
