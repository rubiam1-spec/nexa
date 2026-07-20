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
import { LeadQualificationStatus } from "../../../domain/status/leadQualification";
import type { LeadFunnelRow } from "./leadFunnel";

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
  /** Cobertura do VGV aberto da coorte: com valor (unidade) de total aberto. */
  openCoverage: { withValue: number; total: number };
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

  const openCards = cohort.filter((c) => OPEN_STAGES.includes(stageOf(c)));
  const openVGV = openCards.reduce((s, c) => s + (c.valor ?? 0), 0);
  const openCoverage = { withValue: openCards.filter((c) => c.valor != null).length, total: openCards.length };

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
        reservaAtiva: !!c.reservaStatus, status: c.status, ownerProfileId: c.ownerProfileId,
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
    openCoverage,
    cicloMedioDias,
    vendido,
    transitions,
    reached,
    stageStats,
    prefunnel: { count: simulations.length, vgv: simulations.reduce((s, c) => s + (c.valor ?? 0), 0) },
    bottleneck,
  };
}

// ── Funil v2 (leitura de gestão) — agregações PURAS sobre o dataset da página ──
// Nenhuma query nova: tudo deriva de board.negotiations (histórico completo da
// conta/empreendimento) e da coorte do período.

const MESES_PT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function monthKey(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export type MonthlyPoint = { key: string; label: string; criadas: number; vendas: number; vgvVendas: number };

/**
 * Evolução mês a mês (INDEPENDENTE do filtro curto): criadas por created_at e
 * vendas pela data de fechamento (stage_changed_at do estágio venda, senão updated_at).
 */
export function computeMonthlyEvolution(negotiations: KanbanCard[], nowMs: number, months = 12): MonthlyPoint[] {
  const now = new Date(nowMs);
  const buckets = new Map<string, MonthlyPoint>();
  const pts: MonthlyPoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const p: MonthlyPoint = { key, label: `${MESES_PT[d.getUTCMonth()]}/${String(d.getUTCFullYear()).slice(2)}`, criadas: 0, vendas: 0, vgvVendas: 0 };
    buckets.set(key, p);
    pts.push(p);
  }
  for (const c of negotiations) {
    const ck = monthKey(c.createdAt);
    if (ck && buckets.has(ck)) buckets.get(ck)!.criadas += 1;
    if (columnOfStatusRaw(c.status) === "venda") {
      const wk = monthKey(c.stageChangedAt ?? c.updatedAt);
      if (wk && buckets.has(wk)) {
        const b = buckets.get(wk)!;
        b.vendas += 1;
        b.vgvVendas += c.valor ?? 0;
      }
    }
  }
  return pts;
}

export type BrokerRankRow = { name: string; criadas: number; vendas: number; vgv: number; conv: number | null };

/** Ranking de corretores da COORTE do período: top N por vendas, depois VGV. */
export function computeBrokerRanking(cohort: KanbanCard[], topN = 5): BrokerRankRow[] {
  const map = new Map<string, BrokerRankRow>();
  for (const c of cohort) {
    const name = c.corretorNome ?? "Sem corretor";
    if (!map.has(name)) map.set(name, { name, criadas: 0, vendas: 0, vgv: 0, conv: null });
    const r = map.get(name)!;
    r.criadas += 1;
    if (columnOfStatusRaw(c.status) === "venda") {
      r.vendas += 1;
      r.vgv += c.valor ?? 0;
    }
  }
  return [...map.values()]
    .map((r) => ({ ...r, conv: r.criadas > 0 ? r.vendas / r.criadas : null }))
    .sort((a, b) => b.vendas - a.vendas || b.vgv - a.vgv || b.criadas - a.criadas)
    .slice(0, topN);
}

/** Séries por sub-bucket do período (para sparklines): criadas e vendas. */
export function periodSeries(cohort: KanbanCard[], startMs: number, nowMs: number, buckets = 6): { criadas: number[]; vendas: number[] } {
  const span = Math.max(1, nowMs - startMs);
  const size = span / buckets;
  const criadas = new Array(buckets).fill(0);
  const vendas = new Array(buckets).fill(0);
  const idxOf = (t: number) => Math.min(buckets - 1, Math.max(0, Math.floor((t - startMs) / size)));
  for (const c of cohort) {
    const ct = new Date(c.createdAt).getTime();
    if (Number.isFinite(ct) && ct >= startMs && ct <= nowMs) criadas[idxOf(ct)] += 1;
    if (columnOfStatusRaw(c.status) === "venda") {
      const wonRef = c.stageChangedAt ?? c.updatedAt;
      const wt = wonRef ? new Date(wonRef).getTime() : NaN;
      if (Number.isFinite(wt) && wt >= startMs && wt <= nowMs) vendas[idxOf(wt)] += 1;
    }
  }
  return { criadas, vendas };
}

/** Delta relativo curr vs prev. null = sem base (período anterior vazio). */
export function pctDelta(curr: number, prev: number): number | null {
  if (prev === 0) return curr === 0 ? 0 : null;
  return (curr - prev) / prev;
}

// L1.8 — JORNADA PONTA-A-PONTA (Leads → Em atendimento → Em negociação → Proposta →
// Reserva → Venda), com % entre CADA par. HONESTIDADE fluxo × estoque: Leads e
// Em atendimento são a COORTE DE LEADS do período (por clients.created_at); os
// estágios de negociação são a COORTE DE NEGOCIAÇÕES (reached, já do período). A
// transição Em atendimento → Em negociação cruza as duas coortes (fluxo aproximado).
// Sem base em qualquer par → conv = null → UI "—".
export type JourneyStageKey = "leads" | "atendimento" | "em_negociacao" | "proposta" | "reserva" | "venda";
export type JourneyTone = "lead" | "negotiation";
export type JourneyStage = { key: JourneyStageKey; label: string; count: number; tone: JourneyTone };
export type JourneyTransition = { fromKey: JourneyStageKey; toKey: JourneyStageKey; conv: number | null };
export type EndToEndJourney = {
  stages: JourneyStage[];
  transitions: JourneyTransition[];
  /** Leads criados no período ainda em NEW (sem 1ª resposta) — "atenção" da linha Leads. */
  leadsSemResposta: number;
};

export function computeEndToEndJourney(
  reached: Record<BoardStage, number>,
  leadRows: LeadFunnelRow[],
  startMs: number,
): EndToEndJourney {
  let leadsCriados = 0;
  let atendidos = 0;
  let semResposta = 0;
  for (const r of leadRows) {
    const t = new Date(r.createdAt).getTime();
    if (!Number.isFinite(t) || t < startMs) continue;
    leadsCriados += 1;
    if (r.qualification !== LeadQualificationStatus.NEW) atendidos += 1;
    else semResposta += 1;
  }
  const stages: JourneyStage[] = [
    { key: "leads", label: "Leads", count: leadsCriados, tone: "lead" },
    { key: "atendimento", label: "Em atendimento", count: atendidos, tone: "lead" },
    { key: "em_negociacao", label: "Em negociação", count: reached.em_negociacao, tone: "negotiation" },
    { key: "proposta", label: "Proposta", count: reached.proposta, tone: "negotiation" },
    { key: "reserva", label: "Reserva", count: reached.reserva, tone: "negotiation" },
    { key: "venda", label: "Venda", count: reached.venda, tone: "negotiation" },
  ];
  const conv = (from: number, to: number): number | null => (from > 0 ? to / from : null);
  const transitions: JourneyTransition[] = [];
  for (let i = 0; i < stages.length - 1; i++) {
    transitions.push({ fromKey: stages[i].key, toKey: stages[i + 1].key, conv: conv(stages[i].count, stages[i + 1].count) });
  }
  return { stages, transitions, leadsSemResposta: semResposta };
}
