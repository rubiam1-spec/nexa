import { useMemo, useState } from "react";
import type { BoardModel } from "../board/buildBoard";
import { stageMeta, type BoardStage } from "../board/stageColumn";
import {
  computeFunnelMetrics, computeEndToEndJourney, periodStartMs,
  computeMonthlyEvolution, computeBrokerRanking, periodSeries, pctDelta,
  type PeriodKey, type EndToEndJourney, type JourneyStage, type MonthlyPoint, type BrokerRankRow,
} from "../board/funnelMetrics";
import { generateOperationReading } from "../board/operationReading";
import { useScreen } from "../../../shared/hooks/useIsMobile";

const MONO = "var(--font-mono)";
const SPROUT = "var(--color-sprout)"; // acento — usar com parcimônia
const BLUE = "#7DA7F4";
const fmtV = (v: number) => v >= 1e6 ? `R$ ${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `R$ ${(v / 1e3).toFixed(0)}k` : `R$ ${Math.round(v)}`;
const daysStr = (v: number | null) => v == null ? "—" : `${Math.round(v)}d`;
const pctStr = (v: number | null) => v == null ? "—" : `${Math.round(v * 100)}%`;

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "30d", label: "Últimos 30 dias" },
  { key: "90d", label: "Últimos 90 dias" },
  { key: "month", label: "Este mês" },
];

function journeyStageColor(s: JourneyStage): string {
  if (s.tone === "lead") return s.key === "leads" ? BLUE : "#9DB8E8";
  return stageMeta(s.key as BoardStage).color;
}

// ── Delta e sparkline (SVG próprio; sem lib) ──
function Delta({ v, kind, goodWhen }: { v: number | null; kind: "pct" | "pp" | "days"; goodWhen: "up" | "down" }) {
  if (v == null) return <span style={{ fontSize: 9.5, color: "var(--color-slate)", fontFamily: MONO }}>— sem base</span>;
  const flat = Math.abs(v) < (kind === "pct" ? 0.005 : 0.5);
  const up = v > 0;
  const good = flat ? null : (goodWhen === "up" ? up : !up);
  const color = flat ? "var(--color-slate)" : good ? SPROUT : "#F87171";
  const arrow = flat ? "=" : up ? "▲" : "▼";
  const mag = kind === "pct" ? `${Math.round(Math.abs(v) * 100)}%` : kind === "pp" ? `${Math.abs(Math.round(v * 100))}pp` : `${Math.abs(Math.round(v))}d`;
  return <span style={{ fontSize: 10, color, fontFamily: MONO, fontWeight: 700 }}>{arrow} {mag} <span style={{ color: "var(--color-slate)", fontWeight: 400 }}>vs. anterior</span></span>;
}

function Spark({ data, color }: { data: number[]; color: string }) {
  const w = 66, h = 18, n = data.length;
  if (n < 2) return null;
  const max = Math.max(1, ...data);
  const pts = data.map((v, i) => `${((i / (n - 1)) * w).toFixed(1)},${(h - (v / max) * (h - 3) - 1).toFixed(1)}`).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block", flexShrink: 0 }} aria-hidden="true">
      <polygon points={`0,${h} ${pts} ${w},${h}`} fill={color} opacity={0.12} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
}

export function FunnelView({ board, thresholdDays, onOpenNegotiation, onOpenStage }: {
  board: BoardModel;
  thresholdDays: number;
  onOpenNegotiation: (id: string) => void;
  onOpenStage: (stage: BoardStage) => void;
}) {
  const [period, setPeriod] = useState<PeriodKey>("30d");
  const screen = useScreen();
  const isMobile = screen.isMobile;
  const nowMs = Date.now();

  const { metrics, mPrev, reading, journey, monthly, ranking, series } = useMemo(() => {
    const start = periodStartMs(period, nowMs);
    const prevStart = start - (nowMs - start); // janela anterior de mesmo tamanho
    const createdMs = (iso: string) => new Date(iso).getTime();
    const cohort = board.negotiations.filter((c) => createdMs(c.createdAt) >= start);
    const prevCohort = board.negotiations.filter((c) => { const t = createdMs(c.createdAt); return t >= prevStart && t < start; });
    const sims = board.simulations.filter((c) => createdMs(c.createdAt) >= start);
    const m = computeFunnelMetrics(cohort, sims, thresholdDays, nowMs);
    const mp = computeFunnelMetrics(prevCohort, [], thresholdDays, nowMs);
    const j = computeEndToEndJourney(m.reached, board.leadRows, start);
    return {
      metrics: m, mPrev: mp,
      reading: generateOperationReading(m, cohort, thresholdDays, nowMs),
      journey: j,
      monthly: computeMonthlyEvolution(board.negotiations, nowMs, 12), // INDEPENDENTE do período
      ranking: computeBrokerRanking(cohort, 5),
      series: periodSeries(cohort, start, nowMs, 6),
    };
  }, [board, period, thresholdDays, nowMs]);

  // KPIs com valor + delta (vs. período anterior) + sparkline onde é honesto.
  const convDeltaPP = mPrev.conversaoGeral == null ? null : (metrics.conversaoGeral ?? 0) - mPrev.conversaoGeral;
  const cicloDelta = (metrics.cicloMedioDias == null || mPrev.cicloMedioDias == null) ? null : metrics.cicloMedioDias - mPrev.cicloMedioDias;
  const kpis = [
    { label: "Conversão geral", value: pctStr(metrics.conversaoGeral), hint: `${metrics.reached.venda} de ${metrics.entradas} entradas`, delta: <Delta v={convDeltaPP} kind="pp" goodWhen="up" />, spark: null as number[] | null, sparkColor: BLUE },
    { label: "VGV criado no período", value: fmtV(metrics.openVGV), hint: `abertas · ${metrics.openCoverage.withValue} de ${metrics.openCoverage.total} com valor`, delta: <Delta v={pctDelta(metrics.openVGV, mPrev.openVGV)} kind="pct" goodWhen="up" />, spark: series.criadas, sparkColor: BLUE },
    { label: "Ciclo médio", value: daysStr(metrics.cicloMedioDias), hint: "criação → venda", delta: <Delta v={cicloDelta} kind="days" goodWhen="down" />, spark: null, sparkColor: BLUE },
    { label: "Vendido no período", value: `${metrics.vendido.count}`, hint: fmtV(metrics.vendido.vgv), delta: <Delta v={pctDelta(metrics.vendido.count, mPrev.vendido.count)} kind="pct" goodWhen="up" />, spark: series.vendas, sparkColor: SPROUT },
  ];

  const journeyHasData = journey.stages.some((s) => s.count > 0);
  const leadsStage = journey.stages[0];
  const atendStage = journey.stages[1];
  const maxRowCount = Math.max(1, leadsStage.count, atendStage.count, ...metrics.stageStats.map((s) => s.count));

  return (
    <div>
      {/* Filtro de período */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {PERIODS.map((p) => {
          const active = period === p.key;
          return (
            <button key={p.key} type="button" onClick={() => setPeriod(p.key)}
              style={{ padding: "6px 14px", borderRadius: 8, border: active ? "1px solid rgba(74,222,128,0.35)" : "1px solid var(--border-default)", background: active ? "rgba(74,222,128,0.08)" : "transparent", color: active ? SPROUT : "var(--color-fog)", fontFamily: MONO, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
              {p.label}
            </button>
          );
        })}
      </div>

      {/* KPIs com delta + sparkline */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, minmax(0,1fr))" : "repeat(auto-fit, minmax(190px, 1fr))", gap: 10, marginBottom: 18 }}>
        {kpis.map((k) => (
          <div key={k.label} style={{ background: "var(--surface-raised)", border: "1px solid var(--border-default)", borderRadius: 12, padding: "14px 16px" }}>
            <div style={{ fontSize: 8.5, color: "var(--color-slate)", fontFamily: MONO, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 500 }}>{k.label}</div>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 8, marginTop: 6 }}>
              <div style={{ fontSize: 26, fontWeight: 700, color: "var(--color-chalk)", fontFamily: MONO, lineHeight: 1 }}>{k.value}</div>
              {k.spark ? <Spark data={k.spark} color={k.sparkColor} /> : null}
            </div>
            <div style={{ fontSize: 10, color: "var(--color-slate)", marginTop: 5 }}>{k.hint}</div>
            <div style={{ marginTop: 4 }}>{k.delta}</div>
          </div>
        ))}
      </div>

      {/* Leitura da operação (gerada por regra) */}
      <div style={{ background: "linear-gradient(145deg, rgba(125,167,244,0.06), var(--surface-base))", border: "1px solid rgba(125,167,244,0.18)", borderRadius: 12, padding: "16px 18px", marginBottom: 18, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 8.5, color: BLUE, fontFamily: MONO, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600, marginBottom: 6 }}>Leitura da operação</div>
          <div style={{ fontSize: 14, color: "var(--color-bone)", lineHeight: 1.5, maxWidth: 720 }}>{reading.text}</div>
        </div>
        {reading.cta ? (
          <button type="button" onClick={() => onOpenNegotiation(reading.cta!.negotiationId)} style={{ background: BLUE, color: "#0F0E0C", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>{reading.cta.label} →</button>
        ) : null}
      </div>

      {/* Evolução mensal (12 meses) — INDEPENDENTE do filtro de período */}
      <div style={{ background: "var(--surface-raised)", border: "1px solid var(--border-default)", borderRadius: 12, padding: "16px 18px 12px", marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 9, fontFamily: MONO, color: "var(--color-slate)", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600 }}>Evolução mensal</span>
          <span style={{ fontSize: 9.5, fontFamily: MONO, color: "var(--color-clay)" }}>
            <span style={{ color: BLUE }}>■</span> criadas &nbsp; <span style={{ color: SPROUT }}>■</span> vendas · últimos 12 meses (não segue o filtro acima)
          </span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <MonthlyChart data={monthly} />
        </div>
      </div>

      {/* Gráfico da JORNADA ponta-a-ponta (Leads → … → Venda), % entre cada par */}
      {journeyHasData ? (
        <div style={{ background: "var(--surface-raised)", border: "1px solid var(--border-default)", borderRadius: 12, padding: "18px 18px 12px", marginBottom: 18, overflowX: "auto" }}>
          <JourneyChart journey={journey} vgvByStage={(k) => metrics.stageStats.find((s) => s.stage === k)?.vgv ?? 0} onOpenStage={onOpenStage} />
          <div style={{ fontSize: 9.5, color: "var(--color-slate)", fontFamily: MONO, marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(61,58,48,0.4)" }}>
            Leads/atendimento = coorte de leads criados no período · negociação em diante = coorte de negociações (fluxo, não estoque) · clique num estágio para abrir a Lista filtrada.
          </div>
        </div>
      ) : (
        <div style={{ border: "1px dashed var(--border-default)", borderRadius: 12, padding: "28px", textAlign: "center", color: "var(--color-clay)", fontSize: 13, fontStyle: "italic", marginBottom: 18 }}>Sem leads nem negociações no período para desenhar a jornada.</div>
      )}

      {/* Ranking de corretores do período */}
      <div style={{ background: "var(--surface-raised)", border: "1px solid var(--border-default)", borderRadius: 12, padding: "16px 18px", marginBottom: 18 }}>
        <div style={{ fontSize: 9, fontFamily: MONO, color: "var(--color-slate)", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600, marginBottom: 12 }}>Top corretores do período</div>
        {ranking.length === 0 ? (
          <div style={{ fontSize: 13, color: "var(--color-clay)", fontStyle: "italic" }}>Sem negociações no período.</div>
        ) : (
          <BrokerRanking rows={ranking} isMobile={isMobile} />
        )}
      </div>

      {/* Tabela por estágio — barras inline + clique → Lista; jornada no topo */}
      <div style={{ background: "var(--surface-raised)", border: "1px solid var(--border-default)", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: "10px 16px 0", fontFamily: MONO, fontSize: 9, letterSpacing: "0.06em", color: "var(--color-clay)" }}>
          Corte: coorte de negociações criadas no período (fluxo, não estoque) · valores somam só quem tem unidade.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 0.6fr 1fr 1fr 0.8fr", padding: "10px 16px", borderBottom: "1px solid var(--border-default)", fontFamily: MONO, fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-slate)" }}>
          <span>Estágio</span><span style={{ textAlign: "right" }}>Qtd</span><span style={{ textAlign: "right" }}>Valor</span><span style={{ textAlign: "right" }}>T. médio</span><span style={{ textAlign: "right" }}>Atenção</span>
        </div>
        <StageRow color={journeyStageColor(leadsStage)} label="Leads" count={leadsStage.count} valor="—" tempo="—" atencao={journey.leadsSemResposta} atencaoLabel="sem resposta" barPct={leadsStage.count / maxRowCount} />
        <StageRow color={journeyStageColor(atendStage)} label="Em atendimento" count={atendStage.count} valor="—" tempo="—" atencao={0} barPct={atendStage.count / maxRowCount} />
        {metrics.stageStats.map((st) => {
          const meta = stageMeta(st.stage);
          return (
            <StageRow key={st.stage} color={meta.color} label={meta.label} count={st.count}
              valor={st.vgv > 0 ? fmtV(st.vgv) : "—"} tempo={daysStr(st.tempoMedioDias)} atencao={st.atencao}
              barPct={st.count / maxRowCount} onClick={() => onOpenStage(st.stage)} />
          );
        })}
        {/* Pré-funil — simulações fora da conta */}
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 0.6fr 1fr 1fr 0.8fr", padding: "11px 16px", alignItems: "center", opacity: 0.65 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "#706B5F" }} /><span style={{ fontSize: 13, color: "var(--color-fog)" }}>Pré-funil <span style={{ fontSize: 10 }}>· simulações · fora da conta</span></span></span>
          <span style={{ textAlign: "right", fontFamily: MONO, fontSize: 13, color: "var(--color-fog)" }}>{metrics.prefunnel.count}</span>
          <span style={{ textAlign: "right", fontFamily: MONO, fontSize: 13, color: "var(--color-slate)" }}>{metrics.prefunnel.vgv > 0 ? fmtV(metrics.prefunnel.vgv) : "—"}</span>
          <span style={{ textAlign: "right", color: "var(--color-slate)" }}>—</span>
          <span style={{ textAlign: "right", color: "var(--color-slate)" }}>—</span>
        </div>
      </div>
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
      {/* barra inline proporcional à quantidade (fundo) */}
      <div aria-hidden="true" style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${Math.max(0, Math.min(1, barPct)) * 100}%`, background: color, opacity: 0.07, pointerEvents: "none" }} />
      <span style={{ display: "flex", alignItems: "center", gap: 8, position: "relative" }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: color }} /><span style={{ fontSize: 13, color: "var(--color-bone)" }}>{label}</span>{clickable ? <span style={{ fontSize: 11, color: "var(--color-slate)" }}>→</span> : null}</span>
      <span style={{ textAlign: "right", fontFamily: MONO, fontSize: 13, color: "var(--color-bone)", position: "relative" }}>{count}</span>
      <span style={{ textAlign: "right", fontFamily: MONO, fontSize: 13, color: "var(--color-dust)", position: "relative" }}>{valor}</span>
      <span style={{ textAlign: "right", fontFamily: MONO, fontSize: 12, color: "var(--color-slate)", position: "relative" }}>{tempo}</span>
      <span style={{ textAlign: "right", fontFamily: MONO, fontSize: 12, color: atencao > 0 ? "#F87171" : "var(--color-slate)", position: "relative" }}>{atencao > 0 ? `${atencao}${atencaoLabel ? " " + atencaoLabel : ""}` : "—"}</span>
    </div>
  );
}

// ── Ranking de corretores (barras inline) ──
function BrokerRanking({ rows, isMobile }: { rows: BrokerRankRow[]; isMobile: boolean }) {
  const maxVendas = Math.max(1, ...rows.map((r) => r.vendas));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {rows.map((r, i) => (
        <div key={r.name} style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: i === 0 ? SPROUT : "var(--color-slate)", width: 22, flexShrink: 0 }}>#{i + 1}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-bone)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
              <span style={{ fontFamily: MONO, fontSize: 11, color: "var(--color-fog)", flexShrink: 0, whiteSpace: "nowrap" }}>
                {r.vendas} {r.vendas === 1 ? "venda" : "vendas"}{!isMobile ? ` · ${fmtV(r.vgv)} · ${r.conv == null ? "—" : `${Math.round(r.conv * 100)}%`} conv` : ""}
              </span>
            </div>
            <div style={{ height: 7, borderRadius: 4, background: "var(--border-default)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${Math.max((r.vendas / maxVendas) * 100, r.vendas > 0 ? 4 : 0)}%`, background: i === 0 ? `linear-gradient(90deg, ${SPROUT}, #22C55E)` : "var(--color-clay)", borderRadius: 4 }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Evolução mensal (SVG próprio) — barras "criadas" + linha "vendas" ──
function MonthlyChart({ data }: { data: MonthlyPoint[] }) {
  const W = 860, H = 200, padL = 8, padR = 8, padTop = 16, padBottom = 34;
  const n = data.length;
  const plotW = W - padL - padR, plotH = H - padTop - padBottom;
  const max = Math.max(1, ...data.map((d) => Math.max(d.criadas, d.vendas)));
  const slot = plotW / n;
  const barW = Math.min(24, slot * 0.5);
  const yOf = (v: number) => padTop + (plotH - (v / max) * plotH);
  const xCenter = (i: number) => padL + slot * i + slot / 2;
  const vendasPts = data.map((d, i) => `${xCenter(i).toFixed(1)},${yOf(d.vendas).toFixed(1)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ minWidth: 640 }} role="img" aria-label="Evolução mensal de criadas e vendas">
      {/* barras criadas */}
      {data.map((d, i) => {
        const h = (d.criadas / max) * plotH;
        return <rect key={`c-${d.key}`} x={xCenter(i) - barW / 2} y={padTop + (plotH - h)} width={barW} height={Math.max(0, h)} rx={2} fill={BLUE} opacity={0.55} />;
      })}
      {/* linha vendas */}
      <polyline points={vendasPts} fill="none" stroke={SPROUT} strokeWidth={2} strokeLinejoin="round" />
      {data.map((d, i) => (
        <g key={`v-${d.key}`}>
          <circle cx={xCenter(i)} cy={yOf(d.vendas)} r={2.6} fill={SPROUT} />
          {d.vendas > 0 ? <text x={xCenter(i)} y={yOf(d.vendas) - 6} textAnchor="middle" fontFamily="var(--font-mono)" fontSize={9} fontWeight={700} fill={SPROUT}>{d.vendas}</text> : null}
          <text x={xCenter(i)} y={H - 20} textAnchor="middle" fontFamily="var(--font-mono)" fontSize={9} fill="var(--color-slate)">{d.criadas || ""}</text>
          <text x={xCenter(i)} y={H - 7} textAnchor="middle" fontFamily="var(--font-mono)" fontSize={8.5} fill="var(--color-clay)">{d.label}</text>
        </g>
      ))}
    </svg>
  );
}

function JourneyChart({ journey, vgvByStage, onOpenStage }: { journey: EndToEndJourney; vgvByStage: (k: string) => number; onOpenStage: (stage: BoardStage) => void }) {
  const stages = journey.stages;
  const W = 820, H = 220, padTop = 34, padBottom = 42, barW = 96, gap = (W - barW * stages.length) / (stages.length - 1);
  const maxCount = Math.max(1, ...stages.map((s) => s.count));
  const maxBarH = H - padTop - padBottom;
  const bars = stages.map((s, i) => {
    const h = Math.max(3, (s.count / maxCount) * maxBarH);
    const x = i * (barW + gap);
    const y = padTop + (maxBarH - h);
    return { s, h, x, y, color: journeyStageColor(s) };
  });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ minWidth: 720 }} role="img" aria-label="Jornada ponta-a-ponta">
      {bars.slice(0, -1).map((b, i) => {
        const n = bars[i + 1];
        return <polygon key={`ramp-${b.s.key}`} points={`${b.x + barW},${b.y} ${n.x},${n.y} ${n.x},${padTop + maxBarH} ${b.x + barW},${padTop + maxBarH}`} fill={b.color} opacity={0.08} />;
      })}
      {bars.slice(0, -1).map((b, i) => {
        const n = bars[i + 1];
        const t = journey.transitions[i];
        const cx = (b.x + barW + n.x) / 2;
        return (
          <text key={`conv-${b.s.key}`} x={cx} y={padTop - 14} textAnchor="middle" fontFamily="var(--font-mono)" fontSize={12} fontWeight={700} fill="var(--color-fog)">
            {t.conv == null ? "—" : `${Math.round(t.conv * 100)}%`}
          </text>
        );
      })}
      {bars.map((b) => {
        const vgv = b.s.tone === "negotiation" ? vgvByStage(b.s.key) : 0;
        const clickable = b.s.tone === "negotiation";
        return (
          <g key={b.s.key} style={{ cursor: clickable ? "pointer" : "default" }} onClick={clickable ? () => onOpenStage(b.s.key as BoardStage) : undefined}>
            {clickable ? <title>Abrir Lista filtrada: {b.s.label}</title> : null}
            <rect x={b.x} y={b.y} width={barW} height={b.h} rx={4} fill={b.color} opacity={0.85} />
            <text x={b.x + barW / 2} y={b.y - 8} textAnchor="middle" fontFamily="var(--font-mono)" fontSize={18} fontWeight={800} fill="var(--color-chalk)">{b.s.count}</text>
            <text x={b.x + barW / 2} y={padTop + maxBarH + 18} textAnchor="middle" fontFamily="var(--font-sans)" fontSize={11} fontWeight={600} fill="var(--color-dust)">{b.s.label}</text>
            <text x={b.x + barW / 2} y={padTop + maxBarH + 33} textAnchor="middle" fontFamily="var(--font-mono)" fontSize={10} fill="var(--color-slate)">{vgv > 0 ? fmtV(vgv) : ""}</text>
          </g>
        );
      })}
    </svg>
  );
}
