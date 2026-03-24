import { ProposalService } from "../../domain/proposta/ProposalService";
import { ProposalStatus } from "../../domain/proposta/ProposalStatus";
import type { Proposal } from "../../shared/types/proposal";
import { InvalidProposalTransitionError } from "./errors/InvalidProposalTransitionError";

export function colocarPropostaEmAnalise(proposal: Proposal) {
  if (!ProposalService.podeColocarEmAnalise(proposal)) {
    throw new InvalidProposalTransitionError(
      "A proposta informada nao pode entrar em analise a partir do status atual.",
    );
  }

  return ProposalService.alterarStatus(proposal, ProposalStatus.UNDER_ANALYSIS);
}
