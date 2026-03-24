import type { ReservationRequest } from "../../shared/types/reservationRequest";
import type { Reservation } from "../../shared/types/reservation";
import { ReservationStatus } from "./ReservationStatus";

export class ReservationService {
  static podeAprovarSolicitacao(request: ReservationRequest) {
    return request.status === ReservationStatus.REQUESTED;
  }

  static podeRecusarSolicitacao(request: ReservationRequest) {
    return request.status === ReservationStatus.REQUESTED;
  }

  static podeCancelarSolicitacao(request: ReservationRequest) {
    return request.status === ReservationStatus.REQUESTED;
  }

  static alterarStatusSolicitacao(
    request: ReservationRequest,
    status: ReservationRequest["status"],
  ): ReservationRequest {
    return {
      ...request,
      status,
      updatedAt: new Date(),
    };
  }

  static podeCancelarReserva(reservation: Reservation) {
    return reservation.status === ReservationStatus.ACTIVE;
  }

  static podeExpirarReserva(reservation: Reservation) {
    return reservation.status === ReservationStatus.ACTIVE;
  }

  static alterarStatusReserva(
    reservation: Reservation,
    status: Reservation["status"],
  ): Reservation {
    return {
      ...reservation,
      status,
      updatedAt: new Date(),
    };
  }
}
