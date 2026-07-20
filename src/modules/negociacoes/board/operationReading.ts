// Fase B do Funil (Bloco 2) — "Leitura da operação": frase diagnóstica gerada por
// REGRA DETERMINÍSTICA (sem IA nesta fase). PURA e testável.
//
// NÃO RENDERIZADA NA UI a partir do Funil v3 (decisão de produto — removida da
// tela). O módulo é MANTIDO de propósito: é a futura casa do motor de
// inteligência (hoje regra fixa: pior transição + item mais antigo travado;
// amanhã a mesma interface pode ser alimentada por scoring/insight). O contrato
// de saída permanece estável e coberto por testes.
import type { KanbanCard } from "../hooks/useKanbanData";
import { columnOfStatusRaw, stageMeta, type BoardStage } from "./stageColumn";
import { semaphoreOf, isAssumed } from "./semaphore";
import { computeReached, computeTransitions, bottleneckOf, type FunnelMetrics } from "./funnelMetrics";

export type OperationReadingCta = { label: string; negotiationId: string } | null;
export type OperationReading = { text: string; cta: OperationReadingCta };

const DAY = 86_400_000;
const OPEN_STAGES: BoardStage[] = ["em_negociacao", "proposta", "reserva"];

function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

/** Item mais antigo travado (semáforo vermelho) entre os estágios abertos da coorte. */
function oldestStuck(cards: KanbanCard[], thresholdDays: number, nowMs: number): { card: KanbanCard; days: number } | null {
  let best: { card: KanbanCard; ref: number } | null = null;
  for (const c of cards) {
    const stage = columnOfStatusRaw(c.status);
    if (!OPEN_STAGES.includes(stage)) continue;
    const s = semaphoreOf({
      nextActionAt: c.nextActionAt, followUpAt: c.followUpAt, lastActivityAt: c.lastActivityAt,
      updatedAt: c.updatedAt, stageChangedAt: c.stageChangedAt, reservaExpiresAt: c.reservaExpiresAt,
      reservaAtiva: !!c.reservaStatus,
    }, thresholdDays, nowMs);
    if (s.level !== "red") continue;
    const refIso = c.lastActivityAt ?? c.stageChangedAt ?? c.updatedAt;
    const ref = refIso ? new Date(refIso).getTime() : nowMs;
    if (best == null || ref < best.ref) best = { card: c, ref };
  }
  if (!best) return null;
  return { card: best.card, days: Math.max(0, Math.floor((nowMs - best.ref) / DAY)) };
}

export function generateOperationReading(
  metrics: FunnelMetrics,
  cohort: KanbanCard[],
  thresholdDays: number,
  nowMs: number,
): OperationReading {
  if (metrics.entradas === 0) {
    return { text: "Sem negociações criadas no período selecionado.", cta: null };
  }

  const stuck = oldestStuck(cohort, thresholdDays, nowMs);
  const cta: OperationReadingCta = stuck
    ? { label: "Abrir item mais antigo travado", negotiationId: stuck.card.id }
    : null;

  // Gargalo conta apenas negociações VIVAS E ASSUMIDAS (dono OU atividade) —
  // terminais permanecem (são resultado real). Ghosts importados sem responsável
  // saem da base. Reusa isAssumed (fonte única no semaphore.ts).
  const isTerminal = (c: KanbanCard) => { const st = columnOfStatusRaw(c.status); return st === "venda" || st === "perdido"; };
  const gated = cohort.filter((c) => isTerminal(c) || isAssumed(c));
  const excluded = cohort.filter((c) => !isTerminal(c) && !isAssumed(c));
  const excludedImportadas = excluded.filter((c) => c.importBatchId != null).length;
  const bn = bottleneckOf(computeTransitions(computeReached(gated)));

  const parts: string[] = [];
  if (bn && bn.conv != null) {
    parts.push(
      `Maior gargalo: ${stageMeta(bn.from).label} → ${stageMeta(bn.to).label} — só ${pct(bn.conv)} avançam (${bn.reachedTo} de ${bn.reachedFrom}).`,
    );
  } else if (metrics.conversaoGeral != null && metrics.vendido.count > 0) {
    parts.push(`${pct(metrics.conversaoGeral)} das ${metrics.entradas} entradas viraram venda no período.`);
  } else {
    parts.push(`Funil em formação: ${metrics.entradas} ${metrics.entradas === 1 ? "entrada" : "entradas"}, sem gargalo evidente ainda.`);
  }

  if (stuck) {
    const cliente = stuck.card.clienteNome || "Sem cliente";
    parts.push(`Item mais antigo travado: ${cliente}, parado há ${stuck.days}d em ${stageMeta(columnOfStatusRaw(stuck.card.status)).label}.`);
  }

  if (excludedImportadas > 0) {
    parts.push(`(${excludedImportadas} ${excludedImportadas === 1 ? "importada aguardando responsável" : "importadas aguardando responsável"} fora da conta.)`);
  }

  return { text: parts.join(" "), cta };
}
