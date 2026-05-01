import { UnitQueueStatus } from "./UnitQueueStatus";

export function getUnitQueueStatusLabel(status: UnitQueueStatus | string): string {
  switch (status) {
    case UnitQueueStatus.ACTIVE:
      return "Na fila";
    case UnitQueueStatus.PROMOTED:
      return "Promovido";
    case UnitQueueStatus.CANCELLED:
      return "Cancelada";
    case UnitQueueStatus.WAITING:
      return "Aguardando";
    case UnitQueueStatus.REMOVED:
      return "Removido";
    case UnitQueueStatus.EXPIRED:
      return "Expirado";
    default:
      return status; // Fallback: show raw status, never throw
  }
}
