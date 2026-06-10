import { getSupabaseClientOrThrow } from "./baseRepository";

// Catálogo de tipos de atividade por conta (activity_kinds). É a fonte da
// Etapa 1 do criador. activities.type segue sendo a verdade do motor; ao
// salvar grava-se type = kind.base_type E kind_id = kind.id.
export interface ActivityKind {
  id: string;
  account_id: string;
  development_id: string | null;
  category: "comercial" | "interno" | "operacional";
  base_type: string;
  key: string;
  label: string;
  icon: string;
  color: string | null;
  branch: "agendamento" | "confeccao";
  autolink: boolean;
  suggested_duration_minutes: number | null;
  default_checklist: unknown; // string[] | { text: string }[]
  fields: string[]; // lista ORDENADA de chaves de campo (dirige a Etapa 2)
  position: number;
  active: boolean;
}

export function normalizeFields(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => String(x)).filter(Boolean);
}

// Normaliza default_checklist (pode vir string[] ou {text}[]) → string[].
export function normalizeChecklist(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x) => (typeof x === "string" ? x : (x as { text?: string })?.text ?? ""))
    .map((s) => String(s).trim())
    .filter(Boolean);
}

export async function fetchActivityKinds(
  accountId: string,
  developmentId: string | null,
): Promise<ActivityKind[]> {
  const client = getSupabaseClientOrThrow("activityKindsRepository.fetchActivityKinds");
  let query = client
    .from("activity_kinds")
    .select("*")
    .eq("account_id", accountId)
    .eq("active", true)
    .order("position", { ascending: true });
  // development_id NULL = vale pra conta toda; ou específico do empreendimento.
  if (developmentId) query = query.or(`development_id.is.null,development_id.eq.${developmentId}`);
  else query = query.is("development_id", null);
  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    ...(r as unknown as ActivityKind),
    fields: normalizeFields(r.fields),
  }));
}
