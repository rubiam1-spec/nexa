// Timeline da Ficha da Unidade — consulta TOLERANTE de unit_history (uma unidade,
// desc) + resolução do nome do autor (performed_by = profiles.id). Não usa o
// normalizador legado (que lança em manual_status_change/available). Só leitura.
import { getSupabaseClientOrThrow } from "./baseRepository";

export type UnitTimelineEvent = {
  id: string;
  createdAt: string;
  fromStatus: string | null; // cru (banco/enum); rotulado na UI de forma tolerante
  toStatus: string;
  actionRaw: string; // cru (a UI interpreta label + motivo)
  performedBy: string | null;
  performerName: string | null;
};

export async function getUnitTimeline(unitId: string): Promise<UnitTimelineEvent[]> {
  const supabase = getSupabaseClientOrThrow("unit timeline repository");

  const { data, error } = await supabase
    .from("unit_history")
    .select("id, from_status, to_status, action, performed_by, created_at")
    .eq("unit_id", unitId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Falha ao carregar histórico da unidade: ${error.message}`);

  const rows = (data ?? []) as Array<Record<string, unknown>>;

  // Resolve nomes dos autores numa consulta (performed_by = profiles.id).
  const ids = [...new Set(rows.map((r) => r.performed_by).filter(Boolean))] as string[];
  const nameById = new Map<string, string>();
  if (ids.length > 0) {
    const { data: profs } = await supabase.from("profiles").select("id, name, full_name, email").in("id", ids);
    for (const p of (profs ?? []) as Array<Record<string, unknown>>) {
      nameById.set(p.id as string, (p.name as string) || (p.full_name as string) || (p.email as string) || "—");
    }
  }

  return rows.map((r) => ({
    id: r.id as string,
    createdAt: r.created_at as string,
    fromStatus: (r.from_status as string) ?? null,
    toStatus: r.to_status as string,
    actionRaw: (r.action as string) ?? "",
    performedBy: (r.performed_by as string) ?? null,
    performerName: r.performed_by ? nameById.get(r.performed_by as string) ?? null : null,
  }));
}
