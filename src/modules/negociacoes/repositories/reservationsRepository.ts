import type { Reservation } from "../../../shared/types/reservation";
import { reservationsMock } from "../mocks/reservationsMock";

export function getReservationsByNegotiation(negotiationId: string) {
  return reservationsMock
    .filter((reservation) => reservation.negotiationId === negotiationId)
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
}

export function getReservations(accountId: string, developmentId: string) {
  return reservationsMock
    .filter(
      (reservation) =>
        reservation.accountId === accountId &&
        reservation.developmentId === developmentId,
    )
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
}

export function createReservation(input: {
  reservationRequestId: string;
  negotiationId: string;
  accountId: string;
  developmentId: string;
  unitId: string;
  startedAt: Date;
  expiresAt: Date;
  status: Reservation["status"];
}) {
  const reservation: Reservation = {
    id: `reservation_${crypto.randomUUID()}`,
    reservationRequestId: input.reservationRequestId,
    negotiationId: input.negotiationId,
    accountId: input.accountId,
    developmentId: input.developmentId,
    unitId: input.unitId,
    status: input.status,
    startedAt: input.startedAt,
    expiresAt: input.expiresAt,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  reservationsMock.unshift(reservation);

  return reservation;
}

export function updateReservationStatus(
  reservationId: string,
  status: Reservation["status"],
) {
  const reservation = reservationsMock.find((item) => item.id === reservationId);

  if (!reservation) {
    throw new Error("Reservation not found in mock repository.");
  }

  reservation.status = status;
  reservation.updatedAt = new Date();

  return reservation;
}
