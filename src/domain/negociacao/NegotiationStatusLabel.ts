import { NegotiationStatus } from "./NegotiationStatus";
import type { NegotiationStatus as NegotiationStatusType } from "./NegotiationStatus";

export function getNegotiationStatusLabel(status: NegotiationStatusType) {
  switch (status) {
    case NegotiationStatus.OPEN:
      return "Aberta";
    case NegotiationStatus.IN_PROGRESS:
      return "Em negociação";
    case NegotiationStatus.PROPOSAL:
      return "Proposta";
    case NegotiationStatus.RESERVATION:
      return "Reserva";
    case NegotiationStatus.WON:
      return "Ganha";
    case NegotiationStatus.LOST:
      return "Perdida";
    case NegotiationStatus.CANCELLED:
      return "Cancelada";
  }
}
