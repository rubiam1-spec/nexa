import { supabase } from "../../../infra/supabase/supabaseClient";

export async function signIn(email: string, password: string) {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  return supabase.auth.signInWithPassword({
    email,
    password,
  });
}

export async function signOut() {
  if (!supabase) {
    return { error: null };
  }

  return supabase.auth.signOut();
}

export async function getCurrentUser() {
  if (!supabase) {
    return {
      data: {
        user: null,
      },
      error: null,
    };
  }

  return supabase.auth.getUser();
}

export async function getCurrentSession() {
  if (!supabase) {
    return {
      data: {
        session: null,
      },
      error: null,
    };
  }

  return supabase.auth.getSession();
}

export function onAuthStateChange(
  callback: Parameters<NonNullable<typeof supabase>["auth"]["onAuthStateChange"]>[0],
) {
  if (!supabase) {
    return {
      data: {
        subscription: {
          unsubscribe() {},
        },
      },
    };
  }

  return supabase.auth.onAuthStateChange(callback);
}
