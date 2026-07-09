// Fase B do Funil — fonte ÚNICA do mapeamento estágio→coluna, rótulos canônicos
// e cores, compartilhada pelas 3 visões (Funil, Kanban, Lista). Módulo PURO
// (sem React/IO), testável. Nenhuma visão pode derivar estágio por conta própria:
// o estágio vem EXCLUSIVAMENTE de negotiations.status (Fase A).
import {
  NegotiationStatus,
  type NegotiationStatusType,
} from "../../../domain/status/negotiation";

/** Colunas canônicas do funil (simulação é PRÉ-FUNIL, fora destas). */
export type BoardStage =
  | "em_negociacao"
  | "proposta"
  | "reserva"
  | "venda"
  | "perdido";

export type StageMeta = {
  id: BoardStage;
  label: string;
  /** Cor do estágio (consistente nas 3 visões). */
  color: string;
  /** Fundo translúcido para chips/badges. */
  soft: string;
};

// Rótulos canônicos de exibição (encerram a divergência "Ganhas/Aberta" vs
// "Vendida/Em aberto") e cores por estágio aprovadas pelo Rubiam.
export const STAGES: readonly StageMeta[] = [
  { id: "em_negociacao", label: "Em negociação", color: "#4ADE80", soft: "rgba(74,222,128,0.12)" },
  { id: "proposta",      label: "Proposta",      color: "#7DA7F4", soft: "rgba(125,167,244,0.12)" },
  { id: "reserva",       label: "Reserva",       color: "#E8B45A", soft: "rgba(232,180,90,0.12)" },
  { id: "venda",         label: "Venda",         color: "#34D399", soft: "rgba(52,211,153,0.12)" },
  { id: "perdido",       label: "Perdido",       color: "#706B5F", soft: "rgba(112,107,95,0.12)" },
] as const;

export const STAGE_ORDER: readonly BoardStage[] = STAGES.map((s) => s.id);

/** Estágios que compõem o "funil de progresso" (exclui Perdido). */
export const FUNNEL_FLOW: readonly BoardStage[] = [
  "em_negociacao",
  "proposta",
  "reserva",
  "venda",
];

const STAGE_BY_ID: Record<BoardStage, StageMeta> = Object.fromEntries(
  STAGES.map((s) => [s.id, s]),
) as Record<BoardStage, StageMeta>;

export function stageMeta(stage: BoardStage): StageMeta {
  return STAGE_BY_ID[stage];
}

/**
 * Mapeamento estágio→coluna (decisão de produto, Fase B):
 *   Em negociação = OPEN + IN_PROGRESS · Proposta = PROPOSAL ·
 *   Reserva = RESERVATION · Venda = WON · Perdido = LOST + CANCELLED.
 * `status` já é canônico (garantido pela CHECK + fonte única).
 */
export function columnOfStatus(status: NegotiationStatusType): BoardStage {
  switch (status) {
    case NegotiationStatus.OPEN:
    case NegotiationStatus.IN_PROGRESS:
      return "em_negociacao";
    case NegotiationStatus.PROPOSAL:
      return "proposta";
    case NegotiationStatus.RESERVATION:
      return "reserva";
    case NegotiationStatus.WON:
      return "venda";
    case NegotiationStatus.LOST:
    case NegotiationStatus.CANCELLED:
      return "perdido";
    default:
      // Status desconhecido não deveria existir (CHECK); tratamos como base.
      return "em_negociacao";
  }
}

/** Rótulo canônico de um status (via coluna). */
export function stageLabelOfStatus(status: NegotiationStatusType): string {
  return STAGE_BY_ID[columnOfStatus(status)].label;
}
