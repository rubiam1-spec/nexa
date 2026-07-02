// Fonte única do vocabulário de status de SIMULAÇÃO DE PIPELINE (Fase 3 — Etapa 1).
// pipeline_simulations é acessada de forma crua (sem repositório de tradução), então
// o valor do enum É o valor do banco. Banco em PT (confirmado Fase 1: ativa/convertida).
export const PipelineSimulationStatus = {
  ATIVA: "ativa",
  CONVERTIDA: "convertida",
  EXPIRADA: "expirada",
  CANCELADA: "cancelada",
} as const;

export type PipelineSimulationStatus =
  (typeof PipelineSimulationStatus)[keyof typeof PipelineSimulationStatus];

export const PIPELINE_SIMULATION_DB_VALUES = Object.values(PipelineSimulationStatus) as string[];
