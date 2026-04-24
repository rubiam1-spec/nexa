import { useState } from "react";
import { createPortal } from "react-dom";
import { useIsMobile } from "../hooks/useIsMobile";

const T = { ink: "var(--surface-base)", carbon: "var(--surface-raised)", stone: "var(--border-default)", chalk: "var(--text-primary)", bone: "var(--text-secondary)", fog: "var(--text-muted)", red: "#F87171", sprout: "var(--interactive-primary)" };

const LOSS_REASONS = [
  "Cliente desistiu",
  "Proposta recusada pela incorporadora",
  "Cliente escolheu outro empreendimento",
  "Condições comerciais incompatíveis",
  "Prazo de reserva expirado",
  "Outro",
];

interface CancelNegotiationModalProps {
  isOpen: boolean;
  onClose: () => void;
  negotiation: { id: string; clientName: string; unitLabel: string; value: number; brokerName: string };
  hasActiveReservation: boolean;
  hasActiveProposals: boolean;
  defaultReason?: string;
  onConfirm: (reason: string, notes?: string) => Promise<void>;
}

export default function CancelNegotiationModal({ isOpen, onClose, negotiation, hasActiveReservation, hasActiveProposals, defaultReason, onConfirm }: CancelNegotiationModalProps) {
  const [reason, setReason] = useState(defaultReason || "");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const mob = useIsMobile();

  if (!isOpen) return null;

  const isOther = reason === "Outro";
  const canConfirm = reason.length > 0 && (!isOther || notes.trim().length > 0);
  const finalReason = isOther ? notes.trim() : reason;

  async function handleConfirm() {
    if (!canConfirm) return;
    setSaving(true);
    try {
      await onConfirm(finalReason, notes.trim() || undefined);
      onClose();
    } catch (err) {
      console.error("Erro ao cancelar:", err);
    } finally {
      setSaving(false);
    }
  }

  const IS: React.CSSProperties = { background: T.ink, border: `1px solid ${T.stone}`, borderRadius: 8, padding: "11px 14px", color: T.chalk, fontSize: 14, width: "100%", outline: "none", boxSizing: "border-box" };

  return createPortal(
    <>
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 9000 }} onClick={onClose} />
      <div style={mob ? { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: T.carbon, padding: 24, overflowY: "auto", zIndex: 9001 } : { position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", background: T.carbon, border: `1px solid ${T.stone}`, borderRadius: 12, padding: 28, width: 460, maxWidth: "95vw", maxHeight: "90vh", overflowY: "auto", zIndex: 9001 }}>
        <h2 style={{ color: T.chalk, fontSize: 17, fontWeight: 700, margin: "0 0 20px" }}>Cancelar negociação</h2>

        {/* Summary card */}
        <div style={{ background: T.ink, border: `1px solid ${T.stone}`, borderRadius: 8, padding: 16, marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: T.bone }}>{negotiation.clientName}</div>
          <div style={{ fontSize: 12, color: T.fog, marginTop: 4 }}>{negotiation.unitLabel} · R$ {negotiation.value.toLocaleString("pt-BR")}</div>
          <div style={{ fontSize: 12, color: T.fog, marginTop: 2 }}>Corretor: {negotiation.brokerName}</div>
        </div>

        {/* What will be cancelled */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: T.fog, marginBottom: 8 }}>O que será cancelado:</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {hasActiveReservation && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: T.bone }}>
                <span style={{ color: T.red }}>•</span> Reserva ativa será cancelada
              </div>
            )}
            {hasActiveReservation && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: T.bone }}>
                <span style={{ color: T.red }}>•</span> Unidade {negotiation.unitLabel} será liberada
              </div>
            )}
            {hasActiveProposals && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: T.bone }}>
                <span style={{ color: T.red }}>•</span> Proposta(s) ativa(s) será(ão) cancelada(s)
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: T.bone }}>
              <span style={{ color: T.red }}>•</span> Negociação será marcada como perdida
            </div>
          </div>
        </div>

        {/* Reason select */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 10, color: T.fog, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "var(--font-mono)", display: "block", marginBottom: 6 }}>Motivo da perda *</label>
          <select value={reason} onChange={(e) => setReason(e.target.value)} style={{ ...IS, cursor: "pointer" }}>
            <option value="">Selecione o motivo...</option>
            {LOSS_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        {/* Notes */}
        <div style={{ marginBottom: 24 }}>
          <label style={{ fontSize: 10, color: T.fog, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "var(--font-mono)", display: "block", marginBottom: 6 }}>Observação {isOther ? "*" : "(opcional)"}</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder={isOther ? "Descreva o motivo..." : "Informações adicionais..."} style={{ ...IS, resize: "vertical" }} />
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button type="button" onClick={onClose} disabled={saving} style={{ padding: "10px 20px", borderRadius: 8, border: `1px solid ${T.stone}`, background: "transparent", color: T.fog, fontSize: 13, cursor: "pointer" }}>Voltar</button>
          <button type="button" onClick={handleConfirm} disabled={!canConfirm || saving} style={{ padding: "10px 24px", borderRadius: 8, border: "none", background: T.red, color: T.ink, fontSize: 13, fontWeight: 700, cursor: canConfirm && !saving ? "pointer" : "not-allowed", opacity: canConfirm && !saving ? 1 : 0.5 }}>
            {saving ? "Cancelando..." : "Confirmar cancelamento"}
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
