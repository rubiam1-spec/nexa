import { NegotiationService } from "../../domain/negociacao/NegotiationService";
import { NegotiationStatus } from "../../domain/negociacao/NegotiationStatus";
import type { Negotiation } from "../../shared/types/negotiation";
import { InvalidNegotiationTransitionError } from "./errors/InvalidNegotiationTransitionError";

export function iniciarNegociacao(negotiation: Negotiation) {
  if (!NegotiationService.podeIniciar(negotiation)) {
    throw new InvalidNegotiationTransitionError(
      "A negociacao informada nao pode ser iniciada a partir do status atual.",
    );
  }

  return NegotiationService.alterarStatus(
    negotiation,
    NegotiationStatus.IN_PROGRESS,
  );
}
