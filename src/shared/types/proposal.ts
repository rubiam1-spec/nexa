import type { ProposalStatus } from "../../domain/proposta/ProposalStatus";

export type Proposal = {
  id: string;
  negotiationId: string;
  accountId: string;
  developmentId: string;
  unitId: string;
  clientId: string | null;
  brokerId: string | null;
  title: string;
  amount: number;
  status: ProposalStatus;
  tipo: string;
  entradaTipo: string | null;
  entradaValor: number | null;
  entradaPercentual: number | null;
  parcelasQuantidade: number | null;
  parcelasValor: number | null;
  balaoQuantidade: number | null;
  balaoValor: number | null;
  permutaValor: number | null;
  permutaDescricao: string | null;
  observacoes: string | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};
