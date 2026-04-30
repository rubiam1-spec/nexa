import { useState } from "react";
import { createPortal } from "react-dom";

export const LOSS_REASONS = [
  { value: "PRECO", label: "Preço" },
  { value: "LOCALIZACAO", label: "Localização" },
  { value: "ATENDIMENTO", label: "Atendimento" },
  { value: "FINANCIAMENTO", label: "Financiamento recusado" },
  { value: "CONCORRENTE", label: "Escolheu concorrente" },
  { value: "DESISTENCIA", label: "Desistiu da compra" },
  { value: "OUTRO", label: "Outro" },
] as const;

export interface LostReasonResult {
  reason: string;
  detail: string;
  cascadeToNegotiations: boolean;
}

interface LostReasonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (result: LostReasonResult) => Promise<void> | void;
  showCascadeOption: boolean;
  entityLabel: "contato" | "negociação";
}

const MODAL_BG = "linear-gradient(168deg, rgba(34,33,28,0.95), rgba(18,17,14,0.85))";

export default function LostReasonModal({ isOpen, onClose, onConfirm, showCascadeOption, entityLabel }: LostReasonModalProps) {
  const [reason, setReason] = useState("");
  const [detail, setDetail] = useState("");
  const [cascade, setCascade] = useState(true);
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const isOther = reason === "OUTRO";
  const canConfirm = reason && (!isOther || detail.trim().length > 0) && !saving;

  async function handleConfirm() {
    if (!canConfirm) return;
    setSaving(true);
    try {
      await onConfirm({ reason, detail: detail.trim(), cascadeToNegotiations: cascade });
      setReason("");
      setDetail("");
      setCascade(true);
      onClose();
    } catch {
      /* keep modal open on error */
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 9000 }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }} onClick={() => !saving && onClose()} />
      <div style={{
        position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
        background: MODAL_BG,
        border: "1px solid rgba(61,58,48,0.2)",
        borderRadius: 14, padding: 28, width: 440, maxWidth: "90vw",
        boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
      }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "#F87171", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 4, fontWeight: 600 }}>
          MARCAR COMO PERDIDO
        </div>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: "#E8E5DE", margin: "0 0 18px" }}>
          {entityLabel === "contato" ? "Perder contato" : "Perder negociação"}
        </h3>

        <label style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: 8, color: "#5C5647", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>
          Motivo *
        </label>
        <select value={reason} onChange={(e) => setReason(e.target.value)}
          style={{
            width: "100%", padding: "10px 14px",
            background: "linear-gradient(168deg, rgba(34,33,28,0.5), rgba(18,17,14,0.15))",
            border: "1px solid rgba(61,58,48,0.25)",
            borderRadius: 8, color: "#E8E5DE", fontSize: 13,
            outline: "none", marginBottom: 14, cursor: "pointer",
          }}>
          <option value="">Selecione o motivo...</option>
          {LOSS_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>

        <label style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: 8, color: "#5C5647", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>
          Observação {isOther && "*"}
        </label>
        <textarea value={detail} onChange={(e) => setDetail(e.target.value)} rows={3}
          placeholder={isOther ? "Descreva o motivo..." : "Detalhes adicionais (opcional)"}
          style={{
            width: "100%", padding: "10px 14px",
            background: "linear-gradient(168deg, rgba(34,33,28,0.5), rgba(18,17,14,0.15))",
            border: "1px solid rgba(61,58,48,0.25)",
            borderRadius: 8, color: "#E8E5DE", fontSize: 13,
            outline: "none", resize: "vertical", marginBottom: 16,
            fontFamily: "inherit",
          }} />

        {showCascadeOption && (
          <label style={{ display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer", padding: "10px 12px", background: "rgba(248,113,113,0.04)", border: "1px solid rgba(248,113,113,0.15)", borderRadius: 8, marginBottom: 18 }}>
            <input type="checkbox" checked={cascade} onChange={(e) => setCascade(e.target.checked)} style={{ marginTop: 2, accentColor: "#F87171", width: "auto" }} />
            <div>
              <div style={{ fontSize: 12.5, color: "#E8E5DE", fontWeight: 600 }}>
                Perder também as negociações ativas
              </div>
              <div style={{ fontSize: 10.5, color: "#706B5F", marginTop: 2 }}>
                Marca as negociações abertas deste contato como perdidas com o mesmo motivo
              </div>
            </div>
          </label>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button type="button" onClick={() => !saving && onClose()} disabled={saving}
            style={{ padding: "10px 18px", borderRadius: 8, border: "1px solid rgba(61,58,48,0.25)", background: "transparent", color: "#706B5F", fontSize: 13, cursor: saving ? "not-allowed" : "pointer" }}>
            Cancelar
          </button>
          <button type="button" onClick={handleConfirm} disabled={!canConfirm}
            style={{
              padding: "10px 18px", borderRadius: 8, border: "1px solid rgba(248,113,113,0.3)",
              background: "rgba(248,113,113,0.1)", color: "#F87171",
              fontSize: 13, fontWeight: 600,
              cursor: canConfirm ? "pointer" : "not-allowed",
              opacity: canConfirm ? 1 : 0.5,
            }}>
            {saving ? "..." : "Confirmar perda"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
