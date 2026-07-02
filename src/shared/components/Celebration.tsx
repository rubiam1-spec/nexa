import { createPortal } from "react-dom";
import { useCallback, useRef, useState } from "react";

/* ───── tipos ───── */
type CelebrationLevel = "success" | "sale" | "error";

interface ToastData {
  id: number;
  title: string;
  subtitle?: string;
  level: CelebrationLevel;
}

/* ───── cores por nível ───── */
const palette: Record<CelebrationLevel, { bg: string; border: string; glow: string; text: string; sub: string }> = {
  success: { bg: "var(--surface-raised)", border: "rgba(74,222,128,0.4)", glow: "0 0 24px rgba(74,222,128,0.15)", text: "#4ADE80", sub: "var(--text-muted)" },
  sale:    { bg: "var(--surface-raised)", border: "rgba(251,191,36,0.5)", glow: "0 0 32px rgba(251,191,36,0.2)", text: "#FBBF24", sub: "var(--text-muted)" },
  error:   { bg: "var(--surface-raised)", border: "rgba(248,113,113,0.5)", glow: "0 0 24px rgba(248,113,113,0.15)", text: "#F87171", sub: "var(--text-muted)" },
};

const icons: Record<CelebrationLevel, string> = { success: "\u2713", sale: "\u2605", error: "\u26a0" };

/* ───── hook público ───── */
export function useCelebration() {
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const counter = useRef(0);

  const celebrate = useCallback((title: string, subtitle?: string, level: CelebrationLevel = "success") => {
    const id = ++counter.current;
    setToasts((t) => [...t, { id, title, subtitle, level }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  const celebrateSale = useCallback((title: string, subtitle?: string) => {
    celebrate(title, subtitle, "sale");
  }, [celebrate]);

  const celebrateError = useCallback((title: string, subtitle?: string) => {
    celebrate(title, subtitle, "error");
  }, [celebrate]);

  return { toasts, celebrate, celebrateSale, celebrateError };
}

/* ───── componente Toast Container ───── */
export function CelebrationToasts({ toasts }: { toasts: ToastData[] }) {
  if (toasts.length === 0) return null;
  return createPortal(
    <div style={{ position: "fixed", top: 24, right: 24, zIndex: 10000, display: "flex", flexDirection: "column", gap: 10, pointerEvents: "none" }}>
      {toasts.map((t) => {
        const p = palette[t.level];
        return (
          <div key={t.id} style={{ background: p.bg, border: `1px solid ${p.border}`, borderRadius: 14, padding: "14px 20px", minWidth: 280, maxWidth: 400, boxShadow: p.glow, animation: "celebrationSlideIn 0.4s cubic-bezier(0.32,0.72,0,1)", pointerEvents: "auto" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: `${p.text}18`, border: `1px solid ${p.text}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: p.text, flexShrink: 0 }}>{icons[t.level]}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: p.text }}>{t.title}</div>
                {t.subtitle ? <div style={{ fontSize: 12, color: p.sub, marginTop: 2 }}>{t.subtitle}</div> : null}
              </div>
            </div>
            {t.level === "sale" ? <SaleParticles color={p.text} /> : null}
          </div>
        );
      })}
    </div>,
    document.body
  );
}

/* ───── partículas para vendas ───── */
function SaleParticles({ color }: { color: string }) {
  // useState lazy initializer é tratado especialmente pelo React Compiler:
  // o inicializador roda uma única vez no mount, mesmo com Math.random() impuro.
  const [particles] = useState(() =>
    Array.from({ length: 12 }, () => ({
      width: 4 + Math.random() * 4,
      height: 4 + Math.random() * 4,
      opacity: 0.6 + Math.random() * 0.4,
      left: 10 + Math.random() * 80,
      top: 10 + Math.random() * 80,
      duration: 0.6 + Math.random() * 0.8,
      delay: Math.random() * 0.3,
    })),
  );
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", borderRadius: 14 }}>
      {particles.map((p, i) => (
        <span key={i} style={{
          position: "absolute",
          width: p.width,
          height: p.height,
          borderRadius: "50%",
          background: color,
          opacity: p.opacity,
          left: `${p.left}%`,
          top: `${p.top}%`,
          animation: `celebrationParticle ${p.duration}s ease-out forwards`,
          animationDelay: `${p.delay}s`,
        }} />
      ))}
    </div>
  );
}
