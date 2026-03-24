import { ProposalStatus, type ProposalStatus as ProposalStatusType } from "./ProposalStatus";

export function getProposalStatusLabel(status: ProposalStatusType) {
  switch (status) {
    case ProposalStatus.DRAFT:
      return "Rascunho";
    case ProposalStatus.SENT:
      return "Enviada";
    case ProposalStatus.UNDER_ANALYSIS:
      return "Em analise";
    case ProposalStatus.ACCEPTED:
      return "Aceita";
    case ProposalStatus.REJECTED:
      return "Recusada";
    case ProposalStatus.EXPIRED:
      return "Expirada";
    default:
      return status;
  }
}
