// NEXA — Serviço de salvamento de GRUPO de simulação multi-unidade (Fase 3 — Etapa 5c).
// Extrai a orquestração que vivia no onConfirm do SimuladorPage (guarda-corpo 4:
// regra sai do .tsx). Preserva EXATAMENTE o comportamento anterior:
//   - cada item do grupo vira uma pipeline_simulation individual (status "ativa");
//   - metadados do grupo em simulation_groups (status "active");
//   - itens do grupo em simulation_group_items, com a UNIDADE ATUAL anexada NO FIM
//     e `ordem` sequencial;
//   - best-effort: falhas de escrita são engolidas (como os `.then(()=>{},()=>{})`
//     do inline), sem abortar o restante.
import { createSimulation } from "../../../infra/repositories/pipelineSimulationsSupabaseRepository";
import {
  createSimulationGroup,
  createSimulationGroupItems,
  type SimulationGroupItemInput,
} from "../../../infra/repositories/simulationGroupsSupabaseRepository";

export interface GrupoSimItem {
  unitId: string;
  valorTotal: number;
  entradaPct: number;
  entradaValor: number;
  parcelas: number;
  parcelaValor: number;
  balaoQtd?: number;
  balaoValor?: number;
  permutaValor?: number;
  permutaDesc?: string;
}

export interface SalvarGrupoInput {
  accountId: string;
  developmentId: string;
  clientId: string | null;
  brokerId: string | null;
  createdBy: string | null;
  title: string;
  valorTotalGrupo: number;
  /** Itens adicionais do grupo (fora a unidade atual). */
  groupItems: GrupoSimItem[];
  /** Unidade atual — anexada no FIM dos itens do grupo (não vira sim aqui: já é salva à parte). */
  currentItem?: GrupoSimItem | null;
}

export async function salvarGrupoSimulacao(input: SalvarGrupoInput): Promise<void> {
  // 1. Cada item do grupo vira uma pipeline_simulation individual. `|| null` preserva
  //    a semântica do inline (0 → null nos campos de balão/permuta).
  for (const g of input.groupItems) {
    try {
      await createSimulation({
        accountId: input.accountId,
        developmentId: input.developmentId,
        unitId: g.unitId,
        clientId: input.clientId,
        brokerId: input.brokerId,
        createdBy: input.createdBy,
        valorTotal: g.valorTotal,
        entradaPercentual: g.entradaPct,
        entradaValor: g.entradaValor,
        parcelasQuantidade: g.parcelas,
        parcelasValor: g.parcelaValor,
        balaoQuantidade: g.balaoQtd || null,
        balaoValor: g.balaoValor || null,
        permutaValor: g.permutaValor || null,
        permutaDescricao: g.permutaDesc || null,
      });
    } catch {
      /* best-effort — como o `.then(()=>{},()=>{})` do inline */
    }
  }

  // 2. Metadados do grupo.
  let groupId: string | null = null;
  try {
    groupId = await createSimulationGroup({
      accountId: input.accountId,
      developmentId: input.developmentId,
      clientId: input.clientId,
      brokerId: input.brokerId,
      createdBy: input.createdBy,
      title: input.title,
      valorTotalGrupo: input.valorTotalGrupo,
    });
  } catch {
    return; // grupo falhou → não há o que vincular (igual ao reject handler do inline)
  }
  if (!groupId) return;

  // 3. Itens do grupo: os adicionais + a unidade atual NO FIM; `ordem` sequencial.
  const allItems: GrupoSimItem[] = [...input.groupItems];
  if (input.currentItem) allItems.push(input.currentItem);
  const rows: SimulationGroupItemInput[] = allItems.map((g, i) => ({
    unitId: g.unitId,
    valorUnidade: g.valorTotal,
    entradaPercentual: g.entradaPct,
    entradaValor: g.entradaValor,
    parcelasQuantidade: g.parcelas,
    parcelasValor: g.parcelaValor,
    balaoQuantidade: g.balaoQtd || null,
    balaoValor: g.balaoValor || null,
    permutaValor: g.permutaValor || null,
    permutaDescricao: g.permutaDesc || null,
    ordem: i,
  }));
  try {
    await createSimulationGroupItems(groupId, rows);
  } catch {
    /* best-effort */
  }
}
