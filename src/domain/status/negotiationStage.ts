// Derivação pura do ESTÁGIO da negociação a partir dos filhos (Fase A do Funil).
//
// `negotiations.status` passa a ser A verdade única do estágio. Esta função é a
// REGRA (decisão de produto) que traduz o snapshot dos filhos no estágio. É pura
// (sem I/O): os repositórios leem os filhos, chamam-na e persistem o resultado
// (ver src/infra/repositories/recomputeNegotiationStage.ts).
//
// REGRA — o estágio reflete o marco ATIVO mais avançado:
//   1. venda existente (não cancelada)                        → WON
//   2. senão, reserva ATIVA                                   → RESERVATION
//   3. senão, proposta ABERTA (draft/sent/under_analysis/
//      counter_proposal)                                      → PROPOSAL
//   4. senão                                                  → base (ver abaixo)
//
// Terminais LOST e CANCELLED vêm de ação explícita (markNegotiationLost,
// cancelamento) e NUNCA são sobrescritos pela derivação.
// OPEN permanece OPEN sem marco (nunca auto-promovido); qualquer outro estado
// não-terminal sem marco cai para IN_PROGRESS (permite regressão ENTRE marcos —
// ex.: reserva cancelada sem proposta aberta → IN_PROGRESS).
//
// NB: reservation_requests (requested/approved) NÃO entram aqui — a regra é
// "reserva ATIVA" (tabela reservations, status=active). Solicitação pendente não
// promove o estágio para RESERVATION.
import { NegotiationStatus, type NegotiationStatusType } from "./negotiation";
import { type ProposalStatusType, PROPOSAL_OPEN_VALUES } from "./proposal";
import { ReservationStatus, type ReservationStatusType } from "./reservation";
import { SaleStatus, type SaleStatusType } from "./sale";

/** Snapshot dos filhos de uma negociação, em valores canônicos (enum). */
export type NegotiationChildrenSnapshot = {
  readonly proposals: readonly ProposalStatusType[];
  readonly reservations: readonly ReservationStatusType[];
  readonly sales: readonly SaleStatusType[];
};

const OPEN_PROPOSAL = new Set<ProposalStatusType>(PROPOSAL_OPEN_VALUES);

/**
 * Deriva o estágio da negociação. `current` é o estágio atual (para preservar
 * terminais e a distinção OPEN×IN_PROGRESS). Retorna o estágio que a negociação
 * DEVE ter — o chamador grava apenas se diferir (idempotência).
 */
export function deriveNegotiationStage(
  current: NegotiationStatusType,
  children: NegotiationChildrenSnapshot,
): NegotiationStatusType {
  // Terminais por ação explícita — a derivação nunca os sobrescreve.
  if (
    current === NegotiationStatus.LOST ||
    current === NegotiationStatus.CANCELLED
  ) {
    return current;
  }

  // 1. Venda não-cancelada.
  const hasActiveSale = children.sales.some((s) => s !== SaleStatus.CANCELLED);
  if (hasActiveSale) return NegotiationStatus.WON;

  // 2. Reserva ATIVA.
  const hasActiveReservation = children.reservations.some(
    (r) => r === ReservationStatus.ACTIVE,
  );
  if (hasActiveReservation) return NegotiationStatus.RESERVATION;

  // 3. Proposta aberta.
  const hasOpenProposal = children.proposals.some((p) => OPEN_PROPOSAL.has(p));
  if (hasOpenProposal) return NegotiationStatus.PROPOSAL;

  // 4. Sem marco ativo: base. OPEN só permanece OPEN; o resto cai p/ IN_PROGRESS.
  return current === NegotiationStatus.OPEN
    ? NegotiationStatus.OPEN
    : NegotiationStatus.IN_PROGRESS;
}
