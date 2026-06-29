// Kit de UI mobile reusável do módulo de Atividades (Onda 1).
// - BottomSheet: folha inferior em portal (toque ≥44px, safe-area, sem emoji).
// - TypeChipGrid: grade de tipos (catálogo activity_kinds) com cor semântica
//   única (getActivityColors) — mesma leitura no card, na captura e na troca.
// - useHorizontalSwipe: swipe horizontal com arbitragem de eixo (não briga com
//   o long-press do drag do dnd nem com o scroll vertical da coluna).
import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getActivityColors } from "../../../shared/utils/activityColors";
import { GROUP_LABELS } from "../config/activityTypeSchema";
import KindIcon from "./KindIcon";
import type { ActivityKind } from "../../../infra/repositories/activityKindsRepository";

const T = {
  ink: "var(--surface-base)",
  carbon: "var(--surface-raised)",
  stone: "var(--border-default)",
  chalk: "var(--text-primary)",
  bone: "var(--text-secondary)",
  fog: "var(--text-muted)",
  slate: "var(--text-disabled)",
  sprout: "var(--interactive-primary)",
};
const MONO = "var(--font-mono)";

// ── BottomSheet ──────────────────────────────────────────────────────────────
export function BottomSheet({
  open,
  onClose,
  title,
  children,
  footer,
  maxHeight = "88vh",
}: {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxHeight?: string;
}) {
  if (!open) return null;
  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 9000 }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)" }} />
      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          maxHeight,
          background: "linear-gradient(180deg, var(--surface-raised), var(--surface-base))",
          borderTop: `1px solid ${T.stone}`,
          borderRadius: "18px 18px 0 0",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 -12px 40px rgba(0,0,0,0.5)",
          animation: "slideUpSheet 200ms cubic-bezier(0.2,0,0,1)",
        }}
      >
        {/* Alça */}
        <div style={{ flexShrink: 0, display: "flex", justifyContent: "center", paddingTop: 8 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: T.stone }} />
        </div>
        {title && (
          <div
            style={{
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              padding: "10px 18px 6px",
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 600, color: T.chalk, minWidth: 0 }}>{title}</div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              style={{ width: 44, height: 44, marginRight: -10, background: "transparent", border: "none", color: T.fog, fontSize: 22, cursor: "pointer", lineHeight: 1 }}
            >
              ×
            </button>
          </div>
        )}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            WebkitOverflowScrolling: "touch",
            padding: "6px 18px 16px",
          }}
        >
          {children}
        </div>
        {footer && (
          <div
            style={{
              flexShrink: 0,
              padding: "12px 18px",
              paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)",
              borderTop: `1px solid ${T.stone}`,
              background: "var(--surface-base)",
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

// ── TypeChipGrid ─────────────────────────────────────────────────────────────
type GroupedKinds = {
  comercial: ActivityKind[];
  interno: ActivityKind[];
  operacional: ActivityKind[];
};

export function TypeChipGrid({
  kinds,
  selectedKey,
  onPick,
}: {
  kinds: GroupedKinds;
  selectedKey?: string | null;
  onPick: (k: ActivityKind) => void;
}) {
  const groups: { cat: keyof GroupedKinds; list: ActivityKind[] }[] = [
    { cat: "comercial", list: kinds.comercial },
    { cat: "interno", list: kinds.interno },
    { cat: "operacional", list: kinds.operacional },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {groups.map(({ cat, list }) =>
        list.length === 0 ? null : (
          <div key={cat}>
            <div style={{ fontFamily: MONO, fontSize: 9, color: T.fog, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 6, fontWeight: 600 }}>
              {GROUP_LABELS[cat]}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {list.map((k) => {
                const c = getActivityColors(k.base_type).color;
                const on = selectedKey === k.key || selectedKey === k.base_type;
                return (
                  <button
                    key={k.id}
                    type="button"
                    onClick={() => onPick(k)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 7,
                      minHeight: 44,
                      padding: "8px 14px",
                      borderRadius: 12,
                      border: `1px solid ${on ? c : T.stone}`,
                      background: on ? c + "1F" : "transparent",
                      color: on ? c : T.bone,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    <KindIcon name={k.icon} size={16} color={c} />
                    {k.label}
                  </button>
                );
              })}
            </div>
          </div>
        ),
      )}
    </div>
  );
}

// ── useHorizontalSwipe ───────────────────────────────────────────────────────
// Arbitragem de gesto: decide eixo no primeiro movimento. Horizontal rápido =
// swipe (cancela o início do dnd via touch-action: pan-y no elemento); vertical
// = scroll da coluna; segurar 250ms parado = long-press do dnd (TouchSensor).
export function useHorizontalSwipe({
  onLeft,
  onRight,
  enabled = true,
  threshold = 64,
  maxDuration = 600,
}: {
  onLeft?: () => void;
  onRight?: () => void;
  enabled?: boolean;
  threshold?: number;
  maxDuration?: number;
}) {
  const [dx, setDx] = useState(0);
  const st = useRef({ x: 0, y: 0, t: 0, active: false, axis: null as null | "h" | "v", dx: 0 });

  const reset = () => {
    st.current.active = false;
    st.current.axis = null;
    st.current.dx = 0;
    setDx(0);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (!enabled || e.touches.length !== 1) return;
    const t = e.touches[0];
    st.current = { x: t.clientX, y: t.clientY, t: Date.now(), active: true, axis: null, dx: 0 };
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!enabled || !st.current.active) return;
    const t = e.touches[0];
    const ddx = t.clientX - st.current.x;
    const ddy = t.clientY - st.current.y;
    if (st.current.axis === null && (Math.abs(ddx) > 10 || Math.abs(ddy) > 10)) {
      st.current.axis = Math.abs(ddx) > Math.abs(ddy) * 1.3 ? "h" : "v";
    }
    if (st.current.axis === "h") {
      const clamped = Math.max(-120, Math.min(120, ddx));
      st.current.dx = clamped;
      setDx(clamped);
    }
  };
  const onTouchEnd = () => {
    if (!enabled || !st.current.active) return;
    const ddx = st.current.dx;
    const dt = Date.now() - st.current.t;
    const axis = st.current.axis;
    reset();
    if (axis === "h" && Math.abs(ddx) >= threshold && dt < maxDuration) {
      if (ddx > 0) onRight?.();
      else onLeft?.();
    }
  };

  return {
    dx,
    swiping: st.current.axis === "h",
    handlers: { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel: reset },
  };
}
