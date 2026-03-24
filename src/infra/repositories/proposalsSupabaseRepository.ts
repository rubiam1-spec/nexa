import { ProposalStatus, type ProposalStatus as ProposalStatusType } from "../../domain/proposta/ProposalStatus";
import type { Proposal } from "../../shared/types/proposal";
import { getSupabaseClientOrThrow, unwrapSupabaseListResult } from "./baseRepository";

const dbStatusToEnum: Record<string, ProposalStatusType> = {
  draft: ProposalStatus.DRAFT,
  sent: ProposalStatus.SENT,
  under_analysis: ProposalStatus.UNDER_ANALYSIS,
  accepted: ProposalStatus.ACCEPTED,
  rejected: ProposalStatus.REJECTED,
  expired: ProposalStatus.EXPIRED,
};

const enumToDbStatus: Record<ProposalStatusType, string> = {
  [ProposalStatus.DRAFT]: "draft",
  [ProposalStatus.SENT]: "sent",
  [ProposalStatus.UNDER_ANALYSIS]: "under_analysis",
  [ProposalStatus.ACCEPTED]: "accepted",
  [ProposalStatus.REJECTED]: "rejected",
  [ProposalStatus.EXPIRED]: "expired",
};

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

const selectCols = "id, negotiation_id, account_id, development_id, unit_id, client_id, broker_id, title, amount, status, tipo, entrada_tipo, entrada_valor, entrada_percentual, parcelas_quantidade, parcelas_valor, balao_quantidade, balao_valor, permuta_valor, permuta_descricao, observacoes, created_by, created_at, updated_at";

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
}) {
  const supabase = getSupabaseClientOrThrow("proposals repository");

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
      status: enumToDbStatus[ProposalStatus.DRAFT],
      tipo: input.tipo ?? "proposta",
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
