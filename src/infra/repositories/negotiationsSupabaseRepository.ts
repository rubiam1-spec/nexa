import type { Negotiation } from "../../shared/types/negotiation";
import {
  NegotiationStatus,
  type NegotiationStatus as NegotiationStatusType,
} from "../../domain/negociacao/NegotiationStatus";
import { getSupabaseClientOrThrow, unwrapSupabaseListResult } from "./baseRepository";

const dbStatusToEnum: Record<string, NegotiationStatusType> = {
  open: NegotiationStatus.OPEN,
  in_progress: NegotiationStatus.IN_PROGRESS,
  won: NegotiationStatus.WON,
  lost: NegotiationStatus.LOST,
  cancelled: NegotiationStatus.CANCELLED,
};

const enumToDbStatus: Record<NegotiationStatusType, string> = {
  [NegotiationStatus.OPEN]: "open",
  [NegotiationStatus.IN_PROGRESS]: "in_progress",
  [NegotiationStatus.WON]: "won",
  [NegotiationStatus.LOST]: "lost",
  [NegotiationStatus.CANCELLED]: "cancelled",
};

const validStatuses = new Set<string>(Object.values(NegotiationStatus));

type NegotiationRow = {
  id: string;
  account_id: string;
  development_id: string;
  unit_id: string;
  client_id: string | null;
  broker_id: string | null;
  status: string;
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
  return {
    id: row.id,
    accountId: row.account_id,
    developmentId: row.development_id,
    unitId: row.unit_id,
    clientId: row.client_id,
    brokerId: row.broker_id,
    status: normalizeNegotiationStatus(row.status),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export async function getNegotiations(accountId: string, developmentId: string) {
  const supabase = getSupabaseClientOrThrow("negotiations repository");

  const { data, error } = await supabase
    .from("negotiations")
    .select(
      "id, account_id, development_id, unit_id, client_id, broker_id, status, created_at, updated_at",
    )
    .eq("account_id", accountId)
    .eq("development_id", developmentId)
    .order("created_at", { ascending: false });

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
}) {
  const supabase = getSupabaseClientOrThrow("negotiations repository");

  const { data, error } = await supabase
    .from("negotiations")
    .insert({
      account_id: input.accountId,
      development_id: input.developmentId,
      unit_id: input.unitId,
      client_id: input.clientId,
      broker_id: input.brokerId,
      status: enumToDbStatus[NegotiationStatus.OPEN],
      updated_at: new Date().toISOString(),
    })
    .select(
      "id, account_id, development_id, unit_id, client_id, broker_id, status, created_at, updated_at",
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
      "id, account_id, development_id, unit_id, client_id, broker_id, status, created_at, updated_at",
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
