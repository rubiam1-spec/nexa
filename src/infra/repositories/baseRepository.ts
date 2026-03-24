import { supabase } from "../supabase/supabaseClient";

export function getSupabaseClientOrThrow(scope: string) {
  if (!supabase) {
    throw new Error(
      `Supabase client is not configured for ${scope}. Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY before using repositories reais.`,
    );
  }

  return supabase;
}

export function unwrapSupabaseListResult<T>(
  data: T[] | null,
  error: Error | null,
  entityName: string,
) {
  if (error) {
    throw new Error(`Failed to load ${entityName}: ${error.message}`);
  }

  return data ?? [];
}
