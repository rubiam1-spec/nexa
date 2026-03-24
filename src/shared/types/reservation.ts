import type { ReservationStatus } from "../../domain/reserva/ReservationStatus";

export type Reservation = {
  id: string;
  reservationRequestId: string;
  negotiationId: string;
  accountId: string;
  developmentId: string;
  unitId: string;
  status: ReservationStatus;
  startedAt: Date;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
};
