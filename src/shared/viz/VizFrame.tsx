// NexaViz — moldura ÚNICA de todo gráfico: título, subtítulo (período/corte),
// legenda textual, e estados obrigatórios de VAZIO e LOADING. O gráfico entra
// como children (recebe dados JÁ agregados — primitivas não fazem conta).
import type { ReactNode } from "react";
import { VIZ, VIZ_FRAME_HEIGHT } from "./tokens";

export function VizLegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>
      <span aria-hidden="true" style={{ color }}>■</span> {label}
    </span>
  );
}

export function VizFrame({
  title, subtitle, legend, loading = false, empty = false, emptyLabel = "Sem dados no período.",
  height = VIZ_FRAME_HEIGHT, right, children,
}: {
  title: string;
  subtitle?: ReactNode;
  legend?: ReactNode;
  loading?: boolean;
  empty?: boolean;
  emptyLabel?: string;
  height?: number;
  right?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="nexa-viz-frame" style={{ background: "var(--surface-raised)", border: "1px solid var(--border-default)", borderRadius: 12, padding: "16px 18px 12px" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: subtitle || legend ? 4 : 10 }}>
        <span style={{ fontSize: 9, fontFamily: VIZ.mono, color: VIZ.muted, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600 }}>{title}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          {legend ? <span style={{ display: "flex", gap: 10, fontSize: 9.5, fontFamily: VIZ.mono, color: VIZ.clay }}>{legend}</span> : null}
          {right}
        </span>
      </div>
      {subtitle ? <div style={{ fontSize: 9.5, fontFamily: VIZ.mono, color: VIZ.clay, marginBottom: 10 }}>{subtitle}</div> : null}

      {loading ? (
        <div style={{ minHeight: height, display: "flex", flexDirection: "column", gap: 8, justifyContent: "flex-end", padding: "8px 0" }} aria-busy="true">
          {[0.4, 0.7, 0.55, 0.85, 0.5].map((h, i) => (
            <div key={i} className="nexa-skeleton" style={{ height: 10, width: `${h * 100}%`, borderRadius: 4 }} />
          ))}
        </div>
      ) : empty ? (
        <div style={{ minHeight: height, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", border: "1px dashed var(--border-default)", borderRadius: 10, color: VIZ.clay, fontSize: 13, fontStyle: "italic", padding: 24 }}>
          {emptyLabel}
        </div>
      ) : (
        <div style={{ minHeight: height, overflowX: "auto" }}>{children}</div>
      )}
    </div>
  );
}
