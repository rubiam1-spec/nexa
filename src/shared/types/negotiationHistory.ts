import type { NegotiationHistoryAction } from "../../domain/negociacao/NegotiationHistoryAction";
import type { NegotiationStatus } from "../../domain/negociacao/NegotiationStatus";
import type { ProposalStatus } from "../../domain/proposta/ProposalStatus";
import type { ReservationStatus } from "../../domain/reserva/ReservationStatus";
import type { SaleStatus } from "../../domain/venda/SaleStatus";
import type { UnitQueueStatus } from "../../domain/fila/UnitQueueStatus";

export type NegotiationHistoryStatusValue =
  | NegotiationStatus
  | ProposalStatus
  | ReservationStatus
  | SaleStatus
  | UnitQueueStatus;

export type NegotiationHistoryEvent = {
  id: string;
  negotiationId: string;
  fromStatus: NegotiationHistoryStatusValue | null;
  toStatus: NegotiationHistoryStatusValue;
  action: NegotiationHistoryAction;
  performedBy: string | null;
  createdAt: Date;
};
