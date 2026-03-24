import { ProposalStatus } from "../../../domain/proposta/ProposalStatus";
import type { Proposal } from "../../../shared/types/proposal";
import { proposalsMock } from "../mocks/proposalsMock";

export function getProposalsByNegotiation(negotiationId: string) {
  return proposalsMock
    .filter((proposal) => proposal.negotiationId === negotiationId)
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
}

export function getProposals(accountId: string, developmentId: string) {
  return proposalsMock
    .filter(
      (proposal) =>
        proposal.accountId === accountId &&
        proposal.developmentId === developmentId,
    )
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
}

export function createProposal(input: {
  negotiationId: string;
  accountId: string;
  developmentId: string;
  unitId: string;
  clientId: string | null;
  brokerId: string | null;
  title: string;
  amount: number;
  createdBy: string | null;
}) {
  const proposal: Proposal = {
    id: `proposal_${crypto.randomUUID()}`,
    negotiationId: input.negotiationId,
    accountId: input.accountId,
    developmentId: input.developmentId,
    unitId: input.unitId,
    clientId: input.clientId,
    brokerId: input.brokerId,
    title: input.title,
    amount: input.amount,
    status: ProposalStatus.DRAFT,
    tipo: "proposta",
    entradaTipo: null,
    entradaValor: null,
    entradaPercentual: null,
    parcelasQuantidade: null,
    parcelasValor: null,
    balaoQuantidade: null,
    balaoValor: null,
    permutaValor: null,
    permutaDescricao: null,
    observacoes: null,
    createdBy: input.createdBy,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  proposalsMock.unshift(proposal);

  return proposal;
}

export function updateProposalStatus(
  proposalId: string,
  status: Proposal["status"],
) {
  const proposal = proposalsMock.find((item) => item.id === proposalId);

  if (!proposal) {
    throw new Error("Proposal not found in mock repository.");
  }

  proposal.status = status;
  proposal.updatedAt = new Date();

  return proposal;
}
