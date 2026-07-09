// Fase B do Funil — agregador PURO da fonte única. Recebe os cards (uma só query,
// useKanbanData) e devolve o board que as 3 visões consomem. Contadores e VGV são
// calculados AQUI, uma vez — por isso os números do header são idênticos nas 3
// visões por construção (nenhuma visão recalcula estágio ou soma por conta própria).
import type { KanbanCard } from "../hooks/useKanbanData";
import { NegotiationStatus, type NegotiationStatusType } from "../../../domain/status/negotiation";
import { RESERVATION_ACTIVE_DB, RESERVATION_REQUEST_PENDING_DB } from "../../../domain/status/reservation";
import { columnOfStatus, STAGE_ORDER, type BoardStage } from "./stageColumn";

const NEG_VALUES = new Set<string>(Object.values(NegotiationStatus));
function coerce(status: string): NegotiationStatusType {
  const up = (status || "").trim().toUpperCase();
  return (NEG_VALUES.has(up) ? up : NegotiationStatus.IN_PROGRESS) as NegotiationStatusType;
}

/** Estágios "abertos" (funil em progresso, exclui venda e perdido). */
const OPEN_STAGES: BoardStage[] = ["em_negociacao", "proposta", "reserva"];

export type PendingDecision = {
  id: string;
  kind: "reservation_request" | "reservation_expired";
  clienteNome: string | null;
  unitLabel: string | null;
};

export type BoardModel = {
  /** Negociações reais (exclui simulações), na ordem recebida. */
  negotiations: KanbanCard[];
  /** Simulações (pré-funil). */
  simulations: KanbanCard[];
  byStage: Record<BoardStage, KanbanCard[]>;
  countByStage: Record<BoardStage, number>;
  vgvByStage: Record<BoardStage, number>;
  /** Abertas = em_negociacao + proposta + reserva (exclui venda/perdido). */
  openCount: number;
  openVGV: number;
  wonCount: number;
  wonVGV: number;
  lostCount: number;
  /** Total de negociações no funil (exclui simulações). */
  totalCount: number;
  pending: PendingDecision[];
  /** Pré-funil: simulações (count/vgv) + leads ativos (fora do funil). */
  prefunnel: { count: number; vgv: number; leads: number };
};

function emptyByStage<T>(make: () => T): Record<BoardStage, T> {
  return Object.fromEntries(STAGE_ORDER.map((s) => [s, make()])) as Record<BoardStage, T>;
}

export function buildBoard(cards: KanbanCard[], nowMs: number = Date.now(), leadsActive = 0): BoardModel {
  const negotiations: KanbanCard[] = [];
  const simulations: KanbanCard[] = [];
  for (const c of cards) {
    if (c.isSimulacao) simulations.push(c);
    else negotiations.push(c);
  }

  const byStage = emptyByStage<KanbanCard[]>(() => []);
  const countByStage = emptyByStage<number>(() => 0);
  const vgvByStage = emptyByStage<number>(() => 0);
  const pending: PendingDecision[] = [];

  for (const c of negotiations) {
    const stage = columnOfStatus(coerce(c.status));
    byStage[stage].push(c);
    countByStage[stage] += 1;
    vgvByStage[stage] += c.valor ?? 0;

    // Decisões pendentes (não movem coluna — só sinalizam):
    // (a) solicitação de reserva aguardando aprovação.
    if (c.reservaRequestId && c.reservaRequestStatus === RESERVATION_REQUEST_PENDING_DB) {
      pending.push({
        id: c.id,
        kind: "reservation_request",
        clienteNome: c.clienteNome,
        unitLabel: c.quadra ? `Q${c.quadra}·L${c.lote}` : null,
      });
    }
    // (b) reserva ativa com prazo vencido, sem decisão.
    if (
      c.reservaStatus === RESERVATION_ACTIVE_DB &&
      c.reservaExpiresAt &&
      new Date(c.reservaExpiresAt).getTime() <= nowMs
    ) {
      pending.push({
        id: c.id,
        kind: "reservation_expired",
        clienteNome: c.clienteNome,
        unitLabel: c.quadra ? `Q${c.quadra}·L${c.lote}` : null,
      });
    }
  }

  const openCount = OPEN_STAGES.reduce((s, k) => s + countByStage[k], 0);
  const openVGV = OPEN_STAGES.reduce((s, k) => s + vgvByStage[k], 0);

  return {
    negotiations,
    simulations,
    byStage,
    countByStage,
    vgvByStage,
    openCount,
    openVGV,
    wonCount: countByStage.venda,
    wonVGV: vgvByStage.venda,
    lostCount: countByStage.perdido,
    totalCount: negotiations.length,
    pending,
    prefunnel: {
      count: simulations.length,
      vgv: simulations.reduce((s, c) => s + (c.valor ?? 0), 0),
      leads: leadsActive,
    },
  };
}
