import { UnitQueueStatus } from "./UnitQueueStatus";

export function getUnitQueueStatusLabel(status: UnitQueueStatus) {
  switch (status) {
    case UnitQueueStatus.ACTIVE:
      return "Na fila";
    case UnitQueueStatus.PROMOTED:
      return "Prioridade ativa";
    case UnitQueueStatus.CANCELLED:
      return "Cancelada";
  }
}
