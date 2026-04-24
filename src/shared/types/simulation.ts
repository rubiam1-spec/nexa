// NEXA — Engrenagem Comercial v1
// Tipo de domínio da simulação de pipeline (tabela pipeline_simulations).
// camelCase na UI; mapping para snake_case acontece no repositório.

export type PipelineSimulationStatus =
  | "ativa"
  | "draft"
  | "converted"
  | "cancelled";

export type PipelineSimulation = {
  id: string;
  accountId: string;
  developmentId: string;
  unitId: string | null;
  clientId: string | null;
  brokerId: string | null;
  createdBy: string | null;
  thirdPartyPropertyId: string | null;
  propertyName: string | null;
  /** Vínculo com negociação (Engrenagem Comercial v1 — Fase 1). */
  negotiationId: string | null;
  valorTotal: number;
  entradaPercentual: number | null;
  entradaValor: number | null;
  parcelasQuantidade: number | null;
  parcelasValor: number | null;
  balaoQuantidade: number | null;
  balaoValor: number | null;
  permutaValor: number | null;
  permutaDescricao: string | null;
  observacoes: string | null;
  status: PipelineSimulationStatus | string;
  followUpAt: string | null;
  createdAt: string;
  updatedAt: string;
};
