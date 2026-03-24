import { UnidadeHistoryAction } from "../../../domain/unidade/UnidadeHistoryAction";
import { UnidadeStatus } from "../../../domain/unidade/UnidadeStatus";
import type { UnitHistoryEvent } from "../../../shared/types/unitHistory";

export const unitHistoryMock: UnitHistoryEvent[] = [
  {
    id: "unit_history_1",
    unitId: "unit_2",
    negotiationId: "negotiation_2",
    fromStatus: UnidadeStatus.DISPONIVEL,
    toStatus: UnidadeStatus.EM_NEGOCIACAO,
    action: UnidadeHistoryAction.NEGOTIATION_STARTED,
    performedBy: "user_1",
    createdAt: new Date("2026-01-06T00:00:00.000Z"),
  },
];
