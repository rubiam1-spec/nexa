import { NegotiationHistoryAction } from "../../../domain/negociacao/NegotiationHistoryAction";
import { NegotiationStatus } from "../../../domain/negociacao/NegotiationStatus";
import type { NegotiationHistoryEvent } from "../../../shared/types/negotiationHistory";

export const negotiationHistoryMock: NegotiationHistoryEvent[] = [
  {
    id: "history_1",
    negotiationId: "negotiation_1",
    fromStatus: null,
    toStatus: NegotiationStatus.OPEN,
    action: NegotiationHistoryAction.NEGOTIATION_CREATED,
    performedBy: "user_1",
    createdAt: new Date("2026-01-05T00:00:00.000Z"),
  },
  {
    id: "history_2",
    negotiationId: "negotiation_2",
    fromStatus: null,
    toStatus: NegotiationStatus.OPEN,
    action: NegotiationHistoryAction.NEGOTIATION_CREATED,
    performedBy: "user_1",
    createdAt: new Date("2026-01-06T00:00:00.000Z"),
  },
  {
    id: "history_3",
    negotiationId: "negotiation_2",
    fromStatus: NegotiationStatus.OPEN,
    toStatus: NegotiationStatus.IN_PROGRESS,
    action: NegotiationHistoryAction.NEGOTIATION_STARTED,
    performedBy: "user_1",
    createdAt: new Date("2026-01-07T00:00:00.000Z"),
  },
];
