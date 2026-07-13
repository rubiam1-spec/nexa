// NexaModal — base CANÔNICA de overlay do NEXA. Regra de governança (reafirmada
// 2026-07-11): TODO modal/sheet/confirm passa por AQUI. Overlay SEMPRE via
// createPortal(document.body) com wrapper position:fixed/inset:0/zIndex 9000+ —
// nunca inline, senão um ancestral com `transform` (cards animados do Kanban etc.)
// re-ancora o `fixed` e o modal "gruda" na página em vez da viewport.
// Entrega: backdrop com dismiss, Esc fecha, scroll da página travado enquanto
// aberto, foco inicial no primeiro campo. O conteúdo (card) é do chamador.
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

// Trava de scroll com contador (suporta modais aninhados).
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

export interface NexaModalProps {
  onClose: () => void;
  children: React.ReactNode;
  /** Fechar ao clicar no backdrop (padrão true). */
  dismissOnBackdrop?: boolean;
  /** Focar o 1º campo ao abrir (padrão true). */
  initialFocus?: boolean;
  zIndex?: number;
  padding?: number;
  ariaLabel?: string;
}

export function NexaModal({ onClose, children, dismissOnBackdrop = true, initialFocus = true, zIndex = 9000, padding = 24, ariaLabel }: NexaModalProps) {
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    lockScroll();
    return () => { document.removeEventListener("keydown", onKey); unlockScroll(); };
  }, [onClose]);

  useEffect(() => {
    if (!initialFocus) return;
    const root = backdropRef.current;
    if (!root) return;
    // Primeiro campo; senão, o primeiro focável (p/ Esc/teclado).
    const field = root.querySelector<HTMLElement>("input:not([type=hidden]):not([disabled]), textarea:not([disabled]), select:not([disabled])");
    const focusable = field ?? root.querySelector<HTMLElement>("button:not([disabled]), [tabindex]:not([tabindex='-1'])");
    focusable?.focus();
  }, [initialFocus]);

  return createPortal(
    <div
      ref={backdropRef}
      data-nexa-modal="backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      onClick={dismissOnBackdrop ? (e) => { if (e.target === e.currentTarget) onClose(); } : undefined}
      style={{ position: "fixed", inset: 0, zIndex, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding }}
    >
      {children}
    </div>,
    document.body,
  );
}

export default NexaModal;
