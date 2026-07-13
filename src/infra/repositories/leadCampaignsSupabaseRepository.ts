import { getSupabaseClientOrThrow } from "./baseRepository";

// Campanhas/Ações (lead_campaigns). Supabase-only; RLS reforça acesso.
// Contagem de leads vinculados em BATCH (uma query, sem N+1).

export type LeadCampaign = {
  id: string; name: string; channel: string; developmentId: string | null;
  utmCampaignMatch: string | null; startsAt: string | null; endsAt: string | null;
  budget: number | null; active: boolean; leadCount: number;
};

export type LeadCampaignInput = {
  name: string; channel: string; developmentId?: string | null;
  utmCampaignMatch?: string | null; startsAt?: string | null; endsAt?: string | null;
  budget?: number | null; active?: boolean;
};

export async function getLeadCampaigns(accountId: string): Promise<LeadCampaign[]> {
  const c = getSupabaseClientOrThrow("leadCampaigns.get");
  const [{ data: rows, error }, { data: links }] = await Promise.all([
    c.from("lead_campaigns").select("id, name, channel, development_id, utm_campaign_match, starts_at, ends_at, budget, active").eq("account_id", accountId).order("active", { ascending: false }).order("created_at", { ascending: false }),
    c.from("clients").select("campaign_id").eq("account_id", accountId).not("campaign_id", "is", null),
  ]);
  if (error) throw error;
  const counts = new Map<string, number>();
  for (const l of (links ?? []) as Record<string, unknown>[]) {
    const id = l.campaign_id as string; counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return ((rows ?? []) as Record<string, unknown>[]).map((r) => ({
    id: r.id as string, name: r.name as string, channel: r.channel as string,
    developmentId: (r.development_id as string) ?? null,
    utmCampaignMatch: (r.utm_campaign_match as string) ?? null,
    startsAt: (r.starts_at as string) ?? null, endsAt: (r.ends_at as string) ?? null,
    budget: r.budget != null ? Number(r.budget) : null, active: Boolean(r.active),
    leadCount: counts.get(r.id as string) ?? 0,
  }));
}

function toRow(input: LeadCampaignInput): Record<string, unknown> {
  return {
    name: input.name.trim(), channel: input.channel,
    development_id: input.developmentId ?? null,
    utm_campaign_match: input.utmCampaignMatch?.trim() || null,
    starts_at: input.startsAt || null, ends_at: input.endsAt || null,
    budget: input.budget ?? null, active: input.active ?? true,
  };
}

export async function createLeadCampaign(accountId: string, createdBy: string | null, input: LeadCampaignInput): Promise<void> {
  const c = getSupabaseClientOrThrow("leadCampaigns.create");
  const { error } = await c.from("lead_campaigns").insert({ account_id: accountId, created_by: createdBy, ...toRow(input) });
  if (error) throw new Error(error.code === "23505" ? "Já existe uma campanha com esse casamento de UTM." : error.message);
}

export async function updateLeadCampaign(id: string, input: LeadCampaignInput): Promise<void> {
  const c = getSupabaseClientOrThrow("leadCampaigns.update");
  const { error } = await c.from("lead_campaigns").update({ ...toRow(input), updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.code === "23505" ? "Já existe uma campanha com esse casamento de UTM." : error.message);
}

export async function setLeadCampaignActive(id: string, active: boolean): Promise<void> {
  const c = getSupabaseClientOrThrow("leadCampaigns.setActive");
  const { error } = await c.from("lead_campaigns").update({ active, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

/** Exclui só quando não há leads vinculados (senão, desativar). */
export async function deleteLeadCampaign(id: string): Promise<void> {
  const c = getSupabaseClientOrThrow("leadCampaigns.delete");
  const { error } = await c.from("lead_campaigns").delete().eq("id", id);
  if (error) throw new Error(error.code === "23503" ? "Campanha com leads vinculados não pode ser excluída — desative-a." : error.message);
}
