import { ReservationService } from "../../domain/reserva/ReservationService";
import { ReservationStatus } from "../../domain/reserva/ReservationStatus";
import type { Reservation } from "../../shared/types/reservation";
import { InvalidReservationTransitionError } from "./errors/InvalidReservationTransitionError";

export function cancelarReserva(reservation: Reservation) {
  if (!ReservationService.podeCancelarReserva(reservation)) {
    throw new InvalidReservationTransitionError(
      "A reserva informada nao pode ser cancelada a partir do status atual.",
    );
  }

  return ReservationService.alterarStatusReserva(
    reservation,
    ReservationStatus.CANCELLED,
  );
}
