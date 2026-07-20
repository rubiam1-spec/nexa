// NexaViz — tooltip ÚNICO do sistema. Portal para o body (viewport), clamp às
// bordas, mesmo visual em todos os gráficos. Uso via hook useVizTooltip():
//   const tip = useVizTooltip();
//   <rect onMouseMove={(e) => tip.show(e, <TipContent/>)} onMouseLeave={tip.hide} />
//   {tip.node}
import { useCallback, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { VIZ } from "./tokens";

type TipState = { x: number; y: number; content: ReactNode } | null;

export function useVizTooltip() {
  const [state, setState] = useState<TipState>(null);

  const show = useCallback((e: { clientX: number; clientY: number }, content: ReactNode) => {
    setState({ x: e.clientX, y: e.clientY, content });
  }, []);
  const hide = useCallback(() => setState(null), []);

  // Clamp à viewport: mantém o card visível perto do cursor.
  const node = state
    ? createPortal(
        <div
          data-nexa-viz-tooltip
          className="nexa-viz-tooltip"
          style={{
            position: "fixed",
            left: Math.min(state.x + 14, (typeof window !== "undefined" ? window.innerWidth : 9999) - 240),
            top: Math.max(8, state.y - 12),
            zIndex: 9999,
            pointerEvents: "none",
            maxWidth: 220,
            background: "var(--surface-overlay, #22211C)",
            border: "1px solid var(--border-strong, #3D3A30)",
            borderRadius: 8,
            padding: "8px 10px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
            fontFamily: VIZ.mono,
            fontSize: 11,
            color: "var(--text-primary)",
            lineHeight: 1.5,
          }}
        >
          {state.content}
        </div>,
        document.body,
      )
    : null;

  return { show, hide, node };
}

/** Linha padrão de tooltip: rótulo à esquerda, valor (mono, forte) à direita. */
export function VizTipRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
      <span style={{ color: "var(--color-slate)" }}>{color ? <span style={{ color }}>■ </span> : null}{label}</span>
      <span style={{ fontWeight: 700, color: "var(--color-chalk)" }}>{value}</span>
    </div>
  );
}
