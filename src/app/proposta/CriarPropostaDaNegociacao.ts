import { NegotiationService } from "../../domain/negociacao/NegotiationService";
import type { Negotiation } from "../../shared/types/negotiation";
import { iniciarNegociacao } from "../negociacao/IniciarNegociacao";
import { InvalidProposalCreationError } from "./errors/InvalidProposalCreationError";

export function criarPropostaDaNegociacao(
  negotiation: Negotiation,
  currentProposalCount: number,
) {
  if (!NegotiationService.podeCriarProposta(negotiation)) {
    throw new InvalidProposalCreationError(
      "Nao e possivel criar proposta para a negociacao no status atual.",
    );
  }

  return {
    proposalTitle: `Proposta ${currentProposalCount + 1}`,
    nextNegotiation:
      negotiation.status === "OPEN" ? iniciarNegociacao(negotiation) : null,
  };
}
