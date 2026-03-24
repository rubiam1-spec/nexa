import { ReservationStatus } from "../../domain/reserva/ReservationStatus";
import type { Reservation } from "../../shared/types/reservation";

const RESERVATION_DURATION_HOURS = 48;

export function criarReservaAtiva(input: {
  reservationRequestId: string;
  negotiationId: string;
  accountId: string;
  developmentId: string;
  unitId: string;
  reservationDurationHours?: number;
}) {
  const startedAt = new Date();
  const expiresAt = new Date(
    startedAt.getTime() +
      (input.reservationDurationHours ?? RESERVATION_DURATION_HOURS) *
        60 *
        60 *
        1000,
  );

  return {
    reservationRequestId: input.reservationRequestId,
    negotiationId: input.negotiationId,
    accountId: input.accountId,
    developmentId: input.developmentId,
    unitId: input.unitId,
    status: ReservationStatus.ACTIVE as Reservation["status"],
    startedAt,
    expiresAt,
  };
}
