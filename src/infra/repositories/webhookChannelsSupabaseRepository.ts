import { getSupabaseClientOrThrow } from "./baseRepository";

// Canais de entrada (webhook_endpoints) — L2.1b. Supabase-only; RLS reforça.
// A Edge receive-lead identifica o canal por `api_key` (plaintext, header
// x-api-key OU ?key=). Portanto exibimos/rotacionamos `api_key`. NÃO tocamos na
// receive-lead. `source` guarda o SLUG da origem (receive-lead grava clients.origin=source).

export const RECEIVE_LEAD_URL = "https://phpbsiyxwsbzeevqgixk.supabase.co/functions/v1/receive-lead";

/** Plataforma (provider_adapter) → label + slug de origem sugerido + instrução. */
export const PROVIDER_ADAPTERS: { value: string; label: string; originSlug: string; instructions: string }[] = [
  { value: "landing_page", label: "Landing própria", originSlug: "landing_page",
    instructions: "No seu formulário/landing, envie um POST para a URL com o header x-api-key (a chave abaixo) e body JSON: { \"name\": \"João\", \"phone\": \"45999...\", \"email\": \"...\", \"campaign\": \"...\" }." },
  { value: "google_lead_form", label: "Google Ads", originSlug: "google_ads",
    instructions: "No Google Ads → seu formulário de lead → Integrações → Webhook: cole a URL do webhook e a chave (API Key) no campo de chave. Use o botão \"Enviar dados de teste\" do Google para validar; o lead de teste aparecerá em Leads." },
  { value: "meta_bridge", label: "Meta (via ponte)", originSlug: "meta_ads",
    instructions: "Configure a ponte (Zapier/Make/n8n) para chamar esta URL com header x-api-key ao receber um Lead Ad. Mapeie os campos full_name/nome, email e phone_number/telefone para name, email e phone." },
  { value: "tiktok", label: "TikTok", originSlug: "tiktok_ads",
    instructions: "Na ponte do TikTok Lead Gen, chame esta URL com header x-api-key e mapeie nome, email e telefone para name/email/phone." },
  { value: "linkedin", label: "LinkedIn", originSlug: "linkedin_ads",
    instructions: "Na ponte do LinkedIn Lead Gen Forms, chame esta URL com header x-api-key e mapeie nome, email e telefone para name/email/phone." },
  { value: "taboola", label: "Taboola", originSlug: "taboola",
    instructions: "Na ponte do Taboola Lead, chame esta URL com header x-api-key e mapeie nome, email e telefone para name/email/phone." },
  { value: "generic", label: "Outro / genérico", originSlug: "outro",
    instructions: "Envie um POST para a URL com header x-api-key e body JSON com name, phone, email (e opcionalmente campaign)." },
];

export const DISTRIBUTION_MODES = [
  { value: "fixed", label: "Responsável fixo" },
  { value: "round_robin", label: "Rodízio (roleta)" },
  { value: "unassigned", label: "Sem responsável" },
] as const;

export function providerLabel(v: string): string {
  return PROVIDER_ADAPTERS.find((p) => p.value === v)?.label ?? v;
}
export function providerInstructions(v: string): string {
  return PROVIDER_ADAPTERS.find((p) => p.value === v)?.instructions ?? PROVIDER_ADAPTERS[PROVIDER_ADAPTERS.length - 1].instructions;
}

export type LeadChannel = {
  id: string; name: string; source: string; apiKey: string; isActive: boolean;
  defaultTemperature: string; defaultAssignedTo: string | null; defaultDevelopmentId: string | null;
  distributionMode: string; providerAdapter: string; fallbackAssignedTo: string | null;
  totalReceived: number; lastReceivedAt: string | null; eventsCount: number;
};

export type LeadChannelInput = {
  name: string; source: string; providerAdapter: string; distributionMode: string;
  defaultTemperature: string; defaultDevelopmentId: string | null;
  defaultAssignedTo: string | null; fallbackAssignedTo: string | null;
};

const SELECT = "id, name, source, api_key, is_active, default_temperature, default_assigned_to, default_development_id, distribution_mode, provider_adapter, fallback_assigned_to, total_received, last_received_at";

export async function getLeadChannels(accountId: string): Promise<LeadChannel[]> {
  const c = getSupabaseClientOrThrow("channels.get");
  const [{ data: rows, error }, { data: events }] = await Promise.all([
    c.from("webhook_endpoints").select(SELECT).eq("account_id", accountId).order("created_at", { ascending: false }),
    c.from("webhook_events").select("endpoint_id").eq("account_id", accountId),
  ]);
  if (error) throw error;
  const evCount = new Map<string, number>();
  for (const e of (events ?? []) as Record<string, unknown>[]) {
    const id = e.endpoint_id as string | null; if (id) evCount.set(id, (evCount.get(id) ?? 0) + 1);
  }
  return ((rows ?? []) as Record<string, unknown>[]).map((r) => ({
    id: r.id as string, name: r.name as string, source: r.source as string, apiKey: r.api_key as string,
    isActive: Boolean(r.is_active), defaultTemperature: (r.default_temperature as string) ?? "warm",
    defaultAssignedTo: (r.default_assigned_to as string) ?? null,
    defaultDevelopmentId: (r.default_development_id as string) ?? null,
    distributionMode: (r.distribution_mode as string) ?? "fixed",
    providerAdapter: (r.provider_adapter as string) ?? "generic",
    fallbackAssignedTo: (r.fallback_assigned_to as string) ?? null,
    totalReceived: Number(r.total_received ?? 0), lastReceivedAt: (r.last_received_at as string) ?? null,
    eventsCount: evCount.get(r.id as string) ?? 0,
  }));
}

function toRow(input: LeadChannelInput): Record<string, unknown> {
  return {
    name: input.name.trim(), source: input.source, provider_adapter: input.providerAdapter,
    distribution_mode: input.distributionMode, default_temperature: input.defaultTemperature,
    default_development_id: input.defaultDevelopmentId ?? null,
    // fixed → responsável fixo; round_robin → sem responsável fixo mas com fallback.
    default_assigned_to: input.distributionMode === "fixed" ? (input.defaultAssignedTo ?? null) : null,
    fallback_assigned_to: input.distributionMode === "round_robin" ? (input.fallbackAssignedTo ?? null) : null,
    updated_at: new Date().toISOString(),
  };
}

export async function createLeadChannel(accountId: string, createdBy: string | null, input: LeadChannelInput): Promise<void> {
  const c = getSupabaseClientOrThrow("channels.create");
  const { error } = await c.from("webhook_endpoints").insert({ account_id: accountId, created_by: createdBy, ...toRow(input) });
  if (error) throw new Error(error.message);
}

export async function updateLeadChannel(id: string, input: LeadChannelInput): Promise<void> {
  const c = getSupabaseClientOrThrow("channels.update");
  const { error } = await c.from("webhook_endpoints").update(toRow(input)).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function setLeadChannelActive(id: string, isActive: boolean): Promise<void> {
  const c = getSupabaseClientOrThrow("channels.setActive");
  const { error } = await c.from("webhook_endpoints").update({ is_active: isActive, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

/** Regenera a api_key (hex 32 bytes). A anterior para de funcionar imediatamente.
 *  Seguro: receive-lead valida contra `api_key` e não há trigger de sync. */
export async function regenerateApiKey(id: string): Promise<string> {
  const c = getSupabaseClientOrThrow("channels.regenerate");
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const key = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  const { error } = await c.from("webhook_endpoints").update({ api_key: key, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
  return key;
}

/** Excluir só quando nunca recebeu nada (senão, desativar). */
export async function deleteLeadChannel(channel: { id: string; totalReceived: number; eventsCount: number }): Promise<void> {
  if (channel.totalReceived > 0 || channel.eventsCount > 0) {
    throw new Error("Canal com leads recebidos não pode ser excluído — desative-o.");
  }
  const c = getSupabaseClientOrThrow("channels.delete");
  const { error } = await c.from("webhook_endpoints").delete().eq("id", channel.id);
  if (error) throw new Error(error.message);
}
