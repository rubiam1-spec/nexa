import { NegotiationService } from "../../domain/negociacao/NegotiationService";
import { NegotiationStatus } from "../../domain/negociacao/NegotiationStatus";
import type { Negotiation } from "../../shared/types/negotiation";
import { InvalidNegotiationTransitionError } from "./errors/InvalidNegotiationTransitionError";

export function cancelarNegociacao(negotiation: Negotiation) {
  if (!NegotiationService.podeCancelar(negotiation)) {
    throw new InvalidNegotiationTransitionError(
      "A negociacao informada nao pode ser cancelada a partir do status atual.",
    );
  }

  return NegotiationService.alterarStatus(
    negotiation,
    NegotiationStatus.CANCELLED,
  );
}
