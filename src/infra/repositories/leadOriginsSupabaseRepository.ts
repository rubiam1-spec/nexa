import { getSupabaseClientOrThrow } from "./baseRepository";

// Catálogo de origens por conta (lead_origins). Supabase-only; RLS reforça acesso
// (SELECT membros; escrita owner/director/manager). Origens is_system não se
// excluem — só desativam.

export type LeadOrigin = { id: string; slug: string; label: string; isSystem: boolean; active: boolean };

/** slug canônico a partir do label (minúsculo, sem acento, underscore). */
export function slugifyOrigin(label: string): string {
  return label.normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "origem";
}

export async function getLeadOrigins(accountId: string): Promise<LeadOrigin[]> {
  const c = getSupabaseClientOrThrow("leadOrigins.get");
  const { data, error } = await c.from("lead_origins").select("id, slug, label, is_system, active").eq("account_id", accountId).order("is_system", { ascending: false }).order("label");
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: r.id as string, slug: r.slug as string, label: r.label as string,
    isSystem: Boolean(r.is_system), active: Boolean(r.active),
  }));
}

export async function createLeadOrigin(accountId: string, label: string): Promise<void> {
  const c = getSupabaseClientOrThrow("leadOrigins.create");
  const slug = slugifyOrigin(label);
  const { error } = await c.from("lead_origins").insert({ account_id: accountId, slug, label: label.trim(), is_system: false, active: true });
  if (error) throw new Error(error.code === "23505" ? "Já existe uma origem com esse nome." : error.message);
}

export async function setLeadOriginActive(id: string, active: boolean): Promise<void> {
  const c = getSupabaseClientOrThrow("leadOrigins.setActive");
  const { error } = await c.from("lead_origins").update({ active }).eq("id", id);
  if (error) throw error;
}
