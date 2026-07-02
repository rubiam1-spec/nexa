// Fonte única do vocabulário de status de GRUPO DE SIMULAÇÃO (Fase 3 — Etapa 1).
// simulation_groups é acessada de forma crua (sem repositório), então o valor do enum
// É o valor do banco. Banco em inglês minúsculo (CHECK simulation_groups_status_check).
export const SimulationGroupStatus = {
  ACTIVE: "active",
  CONVERTED: "converted",
  EXPIRED: "expired",
  CANCELLED: "cancelled",
} as const;

export type SimulationGroupStatus =
  (typeof SimulationGroupStatus)[keyof typeof SimulationGroupStatus];

export const SIMULATION_GROUP_DB_VALUES = Object.values(SimulationGroupStatus) as string[];
