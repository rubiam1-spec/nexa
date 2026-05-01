import { NegotiationService } from "../../domain/negociacao/NegotiationService";
import { NegotiationStatus } from "../../domain/negociacao/NegotiationStatus";
import { ReservationStatus } from "../../domain/reserva/ReservationStatus";
import { SaleStatus } from "../../domain/venda/SaleStatus";
import type { Negotiation } from "../../shared/types/negotiation";
import type { Proposal } from "../../shared/types/proposal";
import type { ReservationRequest } from "../../shared/types/reservationRequest";
import type { Reservation } from "../../shared/types/reservation";
import type { Sale } from "../../shared/types/sale";
import { InvalidSaleCreationError } from "./errors/InvalidSaleCreationError";

export function converterNegociacaoEmVenda(input: {
  negotiation: Negotiation;
  proposals: Proposal[];
  reservationRequests: ReservationRequest[];
  reservations: Reservation[];
  existingSales: Sale[];
}) {
  const activeReservation =
    input.reservations.find(
      (reservation) => reservation.status === ReservationStatus.ACTIVE,
    ) ?? null;

  if (!activeReservation) {
    throw new InvalidSaleCreationError(
      "A venda exige uma reserva ativa vinculada à negociação.",
    );
  }

  const reservationRequest =
    input.reservationRequests.find(
      (request) => request.id === activeReservation.reservationRequestId,
    ) ?? null;

  if (!reservationRequest) {
    throw new InvalidSaleCreationError(
      "A reserva ativa não possui solicitação de origem válida.",
    );
  }

  const proposal =
    input.proposals.find((item) => item.id === reservationRequest.proposalId) ?? null;

  if (!proposal) {
    throw new InvalidSaleCreationError(
      "A reserva ativa nao possui proposta vinculada valida.",
    );
  }

  const hasSale = input.existingSales.some(
    (sale) => sale.negotiationId === input.negotiation.id,
  );

  if (hasSale) {
    throw new InvalidSaleCreationError(
      "Já existe uma venda registrada para esta negociação.",
    );
  }

  return {
    saleDraft: {
      negotiationId: input.negotiation.id,
      reservationId: activeReservation.id,
      proposalId: proposal.id,
      accountId: input.negotiation.accountId,
      developmentId: input.negotiation.developmentId,
      unitId: input.negotiation.unitId,
      amount: proposal.amount,
      status: SaleStatus.CREATED as Sale["status"],
    },
    updatedNegotiation: NegotiationService.alterarStatus(
      input.negotiation,
      NegotiationStatus.WON,
    ),
  };
}
