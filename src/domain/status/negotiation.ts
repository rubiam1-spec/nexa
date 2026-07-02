// Fonte única do vocabulário de status de NEGOCIAÇÃO (Fase 3 — Etapa 1).
// Co-loca: enum de domínio + valor real no banco (confirmado na Fase 1) + tradução.
// negotiations.status no banco é UPPERCASE (CHECK negotiations_status_check),
// idêntico ao enum — o mapa é identidade.
export { NegotiationStatus, type NegotiationStatus as NegotiationStatusType } from "../negociacao/NegotiationStatus";
import { NegotiationStatus } from "../negociacao/NegotiationStatus";

/** Valor gravado no banco por membro do enum. */
export const NegotiationDbStatus: Record<string, string> = Object.fromEntries(
  Object.values(NegotiationStatus).map((v) => [v, v]),
);

export const NEGOTIATION_DB_VALUES = Object.values(NegotiationStatus) as string[];
