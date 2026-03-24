import { ReservationService } from "../../domain/reserva/ReservationService";
import { ReservationStatus } from "../../domain/reserva/ReservationStatus";
import type { Reservation } from "../../shared/types/reservation";
import { InvalidReservationTransitionError } from "./errors/InvalidReservationTransitionError";

export function expirarReserva(reservation: Reservation) {
  if (!ReservationService.podeExpirarReserva(reservation)) {
    throw new InvalidReservationTransitionError(
      "A reserva informada nao pode ser expirada a partir do status atual.",
    );
  }

  return ReservationService.alterarStatusReserva(
    reservation,
    ReservationStatus.EXPIRED,
  );
}
