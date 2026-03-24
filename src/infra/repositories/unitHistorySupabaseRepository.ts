import {
  UnidadeHistoryAction,
  type UnidadeHistoryAction as UnidadeHistoryActionType,
} from "../../domain/unidade/UnidadeHistoryAction";
import {
  UnidadeStatus,
  type UnidadeStatus as UnidadeStatusType,
} from "../../domain/unidade/UnidadeStatus";
import type { UnitHistoryEvent } from "../../shared/types/unitHistory";
import { getSupabaseClientOrThrow } from "./baseRepository";

type UnitHistoryRow = {
  id: string;
  unit_id: string;
  negotiation_id: string | null;
  from_status: string | null;
  to_status: string;
  action: string;
  performed_by: string | null;
  created_at: string;
};

function normalizeUnitStatus(status: string | null): UnidadeStatusType | null {
  if (status === null) {
    return null;
  }

  switch (status) {
    case UnidadeStatus.DISPONIVEL:
    case UnidadeStatus.EM_NEGOCIACAO:
    case UnidadeStatus.RESERVADO:
    case UnidadeStatus.VENDIDO:
      return status;
    default:
      throw new Error(`Unsupported unit status history value: ${status}`);
  }
}

function normalizeUnitHistoryAction(
  action: string,
): UnidadeHistoryActionType {
  switch (action) {
    case UnidadeHistoryAction.NEGOTIATION_STARTED:
    case UnidadeHistoryAction.NEGOTIATION_CANCELLED:
    case UnidadeHistoryAction.QUEUE_PROMOTED:
    case UnidadeHistoryAction.RESERVATION_ACTIVATED:
    case UnidadeHistoryAction.RESERVATION_CANCELLED:
    case UnidadeHistoryAction.RESERVATION_EXPIRED:
    case UnidadeHistoryAction.SALE_CREATED:
      return action;
    default:
      throw new Error(`Unsupported unit history action: ${action}`);
  }
}

function mapUnitHistoryRow(row: UnitHistoryRow): UnitHistoryEvent {
  return {
    id: row.id,
    unitId: row.unit_id,
    negotiationId: row.negotiation_id,
    fromStatus: normalizeUnitStatus(row.from_status),
    toStatus: normalizeUnitStatus(row.to_status) ?? UnidadeStatus.DISPONIVEL,
    action: normalizeUnitHistoryAction(row.action),
    performedBy: row.performed_by,
    createdAt: new Date(row.created_at),
  };
}

export async function createUnitHistoryEvent(input: {
  unitId: string;
  negotiationId: string | null;
  fromStatus: UnidadeStatusType | null;
  toStatus: UnidadeStatusType;
  action: UnidadeHistoryActionType;
  performedBy: string | null;
}) {
  const supabase = getSupabaseClientOrThrow("unit history repository");

  const { data, error } = await supabase
    .from("unit_history")
    .insert({
      unit_id: input.unitId,
      negotiation_id: input.negotiationId,
      from_status: input.fromStatus,
      to_status: input.toStatus,
      action: input.action,
      performed_by: input.performedBy,
    })
    .select(
      "id, unit_id, negotiation_id, from_status, to_status, action, performed_by, created_at",
    )
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to create unit history: ${error.message}`);
  }

  if (!data) {
    throw new Error("Unit history event was not returned after insert.");
  }

  return mapUnitHistoryRow(data as UnitHistoryRow);
}

export async function getUnitHistoryByUnitIds(unitIds: string[]) {
  const supabase = getSupabaseClientOrThrow("unit history repository");

  if (unitIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("unit_history")
    .select(
      "id, unit_id, negotiation_id, from_status, to_status, action, performed_by, created_at",
    )
    .in("unit_id", unitIds)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load unit history: ${error.message}`);
  }

  return (data ?? []).map((row) => mapUnitHistoryRow(row as UnitHistoryRow));
}
