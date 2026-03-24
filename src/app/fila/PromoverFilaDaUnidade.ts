import { UnitQueueService } from "../../domain/fila/UnitQueueService";
import { UnitQueueStatus } from "../../domain/fila/UnitQueueStatus";
import type { UnitQueueEntry } from "../../shared/types/unitQueueEntry";

export function promoverFilaDaUnidade(entries: UnitQueueEntry[]) {
  const nextEntry = UnitQueueService.getNextPromotableEntry(entries);

  if (!nextEntry) {
    return null;
  }

  return {
    ...nextEntry,
    status: UnitQueueStatus.PROMOTED as UnitQueueEntry["status"],
    updatedAt: new Date(),
  };
}
