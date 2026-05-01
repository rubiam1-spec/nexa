import { UnitQueueStatus, type UnitQueueStatus as UnitQueueStatusType } from "../../domain/fila/UnitQueueStatus";
import type { UnitQueueEntry } from "../../shared/types/unitQueueEntry";
import { getSupabaseClientOrThrow, unwrapSupabaseListResult } from "./baseRepository";

type UnitQueueRow = {
  id: string;
  unit_id: string;
  negotiation_id: string;
  account_id: string;
  development_id: string;
  requested_by: string | null;
  status: string;
  position: number;
  created_at: string;
  updated_at: string;
};

const dbStatusToEnum: Record<string, UnitQueueStatusType> = {
  active: UnitQueueStatus.ACTIVE, ACTIVE: UnitQueueStatus.ACTIVE,
  promoted: UnitQueueStatus.PROMOTED, PROMOTED: UnitQueueStatus.PROMOTED,
  cancelled: UnitQueueStatus.CANCELLED, CANCELLED: UnitQueueStatus.CANCELLED,
  waiting: UnitQueueStatus.WAITING, WAITING: UnitQueueStatus.WAITING,
  removed: UnitQueueStatus.REMOVED, REMOVED: UnitQueueStatus.REMOVED,
  expired: UnitQueueStatus.EXPIRED, EXPIRED: UnitQueueStatus.EXPIRED,
};

function normalizeUnitQueueStatus(status: string): UnitQueueStatusType {
  return dbStatusToEnum[status] ?? UnitQueueStatus.ACTIVE; // Graceful fallback, never throw
}

function mapUnitQueueRow(row: UnitQueueRow): UnitQueueEntry {
  return {
    id: row.id,
    unitId: row.unit_id,
    negotiationId: row.negotiation_id,
    accountId: row.account_id,
    developmentId: row.development_id,
    requestedBy: row.requested_by,
    status: normalizeUnitQueueStatus(row.status),
    position: row.position,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export async function getUnitQueueEntriesByUnit(unitId: string) {
  const supabase = getSupabaseClientOrThrow("unit queue repository");

  const { data, error } = await supabase
    .from("unit_queue_entries")
    .select(
      "id, unit_id, negotiation_id, account_id, development_id, requested_by, status, position, created_at, updated_at",
    )
    .eq("unit_id", unitId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  const entries = (data ?? []).map((row) => mapUnitQueueRow(row as UnitQueueRow));

  return unwrapSupabaseListResult<UnitQueueEntry>(entries, error, "unit queue");
}

export async function createUnitQueueEntry(input: {
  unitId: string;
  negotiationId: string;
  accountId: string;
  developmentId: string;
  requestedBy: string | null;
  position: number;
}) {
  const supabase = getSupabaseClientOrThrow("unit queue repository");

  const { data, error } = await supabase
    .from("unit_queue_entries")
    .insert({
      unit_id: input.unitId,
      negotiation_id: input.negotiationId,
      account_id: input.accountId,
      development_id: input.developmentId,
      requested_by: input.requestedBy,
      status: UnitQueueStatus.ACTIVE,
      position: input.position,
      updated_at: new Date().toISOString(),
    })
    .select(
      "id, unit_id, negotiation_id, account_id, development_id, requested_by, status, position, created_at, updated_at",
    )
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to create unit queue entry: ${error.message}`);
  }

  if (!data) {
    throw new Error("Unit queue entry was not returned after insert.");
  }

  return mapUnitQueueRow(data as UnitQueueRow);
}

export async function updateUnitQueueEntryStatus(
  entryId: string,
  status: UnitQueueEntry["status"],
) {
  const supabase = getSupabaseClientOrThrow("unit queue repository");

  const { data, error } = await supabase
    .from("unit_queue_entries")
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", entryId)
    .select(
      "id, unit_id, negotiation_id, account_id, development_id, requested_by, status, position, created_at, updated_at",
    )
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to update unit queue entry: ${error.message}`);
  }

  if (!data) {
    throw new Error("Unit queue entry not found for update.");
  }

  return mapUnitQueueRow(data as UnitQueueRow);
}
