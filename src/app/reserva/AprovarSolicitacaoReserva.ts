import { ReservationService } from "../../domain/reserva/ReservationService";
import { ReservationStatus } from "../../domain/reserva/ReservationStatus";
import type { ReservationRequest } from "../../shared/types/reservationRequest";
import { InvalidReservationTransitionError } from "./errors/InvalidReservationTransitionError";

export function aprovarSolicitacaoReserva(request: ReservationRequest) {
  if (!ReservationService.podeAprovarSolicitacao(request)) {
    throw new InvalidReservationTransitionError(
      "A solicitacao de reserva nao pode ser aprovada a partir do status atual.",
    );
  }

  return ReservationService.alterarStatusSolicitacao(
    request,
    ReservationStatus.APPROVED,
  );
}
