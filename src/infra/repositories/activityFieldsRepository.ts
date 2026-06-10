import { getSupabaseClientOrThrow } from "./baseRepository";

// Buscas leves para os controles da Etapa 2 (cliente/corretor/unidade).
// Retornam shapes mínimos — sem mapear domínio inteiro.

export type PickOption = { id: string; name: string };

export async function searchClientsLite(accountId: string, q: string, limit = 8): Promise<PickOption[]> {
  const client = getSupabaseClientOrThrow("activityFieldsRepository.searchClientsLite");
  let query = client.from("clients").select("id, name").eq("account_id", accountId).order("name").limit(limit);
  if (q.trim()) query = query.ilike("name", `%${q.trim()}%`);
  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({ id: r.id as string, name: (r.name as string) ?? "—" }));
}

export async function searchBrokersLite(accountId: string, q: string, limit = 8): Promise<PickOption[]> {
  const client = getSupabaseClientOrThrow("activityFieldsRepository.searchBrokersLite");
  let query = client.from("brokers").select("id, name").eq("account_id", accountId).eq("status", "active").order("name").limit(limit);
  if (q.trim()) query = query.ilike("name", `%${q.trim()}%`);
  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({ id: r.id as string, name: (r.name as string) ?? "—" }));
}

export type UnitOption = { id: string; quadra: string | null; lote: string | null; status: string | null };

export async function fetchUnitsLite(accountId: string, developmentId: string | null, limit = 1000): Promise<UnitOption[]> {
  const client = getSupabaseClientOrThrow("activityFieldsRepository.fetchUnitsLite");
  // quadra/lote são TEXTO — a ordenação numérica é feita no cliente.
  let query = client.from("units").select("id, quadra, lote, status").eq("account_id", accountId).limit(limit);
  if (developmentId) query = query.eq("development_id", developmentId);
  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    quadra: (r.quadra as string) ?? null,
    lote: (r.lote as string) ?? null,
    status: (r.status as string) ?? null,
  }));
}
