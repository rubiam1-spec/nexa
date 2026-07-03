// NEXA — Engrenagem Comercial v1 — Fase 2
// Repositório Supabase para pipeline_simulations. Padrão alinhado com
// os demais repositórios (getSupabaseClientOrThrow + RowType + mapper).
//
// Primeira versão focada nos casos de uso da Fase 2:
//   - getSimulationById → usado por createFromSimulation (proposals)
//   - listSimulationsByNegotiation → usado pelo hook useNegotiationSimulations
//   - linkSimulationToNegotiation / unlinkSimulation → vínculo manual na UI da Fase 3
//
// Mantém intencionalmente FORA do escopo: create/update/delete de simulações,
// que ainda são feitos inline em useEnviarParaPipeline.ts. Migração desses
// métodos é responsabilidade de uma sprint futura de consolidação.

import type { PipelineSimulation } from "../../shared/types/simulation";
import { PipelineSimulationStatus } from "../../domain/status/pipelineSimulation";
import { getSupabaseClientOrThrow, unwrapSupabaseListResult } from "./baseRepository";

type PipelineSimulationRow = {
  id: string;
  account_id: string;
  development_id: string;
  unit_id: string | null;
  client_id: string | null;
  broker_id: string | null;
  created_by: string | null;
  third_party_property_id: string | null;
  property_name: string | null;
  negotiation_id: string | null;
  valor_total: number | string;
  entrada_percentual: number | string | null;
  entrada_valor: number | string | null;
  parcelas_quantidade: number | null;
  parcelas_valor: number | string | null;
  balao_quantidade: number | null;
  balao_valor: number | string | null;
  permuta_valor: number | string | null;
  permuta_descricao: string | null;
  observacoes: string | null;
  status: string;
  follow_up_at: string | null;
  created_at: string;
  updated_at: string;
};

const SELECT_COLS =
  "id, account_id, development_id, unit_id, client_id, broker_id, created_by, third_party_property_id, property_name, negotiation_id, valor_total, entrada_percentual, entrada_valor, parcelas_quantidade, parcelas_valor, balao_quantidade, balao_valor, permuta_valor, permuta_descricao, observacoes, status, follow_up_at, created_at, updated_at";

function toNum(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  return typeof value === "string" ? Number(value) : value;
}

function mapRowToSimulation(row: PipelineSimulationRow): PipelineSimulation {
  const valorTotal = toNum(row.valor_total);
  return {
    id: row.id,
    accountId: row.account_id,
    developmentId: row.development_id,
    unitId: row.unit_id,
    clientId: row.client_id,
    brokerId: row.broker_id,
    createdBy: row.created_by,
    thirdPartyPropertyId: row.third_party_property_id,
    propertyName: row.property_name,
    // Coluna pode estar ausente em bancos antigos — default null.
    negotiationId: row.negotiation_id ?? null,
    valorTotal: valorTotal ?? 0,
    entradaPercentual: toNum(row.entrada_percentual),
    entradaValor: toNum(row.entrada_valor),
    parcelasQuantidade: row.parcelas_quantidade,
    parcelasValor: toNum(row.parcelas_valor),
    balaoQuantidade: row.balao_quantidade,
    balaoValor: toNum(row.balao_valor),
    permutaValor: toNum(row.permuta_valor),
    permutaDescricao: row.permuta_descricao,
    observacoes: row.observacoes,
    status: row.status,
    followUpAt: row.follow_up_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getSimulationById(
  simulationId: string,
): Promise<PipelineSimulation | null> {
  const supabase = getSupabaseClientOrThrow("pipeline simulations repository");

  const { data, error } = await supabase
    .from("pipeline_simulations")
    .select(SELECT_COLS)
    .eq("id", simulationId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load pipeline simulation: ${error.message}`);
  }
  return data ? mapRowToSimulation(data as PipelineSimulationRow) : null;
}

export async function listSimulationsByNegotiation(
  negotiationId: string,
): Promise<PipelineSimulation[]> {
  const supabase = getSupabaseClientOrThrow("pipeline simulations repository");

  const { data, error } = await supabase
    .from("pipeline_simulations")
    .select(SELECT_COLS)
    .eq("negotiation_id", negotiationId)
    .order("created_at", { ascending: false });

  const simulations = ((data ?? []) as PipelineSimulationRow[]).map(
    mapRowToSimulation,
  );
  return unwrapSupabaseListResult<PipelineSimulation>(
    simulations,
    error,
    "pipeline_simulations",
  );
}

export async function linkSimulationToNegotiation(
  simulationId: string,
  negotiationId: string,
): Promise<void> {
  const supabase = getSupabaseClientOrThrow("pipeline simulations repository");

  const { error } = await supabase
    .from("pipeline_simulations")
    .update({ negotiation_id: negotiationId, updated_at: new Date().toISOString() })
    .eq("id", simulationId);

  if (error) {
    throw new Error(
      `Failed to link simulation ${simulationId} to negotiation: ${error.message}`,
    );
  }
}

// Atualiza status da simulação (vocabulário PT — o valor do enum É o valor do banco;
// fonte única em domain/status/pipelineSimulation). Usado ao converter simulação → negociação.
export async function updateSimulationStatus(
  simulationId: string,
  status: PipelineSimulationStatus,
): Promise<void> {
  const supabase = getSupabaseClientOrThrow("pipeline simulations repository");
  const { error } = await supabase
    .from("pipeline_simulations")
    .update({ status })
    .eq("id", simulationId);
  if (error) {
    throw new Error(
      `Failed to update simulation ${simulationId} status: ${error.message}`,
    );
  }
}

export async function unlinkSimulationFromNegotiation(
  simulationId: string,
): Promise<void> {
  const supabase = getSupabaseClientOrThrow("pipeline simulations repository");

  const { error } = await supabase
    .from("pipeline_simulations")
    .update({ negotiation_id: null, updated_at: new Date().toISOString() })
    .eq("id", simulationId);

  if (error) {
    throw new Error(
      `Failed to unlink simulation ${simulationId} from negotiation: ${error.message}`,
    );
  }
}

// ── CRUD de simulação (Fase 3 — Etapa 5c) ──
// Migração das escritas cruas de useEnviarParaPipeline / SimuladorPage / KanbanPage.
// Status "ativa" derivado da fonte única (PT canônico). created_by/follow_up_at só
// entram no payload quando fornecidos — espelha EXATAMENTE o objeto inline (que os
// omitia quando ausentes, preservando o default do banco / valor existente no update).

export interface SimulationWriteInput {
  accountId: string;
  developmentId: string;
  unitId: string | null;
  clientId: string | null;
  brokerId: string | null;
  valorTotal: number;
  entradaPercentual: number;
  entradaValor: number;
  parcelasQuantidade: number;
  parcelasValor: number;
  balaoQuantidade?: number | null;
  balaoValor?: number | null;
  permutaValor?: number | null;
  permutaDescricao?: string | null;
  thirdPartyPropertyId?: string | null;
  propertyName?: string | null;
  negotiationId?: string | null;
  createdBy?: string | null;
  followUpAt?: Date | null;
}

function buildSimulationRow(input: SimulationWriteInput): Record<string, unknown> {
  const row: Record<string, unknown> = {
    account_id: input.accountId,
    development_id: input.developmentId,
    unit_id: input.unitId ?? null,
    client_id: input.clientId ?? null,
    broker_id: input.brokerId ?? null,
    valor_total: input.valorTotal,
    entrada_percentual: input.entradaPercentual,
    entrada_valor: input.entradaValor,
    parcelas_quantidade: input.parcelasQuantidade,
    parcelas_valor: input.parcelasValor,
    balao_quantidade: input.balaoQuantidade ?? null,
    balao_valor: input.balaoValor ?? null,
    permuta_valor: input.permutaValor ?? null,
    permuta_descricao: input.permutaDescricao ?? null,
    third_party_property_id: input.thirdPartyPropertyId ?? null,
    property_name: input.propertyName ?? null,
    negotiation_id: input.negotiationId ?? null,
    status: PipelineSimulationStatus.ATIVA,
  };
  // created_by e follow_up_at: só no payload quando presentes (fiel ao inline).
  if (input.createdBy) row.created_by = input.createdBy;
  if (input.followUpAt) row.follow_up_at = input.followUpAt.toISOString();
  return row;
}

export async function createSimulation(input: SimulationWriteInput): Promise<string | null> {
  const supabase = getSupabaseClientOrThrow("pipeline simulations repository");
  const { data, error } = await supabase
    .from("pipeline_simulations")
    .insert(buildSimulationRow(input))
    .select("id")
    .single();
  if (error) throw new Error(`Failed to create simulation: ${error.message}`);
  return (data as { id: string } | null)?.id ?? null;
}

export async function updateSimulation(simulationId: string, input: SimulationWriteInput): Promise<void> {
  const supabase = getSupabaseClientOrThrow("pipeline simulations repository");
  const { error } = await supabase
    .from("pipeline_simulations")
    .update(buildSimulationRow(input))
    .eq("id", simulationId);
  if (error) throw new Error(`Failed to update simulation ${simulationId}: ${error.message}`);
}

export async function deleteSimulation(simulationId: string): Promise<void> {
  const supabase = getSupabaseClientOrThrow("pipeline simulations repository");
  const { error } = await supabase
    .from("pipeline_simulations")
    .delete()
    .eq("id", simulationId);
  if (error) throw new Error(`Failed to delete simulation ${simulationId}: ${error.message}`);
}
