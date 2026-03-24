import type { ReservationStatus } from "../../domain/reserva/ReservationStatus";

export type ReservationRequest = {
  id: string;
  negotiationId: string;
  proposalId: string;
  accountId: string;
  developmentId: string;
  unitId: string;
  status: ReservationStatus;
  requestedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};
