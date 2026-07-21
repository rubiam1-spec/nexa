import type { Unidade } from "../../domain/unidade/Unidade";
import { UnidadeStatus, type UnidadeStatus as UnidadeStatusType } from "../../domain/unidade/UnidadeStatus";
import { getSupabaseClientOrThrow, unwrapSupabaseListResult } from "./baseRepository";

const dbStatusToEnum: Record<string, UnidadeStatusType> = {
  available: UnidadeStatus.DISPONIVEL,
  in_negotiation: UnidadeStatus.EM_NEGOCIACAO,
  reserved: UnidadeStatus.RESERVADO,
  sold: UnidadeStatus.VENDIDO,
};

const enumToDbStatus: Record<UnidadeStatusType, string> = {
  [UnidadeStatus.DISPONIVEL]: "available",
  [UnidadeStatus.EM_NEGOCIACAO]: "in_negotiation",
  [UnidadeStatus.RESERVADO]: "reserved",
  [UnidadeStatus.VENDIDO]: "sold",
};

const validStatuses = new Set<string>(Object.values(UnidadeStatus));

function normalizeUnitStatus(raw: string): UnidadeStatusType {
  const trimmed = raw.trim();
  // Mapeamento direto do valor lowercase do banco para o enum
  const mapped = dbStatusToEnum[trimmed];
  if (mapped) {
    return mapped;
  }
  // Fallback: tenta uppercase direto (caso o banco já use o enum)
  const upper = trimmed.toUpperCase();
  if (validStatuses.has(upper)) {
    return upper as UnidadeStatusType;
  }
  console.warn(`[unitsRepository] status desconhecido do banco: "${raw}", usando DISPONIVEL como fallback`);
  return UnidadeStatus.DISPONIVEL;
}

type UnitRow = {
  id: string;
  account_id: string;
  development_id: string;
  quadra: string;
  lote: string;
  valor: number;
  status: UnidadeStatus;
  created_at: string;
  updated_at: string;
};

function mapUnitRowToUnit(row: UnitRow): Unidade {
  return {
    id: row.id,
    accountId: row.account_id,
    quadra: row.quadra,
    lote: row.lote,
    valor: Number(row.valor) || 0,
    empreendimentoId: row.development_id,
    status: normalizeUnitStatus(row.status),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export async function getUnits(accountId: string, developmentId: string) {
  const supabase = getSupabaseClientOrThrow("units repository");

  const { data, error } = await supabase
    .from("units")
    .select(
      "id, account_id, development_id, quadra, lote, valor, status, created_at, updated_at",
    )
    .eq("account_id", accountId)
    .eq("development_id", developmentId)
    .order("created_at", { ascending: false });

  const units = (data ?? []).map((row) => mapUnitRowToUnit(row as UnitRow));

  return unwrapSupabaseListResult<Unidade>(units, error, "units");
}

export async function updateUnitStatus(
  unitId: string,
  status: Unidade["status"],
) {
  const supabase = getSupabaseClientOrThrow("units repository");

  const dbStatus = enumToDbStatus[status] ?? status;

  const { data, error } = await supabase
    .from("units")
    .update({
      status: dbStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", unitId)
    .select(
      "id, account_id, development_id, quadra, lote, valor, status, created_at, updated_at",
    )
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to update units: ${error.message}`);
  }

  if (!data) {
    throw new Error("Unit not found for update.");
  }

  return mapUnitRowToUnit(data as UnitRow);
}

// Detalhe completo da unidade para a Ficha (campos que getUnits não traz).
export type UnitDetail = {
  area: number | null;
  areaComum: number | null;
  entradaSugerida: number | null;
  balaoSugerido: number | null;
  parcelaSugerida: number | null;
  socioPermutante: boolean;
};

export async function getUnitDetail(unitId: string): Promise<UnitDetail | null> {
  const supabase = getSupabaseClientOrThrow("units repository");
  const { data, error } = await supabase
    .from("units")
    .select("area, area_comum, entrada_sugerida, balao_sugerido, parcela_sugerida, socio_permutante")
    .eq("id", unitId)
    .maybeSingle();
  if (error) throw new Error(`Falha ao carregar detalhe da unidade: ${error.message}`);
  if (!data) return null;
  const r = data as Record<string, unknown>;
  const num = (v: unknown) => (v == null || v === "" ? null : Number(v));
  return {
    area: num(r.area),
    areaComum: num(r.area_comum),
    entradaSugerida: num(r.entrada_sugerida),
    balaoSugerido: num(r.balao_sugerido),
    parcelaSugerida: num(r.parcela_sugerida),
    socioPermutante: !!r.socio_permutante,
  };
}

// Alteração de status em massa via RPC transacional bulk_update_unit_status
// (JÁ EXISTE em produção — nunca recriar). Retorna { updated, blocked }.
export type BulkStatusBlocked = { unit_id: string; reason: string };
export type BulkStatusResult = { updated: number; blocked: BulkStatusBlocked[] };

export async function updateStatusBulk(
  unitIds: string[],
  status: UnidadeStatusType,
  reason: string,
): Promise<BulkStatusResult> {
  const supabase = getSupabaseClientOrThrow("units repository");
  const { data, error } = await supabase.rpc("bulk_update_unit_status", {
    p_unit_ids: unitIds,
    p_new_status: enumToDbStatus[status] ?? status,
    p_reason: reason,
  });
  // Exceptions do RPC (not_authenticated | invalid_status | reason_required |
  // invalid_batch_size) chegam como error.message; o mapa PT-BR fica no serviço.
  if (error) throw new Error(error.message);
  const r = (data ?? {}) as Record<string, unknown>;
  return {
    updated: Number(r.updated ?? 0),
    blocked: Array.isArray(r.blocked) ? (r.blocked as BulkStatusBlocked[]) : [],
  };
}

export async function createUnit(input: {
  accountId: string;
  developmentId: string;
  quadra: string;
  lote: string;
  valor: number;
}): Promise<Unidade> {
  const supabase = getSupabaseClientOrThrow("units repository");

  const { data, error } = await supabase
    .from("units")
    .insert({
      account_id: input.accountId,
      development_id: input.developmentId,
      quadra: input.quadra,
      lote: input.lote,
      valor: input.valor,
      status: "available",
      updated_at: new Date().toISOString(),
    })
    .select(
      "id, account_id, development_id, quadra, lote, valor, status, created_at, updated_at",
    )
    .maybeSingle();

  if (error) {
    throw new Error(`Falha ao criar unidade: ${error.message}`);
  }

  if (!data) {
    throw new Error("Unidade não retornada após criação.");
  }

  return mapUnitRowToUnit(data as UnitRow);
}

export async function createUnitsInBulk(rows: Array<{
  accountId: string;
  developmentId: string;
  quadra: string;
  lote: string;
  valor: number;
  area?: number;
  areaComum?: number;
  entradaSugerida?: number;
  balaoSugerido?: number;
  parcelaSugerida?: number;
  socioPermutante?: boolean;
  status?: string;
}>): Promise<Unidade[]> {
  const supabase = getSupabaseClientOrThrow("units repository");
  const insertData = rows.map((r) => ({
    account_id: r.accountId,
    development_id: r.developmentId,
    quadra: r.quadra,
    lote: r.lote,
    valor: r.valor,
    area: r.area ?? null,
    area_comum: r.areaComum ?? null,
    entrada_sugerida: r.entradaSugerida ?? null,
    balao_sugerido: r.balaoSugerido ?? null,
    parcela_sugerida: r.parcelaSugerida ?? null,
    socio_permutante: r.socioPermutante ?? false,
    status: r.status ?? "available",
    updated_at: new Date().toISOString(),
  }));
  const { data, error } = await supabase
    .from("units")
    .insert(insertData)
    .select("id, account_id, development_id, quadra, lote, valor, status, created_at, updated_at");
  if (error) throw new Error(`Falha na importação: ${error.message}`);
  return (data ?? []).map((row) => mapUnitRowToUnit(row as UnitRow));
}

export async function updateUnit(unitId: string, input: {
  quadra?: string;
  lote?: string;
  valor?: number;
  area?: number | null;
}): Promise<Unidade> {
  const supabase = getSupabaseClientOrThrow("units repository");
  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.quadra !== undefined) updateData.quadra = input.quadra;
  if (input.lote !== undefined) updateData.lote = input.lote;
  if (input.valor !== undefined) updateData.valor = input.valor;
  if (input.area !== undefined) updateData.area = input.area;
  const { data, error } = await supabase.from("units").update(updateData).eq("id", unitId)
    .select("id, account_id, development_id, quadra, lote, valor, status, created_at, updated_at").maybeSingle();
  if (error) throw new Error(`Falha ao atualizar unidade: ${error.message}`);
  if (!data) throw new Error("Unidade não encontrada.");
  return mapUnitRowToUnit(data as UnitRow);
}

export async function deleteUnit(unitId: string): Promise<void> {
  const supabase = getSupabaseClientOrThrow("units repository");
  const { error } = await supabase.from("units").delete().eq("id", unitId);
  if (error) throw new Error(`Falha ao excluir unidade: ${error.message}`);
}
