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
 * Data de fechamento da venda — fallback em cadeia HONESTO:
 * stage_changed_at (entrada no estágio venda) → created_at. NUNCA updated_at/now.
 */
export function wonRefIso(c: KanbanCard): string {
  return c.stageChangedAt ?? c.createdAt;
}

/** "Alcançou o estágio X" = está em X ou além no fluxo (perdido não avança). */
export function computeReached(cohort: KanbanCard[]): Record<BoardStage, number> {
  const reached: Record<BoardStage, number> = { em_negociacao: 0, proposta: 0, reserva: 0, venda: 0, perdido: 0 };
  for (const c of cohort) {
    reached.em_negociacao += 1;
    const idx = flowIndex(columnOfStatusRaw(c.status));
    if (idx >= flowIndex("proposta") && idx >= 0) reached.proposta += 1;
    if (idx >= flowIndex("reserva") && idx >= 0) reached.reserva += 1;
    if (idx >= flowIndex("venda") && idx >= 0) reached.venda += 1;
  }
  return reached;
}

export function computeTransitions(reached: Record<BoardStage, number>): FunnelTransition[] {
  const transitions: FunnelTransition[] = [];
  for (let i = 0; i < FUNNEL_FLOW.length - 1; i++) {
    const from = FUNNEL_FLOW[i], to = FUNNEL_FLOW[i + 1];
    const rf = reached[from], rt = reached[to];
    transitions.push({ from, to, reachedFrom: rf, reachedTo: rt, conv: rf > 0 ? rt / rf : null });
  }
  return transitions;
}

/** Gargalo = transição de MENOR conversão que ainda tem itens na origem. */
export function bottleneckOf(transitions: FunnelTransition[]): FunnelTransition | null {
  let bottleneck: FunnelTransition | null = null;
  for (const t of transitions) {
    if (t.conv == null || t.reachedFrom === 0) continue;
    if (bottleneck == null || t.conv < (bottleneck.conv ?? 1)) bottleneck = t;
  }
  return bottleneck;
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

  const reached = computeReached(cohort);
  const transitions = computeTransitions(reached);

  const entradas = reached.em_negociacao;
  const conversaoGeral = entradas > 0 ? reached.venda / entradas : null;

  // Ciclo médio (dias) entre criação e venda, na coorte vendida.
  const wonCycle: number[] = [];
  for (const c of cohort) {
    if (stageOf(c) !== "venda") continue;
    const days = (new Date(wonRefIso(c)).getTime() - new Date(c.createdAt).getTime()) / DAY;
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

  const bottleneck = bottleneckOf(transitions);

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

export type MonthlyPoint = { key: string; label: string; criadas: number; vendas: number; vendasComValor: number; vgvVendas: number; overflow?: boolean };

// Índice de mês absoluto (ano*12 + mês) e rótulo "mmm/yy".
function ymIndex(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.getUTCFullYear() * 12 + d.getUTCMonth();
}
function ymLabel(ym: number): string {
  const y = Math.floor(ym / 12), m = ym % 12;
  return `${MESES_PT[m]}/${String(y).slice(2)}`;
}

/**
 * Evolução mês a mês com JANELA DINÂMICA: do mês da negociação mais antiga do
 * dataset até o mês atual. Cap de `cap` meses; acima disso, o excedente antigo
 * é agrupado num bucket "antes de <mês>". Criadas por created_at; vendas pela
 * data de fechamento (wonRefIso: stage_changed_at → created_at, nunca updated_at).
 * INDEPENDENTE do filtro curto do período.
 */
export function computeMonthlyEvolution(negotiations: KanbanCard[], nowMs: number, cap = 24): MonthlyPoint[] {
  const now = new Date(nowMs);
  const nowYm = now.getUTCFullYear() * 12 + now.getUTCMonth();

  let oldestYm = nowYm;
  for (const c of negotiations) {
    const y = ymIndex(c.createdAt);
    if (y != null && y < oldestYm) oldestYm = y;
  }

  const spanMonths = nowYm - oldestYm + 1;
  const hasOverflow = spanMonths > cap;
  const regularCount = hasOverflow ? cap - 1 : spanMonths; // reserva 1 slot p/ overflow
  const startYm = nowYm - (regularCount - 1);

  const buckets = new Map<number, MonthlyPoint>();
  const pts: MonthlyPoint[] = [];
  if (hasOverflow) {
    const ov: MonthlyPoint = { key: `overflow`, label: `antes de ${ymLabel(startYm)}`, criadas: 0, vendas: 0, vendasComValor: 0, vgvVendas: 0, overflow: true };
    pts.push(ov);
  }
  for (let ym = startYm; ym <= nowYm; ym++) {
    const p: MonthlyPoint = { key: `${Math.floor(ym / 12)}-${String((ym % 12) + 1).padStart(2, "0")}`, label: ymLabel(ym), criadas: 0, vendas: 0, vendasComValor: 0, vgvVendas: 0 };
    buckets.set(ym, p);
    pts.push(p);
  }
  const overflowBucket = hasOverflow ? pts[0] : null;

  const put = (ym: number | null, fn: (p: MonthlyPoint) => void) => {
    if (ym == null) return;
    if (ym >= startYm) { const b = buckets.get(ym); if (b) fn(b); }
    else if (overflowBucket) fn(overflowBucket);
  };
  for (const c of negotiations) {
    put(ymIndex(c.createdAt), (p) => { p.criadas += 1; });
    if (columnOfStatusRaw(c.status) === "venda") {
      put(ymIndex(wonRefIso(c)), (p) => { p.vendas += 1; p.vgvVendas += c.valor ?? 0; if (c.valor != null) p.vendasComValor += 1; });
    }
  }
  return pts;
}

export type BrokerRankRow = { name: string; criadas: number; vendas: number; vgv: number; conv: number | null; semVenda: boolean };
export type BrokerRankingResult = {
  rows: BrokerRankRow[];
  /** Vendas sem corretor atribuído (rodapé honesto), fora do top. */
  semCorretorVendas: number;
};

/**
 * Ranking de corretores da COORTE do período. Exclui a pseudo-entrada
 * "Sem corretor" (vendas sem corretor viram rodapé). Prioriza quem tem venda;
 * se restarem <3 com venda, completa por nº de criadas (rotulado semVenda).
 */
export function computeBrokerRanking(cohort: KanbanCard[], topN = 5): BrokerRankingResult {
  const map = new Map<string, { name: string; criadas: number; vendas: number; vgv: number }>();
  let semCorretorVendas = 0;
  for (const c of cohort) {
    const isWon = columnOfStatusRaw(c.status) === "venda";
    if (c.corretorNome == null || c.corretorNome === "") {
      if (isWon) semCorretorVendas += 1;
      continue; // sem corretor não entra no ranking nominal
    }
    const name = c.corretorNome;
    if (!map.has(name)) map.set(name, { name, criadas: 0, vendas: 0, vgv: 0 });
    const r = map.get(name)!;
    r.criadas += 1;
    if (isWon) { r.vendas += 1; r.vgv += c.valor ?? 0; }
  }
  const named = [...map.values()];
  const mkRow = (r: { name: string; criadas: number; vendas: number; vgv: number }, semVenda: boolean): BrokerRankRow =>
    ({ ...r, conv: r.criadas > 0 ? r.vendas / r.criadas : null, semVenda });

  const withVendas = named.filter((r) => r.vendas > 0).sort((a, b) => b.vendas - a.vendas || b.vgv - a.vgv || b.criadas - a.criadas);
  const rows: BrokerRankRow[] = withVendas.slice(0, topN).map((r) => mkRow(r, false));

  // Se poucas com venda, completa por criadas (até 3, respeitando o cap).
  if (rows.length < Math.min(3, topN)) {
    const chosen = new Set(rows.map((r) => r.name));
    const fillers = named
      .filter((r) => r.vendas === 0 && !chosen.has(r.name))
      .sort((a, b) => b.criadas - a.criadas)
      .slice(0, Math.min(3, topN) - rows.length)
      .map((r) => mkRow(r, true));
    rows.push(...fillers);
  }
  return { rows, semCorretorVendas };
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
      const wt = new Date(wonRefIso(c)).getTime();
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
