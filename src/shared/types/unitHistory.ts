import type { UnidadeHistoryAction } from "../../domain/unidade/UnidadeHistoryAction";
import type { UnidadeStatus } from "../../domain/unidade/UnidadeStatus";

export type UnitHistoryEvent = {
  id: string;
  unitId: string;
  negotiationId: string | null;
  fromStatus: UnidadeStatus | null;
  toStatus: UnidadeStatus;
  action: UnidadeHistoryAction;
  performedBy: string | null;
  createdAt: Date;
};
