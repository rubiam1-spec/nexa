// Display do histórico de negociação — PURO e testável. Contrato de tolerância:
// ação desconhecida NUNCA quebra; rende rótulo genérico + ação bruta no title.
// Fonte única de rótulos (a página de detalhe deve consumir isto no lugar do
// switch inline). Espelha os rótulos existentes + o caso de conflito de disputa.
import { NegotiationHistoryAction } from "./NegotiationHistoryAction";

const LABELS: Record<string, string> = {
  [NegotiationHistoryAction.NEGOTIATION_CREATED]: "Negociação criada",
  [NegotiationHistoryAction.NEGOTIATION_STARTED]: "Negociação iniciada",
  [NegotiationHistoryAction.NEGOTIATION_CANCELLED]: "Negociação cancelada",
  [NegotiationHistoryAction.NEGOTIATION_STAGE_CHANGED]: "Estágio atualizado",
  [NegotiationHistoryAction.PROPOSAL_CREATED]: "Proposta criada",
  [NegotiationHistoryAction.PROPOSAL_SENT]: "Proposta enviada",
  [NegotiationHistoryAction.PROPOSAL_UNDER_ANALYSIS]: "Proposta em análise",
  [NegotiationHistoryAction.PROPOSAL_ACCEPTED]: "Proposta aceita",
  [NegotiationHistoryAction.PROPOSAL_REJECTED]: "Proposta recusada",
  [NegotiationHistoryAction.QUEUE_ENTERED]: "Entrada na fila",
  [NegotiationHistoryAction.QUEUE_PROMOTED]: "Fila promovida",
  [NegotiationHistoryAction.RESERVATION_REQUESTED]: "Reserva solicitada",
  [NegotiationHistoryAction.RESERVATION_APPROVED]: "Solicitação aprovada",
  [NegotiationHistoryAction.RESERVATION_REJECTED]: "Solicitação recusada",
  [NegotiationHistoryAction.RESERVATION_CANCELLED]: "Reserva cancelada",
  [NegotiationHistoryAction.RESERVATION_EXPIRED]: "Reserva expirada",
  [NegotiationHistoryAction.SALE_CREATED]: "Venda criada",
  [NegotiationHistoryAction.RESERVATION_CONVERTED]: "Reserva convertida",
  [NegotiationHistoryAction.SALE_ADVANCED]: "Venda avançada",
  [NegotiationHistoryAction.SALE_COMPLETED]: "Venda concluída",
  [NegotiationHistoryAction.SALE_CANCELLED]: "Venda cancelada",
  [NegotiationHistoryAction.UNIT_UNLINKED_CONFLICT]: "Unidade desvinculada (conflito de disputa resolvido)",
};

export type NegotiationHistoryDisplay = {
  label: string;
  /** Preenchido só p/ ação desconhecida — vai no `title` (ação bruta). */
  rawTitle: string | null;
};

export function describeNegotiationHistoryAction(action: string): NegotiationHistoryDisplay {
  const label = LABELS[action];
  if (label) return { label, rawTitle: null };
  return { label: "Atualização do registro", rawTitle: action };
}
