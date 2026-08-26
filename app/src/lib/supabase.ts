import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isBackendConfigured = Boolean(url && anonKey);

// When no project is configured yet (fresh checkout, no .env), we still want
// the app to boot so onboarding/auth screens and practice mode (which needs
// no backend) are explorable. Everything that actually needs the backend
// checks `isBackendConfigured` first and shows a "connect Supabase" state —
// see SUPABASE_SETUP.md.
export const supabase: SupabaseClient | null = isBackendConfigured
  ? createClient(url!, anonKey!, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null;

export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      "Supabase is not configured — set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (see SUPABASE_SETUP.md).",
    );
  }
  return supabase;
}
