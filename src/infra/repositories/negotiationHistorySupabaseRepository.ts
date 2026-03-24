import {
  NegotiationHistoryAction,
  type NegotiationHistoryAction as NegotiationHistoryActionType,
} from "../../domain/negociacao/NegotiationHistoryAction";
import {
  NegotiationStatus,
  type NegotiationStatus as NegotiationStatusType,
} from "../../domain/negociacao/NegotiationStatus";
import {
  ProposalStatus,
  type ProposalStatus as ProposalStatusType,
} from "../../domain/proposta/ProposalStatus";
import {
  ReservationStatus,
  type ReservationStatus as ReservationStatusType,
} from "../../domain/reserva/ReservationStatus";
import {
  SaleStatus,
  type SaleStatus as SaleStatusType,
} from "../../domain/venda/SaleStatus";
import {
  UnitQueueStatus,
  type UnitQueueStatus as UnitQueueStatusType,
} from "../../domain/fila/UnitQueueStatus";
import type { NegotiationHistoryEvent } from "../../shared/types/negotiationHistory";
import { getSupabaseClientOrThrow, unwrapSupabaseListResult } from "./baseRepository";

type NegotiationHistoryRow = {
  id: string;
  negotiation_id: string;
  from_status: string | null;
  to_status: string;
  action: string;
  performed_by: string | null;
  created_at: string;
};

function normalizeNegotiationStatus(
  status: string | null,
):
  | NegotiationStatusType
  | ProposalStatusType
  | ReservationStatusType
  | SaleStatusType
  | UnitQueueStatusType
  | null {
  if (status === null) {
    return null;
  }

  switch (status) {
    case NegotiationStatus.OPEN:
    case NegotiationStatus.IN_PROGRESS:
    case NegotiationStatus.WON:
    case NegotiationStatus.LOST:
    case NegotiationStatus.CANCELLED:
    case ProposalStatus.DRAFT:
    case ProposalStatus.SENT:
    case ProposalStatus.UNDER_ANALYSIS:
    case ProposalStatus.ACCEPTED:
    case ProposalStatus.REJECTED:
    case ProposalStatus.EXPIRED:
    case ReservationStatus.REQUESTED:
    case ReservationStatus.APPROVED:
    case ReservationStatus.REJECTED:
    case ReservationStatus.ACTIVE:
    case ReservationStatus.CANCELLED:
    case ReservationStatus.EXPIRED:
    case SaleStatus.CREATED:
    case SaleStatus.AWAITING_DOCUMENTS:
    case SaleStatus.AWAITING_CONTRACT:
    case SaleStatus.AWAITING_PAYMENT:
    case SaleStatus.COMPLETED:
    case SaleStatus.CANCELLED:
    case UnitQueueStatus.ACTIVE:
    case UnitQueueStatus.PROMOTED:
    case UnitQueueStatus.CANCELLED:
      return status;
    default:
      throw new Error(`Unsupported negotiation history status: ${status}`);
  }
}

function normalizeNegotiationHistoryAction(
  action: string,
): NegotiationHistoryActionType {
  switch (action) {
    case NegotiationHistoryAction.NEGOTIATION_CREATED:
    case NegotiationHistoryAction.NEGOTIATION_STARTED:
    case NegotiationHistoryAction.NEGOTIATION_CANCELLED:
    case NegotiationHistoryAction.PROPOSAL_CREATED:
    case NegotiationHistoryAction.PROPOSAL_SENT:
    case NegotiationHistoryAction.PROPOSAL_UNDER_ANALYSIS:
    case NegotiationHistoryAction.PROPOSAL_ACCEPTED:
    case NegotiationHistoryAction.PROPOSAL_REJECTED:
    case NegotiationHistoryAction.QUEUE_ENTERED:
    case NegotiationHistoryAction.QUEUE_PROMOTED:
    case NegotiationHistoryAction.RESERVATION_REQUESTED:
    case NegotiationHistoryAction.RESERVATION_APPROVED:
    case NegotiationHistoryAction.RESERVATION_REJECTED:
    case NegotiationHistoryAction.RESERVATION_CANCELLED:
    case NegotiationHistoryAction.RESERVATION_EXPIRED:
    case NegotiationHistoryAction.SALE_CREATED:
    case NegotiationHistoryAction.RESERVATION_CONVERTED:
    case NegotiationHistoryAction.SALE_ADVANCED:
    case NegotiationHistoryAction.SALE_COMPLETED:
    case NegotiationHistoryAction.SALE_CANCELLED:
      return action;
    default:
      throw new Error(`Unsupported negotiation history action: ${action}`);
  }
}

function mapHistoryRowToEvent(
  row: NegotiationHistoryRow,
): NegotiationHistoryEvent {
  return {
    id: row.id,
    negotiationId: row.negotiation_id,
    fromStatus: normalizeNegotiationStatus(row.from_status),
    toStatus: normalizeNegotiationStatus(row.to_status) ?? NegotiationStatus.OPEN,
    action: normalizeNegotiationHistoryAction(row.action),
    performedBy: row.performed_by,
    createdAt: new Date(row.created_at),
  };
}

export async function getNegotiationHistory(negotiationId: string) {
  const supabase = getSupabaseClientOrThrow("negotiation history repository");

  const { data, error } = await supabase
    .from("negotiation_history")
    .select(
      "id, negotiation_id, from_status, to_status, action, performed_by, created_at",
    )
    .eq("negotiation_id", negotiationId)
    .order("created_at", { ascending: false });

  const events = (data ?? []).map((row) =>
    mapHistoryRowToEvent(row as NegotiationHistoryRow),
  );

  return unwrapSupabaseListResult<NegotiationHistoryEvent>(
    events,
    error,
    "negotiation history",
  );
}

export async function createNegotiationHistoryEvent(input: {
  negotiationId: string;
  fromStatus:
    | NegotiationStatusType
    | ProposalStatusType
    | ReservationStatusType
    | SaleStatusType
    | UnitQueueStatusType
    | null;
  toStatus:
    | NegotiationStatusType
    | ProposalStatusType
    | ReservationStatusType
    | SaleStatusType
    | UnitQueueStatusType;
  action: NegotiationHistoryActionType;
  performedBy: string | null;
}) {
  const supabase = getSupabaseClientOrThrow("negotiation history repository");

  const { data, error } = await supabase
    .from("negotiation_history")
    .insert({
      negotiation_id: input.negotiationId,
      from_status: input.fromStatus,
      to_status: input.toStatus,
      action: input.action,
      performed_by: input.performedBy,
    })
    .select(
      "id, negotiation_id, from_status, to_status, action, performed_by, created_at",
    )
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to create negotiation history: ${error.message}`);
  }

  if (!data) {
    throw new Error("Negotiation history event was not returned after insert.");
  }

  return mapHistoryRowToEvent(data as NegotiationHistoryRow);
}
