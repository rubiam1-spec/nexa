import { ProposalService } from "../../domain/proposta/ProposalService";
import { ProposalStatus } from "../../domain/proposta/ProposalStatus";
import type { Proposal } from "../../shared/types/proposal";
import { InvalidProposalTransitionError } from "./errors/InvalidProposalTransitionError";

export function enviarProposta(proposal: Proposal) {
  if (!ProposalService.podeEnviar(proposal)) {
    throw new InvalidProposalTransitionError(
      "A proposta informada nao pode ser enviada a partir do status atual.",
    );
  }

  return ProposalService.alterarStatus(proposal, ProposalStatus.SENT);
}
