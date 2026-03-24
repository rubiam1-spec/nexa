import {
  ReservationStatus,
  type ReservationStatus as ReservationStatusType,
} from "../../domain/reserva/ReservationStatus";
import type { Reservation } from "../../shared/types/reservation";
import { getSupabaseClientOrThrow, unwrapSupabaseListResult } from "./baseRepository";

const dbStatusToEnum: Record<string, ReservationStatusType> = {
  requested: ReservationStatus.REQUESTED,
  approved: ReservationStatus.APPROVED,
  rejected: ReservationStatus.REJECTED,
  active: ReservationStatus.ACTIVE,
  cancelled: ReservationStatus.CANCELLED,
  expired: ReservationStatus.EXPIRED,
  converted: ReservationStatus.CONVERTED,
};

const enumToDbStatus: Record<ReservationStatusType, string> = {
  [ReservationStatus.REQUESTED]: "requested",
  [ReservationStatus.APPROVED]: "approved",
  [ReservationStatus.REJECTED]: "rejected",
  [ReservationStatus.ACTIVE]: "active",
  [ReservationStatus.CANCELLED]: "cancelled",
  [ReservationStatus.EXPIRED]: "expired",
  [ReservationStatus.CONVERTED]: "converted",
};

const validStatuses = new Set<string>(Object.values(ReservationStatus));

type ReservationRow = {
  id: string;
  reservation_request_id: string;
  negotiation_id: string;
  account_id: string;
  development_id: string;
  unit_id: string;
  status: string;
  started_at: string;
  expires_at: string;
  created_at: string;
  updated_at: string;
};

function normalizeReservationStatus(raw: string): ReservationStatusType {
  const trimmed = raw.trim();
  const mapped = dbStatusToEnum[trimmed];
  if (mapped) return mapped;
  const upper = trimmed.toUpperCase();
  if (validStatuses.has(upper)) return upper as ReservationStatusType;
  console.warn(`[reservationsRepository] status desconhecido do banco: "${raw}", usando REQUESTED como fallback`);
  return ReservationStatus.REQUESTED;
}

function mapReservationRow(row: ReservationRow): Reservation {
  return {
    id: row.id,
    reservationRequestId: row.reservation_request_id,
    negotiationId: row.negotiation_id,
    accountId: row.account_id,
    developmentId: row.development_id,
    unitId: row.unit_id,
    status: normalizeReservationStatus(row.status),
    startedAt: new Date(row.started_at),
    expiresAt: new Date(row.expires_at),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export async function getReservationsByNegotiation(negotiationId: string) {
  const supabase = getSupabaseClientOrThrow("reservations repository");

  const { data, error } = await supabase
    .from("reservations")
    .select(
      "id, reservation_request_id, negotiation_id, account_id, development_id, unit_id, status, started_at, expires_at, created_at, updated_at",
    )
    .eq("negotiation_id", negotiationId)
    .order("created_at", { ascending: false });

  const reservations = (data ?? []).map((row) =>
    mapReservationRow(row as ReservationRow),
  );

  return unwrapSupabaseListResult<Reservation>(
    reservations,
    error,
    "reservations",
  );
}

export async function getReservations(accountId: string, developmentId: string) {
  const supabase = getSupabaseClientOrThrow("reservations repository");

  const { data, error } = await supabase
    .from("reservations")
    .select(
      "id, reservation_request_id, negotiation_id, account_id, development_id, unit_id, status, started_at, expires_at, created_at, updated_at",
    )
    .eq("account_id", accountId)
    .eq("development_id", developmentId)
    .order("created_at", { ascending: false });

  const reservations = (data ?? []).map((row) =>
    mapReservationRow(row as ReservationRow),
  );

  return unwrapSupabaseListResult<Reservation>(
    reservations,
    error,
    "reservations",
  );
}

export async function createReservation(input: {
  reservationRequestId: string;
  negotiationId: string;
  accountId: string;
  developmentId: string;
  unitId: string;
  startedAt: Date;
  expiresAt: Date;
  status: Reservation["status"];
}) {
  const supabase = getSupabaseClientOrThrow("reservations repository");

  const { data, error } = await supabase
    .from("reservations")
    .insert({
      reservation_request_id: input.reservationRequestId,
      negotiation_id: input.negotiationId,
      account_id: input.accountId,
      development_id: input.developmentId,
      unit_id: input.unitId,
      status: enumToDbStatus[input.status] ?? input.status,
      started_at: input.startedAt.toISOString(),
      expires_at: input.expiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select(
      "id, reservation_request_id, negotiation_id, account_id, development_id, unit_id, status, started_at, expires_at, created_at, updated_at",
    )
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to create reservation: ${error.message}`);
  }

  if (!data) {
    throw new Error("Reservation was not returned after insert.");
  }

  return mapReservationRow(data as ReservationRow);
}

export async function updateReservationStatus(
  reservationId: string,
  status: Reservation["status"],
) {
  const supabase = getSupabaseClientOrThrow("reservations repository");

  const dbStatus = enumToDbStatus[status] ?? status;

  const { data, error } = await supabase
    .from("reservations")
    .update({
      status: dbStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", reservationId)
    .select(
      "id, reservation_request_id, negotiation_id, account_id, development_id, unit_id, status, started_at, expires_at, created_at, updated_at",
    )
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to update reservation: ${error.message}`);
  }

  if (!data) {
    throw new Error("Reservation not found for update.");
  }

  return mapReservationRow(data as ReservationRow);
}
