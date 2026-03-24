import type { Proposal } from "../../shared/types/proposal";
import { ProposalStatus } from "./ProposalStatus";

export class ProposalService {
  static podeEnviar(proposal: Proposal) {
    return proposal.status === ProposalStatus.DRAFT;
  }

  static podeColocarEmAnalise(proposal: Proposal) {
    return proposal.status === ProposalStatus.SENT;
  }

  static podeAceitar(proposal: Proposal) {
    return (
      proposal.status === ProposalStatus.SENT ||
      proposal.status === ProposalStatus.UNDER_ANALYSIS
    );
  }

  static podeRecusar(proposal: Proposal) {
    return (
      proposal.status === ProposalStatus.DRAFT ||
      proposal.status === ProposalStatus.SENT ||
      proposal.status === ProposalStatus.UNDER_ANALYSIS
    );
  }

  static alterarStatus(
    proposal: Proposal,
    status: Proposal["status"],
  ): Proposal {
    return {
      ...proposal,
      status,
      updatedAt: new Date(),
    };
  }
}
