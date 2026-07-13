import { getSupabaseClientOrThrow } from "./baseRepository";

// Repositório único (Supabase-only) da distribuição de leads. Toda a regra de
// acesso é reforçada pela RLS de lead_distribution / account_settings; aqui só
// montamos as queries e devolvemos shapes já em camelCase. numeric → Number().

export type LeadDistSettings = { enabled: boolean; eligibleRoles: string[] };

export type LeadDistParticipant = {
  id: string;
  consultantId: string;
  name: string;
  role: string;
  active: boolean;
  paused: boolean;
  weight: number;
  currentCount: number;
  lastAssignedAt: string | null;
};

export type EligiblePerson = { userId: string; name: string; role: string };

function nameOf(row: Record<string, unknown>): string {
  const p = (Array.isArray(row.profiles) ? row.profiles[0] : row.profiles) as Record<string, unknown> | null;
  return (p?.name as string) ?? "—";
}

export async function getLeadDistSettings(accountId: string): Promise<LeadDistSettings> {
  const client = getSupabaseClientOrThrow("leadDistribution.getSettings");
  const { data, error } = await client
    .from("account_settings")
    .select("lead_distribution_enabled, lead_distribution_eligible_roles")
    .eq("account_id", accountId)
    .maybeSingle();
  if (error) throw error;
  return {
    enabled: Boolean(data?.lead_distribution_enabled),
    eligibleRoles: (data?.lead_distribution_eligible_roles as string[] | null) ?? ["commercial_consultant"],
  };
}

export async function updateLeadDistSettings(
  accountId: string,
  patch: Partial<{ enabled: boolean; eligibleRoles: string[] }>,
): Promise<void> {
  const client = getSupabaseClientOrThrow("leadDistribution.updateSettings");
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.enabled !== undefined) row.lead_distribution_enabled = patch.enabled;
  if (patch.eligibleRoles !== undefined) row.lead_distribution_eligible_roles = patch.eligibleRoles;
  const { error } = await client.from("account_settings").update(row).eq("account_id", accountId);
  if (error) throw error;
}

export async function getLeadDistParticipants(accountId: string): Promise<LeadDistParticipant[]> {
  const client = getSupabaseClientOrThrow("leadDistribution.getParticipants");
  const { data: rows, error } = await client
    .from("lead_distribution")
    .select("id, consultant_id, active, paused, weight, current_count, last_assigned_at")
    .eq("account_id", accountId);
  if (error) throw error;
  const list = (rows ?? []) as Record<string, unknown>[];
  if (list.length === 0) return [];

  const ids = list.map((r) => r.consultant_id as string);
  const { data: access } = await client
    .from("user_account_access")
    .select("user_id, role, profiles!inner(name)")
    .eq("account_id", accountId)
    .in("user_id", ids);
  const byUser = new Map(
    ((access ?? []) as Record<string, unknown>[]).map((a) => [a.user_id as string, a]),
  );

  return list
    .map((r) => {
      const a = byUser.get(r.consultant_id as string);
      return {
        id: r.id as string,
        consultantId: r.consultant_id as string,
        name: a ? nameOf(a) : "—",
        role: (a?.role as string) ?? "—",
        active: Boolean(r.active),
        paused: Boolean(r.paused),
        weight: Number(r.weight ?? 1),
        currentCount: Number(r.current_count ?? 0),
        lastAssignedAt: (r.last_assigned_at as string) ?? null,
      };
    })
    .sort((x, y) => x.name.localeCompare(y.name));
}

export async function getEligiblePeople(
  accountId: string,
  eligibleRoles: string[],
): Promise<EligiblePerson[]> {
  if (eligibleRoles.length === 0) return [];
  const client = getSupabaseClientOrThrow("leadDistribution.getEligiblePeople");
  const { data, error } = await client
    .from("user_account_access")
    .select("user_id, role, profiles!inner(name)")
    .eq("account_id", accountId)
    .in("role", eligibleRoles);
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[])
    .map((a) => ({ userId: a.user_id as string, name: nameOf(a), role: a.role as string }))
    .sort((x, y) => x.name.localeCompare(y.name));
}

export async function addParticipant(
  accountId: string,
  developmentId: string | null,
  consultantId: string,
): Promise<void> {
  const client = getSupabaseClientOrThrow("leadDistribution.addParticipant");
  const { error } = await client.from("lead_distribution").insert({
    account_id: accountId,
    development_id: developmentId,
    consultant_id: consultantId,
    active: true,
    weight: 1,
    current_count: 0,
  });
  if (error) throw error;
}

export async function removeParticipant(id: string): Promise<void> {
  const client = getSupabaseClientOrThrow("leadDistribution.removeParticipant");
  const { error } = await client.from("lead_distribution").delete().eq("id", id);
  if (error) throw error;
}

export async function setParticipantActive(id: string, active: boolean): Promise<void> {
  const client = getSupabaseClientOrThrow("leadDistribution.setActive");
  const { error } = await client.from("lead_distribution").update({ active }).eq("id", id);
  if (error) throw error;
}

export async function setParticipantWeight(id: string, weight: number): Promise<void> {
  const client = getSupabaseClientOrThrow("leadDistribution.setWeight");
  const { error } = await client.from("lead_distribution").update({ weight }).eq("id", id);
  if (error) throw error;
}

export async function setParticipantPaused(id: string, paused: boolean): Promise<void> {
  const client = getSupabaseClientOrThrow("leadDistribution.setPaused");
  const { error } = await client.from("lead_distribution").update({ paused }).eq("id", id);
  if (error) throw error;
}

export async function resetCounts(accountId: string): Promise<void> {
  const client = getSupabaseClientOrThrow("leadDistribution.resetCounts");
  const { error } = await client
    .from("lead_distribution")
    .update({ current_count: 0, last_assigned_at: null })
    .eq("account_id", accountId);
  if (error) throw error;
}
