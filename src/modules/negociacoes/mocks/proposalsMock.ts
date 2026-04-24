import { ProposalStatus } from "../../../domain/proposta/ProposalStatus";
import type { Proposal } from "../../../shared/types/proposal";

export const proposalsMock: Proposal[] = [
  {
    id: "proposal_1",
    negotiationId: "negotiation_2",
    accountId: "account_1",
    developmentId: "development_1",
    unitId: "unit_2",
    clientId: "client_3",
    brokerId: "broker_3",
    title: "Proposta inicial",
    amount: 510000,
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
    simulationId: null,
    createdBy: "user_1",
    createdAt: new Date("2026-01-07T00:00:00.000Z"),
    updatedAt: new Date("2026-01-07T00:00:00.000Z"),
  },
];
