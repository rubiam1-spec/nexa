// Fonte única do vocabulário de status de PROPOSTA (Fase 3 — Etapa 1).
// enum de domínio (UPPERCASE) + valor real no banco (lowercase, confirmado Fase 1).
import { ProposalStatus, type ProposalStatus as ProposalStatusType } from "../proposta/ProposalStatus";
export { ProposalStatus, type ProposalStatusType };

/** enum → valor gravado em proposals.status (lowercase). */
export const ProposalDbStatus: Record<ProposalStatusType, string> = {
  [ProposalStatus.DRAFT]: "draft",
  [ProposalStatus.SENT]: "sent",
  [ProposalStatus.UNDER_ANALYSIS]: "under_analysis",
  [ProposalStatus.ACCEPTED]: "accepted",
  [ProposalStatus.REJECTED]: "rejected",
  [ProposalStatus.EXPIRED]: "expired",
  [ProposalStatus.COUNTER_PROPOSAL]: "counter_proposal",
};

export const PROPOSAL_DB_VALUES = Object.values(ProposalDbStatus);

// Proposta encerrada (não requer mais ação): rejeitada/expirada/aceita — valores do banco.
// Usado por leitores estritos do Kanban (Fase 3 — Etapa 3).
export const PROPOSAL_CLOSED_DB_VALUES = [
  ProposalDbStatus[ProposalStatus.REJECTED],
  ProposalDbStatus[ProposalStatus.EXPIRED],
  ProposalDbStatus[ProposalStatus.ACCEPTED],
];

// Propostas "ativas canceláveis" pela cascata de cancelamento de negociação.
// Espelha EXATAMENTE o conjunto que usePipelineActions varria (Fase 3 — Etapa 5):
// EXCLUI counter_proposal por design atual (decisão de produto — preservar comportamento).
export const PROPOSAL_ACTIVE_CANCELLABLE_DB_VALUES = [
  ProposalDbStatus[ProposalStatus.DRAFT],
  ProposalDbStatus[ProposalStatus.SENT],
  ProposalDbStatus[ProposalStatus.UNDER_ANALYSIS],
];

/** valor do banco → membro do enum. */
export const ProposalStatusFromDb: Record<string, ProposalStatusType> = Object.fromEntries(
  Object.entries(ProposalDbStatus).map(([k, v]) => [v, k as ProposalStatusType]),
);
const fromDb = ProposalStatusFromDb;

export function toProposalDb(status: ProposalStatusType): string {
  return ProposalDbStatus[status];
}
export function fromProposalDb(raw: string): ProposalStatusType {
  const trimmed = (raw ?? "").trim();
  if (fromDb[trimmed]) return fromDb[trimmed];
  const upper = trimmed.toUpperCase();
  if ((Object.values(ProposalStatus) as string[]).includes(upper)) return upper as ProposalStatusType;
  return ProposalStatus.DRAFT;
}
