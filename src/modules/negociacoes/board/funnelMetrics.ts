// Fase B do Funil (Bloco 2) — métricas do FUNIL, PURAS e testáveis.
// Cálculo em serviço (nunca no .tsx). Escopo = COORTE do período (negociações
// criadas no período selecionado); tudo derivado do snapshot atual dos filhos.
//
// HONESTIDADE: sem histórico completo de transições, não reconstruímos o tempo
// por estágio ao longo da vida — usamos o que existe (stage_changed_at = entrada
// no estágio atual; created_at). Quando um cálculo não tem base, devolvemos null
// e a UI mostra "—" (nunca inventa número).
import type { KanbanCard } from "../hooks/useKanbanData";
import { columnOfStatusRaw, FUNNEL_FLOW, type BoardStage } from "./stageColumn";
import { semaphoreOf } from "./semaphore";

export type PeriodKey = "30d" | "90d" | "month";

export function periodStartMs(period: PeriodKey, nowMs: number): number {
  if (period === "month") {
    const d = new Date(nowMs);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
  }
  const days = period === "30d" ? 30 : 90;
  return nowMs - days * 86_400_000;
}

export type FunnelStageStat = {
  stage: BoardStage;
  count: number;
  vgv: number;
  /** Tempo médio (dias) no estágio ATUAL — null se sem base. */
  tempoMedioDias: number | null;
  /** Nº de itens em atenção (semáforo vermelho). */
  atencao: number;
};

export type FunnelTransition = {
  from: BoardStage;
  to: BoardStage;
  reachedFrom: number;
  reachedTo: number;
  /** Conversão from→to (0..1) — null se reachedFrom = 0. */
  conv: number | null;
};

export type FunnelMetrics = {
  entradas: number;
  conversaoGeral: number | null;
  openVGV: number;
  cicloMedioDias: number | null;
  vendido: { count: number; vgv: number };
  transitions: FunnelTransition[];
  /** Contagem "alcançou o estágio" por etapa do fluxo. */
  reached: Record<BoardStage, number>;
  stageStats: FunnelStageStat[];
  prefunnel: { count: number; vgv: number };
  /** Transição gargalo (menor conversão com itens presos), ou null. */
  bottleneck: FunnelTransition | null;
};

const OPEN_STAGES: BoardStage[] = ["em_negociacao", "proposta", "reserva"];
const flowIndex = (s: BoardStage) => FUNNEL_FLOW.indexOf(s);
const DAY = 86_400_000;

function avg(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/**
 * @param cohort negociações já filtradas ao período (created_at no período) — exclui simulações.
 * @param simulations simulações (pré-funil) já filtradas ao período.
 */
export function computeFunnelMetrics(
  cohort: KanbanCard[],
  simulations: KanbanCard[],
  thresholdDays: number,
  nowMs: number,
): FunnelMetrics {
  const stageOf = (c: KanbanCard) => columnOfStatusRaw(c.status);

  // "Alcançou o estágio X" = está atualmente em X ou além (no fluxo). Perdido não
  // conta como avanço (só entrou em em_negociacao).
  const reached: Record<BoardStage, number> = { em_negociacao: 0, proposta: 0, reserva: 0, venda: 0, perdido: 0 };
  for (const c of cohort) {
    const st = stageOf(c);
    // todos entraram em em_negociacao
    reached.em_negociacao += 1;
    const idx = flowIndex(st);
    if (idx >= flowIndex("proposta") && idx >= 0) reached.proposta += 1;
    if (idx >= flowIndex("reserva") && idx >= 0) reached.reserva += 1;
    if (idx >= flowIndex("venda") && idx >= 0) reached.venda += 1;
  }

  const transitions: FunnelTransition[] = [];
  for (let i = 0; i < FUNNEL_FLOW.length - 1; i++) {
    const from = FUNNEL_FLOW[i], to = FUNNEL_FLOW[i + 1];
    const rf = reached[from], rt = reached[to];
    transitions.push({ from, to, reachedFrom: rf, reachedTo: rt, conv: rf > 0 ? rt / rf : null });
  }

  const entradas = reached.em_negociacao;
  const conversaoGeral = entradas > 0 ? reached.venda / entradas : null;

  // Ciclo médio (dias) entre criação e venda, na coorte vendida.
  const wonCycle: number[] = [];
  for (const c of cohort) {
    if (stageOf(c) !== "venda") continue;
    const wonRef = c.stageChangedAt ?? c.updatedAt;
    if (!wonRef) continue;
    const days = (new Date(wonRef).getTime() - new Date(c.createdAt).getTime()) / DAY;
    if (Number.isFinite(days) && days >= 0) wonCycle.push(days);
  }
  const cicloMedioDias = avg(wonCycle);

  // Vendido no período (coorte vendida).
  const vendaCards = cohort.filter((c) => stageOf(c) === "venda");
  const vendido = { count: vendaCards.length, vgv: vendaCards.reduce((s, c) => s + (c.valor ?? 0), 0) };

  const openVGV = cohort.filter((c) => OPEN_STAGES.includes(stageOf(c))).reduce((s, c) => s + (c.valor ?? 0), 0);

  // Tabela por estágio (distribuição atual da coorte).
  const stageStats: FunnelStageStat[] = FUNNEL_FLOW.map((stage) => {
    const inStage = cohort.filter((c) => stageOf(c) === stage);
    const tempos: number[] = [];
    let atencao = 0;
    for (const c of inStage) {
      if (c.stageChangedAt) {
        const d = (nowMs - new Date(c.stageChangedAt).getTime()) / DAY;
        if (Number.isFinite(d) && d >= 0) tempos.push(d);
      }
      const s = semaphoreOf({
        nextActionAt: c.nextActionAt, followUpAt: c.followUpAt, lastActivityAt: c.lastActivityAt,
        updatedAt: c.updatedAt, stageChangedAt: c.stageChangedAt, reservaExpiresAt: c.reservaExpiresAt,
        reservaAtiva: !!c.reservaStatus,
      }, thresholdDays, nowMs);
      if (s.level === "red") atencao += 1;
    }
    return {
      stage,
      count: inStage.length,
      vgv: inStage.reduce((s, c) => s + (c.valor ?? 0), 0),
      tempoMedioDias: avg(tempos),
      atencao,
    };
  });

  // Gargalo = transição de MENOR conversão que ainda tem itens na origem.
  let bottleneck: FunnelTransition | null = null;
  for (const t of transitions) {
    if (t.conv == null || t.reachedFrom === 0) continue;
    if (bottleneck == null || t.conv < (bottleneck.conv ?? 1)) bottleneck = t;
  }

  return {
    entradas,
    conversaoGeral,
    openVGV,
    cicloMedioDias,
    vendido,
    transitions,
    reached,
    stageStats,
    prefunnel: { count: simulations.length, vgv: simulations.reduce((s, c) => s + (c.valor ?? 0), 0) },
    bottleneck,
  };
}
