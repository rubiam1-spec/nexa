// NEXA — Repositório Supabase de GRUPOS de simulação (Fase 3 — Etapa 5c).
// Migração das escritas cruas de SimuladorPage (salvar grupo multi-unidade).
// Status "active" derivado da fonte única (SimulationGroupStatus). Padrão alinhado
// aos demais repositórios (getSupabaseClientOrThrow + payload snake_case).

import { SimulationGroupStatus } from "../../domain/status/simulationGroup";
import { getSupabaseClientOrThrow } from "./baseRepository";

export interface SimulationGroupInput {
  accountId: string;
  developmentId: string;
  clientId: string | null;
  brokerId: string | null;
  createdBy: string | null;
  title: string;
  valorTotalGrupo: number;
}

export interface SimulationGroupItemInput {
  unitId: string;
  valorUnidade: number;
  entradaPercentual: number;
  entradaValor: number;
  parcelasQuantidade: number;
  parcelasValor: number;
  balaoQuantidade?: number | null;
  balaoValor?: number | null;
  permutaValor?: number | null;
  permutaDescricao?: string | null;
  ordem: number;
}

export async function createSimulationGroup(input: SimulationGroupInput): Promise<string | null> {
  const supabase = getSupabaseClientOrThrow("simulation groups repository");
  const { data, error } = await supabase
    .from("simulation_groups")
    .insert({
      account_id: input.accountId,
      development_id: input.developmentId,
      client_id: input.clientId,
      broker_id: input.brokerId,
      created_by: input.createdBy,
      title: input.title,
      valor_total_grupo: input.valorTotalGrupo,
      status: SimulationGroupStatus.ACTIVE,
    })
    .select("id")
    .single();
  if (error) throw new Error(`Failed to create simulation group: ${error.message}`);
  return (data as { id: string } | null)?.id ?? null;
}

export async function createSimulationGroupItems(
  groupId: string,
  items: SimulationGroupItemInput[],
): Promise<void> {
  const supabase = getSupabaseClientOrThrow("simulation groups repository");
  const { error } = await supabase.from("simulation_group_items").insert(
    items.map((g) => ({
      group_id: groupId,
      unit_id: g.unitId,
      valor_unidade: g.valorUnidade,
      entrada_percentual: g.entradaPercentual,
      entrada_valor: g.entradaValor,
      parcelas_quantidade: g.parcelasQuantidade,
      parcelas_valor: g.parcelasValor,
      balao_quantidade: g.balaoQuantidade ?? null,
      balao_valor: g.balaoValor ?? null,
      permuta_valor: g.permutaValor ?? null,
      permuta_descricao: g.permutaDescricao ?? null,
      ordem: g.ordem,
    })),
  );
  if (error) throw new Error(`Failed to create simulation group items: ${error.message}`);
}
