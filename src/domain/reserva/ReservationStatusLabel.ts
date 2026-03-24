import {
  ReservationStatus,
  type ReservationStatus as ReservationStatusType,
} from "./ReservationStatus";

export function getReservationStatusLabel(status: ReservationStatusType) {
  switch (status) {
    case ReservationStatus.REQUESTED:
      return "Solicitada";
    case ReservationStatus.APPROVED:
      return "Aprovada";
    case ReservationStatus.REJECTED:
      return "Recusada";
    case ReservationStatus.ACTIVE:
      return "Ativa";
    case ReservationStatus.CANCELLED:
      return "Cancelada";
    case ReservationStatus.EXPIRED:
      return "Expirada";
    case ReservationStatus.CONVERTED:
      return "Convertida";
    default:
      return status;
  }
}
