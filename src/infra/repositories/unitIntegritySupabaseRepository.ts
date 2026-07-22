// Consome os RPCs de saúde do dado (JÁ EXISTEM em produção — nunca recriar):
//   check_unit_integrity(p_development_id) -> jsonb de contadores
//   unit_integrity_units(p_development_id, p_issue) -> uuid[] das unidades
import { getSupabaseClientOrThrow } from "./baseRepository";

export type UnitIntegrityCounters = Record<string, number>;

export async function getUnitIntegrity(developmentId: string): Promise<UnitIntegrityCounters> {
  const supabase = getSupabaseClientOrThrow("unit integrity repository");
  const { data, error } = await supabase.rpc("check_unit_integrity", { p_development_id: developmentId });
  if (error) throw new Error(error.message);
  const obj = (data ?? {}) as Record<string, unknown>;
  const out: UnitIntegrityCounters = {};
  for (const [k, v] of Object.entries(obj)) out[k] = Number(v) || 0;
  return out;
}

export async function getUnitIntegrityUnits(developmentId: string, issue: string): Promise<string[]> {
  const supabase = getSupabaseClientOrThrow("unit integrity repository");
  const { data, error } = await supabase.rpc("unit_integrity_units", { p_development_id: developmentId, p_issue: issue });
  if (error) throw new Error(error.message);
  return Array.isArray(data) ? (data as string[]) : [];
}
