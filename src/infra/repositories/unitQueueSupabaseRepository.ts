import { UnitQueueStatus, type UnitQueueStatus as UnitQueueStatusType } from "../../domain/fila/UnitQueueStatus";
import { UnitQueueDbStatus, UnitQueueStatusFromDb, toUnitQueueDb } from "../../domain/status/unitQueue";
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

// Vocabulário centralizado em src/domain/status/unitQueue.ts (Fase 3 — Etapa 5).
// Leitura estrita (só lowercase canônico); fallback seguro para não quebrar.
function normalizeUnitQueueStatus(status: string): UnitQueueStatusType {
  return UnitQueueStatusFromDb[status] ?? UnitQueueStatus.WAITING;
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
  negotiationId: string | null;
  accountId: string;
  developmentId: string;
  requestedBy: string | null;
  position: number;
  clientId?: string | null;
  brokerId?: string | null;
  reason?: string | null;
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
      client_id: input.clientId ?? null,
      broker_id: input.brokerId ?? null,
      reason: input.reason ?? null,
      status: toUnitQueueDb(UnitQueueStatus.WAITING),
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
      status: toUnitQueueDb(status),
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

/**
 * Promove a primeira entrada "na fila" (waiting) de uma unidade quando ela é
 * liberada. Substitui a escrita crua do usePipelineActions (fix M1: filtrava
 * "ACTIVE" — inexistente nos dados — e gravava UPPER; agora filtra o canônico
 * "waiting" e grava "promoted" minúsculo, tudo via fonte única). Retorna a
 * entrada promovida, ou null se a fila estiver vazia.
 */
export async function promoteFirstWaiting(
  unitId: string,
  accountId: string,
): Promise<UnitQueueEntry | null> {
  const supabase = getSupabaseClientOrThrow("unit queue repository");
  const { data: first } = await supabase
    .from("unit_queue_entries")
    .select("id")
    .eq("unit_id", unitId)
    .eq("account_id", accountId)
    .eq("status", UnitQueueDbStatus[UnitQueueStatus.WAITING])
    .order("position", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!first) return null;

  const { data, error } = await supabase
    .from("unit_queue_entries")
    .update({
      status: toUnitQueueDb(UnitQueueStatus.PROMOTED),
      promoted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", (first as { id: string }).id)
    .select(
      "id, unit_id, negotiation_id, account_id, development_id, requested_by, status, position, created_at, updated_at",
    )
    .maybeSingle();
  if (error) throw new Error(`Failed to promote unit queue entry: ${error.message}`);
  return data ? mapUnitQueueRow(data as UnitQueueRow) : null;
}

// ── Escritas da fila migradas do units/useUnitQueue e BrokerDashboard (Etapa 5c) ──
// Status sempre da fonte única; campos removed_*/promoted_at/position preservam
// EXATAMENTE o que as escritas cruas gravavam (sem updated_at, como no inline).

// Promove uma entrada específica (por id) — a fila (useUnitQueue) já escolheu a 1ª.
export async function promoteUnitQueueEntry(entryId: string): Promise<void> {
  const supabase = getSupabaseClientOrThrow("unit queue repository");
  const { error } = await supabase
    .from("unit_queue_entries")
    .update({ status: toUnitQueueDb(UnitQueueStatus.PROMOTED), promoted_at: new Date().toISOString() })
    .eq("id", entryId);
  if (error) throw new Error(`Failed to promote unit queue entry ${entryId}: ${error.message}`);
}

// Remove (desistência/expurgo) preservando removed_at + removed_reason.
export async function removeUnitQueueEntry(entryId: string, reason: string): Promise<void> {
  const supabase = getSupabaseClientOrThrow("unit queue repository");
  const { error } = await supabase
    .from("unit_queue_entries")
    .update({ status: toUnitQueueDb(UnitQueueStatus.REMOVED), removed_at: new Date().toISOString(), removed_reason: reason })
    .eq("id", entryId);
  if (error) throw new Error(`Failed to remove unit queue entry ${entryId}: ${error.message}`);
}

// Reordenação da fila (a lógica de posição segue no hook; aqui só a escrita).
export async function updateUnitQueuePosition(entryId: string, position: number): Promise<void> {
  const supabase = getSupabaseClientOrThrow("unit queue repository");
  const { error } = await supabase
    .from("unit_queue_entries")
    .update({ position })
    .eq("id", entryId);
  if (error) throw new Error(`Failed to update unit queue position ${entryId}: ${error.message}`);
}
