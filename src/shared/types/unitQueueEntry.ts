import type { UnitQueueStatus } from "../../domain/fila/UnitQueueStatus";

export type UnitQueueEntry = {
  id: string;
  unitId: string;
  negotiationId: string;
  accountId: string;
  developmentId: string;
  requestedBy: string | null;
  status: UnitQueueStatus;
  position: number;
  createdAt: Date;
  updatedAt: Date;
};
