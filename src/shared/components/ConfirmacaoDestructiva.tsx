import { createPortal } from "react-dom";
import { useState, useEffect, useRef } from "react";

interface Props {
  open: boolean;
  titulo: string;
  descricao: string;
  labelConfirmar?: string;
  countdown?: number;
  onConfirmar: () => void;
  onCancelar: () => void;
}

export function ConfirmacaoDestructiva({ open, titulo, descricao, labelConfirmar = "Confirmar", countdown = 3, onConfirmar, onCancelar }: Props) {
  const [sec, setSec] = useState(countdown);
  const timer = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    if (!open) { setSec(countdown); return; }
    setSec(countdown);
    timer.current = setInterval(() => setSec((s) => { if (s <= 1) { clearInterval(timer.current); return 0; } return s - 1; }), 1000);
    return () => clearInterval(timer.current);
  }, [open, countdown]);

  if (!open) return null;

  return createPortal(
    <>
      <div onClick={onCancelar} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 10001 }} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 10002, width: 420, maxWidth: "92vw", background: "var(--surface-raised)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: 16, overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.5)" }}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border-default)", display: "flex", alignItems: "flex-start", gap: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0, background: "rgba(248,113,113,0.12)", border: "1px solid rgba(248,113,113,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: "#F87171" }}>!</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-secondary)" }}>{titulo}</div>
            <div style={{ fontSize: 12, color: "var(--text-disabled)", marginTop: 3 }}>{descricao}</div>
          </div>
        </div>
        <div style={{ padding: "16px 24px", display: "flex", gap: 10 }}>
          <button type="button" onClick={onCancelar} style={{ flex: 1, padding: 12, borderRadius: 10, border: "1px solid var(--border-strong)", background: "transparent", color: "var(--text-muted)", fontSize: 13, cursor: "pointer" }}>Cancelar</button>
          <button type="button" onClick={onConfirmar} disabled={sec > 0} style={{
            flex: 2, padding: 12, borderRadius: 10, border: "none",
            background: sec > 0 ? "rgba(248,113,113,0.15)" : "rgba(248,113,113,0.9)",
            color: sec > 0 ? "rgba(248,113,113,0.5)" : "#fff",
            fontSize: 13, fontWeight: 700,
            cursor: sec > 0 ? "not-allowed" : "pointer",
            transition: "all 0.3s",
          }}>
            {sec > 0 ? `${labelConfirmar} (${sec}s)` : labelConfirmar}
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}
