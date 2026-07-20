// NexaViz — primitivas FINAS de SVG. Recebem dados JÁ agregados (invariante:
// nenhuma conta/regra de negócio aqui). Tooltips são plugados pelo consumidor
// via useVizTooltip (onHover/onLeave), mantendo o visual único do sistema.
import type { MouseEvent } from "react";
import { VIZ } from "./tokens";

export type VizDatum = { label: string; value: number; color?: string };
type HoverFn<T> = (e: MouseEvent, d: T, i: number) => void;

/** Sparkline (área + linha) — série pequena, sem eixos. */
export function Sparkline({ data, color = VIZ.blue, width = 66, height = 18 }: { data: number[]; color?: string; width?: number; height?: number }) {
  const n = data.length;
  if (n < 2) return null;
  const max = Math.max(1, ...data);
  const pts = data.map((v, i) => `${((i / (n - 1)) * width).toFixed(1)},${(height - (v / max) * (height - 3) - 1).toFixed(1)}`).join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "block", flexShrink: 0 }} aria-hidden="true">
      <polygon points={`0,${height} ${pts} ${width},${height}`} fill={color} opacity={0.12} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
}

const GRID = [0.25, 0.5, 0.75, 1];

/** Barras verticais categóricas, com grid sutil, rótulos e valores opcionais. */
export function BarSeries({ data, height = 200, showValues = true, max: maxProp, onHover, onLeave, onSelect }: {
  data: VizDatum[]; height?: number; showValues?: boolean; max?: number;
  onHover?: HoverFn<VizDatum>; onLeave?: () => void; onSelect?: (d: VizDatum, i: number) => void;
}) {
  const W = 860, padTop = 16, padBottom = 34, padX = 8;
  const n = Math.max(1, data.length);
  const plotH = height - padTop - padBottom;
  const max = Math.max(1, maxProp ?? Math.max(...data.map((d) => d.value), 0));
  const slot = (W - padX * 2) / n;
  const barW = Math.min(28, slot * 0.6);
  return (
    <svg viewBox={`0 0 ${W} ${height}`} width="100%" height={height} style={{ minWidth: Math.max(560, n * 40) }} role="img" aria-label="Gráfico de barras">
      {GRID.map((g) => <line key={g} x1={padX} x2={W - padX} y1={padTop + plotH * (1 - g)} y2={padTop + plotH * (1 - g)} stroke={VIZ.grid} strokeWidth={0.5} />)}
      {data.map((d, i) => {
        const h = (d.value / max) * plotH;
        const cx = padX + slot * i + slot / 2;
        const y = padTop + (plotH - h);
        return (
          <g key={i} style={{ cursor: onSelect ? "pointer" : "default" }}
             onMouseMove={onHover ? (e) => onHover(e, d, i) : undefined} onMouseLeave={onLeave}
             onClick={onSelect ? () => onSelect(d, i) : undefined}>
            <rect x={cx - barW / 2} y={y} width={barW} height={Math.max(0, h)} rx={2} fill={d.color ?? VIZ.blue} opacity={0.7} />
            {showValues && d.value > 0 ? <text x={cx} y={y - 5} textAnchor="middle" fontFamily={VIZ.mono} fontSize={9} fontWeight={700} fill={VIZ.dust}>{d.value}</text> : null}
            <text x={cx} y={height - 9} textAnchor="middle" fontFamily={VIZ.mono} fontSize={8.5} fill={VIZ.clay}>{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

/** Linha sobreposta a barras (ex.: criadas=barra, vendas=linha) — mesma escala. */
export function LineOverlay({ data, color = VIZ.positiveSolid, height = 200, showValues = true, getValue, max: maxProp }: {
  data: VizDatum[]; color?: string; height?: number; showValues?: boolean; getValue?: (d: VizDatum) => number; max?: number;
}) {
  const W = 860, padTop = 16, padBottom = 34, padX = 8;
  const n = Math.max(1, data.length);
  const plotH = height - padTop - padBottom;
  const get = getValue ?? ((d: VizDatum) => d.value);
  const max = Math.max(1, maxProp ?? Math.max(...data.map(get), 0));
  const slot = (W - padX * 2) / n;
  const cx = (i: number) => padX + slot * i + slot / 2;
  const cy = (v: number) => padTop + (plotH - (v / max) * plotH);
  const pts = data.map((d, i) => `${cx(i).toFixed(1)},${cy(get(d)).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${height}`} width="100%" height={height} style={{ position: "absolute", inset: 0, minWidth: Math.max(560, n * 40), pointerEvents: "none" }} role="img" aria-hidden="true">
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      {data.map((d, i) => {
        const v = get(d);
        return (
          <g key={i}>
            <circle cx={cx(i)} cy={cy(v)} r={2.6} fill={color} />
            {showValues && v > 0 ? <text x={cx(i)} y={cy(v) - 6} textAnchor="middle" fontFamily={VIZ.mono} fontSize={9} fontWeight={700} fill={color}>{v}</text> : null}
          </g>
        );
      })}
    </svg>
  );
}

export type FunnelStageDatum = VizDatum & { key: string; secondary?: string };

/** Funil de barras com conectores proporcionais e % SOBRE cada conector. */
export function FunnelBars({ stages, convs, height = 220, onSelect, onHover, onLeave }: {
  stages: FunnelStageDatum[]; convs: (number | null)[]; height?: number;
  onSelect?: (s: FunnelStageDatum, i: number) => void; onHover?: HoverFn<FunnelStageDatum>; onLeave?: () => void;
}) {
  const W = 820, padTop = 34, padBottom = 44, barW = Math.min(96, (W - 20) / stages.length - 12);
  const gap = stages.length > 1 ? (W - barW * stages.length) / (stages.length - 1) : 0;
  const maxCount = Math.max(1, ...stages.map((s) => s.value));
  const maxBarH = height - padTop - padBottom;
  const bars = stages.map((s, i) => {
    const h = Math.max(3, (s.value / maxCount) * maxBarH);
    const x = i * (barW + gap);
    return { s, i, h, x, y: padTop + (maxBarH - h), color: s.color ?? VIZ.blue };
  });
  return (
    <svg viewBox={`0 0 ${W} ${height}`} width="100%" height={height} style={{ minWidth: 700 }} role="img" aria-label="Funil">
      {bars.slice(0, -1).map((b, i) => {
        const nx = bars[i + 1];
        return <polygon key={`ramp-${b.s.key}`} points={`${b.x + barW},${b.y} ${nx.x},${nx.y} ${nx.x},${padTop + maxBarH} ${b.x + barW},${padTop + maxBarH}`} fill={b.color} opacity={0.08} />;
      })}
      {bars.slice(0, -1).map((b, i) => {
        const nx = bars[i + 1];
        const midx = (b.x + barW + nx.x) / 2;
        const c = convs[i];
        return <text key={`conv-${b.s.key}`} x={midx} y={padTop - 14} textAnchor="middle" fontFamily={VIZ.mono} fontSize={12} fontWeight={700} fill={VIZ.muted}>{c == null ? "—" : `${Math.round(c * 100)}%`}</text>;
      })}
      {bars.map((b) => (
        <g key={b.s.key} style={{ cursor: onSelect ? "pointer" : "default" }}
           onMouseMove={onHover ? (e) => onHover(e, b.s, b.i) : undefined} onMouseLeave={onLeave}
           onClick={onSelect ? () => onSelect(b.s, b.i) : undefined}>
          <rect x={b.x} y={b.y} width={barW} height={b.h} rx={4} fill={b.color} opacity={0.85} />
          <text x={b.x + barW / 2} y={b.y - 8} textAnchor="middle" fontFamily={VIZ.mono} fontSize={18} fontWeight={800} fill={VIZ.ink}>{b.s.value}</text>
          <text x={b.x + barW / 2} y={padTop + maxBarH + 18} textAnchor="middle" fontFamily="var(--font-sans)" fontSize={11} fontWeight={600} fill={VIZ.dust}>{b.s.label}</text>
          <text x={b.x + barW / 2} y={padTop + maxBarH + 33} textAnchor="middle" fontFamily={VIZ.mono} fontSize={10} fill={VIZ.muted}>{b.s.secondary ?? ""}</text>
        </g>
      ))}
    </svg>
  );
}
