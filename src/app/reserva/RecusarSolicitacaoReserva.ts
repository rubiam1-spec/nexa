import { ReservationService } from "../../domain/reserva/ReservationService";
import { ReservationStatus } from "../../domain/reserva/ReservationStatus";
import type { ReservationRequest } from "../../shared/types/reservationRequest";
import { InvalidReservationTransitionError } from "./errors/InvalidReservationTransitionError";

export function recusarSolicitacaoReserva(request: ReservationRequest) {
  if (!ReservationService.podeRecusarSolicitacao(request)) {
    throw new InvalidReservationTransitionError(
      "A solicitacao de reserva nao pode ser recusada a partir do status atual.",
    );
  }

  return ReservationService.alterarStatusSolicitacao(
    request,
    ReservationStatus.REJECTED,
  );
}
