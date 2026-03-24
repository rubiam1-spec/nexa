import { ProposalService } from "../../domain/proposta/ProposalService";
import { ProposalStatus } from "../../domain/proposta/ProposalStatus";
import type { Proposal } from "../../shared/types/proposal";
import { InvalidProposalTransitionError } from "./errors/InvalidProposalTransitionError";

export function recusarProposta(proposal: Proposal) {
  if (!ProposalService.podeRecusar(proposal)) {
    throw new InvalidProposalTransitionError(
      "A proposta informada nao pode ser recusada a partir do status atual.",
    );
  }

  return ProposalService.alterarStatus(proposal, ProposalStatus.REJECTED);
}
