import type { UnidadeHistoryAction } from "../../../domain/unidade/UnidadeHistoryAction";
import type { UnidadeStatus } from "../../../domain/unidade/UnidadeStatus";
import type { UnitHistoryEvent } from "../../../shared/types/unitHistory";
import { unitHistoryMock } from "../mocks/unitHistoryMock";

export function getUnitHistoryByUnitIds(unitIds: string[]) {
  return unitHistoryMock
    .filter((event) => unitIds.includes(event.unitId))
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
}

export function appendUnitHistoryEvent(input: {
  unitId: string;
  negotiationId: string | null;
  fromStatus: UnidadeStatus | null;
  toStatus: UnidadeStatus;
  action: UnidadeHistoryAction;
  performedBy: string | null;
}) {
  const event: UnitHistoryEvent = {
    id: `unit_history_${crypto.randomUUID()}`,
    unitId: input.unitId,
    negotiationId: input.negotiationId,
    fromStatus: input.fromStatus,
    toStatus: input.toStatus,
    action: input.action,
    performedBy: input.performedBy,
    createdAt: new Date(),
  };

  unitHistoryMock.unshift(event);

  return event;
}
