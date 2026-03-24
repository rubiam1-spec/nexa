import type { AccountUser } from "../../shared/types/accountUser";
import type { UserRole } from "../../shared/types/auth";
import { normalizeUserRole } from "../../shared/types/role";
import { getSupabaseClientOrThrow, unwrapSupabaseListResult } from "./baseRepository";
import { supabase } from "../supabase/supabaseClient";

type UserAccountAccessRow = {
  role: UserRole | null;
  profiles:
    | {
        id: string;
        full_name: string;
        email: string;
        status: "active" | "inactive";
      }
    | {
        id: string;
        full_name: string;
        email: string;
        status: "active" | "inactive";
      }[]
    | null;
};

function mapUserAccessRowToUser(
  row: UserAccountAccessRow,
): AccountUser | null {
  const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;

  if (!profile) {
    return null;
  }

  return {
    id: profile.id,
    fullName: profile.full_name,
    email: profile.email,
    role: normalizeUserRole(row.role),
    status: profile.status,
  };
}

export async function inviteUser(input: {
  email: string;
  fullName: string;
  role: UserRole;
  accountId: string;
}): Promise<AccountUser> {
  if (!supabase) {
    throw new Error("Supabase não configurado.");
  }

  // 1. Create auth user via signUp with a temporary password
  const tempPassword = `Nexa_${crypto.randomUUID().slice(0, 12)}!`;
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: input.email,
    password: tempPassword,
    options: {
      data: {
        full_name: input.fullName,
      },
    },
  });

  if (authError) {
    throw new Error(`Falha ao criar usuário: ${authError.message}`);
  }

  const userId = authData.user?.id;
  if (!userId) {
    throw new Error("Usuário criado mas ID não retornado.");
  }

  // 2. Re-authenticate as the current admin (signUp may have switched session)
  // We need to restore the admin session — the signUp with anon key does NOT
  // switch sessions if email confirmation is required (which is the default).
  // If it does switch, the admin will need to log in again.

  // 3. Insert profile record
  const { error: profileError } = await supabase
    .from("profiles")
    .insert({
      id: userId,
      full_name: input.fullName,
      email: input.email,
      name: input.fullName,
      role: input.role,
      status: "active",
    });

  if (profileError) {
    throw new Error(`Perfil criado no auth mas falha ao inserir em profiles: ${profileError.message}`);
  }

  // 4. Insert user_account_access
  const { error: accessError } = await supabase
    .from("user_account_access")
    .insert({
      user_id: userId,
      account_id: input.accountId,
      role: input.role,
    });

  if (accessError) {
    throw new Error(`Perfil criado mas falha ao vincular à conta: ${accessError.message}`);
  }

  return {
    id: userId,
    fullName: input.fullName,
    email: input.email,
    role: input.role,
    status: "active",
  };
}

export async function getUsers(accountId: string) {
  const supabase = getSupabaseClientOrThrow("users repository");

  const { data, error } = await supabase
    .from("user_account_access")
    .select("role, profiles(id, full_name, email, status)")
    .eq("account_id", accountId)
    .order("created_at", { ascending: false });

  const users = (data ?? [])
    .map((row) => mapUserAccessRowToUser(row as UserAccountAccessRow))
    .filter((user): user is AccountUser => user !== null);

  return unwrapSupabaseListResult<AccountUser>(users, error, "users");
}
