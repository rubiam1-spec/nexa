import { useMemo, useState } from "react";
import type { BoardModel } from "../board/buildBoard";
import { stageMeta, type BoardStage } from "../board/stageColumn";
import {
  computeFunnelMetrics, computeEndToEndJourney, periodStartMs,
  computeMonthlyEvolution, computeBrokerRanking, periodSeries, pctDelta,
  type PeriodKey, type JourneyStage, type BrokerRankRow,
} from "../board/funnelMetrics";
import { useScreen } from "../../../shared/hooks/useIsMobile";
import {
  VizFrame, VizLegendItem, useVizTooltip, VizTipRow,
  Sparkline, BarSeries, LineOverlay, FunnelBars, VIZ,
  vgvOrDash, percent, coverageLabel, rangeLabel,
  type VizDatum, type FunnelStageDatum,
} from "../../../shared/viz";

const MONO = VIZ.mono;
const daysStr = (v: number | null) => v == null ? "—" : `${Math.round(v)}d`;

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "30d", label: "Últimos 30 dias" },
  { key: "90d", label: "Últimos 90 dias" },
  { key: "month", label: "Este mês" },
];

const NEG_STAGES = new Set<string>(["em_negociacao", "proposta", "reserva", "venda"]);
function journeyStageColor(s: JourneyStage): string {
  if (s.tone === "lead") return s.key === "leads" ? VIZ.blue : VIZ.slateBlue;
  return stageMeta(s.key as BoardStage).color;
}

// ── Delta (chip vs. período anterior) ──
function Delta({ v, kind, goodWhen }: { v: number | null; kind: "pct" | "pp" | "days"; goodWhen: "up" | "down" }) {
  if (v == null) return <span style={{ fontSize: 9.5, color: VIZ.muted, fontFamily: MONO }}>— sem base</span>;
  const flat = Math.abs(v) < (kind === "pct" ? 0.005 : 0.5);
  const up = v > 0;
  const good = flat ? null : (goodWhen === "up" ? up : !up);
  const color = flat ? VIZ.muted : good ? VIZ.positive : VIZ.negative;
  const arrow = flat ? "=" : up ? "▲" : "▼";
  const mag = kind === "pct" ? `${Math.round(Math.abs(v) * 100)}%` : kind === "pp" ? `${Math.abs(Math.round(v * 100))}pp` : `${Math.abs(Math.round(v))}d`;
  return <span style={{ fontSize: 10, color, fontFamily: MONO, fontWeight: 700 }}>{arrow} {mag} <span style={{ color: VIZ.muted, fontWeight: 400 }}>vs. anterior</span></span>;
}

export function FunnelView({ board, thresholdDays, onOpenStage }: {
  board: BoardModel;
  thresholdDays: number;
  onOpenNegotiation?: (id: string) => void; // mantido no contrato; Leitura da Operação removida da UI
  onOpenStage: (stage: BoardStage) => void;
}) {
  const [period, setPeriod] = useState<PeriodKey>("30d");
  const screen = useScreen();
  const isMobile = screen.isMobile;
  const nowMs = Date.now();
  const tip = useVizTooltip();

  const start = periodStartMs(period, nowMs);
  const intervalLabel = rangeLabel(start, nowMs);

  const { metrics, mPrev, journey, monthly, ranking, series } = useMemo(() => {
    const prevStart = start - (nowMs - start);
    const createdMs = (iso: string) => new Date(iso).getTime();
    const cohort = board.negotiations.filter((c) => createdMs(c.createdAt) >= start);
    const prevCohort = board.negotiations.filter((c) => { const t = createdMs(c.createdAt); return t >= prevStart && t < start; });
    const sims = board.simulations.filter((c) => createdMs(c.createdAt) >= start);
    const m = computeFunnelMetrics(cohort, sims, thresholdDays, nowMs);
    const mp = computeFunnelMetrics(prevCohort, [], thresholdDays, nowMs);
    return {
      metrics: m, mPrev: mp,
      journey: computeEndToEndJourney(m.reached, board.leadRows, start),
      monthly: computeMonthlyEvolution(board.negotiations, nowMs, 24), // FIX: cap 24 (era 12)
      ranking: computeBrokerRanking(cohort, 5),
      series: periodSeries(cohort, start, nowMs, 6),
    };
  }, [board, start, thresholdDays, nowMs]);

  // KPIs (seguem o filtro) com delta + sparkline.
  const convDeltaPP = mPrev.conversaoGeral == null ? null : (metrics.conversaoGeral ?? 0) - mPrev.conversaoGeral;
  const cicloDelta = (metrics.cicloMedioDias == null || mPrev.cicloMedioDias == null) ? null : metrics.cicloMedioDias - mPrev.cicloMedioDias;
  const kpis = [
    { label: "Conversão geral", value: percent(metrics.conversaoGeral), hint: `${metrics.reached.venda} de ${metrics.entradas} entradas`, delta: <Delta v={convDeltaPP} kind="pp" goodWhen="up" />, spark: null as number[] | null, sparkColor: VIZ.blue },
    { label: "VGV criado no período", value: vgvOrDash(metrics.openVGV), hint: `abertas · ${coverageLabel(metrics.openCoverage.withValue, metrics.openCoverage.total)}`, delta: <Delta v={pctDelta(metrics.openVGV, mPrev.openVGV)} kind="pct" goodWhen="up" />, spark: series.criadas, sparkColor: VIZ.blue },
    { label: "Ciclo médio", value: daysStr(metrics.cicloMedioDias), hint: "criação → venda", delta: <Delta v={cicloDelta} kind="days" goodWhen="down" />, spark: null, sparkColor: VIZ.blue },
    { label: "Vendido no período", value: `${metrics.vendido.count}`, hint: vgvOrDash(metrics.vendido.vgv), delta: <Delta v={pctDelta(metrics.vendido.count, mPrev.vendido.count)} kind="pct" goodWhen="up" />, spark: series.vendas, sparkColor: VIZ.positiveSolid },
  ];

  const journeyHasData = journey.stages.some((s) => s.count > 0);
  const monthRange = monthly.length ? `${monthly[0].label} → ${monthly[monthly.length - 1].label}` : "—";

  // ── Evolução mensal: barras (criadas) + linha (vendas), mesma escala ──
  const evoMax = Math.max(1, ...monthly.map((m) => Math.max(m.criadas, m.vendas)));
  const evoBars: VizDatum[] = monthly.map((m) => ({ label: m.label, value: m.criadas, color: m.overflow ? VIZ.clay : VIZ.blue }));
  const evoLine: VizDatum[] = monthly.map((m) => ({ label: m.label, value: m.vendas }));

  // ── Funil da jornada: estágios + conversões + VGV (secundário) ──
  const vgvOf = (k: string) => metrics.stageStats.find((s) => s.stage === k)?.vgv ?? 0;
  const tempoOf = (k: string) => metrics.stageStats.find((s) => s.stage === k)?.tempoMedioDias ?? null;
  const funnelStages: FunnelStageDatum[] = journey.stages.map((s) => ({
    key: s.key, label: s.label, value: s.count, color: journeyStageColor(s),
    secondary: NEG_STAGES.has(s.key) ? (vgvOf(s.key) > 0 ? vgvOrDash(vgvOf(s.key)) : "") : "",
  }));
  const convs = journey.transitions.map((t) => t.conv);
  const maxRowCount = Math.max(1, journey.stages[0].count, journey.stages[1].count, ...metrics.stageStats.map((s) => s.count));

  return (
    <div>
      {/* Filtro de período + INTERVALO visível */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {PERIODS.map((p) => {
            const active = period === p.key;
            return (
              <button key={p.key} type="button" onClick={() => setPeriod(p.key)}
                style={{ padding: "6px 14px", borderRadius: 8, border: active ? "1px solid rgba(74,222,128,0.35)" : "1px solid var(--border-default)", background: active ? "rgba(74,222,128,0.08)" : "transparent", color: active ? VIZ.positive : "var(--color-fog)", fontFamily: MONO, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                {p.label}
              </button>
            );
          })}
        </div>
        <span style={{ fontFamily: MONO, fontSize: 10.5, color: VIZ.muted }}>{intervalLabel}</span>
      </div>

      {/* KPIs (seguem o filtro) */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, minmax(0,1fr))" : "repeat(auto-fit, minmax(190px, 1fr))", gap: 10, marginBottom: 18 }}>
        {kpis.map((k) => (
          <div key={k.label} style={{ background: "var(--surface-raised)", border: "1px solid var(--border-default)", borderRadius: 12, padding: "14px 16px" }}>
            <div style={{ fontSize: 8.5, color: VIZ.muted, fontFamily: MONO, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 500 }}>{k.label}</div>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 8, marginTop: 6 }}>
              <div style={{ fontSize: 26, fontWeight: 700, color: VIZ.ink, fontFamily: MONO, lineHeight: 1 }}>{k.value}</div>
              {k.spark ? <Sparkline data={k.spark} color={k.sparkColor} /> : null}
            </div>
            <div style={{ fontSize: 10, color: VIZ.muted, marginTop: 5 }}>{k.hint}</div>
            <div style={{ marginTop: 4 }}>{k.delta}</div>
          </div>
        ))}
      </div>

      {/* Evolução mensal — histórico completo, NÃO segue o filtro */}
      <div style={{ marginBottom: 18 }}>
        <VizFrame
          title="Evolução mensal"
          subtitle={`histórico completo · não segue o filtro · ${monthRange}`}
          legend={<><VizLegendItem color={VIZ.blue} label="criadas" /><VizLegendItem color={VIZ.positiveSolid} label="vendas" /></>}
          empty={monthly.every((m) => m.criadas === 0 && m.vendas === 0)}
          emptyLabel="Sem negociações no histórico para desenhar a evolução."
          height={220}
        >
          <div style={{ position: "relative" }}>
            <BarSeries data={evoBars} max={evoMax} height={210}
              onHover={(e, _d, i) => { const m = monthly[i]; tip.show(e, <><VizTipRow label={m.label} value="" /><VizTipRow label="criadas" value={`${m.criadas}`} color={VIZ.blue} /><VizTipRow label="vendas" value={`${m.vendas}`} color={VIZ.positiveSolid} /><VizTipRow label="VGV" value={vgvOrDash(m.vgvVendas)} /><div style={{ color: VIZ.muted, marginTop: 2 }}>{coverageLabel(m.vendasComValor, m.vendas)}</div></>); }}
              onLeave={tip.hide} />
            <LineOverlay data={evoLine} max={evoMax} height={210} color={VIZ.positiveSolid} />
          </div>
        </VizFrame>
      </div>

      {/* Funil da jornada — segue o filtro; clique abre a Lista */}
      <div style={{ marginBottom: 18 }}>
        <VizFrame
          title="Funil da jornada"
          subtitle={`segue o filtro · ${intervalLabel} · Leads/atendimento = coorte de leads; negociação = coorte de negociações · clique num estágio para abrir a Lista`}
          empty={!journeyHasData}
          emptyLabel="Sem leads nem negociações no período para desenhar a jornada."
          height={240}
        >
          <FunnelBars
            stages={funnelStages}
            convs={convs}
            onSelect={(s) => { if (NEG_STAGES.has(s.key)) onOpenStage(s.key as BoardStage); }}
            onHover={(e, s, i) => {
              const isNeg = NEG_STAGES.has(s.key);
              const convIn = i > 0 ? convs[i - 1] : null;
              tip.show(e, <><VizTipRow label={s.label} value={`${s.value}`} /><VizTipRow label="conversão de entrada" value={percent(convIn)} />{isNeg ? <><VizTipRow label="VGV" value={vgvOrDash(vgvOf(s.key))} /><VizTipRow label="tempo médio" value={daysStr(tempoOf(s.key))} /></> : null}</>);
            }}
            onLeave={tip.hide}
          />
        </VizFrame>
      </div>

      {/* Ranking de corretores do período */}
      <div style={{ marginBottom: 18 }}>
        <VizFrame title="Top corretores do período" subtitle={`segue o filtro · ${intervalLabel}`} empty={ranking.rows.length === 0} emptyLabel="Sem negociações no período." height={0}>
          <BrokerRanking rows={ranking.rows} semCorretorVendas={ranking.semCorretorVendas} isMobile={isMobile} />
        </VizFrame>
      </div>

      {/* Tabela por estágio — barras inline + clique → Lista */}
      <div style={{ background: "var(--surface-raised)", border: "1px solid var(--border-default)", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: "10px 16px 0", fontFamily: MONO, fontSize: 9, letterSpacing: "0.06em", color: VIZ.clay }}>
          Segue o filtro · coorte de negociações criadas no período (fluxo, não estoque) · valores somam só quem tem unidade.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 0.6fr 1fr 1fr 0.8fr", padding: "10px 16px", borderBottom: "1px solid var(--border-default)", fontFamily: MONO, fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", color: VIZ.muted }}>
          <span>Estágio</span><span style={{ textAlign: "right" }}>Qtd</span><span style={{ textAlign: "right" }}>Valor</span><span style={{ textAlign: "right" }}>T. médio</span><span style={{ textAlign: "right" }}>Atenção</span>
        </div>
        <StageRow color={journeyStageColor(journey.stages[0])} label="Leads" count={journey.stages[0].count} valor="—" tempo="—" atencao={journey.leadsSemResposta} atencaoLabel="sem resposta" barPct={journey.stages[0].count / maxRowCount} />
        <StageRow color={journeyStageColor(journey.stages[1])} label="Em atendimento" count={journey.stages[1].count} valor="—" tempo="—" atencao={0} barPct={journey.stages[1].count / maxRowCount} />
        {metrics.stageStats.map((st) => {
          const meta = stageMeta(st.stage);
          return (
            <StageRow key={st.stage} color={meta.color} label={meta.label} count={st.count}
              valor={vgvOrDash(st.vgv)} tempo={daysStr(st.tempoMedioDias)} atencao={st.atencao}
              barPct={st.count / maxRowCount} onClick={() => onOpenStage(st.stage)} />
          );
        })}
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 0.6fr 1fr 1fr 0.8fr", padding: "11px 16px", alignItems: "center", opacity: 0.65 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "#706B5F" }} /><span style={{ fontSize: 13, color: "var(--color-fog)" }}>Pré-funil <span style={{ fontSize: 10 }}>· simulações · fora da conta</span></span></span>
          <span style={{ textAlign: "right", fontFamily: MONO, fontSize: 13, color: "var(--color-fog)" }}>{metrics.prefunnel.count}</span>
          <span style={{ textAlign: "right", fontFamily: MONO, fontSize: 13, color: VIZ.muted }}>{vgvOrDash(metrics.prefunnel.vgv)}</span>
          <span style={{ textAlign: "right", color: VIZ.muted }}>—</span>
          <span style={{ textAlign: "right", color: VIZ.muted }}>—</span>
        </div>
      </div>

      {tip.node}
    </div>
  );
}

function StageRow({ color, label, count, valor, tempo, atencao, atencaoLabel, barPct, onClick }: {
  color: string; label: string; count: number; valor: string; tempo: string; atencao: number; atencaoLabel?: string; barPct: number; onClick?: () => void;
}) {
  const clickable = !!onClick;
  return (
    <div onClick={onClick} title={clickable ? "Abrir Lista filtrada por este estágio" : undefined}
      style={{ position: "relative", display: "grid", gridTemplateColumns: "1.4fr 0.6fr 1fr 1fr 0.8fr", padding: "11px 16px", borderBottom: "1px solid rgba(61,58,48,0.4)", alignItems: "center", cursor: clickable ? "pointer" : "default" }}>
      <div aria-hidden="true" style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${Math.max(0, Math.min(1, barPct)) * 100}%`, background: color, opacity: 0.07, pointerEvents: "none" }} />
      <span style={{ display: "flex", alignItems: "center", gap: 8, position: "relative" }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: color }} /><span style={{ fontSize: 13, color: "var(--color-bone)" }}>{label}</span>{clickable ? <span style={{ fontSize: 11, color: VIZ.muted }}>→</span> : null}</span>
      <span style={{ textAlign: "right", fontFamily: MONO, fontSize: 13, color: "var(--color-bone)", position: "relative" }}>{count}</span>
      <span style={{ textAlign: "right", fontFamily: MONO, fontSize: 13, color: "var(--color-dust)", position: "relative" }}>{valor}</span>
      <span style={{ textAlign: "right", fontFamily: MONO, fontSize: 12, color: VIZ.muted, position: "relative" }}>{tempo}</span>
      <span style={{ textAlign: "right", fontFamily: MONO, fontSize: 12, color: atencao > 0 ? VIZ.negative : VIZ.muted, position: "relative" }}>{atencao > 0 ? `${atencao}${atencaoLabel ? " " + atencaoLabel : ""}` : "—"}</span>
    </div>
  );
}

// ── Ranking de corretores (barras inline) ──
function BrokerRanking({ rows, semCorretorVendas, isMobile }: { rows: BrokerRankRow[]; semCorretorVendas: number; isMobile: boolean }) {
  const maxVendas = Math.max(1, ...rows.map((r) => r.vendas));
  const maxCriadas = Math.max(1, ...rows.filter((r) => r.semVenda).map((r) => r.criadas));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {rows.map((r, i) => {
        const right = r.semVenda
          ? `${r.criadas} ${r.criadas === 1 ? "criada" : "criadas"} · sem venda no período`
          : `${r.vendas} ${r.vendas === 1 ? "venda" : "vendas"}${!isMobile ? ` · ${vgvOrDash(r.vgv)} · ${percent(r.conv)} conv` : ""}`;
        const barPct = r.semVenda ? r.criadas / maxCriadas : r.vendas / maxVendas;
        const barBg = r.semVenda ? "var(--border-strong, #3D3A30)" : (i === 0 ? `linear-gradient(90deg, ${VIZ.positive}, #22C55E)` : "var(--color-clay)");
        return (
          <div key={r.name} style={{ display: "flex", alignItems: "center", gap: 12, opacity: r.semVenda ? 0.7 : 1 }}>
            <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: !r.semVenda && i === 0 ? VIZ.positive : VIZ.muted, width: 22, flexShrink: 0 }}>#{i + 1}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-bone)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
                <span style={{ fontFamily: MONO, fontSize: 11, color: "var(--color-fog)", flexShrink: 0, whiteSpace: "nowrap" }}>{right}</span>
              </div>
              <div style={{ height: 7, borderRadius: 4, background: "var(--border-default)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${Math.max(barPct * 100, barPct > 0 ? 4 : 0)}%`, background: barBg, borderRadius: 4 }} />
              </div>
            </div>
          </div>
        );
      })}
      {semCorretorVendas > 0 ? (
        <div style={{ fontFamily: MONO, fontSize: 10.5, color: VIZ.muted, paddingTop: 6, borderTop: "1px solid rgba(61,58,48,0.4)" }}>
          {semCorretorVendas} {semCorretorVendas === 1 ? "venda sem corretor" : "vendas sem corretor"} atribuído (fora do ranking).
        </div>
      ) : null}
    </div>
  );
}
