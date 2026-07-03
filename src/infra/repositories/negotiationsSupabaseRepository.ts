import type { Negotiation } from "../../shared/types/negotiation";
import {
  NegotiationStatus,
  type NegotiationStatus as NegotiationStatusType,
} from "../../domain/negociacao/NegotiationStatus";
import { getSupabaseClientOrThrow, unwrapSupabaseListResult } from "./baseRepository";

const dbStatusToEnum: Record<string, NegotiationStatusType> = {
  open: NegotiationStatus.OPEN,
  in_progress: NegotiationStatus.IN_PROGRESS,
  proposal: NegotiationStatus.PROPOSAL,
  reservation: NegotiationStatus.RESERVATION,
  won: NegotiationStatus.WON,
  lost: NegotiationStatus.LOST,
  cancelled: NegotiationStatus.CANCELLED,
};

// O CHECK negotiations_status_check exige os valores canônicos em UPPERCASE
// (idênticos ao enum de domínio). O mapa de escrita é identidade — nunca gravar
// lowercase, senão a constraint é violada no insert/update.
const enumToDbStatus: Record<NegotiationStatusType, string> = {
  [NegotiationStatus.OPEN]: "OPEN",
  [NegotiationStatus.IN_PROGRESS]: "IN_PROGRESS",
  [NegotiationStatus.PROPOSAL]: "PROPOSAL",
  [NegotiationStatus.RESERVATION]: "RESERVATION",
  [NegotiationStatus.WON]: "WON",
  [NegotiationStatus.LOST]: "LOST",
  [NegotiationStatus.CANCELLED]: "CANCELLED",
};

const validStatuses = new Set<string>(Object.values(NegotiationStatus));

type NegotiationRow = {
  id: string;
  account_id: string;
  development_id: string;
  unit_id: string;
  client_id: string | null;
  broker_id: string | null;
  third_party_property_id: string | null;
  status: string;
  score: number | null;
  temperature: string | null;
  created_at: string;
  updated_at: string;
};

function normalizeNegotiationStatus(raw: string): NegotiationStatusType {
  const trimmed = raw.trim();
  const mapped = dbStatusToEnum[trimmed];
  if (mapped) return mapped;
  const upper = trimmed.toUpperCase();
  if (validStatuses.has(upper)) return upper as NegotiationStatusType;
  console.warn(`[negotiationsRepository] status desconhecido do banco: "${raw}", usando OPEN como fallback`);
  return NegotiationStatus.OPEN;
}

function mapNegotiationRowToNegotiation(row: NegotiationRow): Negotiation {
  const score = row.score ?? 50;
  return {
    id: row.id,
    accountId: row.account_id,
    developmentId: row.development_id,
    unitId: row.unit_id,
    clientId: row.client_id,
    brokerId: row.broker_id,
    thirdPartyPropertyId: row.third_party_property_id ?? null,
    status: normalizeNegotiationStatus(row.status),
    score,
    temperature: (row.temperature as Negotiation["temperature"]) ?? (score > 70 ? "hot" : score >= 40 ? "warm" : "cold"),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export async function getNegotiations(accountId: string, developmentId: string, filters?: { brokerId?: string | null; ownerProfileId?: string | null }) {
  const supabase = getSupabaseClientOrThrow("negotiations repository");

  let query = supabase
    .from("negotiations")
    .select(
      "id, account_id, development_id, unit_id, client_id, broker_id, third_party_property_id, status, score, temperature, created_at, updated_at",
    )
    .eq("account_id", accountId)
    .eq("development_id", developmentId);
  if (filters?.brokerId) query = query.eq("broker_id", filters.brokerId);
  if (filters?.ownerProfileId) query = query.eq("owner_profile_id", filters.ownerProfileId);
  const { data, error } = await query.order("created_at", { ascending: false });

  const negotiations = (data ?? []).map((row) =>
    mapNegotiationRowToNegotiation(row as NegotiationRow),
  );

  return unwrapSupabaseListResult<Negotiation>(
    negotiations,
    error,
    "negotiations",
  );
}

export async function createNegotiation(input: {
  accountId: string;
  developmentId: string;
  unitId: string;
  clientId: string | null;
  brokerId: string | null;
  ownerProfileId?: string | null;
}) {
  const supabase = getSupabaseClientOrThrow("negotiations repository");

  const insertPayload: Record<string, unknown> = {
    account_id: input.accountId,
    development_id: input.developmentId,
    unit_id: input.unitId,
    client_id: input.clientId,
    broker_id: input.brokerId,
    status: enumToDbStatus[NegotiationStatus.OPEN],
    updated_at: new Date().toISOString(),
  };
  if (input.ownerProfileId) insertPayload.owner_profile_id = input.ownerProfileId;

  const { data, error } = await supabase
    .from("negotiations")
    .insert(insertPayload)
    .select(
      "id, account_id, development_id, unit_id, client_id, broker_id, third_party_property_id, status, score, temperature, created_at, updated_at",
    )
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to create negotiation: ${error.message}`);
  }

  if (!data) {
    throw new Error("Negotiation was not returned after insert.");
  }

  return mapNegotiationRowToNegotiation(data as NegotiationRow);
}

export async function updateNegotiationStatus(
  negotiationId: string,
  status: Negotiation["status"],
) {
  const supabase = getSupabaseClientOrThrow("negotiations repository");

  const dbStatus = enumToDbStatus[status] ?? status;

  const { data, error } = await supabase
    .from("negotiations")
    .update({
      status: dbStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", negotiationId)
    .select(
      "id, account_id, development_id, unit_id, client_id, broker_id, third_party_property_id, status, score, temperature, created_at, updated_at",
    )
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to update negotiations: ${error.message}`);
  }

  if (!data) {
    throw new Error("Negotiation not found for update.");
  }

  return mapNegotiationRowToNegotiation(data as NegotiationRow);
}

// ── Migrações de escrita do usePipelineActions (Fase 3 — Etapa 5) ──

// Toca updated_at (o "estágio" é derivado da existência de proposta/reserva).
export async function touchNegotiation(negotiationId: string) {
  const supabase = getSupabaseClientOrThrow("negotiations repository");
  const { error } = await supabase
    .from("negotiations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", negotiationId);
  if (error) throw new Error(`Failed to touch negotiation: ${error.message}`);
}

// Cria a negociação ao converter uma simulação. Preserva EXATAMENTE o payload de
// usePipelineActions.converterSimulacao: owner_profile_id = dono definido pelo fluxo
// (perfil autenticado); se imóvel de terceiro (TPP), development_id = null. Sem updated_at
// (usa o default do banco, como o insert cru).
export async function createNegotiationForConversion(input: {
  accountId: string;
  developmentId: string;
  unitId: string;
  clientId: string | null;
  brokerId: string | null;
  ownerProfileId: string | null;
  thirdPartyPropertyId?: string | null;
}) {
  const supabase = getSupabaseClientOrThrow("negotiations repository");
  const payload: Record<string, unknown> = {
    account_id: input.accountId,
    development_id: input.developmentId,
    unit_id: input.unitId,
    client_id: input.clientId,
    broker_id: input.brokerId,
    status: enumToDbStatus[NegotiationStatus.IN_PROGRESS],
  };
  if (input.ownerProfileId) payload.owner_profile_id = input.ownerProfileId;
  if (input.thirdPartyPropertyId) {
    payload.third_party_property_id = input.thirdPartyPropertyId;
    payload.development_id = null;
  }
  const { error } = await supabase.from("negotiations").insert(payload);
  if (error) throw new Error(`Failed to create negotiation (conversion): ${error.message}`);
}

// Marca a negociação como perdida (cascata de cancelamento), com os campos de perda.
export async function markNegotiationLost(
  negotiationId: string,
  input: { reason: string; lostAtStage: string | null },
) {
  const supabase = getSupabaseClientOrThrow("negotiations repository");
  const { error } = await supabase
    .from("negotiations")
    .update({
      status: enumToDbStatus[NegotiationStatus.LOST],
      lost_reason: input.reason,
      lost_at: new Date().toISOString(),
      lost_at_stage: input.lostAtStage,
      updated_at: new Date().toISOString(),
    })
    .eq("id", negotiationId);
  if (error) throw new Error(`Failed to mark negotiation lost: ${error.message}`);
}
