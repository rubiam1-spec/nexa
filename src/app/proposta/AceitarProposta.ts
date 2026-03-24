import { ProposalService } from "../../domain/proposta/ProposalService";
import { ProposalStatus } from "../../domain/proposta/ProposalStatus";
import type { Proposal } from "../../shared/types/proposal";
import { InvalidProposalTransitionError } from "./errors/InvalidProposalTransitionError";

export function aceitarProposta(proposal: Proposal) {
  if (!ProposalService.podeAceitar(proposal)) {
    throw new InvalidProposalTransitionError(
      "A proposta informada nao pode ser aceita a partir do status atual.",
    );
  }

  return ProposalService.alterarStatus(proposal, ProposalStatus.ACCEPTED);
}
