import { ReservationStatus } from "../../../domain/reserva/ReservationStatus";
import type { ReservationRequest } from "../../../shared/types/reservationRequest";
import { reservationRequestsMock } from "../mocks/reservationRequestsMock";

export function getReservationRequestsByNegotiation(negotiationId: string) {
  return reservationRequestsMock
    .filter((request) => request.negotiationId === negotiationId)
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
}

export function getReservationRequests(accountId: string, developmentId: string) {
  return reservationRequestsMock
    .filter(
      (request) =>
        request.accountId === accountId &&
        request.developmentId === developmentId,
    )
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
}

export function createReservationRequest(input: {
  negotiationId: string;
  proposalId: string;
  accountId: string;
  developmentId: string;
  unitId: string;
  requestedBy: string | null;
}) {
  const request: ReservationRequest = {
    id: `reservation_request_${crypto.randomUUID()}`,
    negotiationId: input.negotiationId,
    proposalId: input.proposalId,
    accountId: input.accountId,
    developmentId: input.developmentId,
    unitId: input.unitId,
    status: ReservationStatus.REQUESTED,
    requestedBy: input.requestedBy,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  reservationRequestsMock.unshift(request);

  return request;
}

export function updateReservationRequestStatus(
  requestId: string,
  status: ReservationRequest["status"],
) {
  const request = reservationRequestsMock.find((item) => item.id === requestId);

  if (!request) {
    throw new Error("Reservation request not found in mock repository.");
  }

  request.status = status;
  request.updatedAt = new Date();

  return request;
}
