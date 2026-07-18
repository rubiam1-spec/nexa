import type { AccountUser } from "../../shared/types/accountUser";
import type { UserRole } from "../../shared/types/auth";
import { normalizeUserRole } from "../../shared/types/role";
import { getSupabaseClientOrThrow, unwrapSupabaseListResult } from "./baseRepository";
import { supabase } from "../supabase/supabaseClient";
import { invokeWithError } from "../../services/edgeFunctions/invokeWithError";

// Traduz mensagens conhecidas da invite-user para PT-BR amigável. Casos não mapeados
// exibem a mensagem real do backend (já legível). Regra de tradução fica no serviço,
// nunca na UI.
function mapInviteError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("unable to validate email address")) return "E-mail inválido — confira o endereço.";
  if (m.includes("already been registered")) return "Este e-mail já tem acesso.";
  return message;
}

type UserAccountAccessRow = {
  role: UserRole | null;
  profiles:
    | { id: string; name: string | null; full_name: string | null; email: string; status: "active" | "inactive" }
    | { id: string; name: string | null; full_name: string | null; email: string; status: "active" | "inactive" }[]
    | null;
};

function mapUserAccessRowToUser(row: UserAccountAccessRow): AccountUser | null {
  const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  if (!profile) return null;
  return { id: profile.id, fullName: profile.name || profile.full_name || profile.email, email: profile.email, role: normalizeUserRole(row.role), status: profile.status };
}

export type InviteUserResult = { user: AccountUser; link?: string };

export async function inviteUser(input: {
  email: string;
  fullName: string;
  role: UserRole;
  accountId: string;
}): Promise<InviteUserResult> {
  if (!supabase) throw new Error("Supabase não configurado.");

  // Refresh da sessão para garantir token válido antes de chamar a Edge Function
  const { error: refreshError } = await supabase.auth.refreshSession();
  if (refreshError) throw new Error("Sessão expirada. Faça login novamente.");

  const { data, errorMessage } = await invokeWithError<{ userId?: string; link?: string }>(
    "invite-user",
    {
      body: {
        email: input.email.trim().toLowerCase(),
        name: input.fullName.trim(),
        role: input.role,
        account_id: input.accountId,
      },
    },
  );

  if (errorMessage) throw new Error(mapInviteError(errorMessage));

  return {
    user: {
      id: data?.userId ?? crypto.randomUUID(),
      fullName: input.fullName,
      email: input.email,
      role: input.role,
      status: "active",
    },
    link: data?.link ?? undefined,
  };
}

export async function updateUserRole(userId: string, accountId: string, newRole: UserRole): Promise<void> {
  const supabase = getSupabaseClientOrThrow("users repository");
  const { error: e1 } = await supabase.from("profiles").update({ role: newRole }).eq("id", userId);
  if (e1) throw new Error(`Falha ao atualizar perfil: ${e1.message}`);
  const { error: e2 } = await supabase.from("user_account_access").update({ role: newRole }).eq("user_id", userId).eq("account_id", accountId);
  if (e2) throw new Error(`Falha ao atualizar acesso: ${e2.message}`);
}

export async function deactivateUser(userId: string): Promise<void> {
  const supabase = getSupabaseClientOrThrow("users repository");
  const { error } = await supabase.from("profiles").update({ status: "inactive" }).eq("id", userId);
  if (error) throw new Error(`Falha ao desativar: ${error.message}`);
}

export async function reactivateUser(userId: string): Promise<void> {
  const supabase = getSupabaseClientOrThrow("users repository");
  const { error } = await supabase.from("profiles").update({ status: "active" }).eq("id", userId);
  if (error) throw new Error(`Falha ao reativar: ${error.message}`);
}

export async function countUserNegotiations(userId: string): Promise<number> {
  const supabase = getSupabaseClientOrThrow("users repository");
  const { count, error } = await supabase.from("negotiations").select("id", { count: "exact", head: true }).eq("owner_profile_id", userId);
  if (error) throw new Error(`Falha ao verificar: ${error.message}`);
  return count ?? 0;
}

export async function deleteUser(userId: string, accountId: string): Promise<void> {
  const supabase = getSupabaseClientOrThrow("users repository");
  const { error: e1 } = await supabase.from("user_account_access").delete().eq("user_id", userId).eq("account_id", accountId);
  if (e1) throw new Error(`Falha ao remover acesso: ${e1.message}`);
  const { error: e2 } = await supabase.from("profiles").delete().eq("id", userId);
  if (e2) throw new Error(`Falha ao excluir perfil: ${e2.message}`);
}

export async function getUsers(accountId: string) {
  const supabase = getSupabaseClientOrThrow("users repository");

  const { data, error } = await supabase
    .from("user_account_access")
    .select("role, profiles(id, name, full_name, email, status)")
    .eq("account_id", accountId)
    .neq("role", "broker")
    .order("created_at", { ascending: false });

  const users = (data ?? [])
    .map((row) => mapUserAccessRowToUser(row as UserAccountAccessRow))
    .filter((user): user is AccountUser => user !== null && user.role !== "broker");

  return unwrapSupabaseListResult<AccountUser>(users, error, "users");
}
