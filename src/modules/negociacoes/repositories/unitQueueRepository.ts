import { UnitQueueStatus } from "../../../domain/fila/UnitQueueStatus";
import type { UnitQueueEntry } from "../../../shared/types/unitQueueEntry";
import { unitQueueMock } from "../mocks/unitQueueMock";

export function getUnitQueueEntriesByUnit(unitId: string) {
  return unitQueueMock
    .filter((entry) => entry.unitId === unitId)
    .sort((left, right) => {
      if (left.position !== right.position) {
        return left.position - right.position;
      }

      return left.createdAt.getTime() - right.createdAt.getTime();
    });
}

export function createUnitQueueEntry(input: {
  unitId: string;
  negotiationId: string;
  accountId: string;
  developmentId: string;
  requestedBy: string | null;
  position: number;
}) {
  const entry: UnitQueueEntry = {
    id: `unit_queue_${crypto.randomUUID()}`,
    unitId: input.unitId,
    negotiationId: input.negotiationId,
    accountId: input.accountId,
    developmentId: input.developmentId,
    requestedBy: input.requestedBy,
    position: input.position,
    status: UnitQueueStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  unitQueueMock.unshift(entry);

  return entry;
}

export function updateUnitQueueEntryStatus(
  entryId: string,
  status: UnitQueueEntry["status"],
) {
  const entry = unitQueueMock.find((item) => item.id === entryId);

  if (!entry) {
    throw new Error("Queue entry not found in mock repository.");
  }

  entry.status = status;
  entry.updatedAt = new Date();

  return entry;
}
