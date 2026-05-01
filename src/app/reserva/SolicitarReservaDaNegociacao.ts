import { ProposalStatus } from "../../domain/proposta/ProposalStatus";
import { ReservationStatus } from "../../domain/reserva/ReservationStatus";
import type { Client } from "../../shared/types/client";
import type { CommercialSettings } from "../../shared/types/commercialSettings";
import type { Negotiation } from "../../shared/types/negotiation";
import type { Proposal } from "../../shared/types/proposal";
import type { ReservationRequest } from "../../shared/types/reservationRequest";
import { InvalidReservationRequestError } from "./errors/InvalidReservationRequestError";

function isClientDataComplete(client: Client | null) {
  return Boolean(
    client &&
      client.status === "active" &&
      client.name.trim() &&
      client.email.trim() &&
      client.phone.trim() &&
      client.city.trim(),
  );
}

export function solicitarReservaDaNegociacao(input: {
  negotiation: Negotiation;
  proposals: Proposal[];
  existingRequests: ReservationRequest[];
  settings: CommercialSettings;
  client: Client | null;
}) {
  const acceptedProposal =
    input.proposals.find((proposal) => proposal.status === ProposalStatus.ACCEPTED) ??
    null;
  const latestProposal =
    [...input.proposals].sort(
      (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
    )[0] ?? null;

  // requireAcceptedProposal is now advisory only — reservation can be requested
  // with any active proposal (accepted or not). The flag controls whether
  // auto-reservation happens on proposal acceptance.

  if (
    input.settings.requireCompleteClientDataForReservationRequest &&
    !isClientDataComplete(input.client)
  ) {
    throw new InvalidReservationRequestError(
      "A solicitacao de reserva exige cliente com dados completos e ativo.",
    );
  }

  const hasOpenRequest = input.existingRequests.some(
    (request) => request.status === ReservationStatus.REQUESTED,
  );

  if (hasOpenRequest) {
    throw new InvalidReservationRequestError(
      "Ja existe uma solicitacao de reserva em aberto para esta negociacao.",
    );
  }

  const proposal = acceptedProposal ?? latestProposal;

  if (!proposal) {
    throw new InvalidReservationRequestError(
      "A solicitacao de reserva exige ao menos uma proposta vinculada.",
    );
  }

  return {
    proposal,
  };
}
