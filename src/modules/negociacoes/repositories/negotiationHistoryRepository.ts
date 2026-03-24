import type { NegotiationHistoryAction } from "../../../domain/negociacao/NegotiationHistoryAction";
import type {
  NegotiationHistoryEvent,
  NegotiationHistoryStatusValue,
} from "../../../shared/types/negotiationHistory";
import { negotiationHistoryMock } from "../mocks/negotiationHistoryMock";

export function getNegotiationHistory(negotiationId: string) {
  return negotiationHistoryMock
    .filter((event) => event.negotiationId === negotiationId)
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
}

export function appendNegotiationHistoryEvent(input: {
  negotiationId: string;
  fromStatus: NegotiationHistoryStatusValue | null;
  toStatus: NegotiationHistoryStatusValue;
  action: NegotiationHistoryAction;
  performedBy: string | null;
}) {
  const event: NegotiationHistoryEvent = {
    id: `history_${crypto.randomUUID()}`,
    negotiationId: input.negotiationId,
    fromStatus: input.fromStatus,
    toStatus: input.toStatus,
    action: input.action,
    performedBy: input.performedBy,
    createdAt: new Date(),
  };

  negotiationHistoryMock.unshift(event);

  return event;
}
