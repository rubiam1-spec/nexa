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
