import { ProposalStatus, type ProposalStatus as ProposalStatusType } from "../../domain/proposta/ProposalStatus";
import { ProposalDbStatus, ProposalStatusFromDb, PROPOSAL_ACTIVE_CANCELLABLE_DB_VALUES } from "../../domain/status/proposal";
import type { Proposal } from "../../shared/types/proposal";
import { getSupabaseClientOrThrow, unwrapSupabaseListResult } from "./baseRepository";
import { getSimulationById } from "./pipelineSimulationsSupabaseRepository";

// Vocabulário de status centralizado em src/domain/status/proposal.ts (Fase 3 — Etapa 1).
const dbStatusToEnum = ProposalStatusFromDb;
const enumToDbStatus = ProposalDbStatus;

const validStatuses = new Set<string>(Object.values(ProposalStatus));

type ProposalRow = {
  id: string;
  negotiation_id: string;
  account_id: string;
  development_id: string;
  unit_id: string;
  client_id: string | null;
  broker_id: string | null;
  title: string;
  amount: number;
  status: string;
  tipo: string | null;
  entrada_tipo: string | null;
  entrada_valor: number | null;
  entrada_percentual: number | null;
  parcelas_quantidade: number | null;
  parcelas_valor: number | null;
  balao_quantidade: number | null;
  balao_valor: number | null;
  permuta_valor: number | null;
  permuta_descricao: string | null;
  observacoes: string | null;
  simulation_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

function normalizeProposalStatus(raw: string): ProposalStatusType {
  const trimmed = raw.trim();
  const mapped = dbStatusToEnum[trimmed];
  if (mapped) return mapped;
  const upper = trimmed.toUpperCase();
  if (validStatuses.has(upper)) return upper as ProposalStatusType;
  console.warn(`[proposalsRepository] status desconhecido do banco: "${raw}", usando DRAFT como fallback`);
  return ProposalStatus.DRAFT;
}

const selectCols = "id, negotiation_id, account_id, development_id, unit_id, client_id, broker_id, title, amount, status, tipo, entrada_tipo, entrada_valor, entrada_percentual, parcelas_quantidade, parcelas_valor, balao_quantidade, balao_valor, permuta_valor, permuta_descricao, observacoes, simulation_id, created_by, created_at, updated_at";

function mapProposalRowToProposal(row: ProposalRow): Proposal {
  return {
    id: row.id,
    negotiationId: row.negotiation_id,
    accountId: row.account_id,
    developmentId: row.development_id,
    unitId: row.unit_id,
    clientId: row.client_id,
    brokerId: row.broker_id,
    title: row.title,
    amount: Number(row.amount),
    status: normalizeProposalStatus(row.status),
    tipo: row.tipo ?? "proposta",
    entradaTipo: row.entrada_tipo,
    entradaValor: row.entrada_valor ? Number(row.entrada_valor) : null,
    entradaPercentual: row.entrada_percentual ? Number(row.entrada_percentual) : null,
    parcelasQuantidade: row.parcelas_quantidade,
    parcelasValor: row.parcelas_valor ? Number(row.parcelas_valor) : null,
    balaoQuantidade: row.balao_quantidade,
    balaoValor: row.balao_valor ? Number(row.balao_valor) : null,
    permutaValor: row.permuta_valor ? Number(row.permuta_valor) : null,
    permutaDescricao: row.permuta_descricao,
    observacoes: row.observacoes,
    simulationId: row.simulation_id ?? null,
    createdBy: row.created_by,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export async function getProposalsByNegotiation(negotiationId: string) {
  const supabase = getSupabaseClientOrThrow("proposals repository");

  const { data, error } = await supabase
    .from("proposals")
    .select(
      selectCols,
    )
    .eq("negotiation_id", negotiationId)
    .order("created_at", { ascending: false });

  const proposals = (data ?? []).map((row) =>
    mapProposalRowToProposal(row as ProposalRow),
  );

  return unwrapSupabaseListResult<Proposal>(proposals, error, "proposals");
}

export async function getProposals(accountId: string, developmentId: string) {
  const supabase = getSupabaseClientOrThrow("proposals repository");

  const { data, error } = await supabase
    .from("proposals")
    .select(
      selectCols,
    )
    .eq("account_id", accountId)
    .eq("development_id", developmentId)
    .order("created_at", { ascending: false });

  const proposals = (data ?? []).map((row) =>
    mapProposalRowToProposal(row as ProposalRow),
  );

  return unwrapSupabaseListResult<Proposal>(proposals, error, "proposals");
}

export async function createProposal(input: {
  negotiationId: string;
  accountId: string;
  developmentId: string;
  unitId: string;
  clientId: string | null;
  brokerId: string | null;
  title: string;
  amount: number;
  createdBy: string | null;
  tipo?: string;
  entradaTipo?: string;
  entradaValor?: number;
  entradaPercentual?: number;
  parcelasQuantidade?: number;
  parcelasValor?: number;
  balaoQuantidade?: number;
  balaoValor?: number;
  permutaValor?: number;
  permutaDescricao?: string;
  observacoes?: string;
  parentProposalId?: string;
  simulationId?: string | null;
}) {
  const supabase = getSupabaseClientOrThrow("proposals repository");
  const isCounter = input.tipo === "contraproposta" || !!input.parentProposalId;

  const { data, error } = await supabase
    .from("proposals")
    .insert({
      negotiation_id: input.negotiationId,
      account_id: input.accountId,
      development_id: input.developmentId,
      unit_id: input.unitId,
      client_id: input.clientId,
      broker_id: input.brokerId,
      title: input.title,
      amount: input.amount,
      status: isCounter ? enumToDbStatus[ProposalStatus.SENT] : enumToDbStatus[ProposalStatus.DRAFT],
      tipo: input.tipo ?? "proposta",
      parent_proposal_id: input.parentProposalId ?? null,
      entrada_tipo: input.entradaTipo ?? null,
      entrada_valor: input.entradaValor ?? null,
      entrada_percentual: input.entradaPercentual ?? null,
      parcelas_quantidade: input.parcelasQuantidade ?? null,
      parcelas_valor: input.parcelasValor ?? null,
      balao_quantidade: input.balaoQuantidade ?? null,
      balao_valor: input.balaoValor ?? null,
      permuta_valor: input.permutaValor ?? null,
      permuta_descricao: input.permutaDescricao ?? null,
      observacoes: input.observacoes ?? null,
      simulation_id: input.simulationId ?? null,
      created_by: input.createdBy,
      updated_at: new Date().toISOString(),
    })
    .select(
      selectCols,
    )
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to create proposal: ${error.message}`);
  }

  if (!data) {
    throw new Error("Proposal was not returned after insert.");
  }

  return mapProposalRowToProposal(data as ProposalRow);
}

export async function updateProposalStatus(
  proposalId: string,
  status: Proposal["status"],
) {
  const supabase = getSupabaseClientOrThrow("proposals repository");

  const dbStatus = enumToDbStatus[status] ?? status;

  const { data, error } = await supabase
    .from("proposals")
    .update({
      status: dbStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", proposalId)
    .select(
      selectCols,
    )
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to update proposals: ${error.message}`);
  }

  if (!data) {
    throw new Error("Proposal not found for update.");
  }

  return mapProposalRowToProposal(data as ProposalRow);
}

// Edita os campos financeiros de uma proposta em rascunho (sem mudar status).
// Migração da escrita crua de usePipelineActions.criarProposta (Fase 3 — Etapa 5).
export async function updateProposalDetails(
  proposalId: string,
  input: {
    amount: number;
    entradaPercentual: number;
    entradaValor: number;
    parcelasQuantidade: number;
    parcelasValor: number;
  },
) {
  const supabase = getSupabaseClientOrThrow("proposals repository");
  const { error } = await supabase
    .from("proposals")
    .update({
      amount: input.amount,
      entrada_percentual: input.entradaPercentual,
      entrada_valor: input.entradaValor,
      parcelas_quantidade: input.parcelasQuantidade,
      parcelas_valor: input.parcelasValor,
      updated_at: new Date().toISOString(),
    })
    .eq("id", proposalId);
  if (error) throw new Error(`Failed to update proposal details: ${error.message}`);
}

// Rejeita em lote as propostas "ativas canceláveis" de uma negociação (cascata de
// cancelamento). O conjunto vem da fonte única (exclui counter_proposal por design).
export async function rejectActiveProposals(negotiationId: string) {
  const supabase = getSupabaseClientOrThrow("proposals repository");
  const { error } = await supabase
    .from("proposals")
    .update({ status: enumToDbStatus[ProposalStatus.REJECTED], updated_at: new Date().toISOString() })
    .eq("negotiation_id", negotiationId)
    .in("status", PROPOSAL_ACTIVE_CANCELLABLE_DB_VALUES);
  if (error) throw new Error(`Failed to reject active proposals: ${error.message}`);
}

// ── Engrenagem Comercial v1 — vínculo Simulation → Proposta ──

export async function listProposalsBySimulation(
  simulationId: string,
): Promise<Proposal[]> {
  const supabase = getSupabaseClientOrThrow("proposals repository");

  const { data, error } = await supabase
    .from("proposals")
    .select(selectCols)
    .eq("simulation_id", simulationId)
    .order("created_at", { ascending: false });

  const proposals = (data ?? []).map((row) =>
    mapProposalRowToProposal(row as ProposalRow),
  );
  return unwrapSupabaseListResult<Proposal>(proposals, error, "proposals");
}

export type CreateProposalFromSimulationOverrides = {
  title?: string;
  amount?: number;
  entradaTipo?: string;
  entradaValor?: number;
  entradaPercentual?: number;
  parcelasQuantidade?: number;
  parcelasValor?: number;
  balaoQuantidade?: number;
  balaoValor?: number;
  permutaValor?: number;
  permutaDescricao?: string;
  observacoes?: string;
  tipo?: string;
};

/**
 * Cria uma proposta pré-preenchida a partir de uma simulação de pipeline.
 *
 * ATENÇÃO — Intencionalmente ociosa no fluxo UI v1 (não é chamada pelo
 * NegotiationDetailPage). Disponível como endpoint programático para
 * fluxos não-UI (automações, integrações externas, scripts de backfill,
 * bots que gerem propostas automaticamente sem passar pelo form). O fluxo
 * UI da Engrenagem Comercial v1 passa pelo `createProposal` padrão com
 * `simulationId` opcional, para reaproveitar a orquestração de history
 * events + update de negociação do `useProposals.createProposal`. Se
 * alguém precisar disparar "criar proposta a partir de simulação" fora
 * da UI, use esta função — ela valida contas, herda campos e atribui o
 * vínculo `simulation_id` na linha criada. Não remover sem substituir.
 *
 * Regras:
 *   - A simulação deve existir.
 *   - Simulação e negociação devem pertencer à mesma account_id.
 *   - Campos principais são herdados da simulação; `overrides` sobrescreve
 *     pontualmente antes de persistir.
 *   - unit_id é obrigatório no schema de proposals — se a simulação for de
 *     imóvel de terceiro (unit_id null), a função rejeita explicitamente.
 *   - entradaTipo é inferido quando não vem em overrides: "valor" se
 *     entradaValor existir, senão "percentual".
 *   - Status inicial: `ProposalStatus.DRAFT` (mesmo padrão de createProposal
 *     para propostas não-contraproposta).
 *   - title default: "Proposta — {propertyName ou R$ {amount}}".
 */
export async function createProposalFromSimulation(params: {
  simulationId: string;
  negotiationId: string;
  createdBy: string | null;
  title?: string;
  overrides?: CreateProposalFromSimulationOverrides;
}): Promise<Proposal> {
  const supabase = getSupabaseClientOrThrow("proposals repository");

  const sim = await getSimulationById(params.simulationId);
  if (!sim) {
    throw new Error(`Simulation ${params.simulationId} não encontrada.`);
  }

  // Valida que a negociação existe e pertence à mesma conta da simulação.
  const { data: negRow, error: negError } = await supabase
    .from("negotiations")
    .select("id, account_id")
    .eq("id", params.negotiationId)
    .maybeSingle();

  if (negError) {
    throw new Error(
      `Failed to validate negotiation on createProposalFromSimulation: ${negError.message}`,
    );
  }
  if (!negRow) {
    throw new Error(`Negotiation ${params.negotiationId} não encontrada.`);
  }
  if ((negRow as { account_id: string }).account_id !== sim.accountId) {
    throw new Error(
      "Simulação e negociação pertencem a contas diferentes — operação bloqueada.",
    );
  }

  if (!sim.unitId) {
    throw new Error(
      "Simulação é de imóvel de terceiro (sem unit_id). createProposalFromSimulation exige unidade do empreendimento.",
    );
  }

  const overrides = params.overrides ?? {};
  const amount = overrides.amount ?? sim.valorTotal;
  const entradaValor = overrides.entradaValor ?? sim.entradaValor ?? undefined;
  const entradaPercentual =
    overrides.entradaPercentual ?? sim.entradaPercentual ?? undefined;
  const entradaTipo =
    overrides.entradaTipo ??
    (sim.entradaValor != null
      ? "valor"
      : sim.entradaPercentual != null
      ? "percentual"
      : undefined);

  const defaultTitle = sim.propertyName
    ? `Proposta — ${sim.propertyName}`
    : `Proposta — R$ ${amount.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  const title = params.title ?? overrides.title ?? defaultTitle;

  return createProposal({
    negotiationId: params.negotiationId,
    accountId: sim.accountId,
    developmentId: sim.developmentId,
    unitId: sim.unitId,
    clientId: sim.clientId,
    brokerId: sim.brokerId,
    title,
    amount,
    createdBy: params.createdBy,
    tipo: overrides.tipo ?? "proposta",
    entradaTipo,
    entradaValor,
    entradaPercentual,
    parcelasQuantidade:
      overrides.parcelasQuantidade ?? sim.parcelasQuantidade ?? undefined,
    parcelasValor: overrides.parcelasValor ?? sim.parcelasValor ?? undefined,
    balaoQuantidade:
      overrides.balaoQuantidade ?? sim.balaoQuantidade ?? undefined,
    balaoValor: overrides.balaoValor ?? sim.balaoValor ?? undefined,
    permutaValor: overrides.permutaValor ?? sim.permutaValor ?? undefined,
    permutaDescricao:
      overrides.permutaDescricao ?? sim.permutaDescricao ?? undefined,
    observacoes: overrides.observacoes ?? sim.observacoes ?? undefined,
    simulationId: sim.id,
  });
}
