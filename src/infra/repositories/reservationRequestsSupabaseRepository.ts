import {
  ReservationStatus,
  type ReservationStatus as ReservationStatusType,
} from "../../domain/reserva/ReservationStatus";
import { ReservationDbStatus, ReservationStatusFromDb } from "../../domain/status/reservation";
import type { ReservationRequest } from "../../shared/types/reservationRequest";
import { getSupabaseClientOrThrow, unwrapSupabaseListResult } from "./baseRepository";

// Vocabulário de status centralizado em src/domain/status/reservation.ts (Fase 3 — Etapa 1).
const dbStatusToEnum = ReservationStatusFromDb;
const enumToDbStatus = ReservationDbStatus;

const validStatuses = new Set<string>([
  ReservationStatus.REQUESTED,
  ReservationStatus.APPROVED,
  ReservationStatus.REJECTED,
  ReservationStatus.CANCELLED,
]);

type ReservationRequestRow = {
  id: string;
  negotiation_id: string;
  proposal_id: string;
  account_id: string;
  development_id: string;
  unit_id: string;
  status: string;
  requested_by: string | null;
  created_at: string;
  updated_at: string;
};

function normalizeReservationRequestStatus(raw: string): ReservationStatusType {
  const trimmed = raw.trim();
  const mapped = dbStatusToEnum[trimmed];
  if (mapped) return mapped;
  const upper = trimmed.toUpperCase();
  if (validStatuses.has(upper)) return upper as ReservationStatusType;
  console.warn(`[reservationRequestsRepository] status desconhecido do banco: "${raw}", usando REQUESTED como fallback`);
  return ReservationStatus.REQUESTED;
}

function mapReservationRequestRow(
  row: ReservationRequestRow,
): ReservationRequest {
  return {
    id: row.id,
    negotiationId: row.negotiation_id,
    proposalId: row.proposal_id,
    accountId: row.account_id,
    developmentId: row.development_id,
    unitId: row.unit_id,
    status: normalizeReservationRequestStatus(row.status),
    requestedBy: row.requested_by,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export async function getReservationRequestsByNegotiation(negotiationId: string) {
  const supabase = getSupabaseClientOrThrow("reservation requests repository");

  const { data, error } = await supabase
    .from("reservation_requests")
    .select(
      "id, negotiation_id, proposal_id, account_id, development_id, unit_id, status, requested_by, created_at, updated_at",
    )
    .eq("negotiation_id", negotiationId)
    .order("created_at", { ascending: false });

  const requests = (data ?? []).map((row) =>
    mapReservationRequestRow(row as ReservationRequestRow),
  );

  return unwrapSupabaseListResult<ReservationRequest>(
    requests,
    error,
    "reservation requests",
  );
}

export async function getReservationRequests(
  accountId: string,
  developmentId: string,
) {
  const supabase = getSupabaseClientOrThrow("reservation requests repository");

  const { data, error } = await supabase
    .from("reservation_requests")
    .select(
      "id, negotiation_id, proposal_id, account_id, development_id, unit_id, status, requested_by, created_at, updated_at",
    )
    .eq("account_id", accountId)
    .eq("development_id", developmentId)
    .order("created_at", { ascending: false });

  const requests = (data ?? []).map((row) =>
    mapReservationRequestRow(row as ReservationRequestRow),
  );

  return unwrapSupabaseListResult<ReservationRequest>(
    requests,
    error,
    "reservation requests",
  );
}

export async function createReservationRequest(input: {
  negotiationId: string;
  proposalId: string;
  accountId: string;
  developmentId: string;
  unitId: string;
  requestedBy: string | null;
}) {
  const supabase = getSupabaseClientOrThrow("reservation requests repository");

  const { data, error } = await supabase
    .from("reservation_requests")
    .insert({
      negotiation_id: input.negotiationId,
      proposal_id: input.proposalId,
      account_id: input.accountId,
      development_id: input.developmentId,
      unit_id: input.unitId,
      status: enumToDbStatus[ReservationStatus.REQUESTED],
      requested_by: input.requestedBy,
      updated_at: new Date().toISOString(),
    })
    .select(
      "id, negotiation_id, proposal_id, account_id, development_id, unit_id, status, requested_by, created_at, updated_at",
    )
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to create reservation request: ${error.message}`);
  }

  if (!data) {
    throw new Error("Reservation request was not returned after insert.");
  }

  return mapReservationRequestRow(data as ReservationRequestRow);
}

export async function updateReservationRequestStatus(
  requestId: string,
  status: ReservationRequest["status"],
) {
  const supabase = getSupabaseClientOrThrow("reservation requests repository");

  const dbStatus = enumToDbStatus[status] ?? status;

  const { data, error } = await supabase
    .from("reservation_requests")
    .update({
      status: dbStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .select(
      "id, negotiation_id, proposal_id, account_id, development_id, unit_id, status, requested_by, created_at, updated_at",
    )
    .maybeSingle();

  if (error) {
    throw new Error(
      `Failed to update reservation request: ${error.message}`,
    );
  }

  if (!data) {
    throw new Error("Reservation request not found for update.");
  }

  return mapReservationRequestRow(data as ReservationRequestRow);
}
