import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Server-only Supabase client using the service-role key. This bypasses Row
// Level Security, which is correct here because every call site is a server
// route — the key never reaches the browser. Never import this into a client
// component.

const g = globalThis as unknown as { __jc_supabase?: SupabaseClient };

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

export function supabase(): SupabaseClient {
  if (g.__jc_supabase) return g.__jc_supabase;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  g.__jc_supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return g.__jc_supabase;
}
