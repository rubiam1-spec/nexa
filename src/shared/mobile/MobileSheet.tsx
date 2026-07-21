import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { TOUCH_TARGET } from "./tokens";

// Bottom sheet reutilizável. Portal p/ document.body (NUNCA inline — igual à
// regra do NexaModal: um ancestral com `transform` re-ancoraria o `fixed`).
// Safe-area, backdrop com dismiss, Esc fecha, scroll da página travado, foco
// inicial no 1º focável. Alvo de fechar ≥44px.
let lockCount = 0;
function lockScroll() {
  if (typeof document === "undefined") return;
  lockCount += 1;
  if (lockCount === 1) document.body.style.overflow = "hidden";
}
function unlockScroll() {
  if (typeof document === "undefined") return;
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) document.body.style.overflow = "";
}

export function MobileSheet({
  open, onClose, title, children, ariaLabel,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  ariaLabel?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    lockScroll();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const root = panelRef.current;
    const focusable = root?.querySelector<HTMLElement>(
      "input:not([type=hidden]):not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex='-1'])",
    );
    focusable?.focus();
    return () => { document.removeEventListener("keydown", onKey); unlockScroll(); };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      style={{ position: "fixed", inset: 0, zIndex: 9000, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
    >
      <div
        ref={panelRef}
        style={{
          width: "100%",
          maxHeight: "88vh",
          overflowY: "auto",
          background: "var(--surface-raised)",
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          paddingBottom: "max(16px, env(safe-area-inset-bottom))",
          boxShadow: "0 -8px 24px rgba(0,0,0,0.3)",
          animation: "slideUpSheet 300ms cubic-bezier(0.16,1,0.3,1) both",
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 8, position: "sticky", top: 0, background: "var(--surface-raised)" }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: "var(--border-strong)" }} />
        </div>
        {title != null && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 16px 4px" }}>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>{title}</span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              style={{ minWidth: TOUCH_TARGET, minHeight: TOUCH_TARGET, borderRadius: 999, background: "transparent", border: "none", color: "var(--text-muted)", display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 22, lineHeight: 1 }}
            >
              ×
            </button>
          </div>
        )}
        <div style={{ padding: "8px 16px 16px" }}>{children}</div>
      </div>
    </div>,
    document.body,
  );
}

export default MobileSheet;
