import type { UnitQueueEntry } from "../../shared/types/unitQueueEntry";
import type { Unidade } from "../unidade/Unidade";
import { UnidadeStatus } from "../unidade/UnidadeStatus";
import { UnitQueueStatus } from "./UnitQueueStatus";

export class UnitQueueService {
  static getNextPosition(entries: UnitQueueEntry[]) {
    return (
      entries.filter((entry) => entry.status === UnitQueueStatus.ACTIVE).length + 1
    );
  }

  static hasOpenEntryForNegotiation(
    entries: UnitQueueEntry[],
    negotiationId: string,
  ) {
    return entries.some(
      (entry) =>
        entry.negotiationId === negotiationId &&
        (entry.status === UnitQueueStatus.ACTIVE ||
          entry.status === UnitQueueStatus.PROMOTED),
    );
  }

  static hasPromotedPriority(entries: UnitQueueEntry[]) {
    return entries.some((entry) => entry.status === UnitQueueStatus.PROMOTED);
  }

  static getPromotedEntry(entries: UnitQueueEntry[]) {
    return (
      entries.find((entry) => entry.status === UnitQueueStatus.PROMOTED) ?? null
    );
  }

  static requiresQueueForNegotiation(
    unit: Unidade,
    entries: UnitQueueEntry[],
    negotiationId: string,
  ) {
    if (unit.status === UnidadeStatus.RESERVADO) {
      return true;
    }

    if (unit.status !== UnidadeStatus.EM_NEGOCIACAO) {
      return false;
    }

    const promotedEntry = this.getPromotedEntry(entries);

    return promotedEntry !== null && promotedEntry.negotiationId !== negotiationId;
  }

  static getNextPromotableEntry(entries: UnitQueueEntry[]) {
    return (
      [...entries]
        .filter((entry) => entry.status === UnitQueueStatus.ACTIVE)
        .sort((left, right) => {
          if (left.position !== right.position) {
            return left.position - right.position;
          }

          return left.createdAt.getTime() - right.createdAt.getTime();
        })[0] ?? null
    );
  }
}
