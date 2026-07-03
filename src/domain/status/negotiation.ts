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

/** Estados terminais (não-ativos) de negociação. */
export const NEGOTIATION_DONE_VALUES: string[] = [
  NegotiationStatus.WON,
  NegotiationStatus.LOST,
  NegotiationStatus.CANCELLED,
];

/**
 * Negociação ativa = não está num estado terminal. Comparação ESTRITA contra o
 * canônico (status vivo é sempre canônico — garantido pelo CHECK). Substitui o
 * antigo shared/utils/normalizeStatus.isNegotiationActive (que era tolerante).
 */
export function isNegotiationActive(status: string | null | undefined): boolean {
  return !NEGOTIATION_DONE_VALUES.includes(status ?? "");
}
