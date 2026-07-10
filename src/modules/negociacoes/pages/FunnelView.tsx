import { useMemo, useState } from "react";
import type { BoardModel } from "../board/buildBoard";
import { stageMeta, type BoardStage } from "../board/stageColumn";
import {
  computeFunnelMetrics, computeEndToEndJourney, periodStartMs,
  type PeriodKey, type EndToEndJourney, type JourneyStage,
} from "../board/funnelMetrics";
import { generateOperationReading } from "../board/operationReading";

const MONO = "var(--font-mono)";
const fmtV = (v: number) => v >= 1e6 ? `R$ ${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `R$ ${(v / 1e3).toFixed(0)}k` : `R$ ${Math.round(v)}`;
const daysStr = (v: number | null) => v == null ? "—" : `${Math.round(v)}d`;

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "30d", label: "Últimos 30 dias" },
  { key: "90d", label: "Últimos 90 dias" },
  { key: "month", label: "Este mês" },
];

// Tons: Leads/atendimento em azul/neutro; negociação mantém as cores dos estágios.
function journeyStageColor(s: JourneyStage): string {
  if (s.tone === "lead") return s.key === "leads" ? "#7DA7F4" : "#9DB8E8";
  return stageMeta(s.key as BoardStage).color;
}

export function FunnelView({ board, thresholdDays, onOpenNegotiation }: {
  board: BoardModel;
  thresholdDays: number;
  onOpenNegotiation: (id: string) => void;
}) {
  const [period, setPeriod] = useState<PeriodKey>("30d");
  const nowMs = Date.now();

  const { metrics, reading, journey } = useMemo(() => {
    const start = periodStartMs(period, nowMs);
    const inPeriod = (iso: string) => new Date(iso).getTime() >= start;
    const cohort = board.negotiations.filter((c) => inPeriod(c.createdAt));
    const sims = board.simulations.filter((c) => inPeriod(c.createdAt));
    const m = computeFunnelMetrics(cohort, sims, thresholdDays, nowMs);
    // Jornada ponta-a-ponta: coorte de leads (período) + estágios de negociação (reached).
    const j = computeEndToEndJourney(m.reached, board.leadRows, start);
    return { metrics: m, reading: generateOperationReading(m, cohort, thresholdDays, nowMs), journey: j };
  }, [board, period, thresholdDays, nowMs]);

  const pctStr = (v: number | null) => v == null ? "—" : `${Math.round(v * 100)}%`;
  const kpis = [
    { label: "Conversão geral", value: pctStr(metrics.conversaoGeral), hint: `${metrics.reached.venda} de ${metrics.entradas} entradas`, tip: metrics.entradas === 0 ? "Sem entradas no período" : undefined },
    { label: "VGV no funil (abertas)", value: fmtV(metrics.openVGV), hint: "em negociação + proposta + reserva" },
    { label: "Ciclo médio", value: daysStr(metrics.cicloMedioDias), hint: "criação → venda", tip: metrics.cicloMedioDias == null ? "Sem vendas no período para medir" : undefined },
    { label: "Vendido no período", value: `${metrics.vendido.count}`, hint: fmtV(metrics.vendido.vgv) },
  ];

  const journeyHasData = journey.stages.some((s) => s.count > 0);
  const leadsStage = journey.stages[0];
  const atendStage = journey.stages[1];

  return (
    <div>
      {/* Filtro de período */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {PERIODS.map((p) => {
          const active = period === p.key;
          return (
            <button key={p.key} type="button" onClick={() => setPeriod(p.key)}
              style={{ padding: "6px 14px", borderRadius: 8, border: active ? "1px solid rgba(74,222,128,0.35)" : "1px solid var(--border-default)", background: active ? "rgba(74,222,128,0.08)" : "transparent", color: active ? "var(--color-sprout)" : "var(--color-fog)", fontFamily: MONO, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
              {p.label}
            </button>
          );
        })}
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 18 }}>
        {kpis.map((k) => (
          <div key={k.label} title={k.tip} style={{ background: "var(--surface-raised)", border: "1px solid var(--border-default)", borderRadius: 12, padding: "14px 16px" }}>
            <div style={{ fontSize: 8.5, color: "var(--color-slate)", fontFamily: MONO, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 500 }}>{k.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: "var(--color-chalk)", fontFamily: MONO, marginTop: 6 }}>{k.value}</div>
            <div style={{ fontSize: 10, color: "var(--color-slate)", marginTop: 3 }}>{k.hint}</div>
          </div>
        ))}
      </div>

      {/* Leitura da operação (gerada por regra) */}
      <div style={{ background: "linear-gradient(145deg, rgba(125,167,244,0.06), var(--surface-base))", border: "1px solid rgba(125,167,244,0.18)", borderRadius: 12, padding: "16px 18px", marginBottom: 18, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 8.5, color: "#7DA7F4", fontFamily: MONO, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600, marginBottom: 6 }}>Leitura da operação</div>
          <div style={{ fontSize: 14, color: "var(--color-bone)", lineHeight: 1.5, maxWidth: 720 }}>{reading.text}</div>
        </div>
        {reading.cta ? (
          <button type="button" onClick={() => onOpenNegotiation(reading.cta!.negotiationId)} style={{ background: "#7DA7F4", color: "#0F0E0C", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>{reading.cta.label} →</button>
        ) : null}
      </div>

      {/* Gráfico da JORNADA ponta-a-ponta (Leads → … → Venda), % entre cada par */}
      {journeyHasData ? (
        <div style={{ background: "var(--surface-raised)", border: "1px solid var(--border-default)", borderRadius: 12, padding: "18px 18px 12px", marginBottom: 18, overflowX: "auto" }}>
          <JourneyChart journey={journey} vgvByStage={(k) => metrics.stageStats.find((s) => s.stage === k)?.vgv ?? 0} />
          <div style={{ fontSize: 9.5, color: "var(--color-slate)", fontFamily: MONO, marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(61,58,48,0.4)" }}>
            Leads/atendimento = coorte de leads criados no período · negociação em diante = coorte de negociações (fluxo, não estoque).
          </div>
        </div>
      ) : (
        <div style={{ border: "1px dashed var(--border-default)", borderRadius: 12, padding: "28px", textAlign: "center", color: "var(--color-clay)", fontSize: 13, fontStyle: "italic", marginBottom: 18 }}>Sem leads nem negociações no período para desenhar a jornada.</div>
      )}

      {/* Tabela por estágio — jornada no topo (Leads, Em atendimento), depois negociação */}
      <div style={{ background: "var(--surface-raised)", border: "1px solid var(--border-default)", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 0.6fr 1fr 1fr 0.8fr", padding: "10px 16px", borderBottom: "1px solid var(--border-default)", fontFamily: MONO, fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-slate)" }}>
          <span>Estágio</span><span style={{ textAlign: "right" }}>Qtd</span><span style={{ textAlign: "right" }}>Valor</span><span style={{ textAlign: "right" }}>T. médio</span><span style={{ textAlign: "right" }}>Atenção</span>
        </div>
        {/* Leads (atenção = sem resposta) */}
        <StageRow color={journeyStageColor(leadsStage)} label="Leads" count={leadsStage.count} valor="—" tempo="—" atencao={journey.leadsSemResposta} atencaoLabel="sem resposta" />
        {/* Em atendimento */}
        <StageRow color={journeyStageColor(atendStage)} label="Em atendimento" count={atendStage.count} valor="—" tempo="—" atencao={0} />
        {metrics.stageStats.map((st) => {
          const meta = stageMeta(st.stage);
          return (
            <StageRow key={st.stage} color={meta.color} label={meta.label} count={st.count}
              valor={st.vgv > 0 ? fmtV(st.vgv) : "—"} tempo={daysStr(st.tempoMedioDias)} atencao={st.atencao} />
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

function StageRow({ color, label, count, valor, tempo, atencao, atencaoLabel }: {
  color: string; label: string; count: number; valor: string; tempo: string; atencao: number; atencaoLabel?: string;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.4fr 0.6fr 1fr 1fr 0.8fr", padding: "11px 16px", borderBottom: "1px solid rgba(61,58,48,0.4)", alignItems: "center" }}>
      <span style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: color }} /><span style={{ fontSize: 13, color: "var(--color-bone)" }}>{label}</span></span>
      <span style={{ textAlign: "right", fontFamily: MONO, fontSize: 13, color: "var(--color-bone)" }}>{count}</span>
      <span style={{ textAlign: "right", fontFamily: MONO, fontSize: 13, color: "var(--color-dust)" }}>{valor}</span>
      <span style={{ textAlign: "right", fontFamily: MONO, fontSize: 12, color: "var(--color-slate)" }}>{tempo}</span>
      <span style={{ textAlign: "right", fontFamily: MONO, fontSize: 12, color: atencao > 0 ? "#F87171" : "var(--color-slate)" }}>{atencao > 0 ? `${atencao}${atencaoLabel ? " " + atencaoLabel : ""}` : "—"}</span>
    </div>
  );
}

function JourneyChart({ journey, vgvByStage }: { journey: EndToEndJourney; vgvByStage: (k: string) => number }) {
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
        return (
          <g key={b.s.key}>
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
