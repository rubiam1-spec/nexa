import type { AuthenticatedProfile } from "../../shared/types/auth";
import { normalizeUserRole } from "../../shared/types/role";
import { getSupabaseClientOrThrow } from "./baseRepository";

type ProfileRow = {
  id: string;
  full_name: string;
  email: string;
  status: "active" | "inactive";
  role?: string | null;
};

function mapProfileRowToProfile(row: ProfileRow): AuthenticatedProfile {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    status: row.status,
    role: normalizeUserRole(row.role ?? null),
  };
}

export async function getAuthenticatedProfile(userId: string) {
  const supabase = getSupabaseClientOrThrow("profile repository");

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, status, role")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load authenticated profile: ${error.message}`);
  }

  return data ? mapProfileRowToProfile(data) : null;
}
