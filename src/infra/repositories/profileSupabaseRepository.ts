import type { AuthenticatedProfile } from "../../shared/types/auth";
import { normalizeUserRole } from "../../shared/types/role";
import { getSupabaseClientOrThrow } from "./baseRepository";
import { supabase } from "../supabase/supabaseClient";

type ProfileRow = {
  id: string;
  name: string | null;
  full_name: string;
  email: string;
  status: "active" | "inactive";
  role?: string | null;
  avatar_url?: string | null;
  phone?: string | null;
};

function mapProfileRowToProfile(row: ProfileRow): AuthenticatedProfile {
  return {
    id: row.id,
    fullName: row.name || row.full_name,
    email: row.email,
    status: row.status,
    role: normalizeUserRole(row.role ?? null),
    avatarUrl: row.avatar_url ?? null,
    phone: row.phone ?? null,
  };
}

export async function getAuthenticatedProfile(userId: string) {
  const supabase = getSupabaseClientOrThrow("profile repository");

  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, full_name, email, status, role, avatar_url, phone")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load authenticated profile: ${error.message}`);
  }

  return data ? mapProfileRowToProfile(data) : null;
}

export async function updateProfile(userId: string, updates: {
  fullName?: string;
  phone?: string | null;
  avatarUrl?: string | null;
}): Promise<AuthenticatedProfile> {
  const client = getSupabaseClientOrThrow("profile repository");

  const payload: Record<string, unknown> = {};
  if (updates.fullName !== undefined) {
    payload.name = updates.fullName;
    payload.full_name = updates.fullName;
  }
  if (updates.phone !== undefined) payload.phone = updates.phone;
  if (updates.avatarUrl !== undefined) payload.avatar_url = updates.avatarUrl;

  const { data, error } = await client
    .from("profiles")
    .update(payload)
    .eq("id", userId)
    .select("id, name, full_name, email, status, role, avatar_url, phone")
    .single();

  if (error) throw new Error(`Falha ao atualizar perfil: ${error.message}`);
  return mapProfileRowToProfile(data);
}

export async function sendPasswordResetEmail(email: string): Promise<void> {
  if (!supabase) throw new Error("Supabase não configurado.");
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/recuperar-senha`,
  });
  if (error) throw new Error(error.message);
}
