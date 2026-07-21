// Modal único de alteração de status (individual e em massa). createPortal para
// o body (viewport), fixed inset-0 z-9000 — padrão do projeto. Regra/tradução no
// serviço; aqui só UI + a11y (foco preso, Esc, aria). Resultado é OBRIGATÓRIO:
// sucesso parcial (X ok + Y bloqueadas) é sucesso, não erro — nada silencioso.
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { NexaSelect } from "../../../shared/ui/NexaSelect";
import { UnidadeStatus } from "../../../domain/unidade/UnidadeStatus";
import { getUnidadeStatusLabel } from "../../../domain/unidade/UnidadeStatusLabel";
import { bulkBlockReasonLabel } from "../../../domain/unidade/bulkStatusReason";
import { useUnitStatusChange } from "../hooks/useUnitStatusChange";

export type StatusTarget = { id: string; quadra: string; lote: string; status: UnidadeStatus };

const MAX_BATCH = 200;
const MIN_REASON = 5;
const STATUS_OPTIONS = [
  UnidadeStatus.DISPONIVEL,
  UnidadeStatus.EM_NEGOCIACAO,
  UnidadeStatus.RESERVADO,
  UnidadeStatus.VENDIDO,
].map((s) => ({ value: s, label: getUnidadeStatusLabel(s) }));

const btnPrimary: React.CSSProperties = { flex: 1, height: 40, borderRadius: 8, border: "none", background: "var(--color-sprout)", color: "var(--interactive-on-primary, #16150F)", fontSize: 13, fontWeight: 700, cursor: "pointer" };
const btnGhost: React.CSSProperties = { flex: 1, height: 40, borderRadius: 8, border: "1px solid var(--border-default)", background: "transparent", color: "var(--text-secondary)", fontSize: 13, fontWeight: 600, cursor: "pointer" };

export default function ChangeUnitStatusModal({ open, targets, onClose, onChanged }: {
  open: boolean;
  targets: StatusTarget[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const { submit, isSubmitting, result, errorMessage, reset } = useUnitStatusChange(onChanged);
  const [destino, setDestino] = useState<UnidadeStatus | "">("");
  const [reason, setReason] = useState("");
  const [copied, setCopied] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const isBulk = targets.length > 1;
  const overCap = targets.length > MAX_BATCH;
  const reasonOk = reason.trim().length >= MIN_REASON;
  const targetsKey = targets.map((t) => t.id).join(",");
  const byId = useMemo(() => new Map(targets.map((t) => [t.id, t])), [targets]);

  // Reset ao (re)abrir ou trocar a seleção.
  useEffect(() => {
    if (!open) return;
    setDestino("");
    setReason("");
    setCopied(false);
    reset();
  }, [open, targetsKey, reset]);

  // A11y: foco preso, Esc fecha.
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    panel?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "Tab" && panel) {
        const list = Array.from(panel.querySelectorAll<HTMLElement>('button, input, select, textarea, [href], [tabindex]:not([tabindex="-1"])')).filter((el) => !el.hasAttribute("disabled") && el.offsetParent !== null);
        if (list.length === 0) return;
        const first = list[0], last = list[list.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const showResult = result !== null && (isBulk || result.blocked.length > 0);

  async function handleConfirm() {
    if (!destino || !reasonOk || overCap) return;
    const r = await submit(targets.map((t) => t.id), destino, reason.trim());
    if (!r) return; // exception → errorMessage inline
    if (!isBulk && r.updated === 1) onClose(); // individual OK → fecha
    // demais casos: painel de resultado renderiza a partir de `result`
  }

  function copyBlocked() {
    const text = (result?.blocked ?? [])
      .map((b) => { const t = byId.get(b.unit_id); return `${t ? `${t.quadra}·${t.lote}` : b.unit_id} — ${bulkBlockReasonLabel(b.reason)}`; })
      .join("\n");
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const single = targets[0];
  const destinoLabel = destino ? getUnidadeStatusLabel(destino) : "—";
  const resumo = isBulk
    ? `${targets.length} unidades → ${destinoLabel}`
    : single ? `${single.quadra}·${single.lote} · ${getUnidadeStatusLabel(single.status)} → ${destinoLabel}` : "";

  return createPortal(
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "rgba(0,0,0,0.6)" }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="chg-status-title"
        onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 460, maxHeight: "88vh", overflowY: "auto", outline: "none", background: "var(--surface-raised, #1C1B18)", border: "1px solid var(--border-default, #3D3A30)", borderRadius: 16, padding: 24, boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <h2 id="chg-status-title" style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Alterar status {isBulk ? "em massa" : "da unidade"}</h2>
          <button type="button" onClick={onClose} aria-label="Fechar" style={{ background: "transparent", border: "none", color: "var(--text-muted)", fontSize: 22, lineHeight: 1, cursor: "pointer", padding: 2 }}>×</button>
        </div>

        {showResult ? (
          // ── Painel de resultado (sucesso, mesmo parcial) ──
          <div>
            <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
              <div style={{ flex: 1, background: "var(--color-sprout-muted)", border: "1px solid var(--color-sprout)", borderRadius: 10, padding: "12px 14px" }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: "var(--color-sprout)", fontFamily: "var(--font-mono)" }}>{result!.updated}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{result!.updated === 1 ? "alterada" : "alteradas"}</div>
              </div>
              <div style={{ flex: 1, background: result!.blocked.length ? "rgba(248,113,113,0.08)" : "var(--surface-base)", border: `1px solid ${result!.blocked.length ? "rgba(248,113,113,0.3)" : "var(--border-default)"}`, borderRadius: 10, padding: "12px 14px" }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: result!.blocked.length ? "#F87171" : "var(--text-muted)", fontFamily: "var(--font-mono)" }}>{result!.blocked.length}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{result!.blocked.length === 1 ? "bloqueada" : "bloqueadas"}</div>
              </div>
            </div>

            {result!.blocked.length > 0 && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--text-muted)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Bloqueadas — por quê</span>
                  <button type="button" onClick={copyBlocked} style={{ background: "transparent", border: "1px solid var(--border-default)", borderRadius: 6, padding: "3px 8px", fontSize: 11, color: "var(--text-secondary)", cursor: "pointer" }}>{copied ? "✓ copiado" : "copiar lista"}</button>
                </div>
                <div style={{ maxHeight: 220, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
                  {result!.blocked.map((b) => {
                    const t = byId.get(b.unit_id);
                    return (
                      <div key={b.unit_id} style={{ display: "flex", gap: 8, alignItems: "baseline", border: "1px solid var(--border-default)", borderRadius: 8, padding: "8px 10px" }}>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, color: "var(--text-primary)", flexShrink: 0 }}>{t ? `${t.quadra}·${t.lote}` : "—"}</span>
                        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{bulkBlockReasonLabel(b.reason)}</span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
            <button type="button" onClick={onClose} style={{ ...btnPrimary, width: "100%", flex: "unset", marginTop: 16 }}>Fechar</button>
          </div>
        ) : (
          // ── Formulário ──
          <div>
            <label style={{ display: "block", marginBottom: 14 }}>
              <span style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>Status destino</span>
              <NexaSelect value={destino} onChange={(v) => setDestino(v as UnidadeStatus)} options={STATUS_OPTIONS} placeholder="Selecionar status..." ariaLabel="Status destino" />
            </label>

            <label style={{ display: "block", marginBottom: 6 }}>
              <span style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>Motivo <span style={{ color: "#F87171" }}>*</span></span>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="Por que este status está mudando? (mín. 5 caracteres)"
                style={{ width: "100%", resize: "vertical", background: "var(--surface-base)", border: `1px solid ${reason.length > 0 && !reasonOk ? "#F87171" : "var(--border-default)"}`, borderRadius: 8, padding: "10px 12px", color: "var(--text-primary)", fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
              />
            </label>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-muted)", marginBottom: 14 }}>
              <span>{reason.trim().length < MIN_REASON ? `Mínimo ${MIN_REASON} caracteres` : "Obrigatório e registrado no histórico"}</span>
              <span style={{ fontFamily: "var(--font-mono)" }}>{reason.trim().length}</span>
            </div>

            <div style={{ background: "var(--surface-base)", border: "1px solid var(--border-default)", borderRadius: 8, padding: "10px 12px", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-secondary)", marginBottom: overCap ? 8 : 16 }}>
              {resumo}
            </div>
            {isBulk && (
              <div style={{ fontSize: 11, color: overCap ? "#F87171" : "var(--text-muted)", marginBottom: 16 }}>
                {overCap ? `Seleção acima do limite de ${MAX_BATCH} — reduza a seleção.` : `Até ${MAX_BATCH} unidades por vez. Cada unidade é validada individualmente.`}
              </div>
            )}

            {errorMessage && (
              <div style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: 8, padding: "10px 12px", fontSize: 12, color: "#F87171", marginBottom: 14 }}>{errorMessage}</div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" onClick={onClose} style={btnGhost}>Cancelar</button>
              <button type="button" disabled={isSubmitting || !destino || !reasonOk || overCap} onClick={() => void handleConfirm()} style={{ ...btnPrimary, opacity: isSubmitting || !destino || !reasonOk || overCap ? 0.5 : 1, cursor: isSubmitting || !destino || !reasonOk || overCap ? "not-allowed" : "pointer" }}>
                {isSubmitting ? "Alterando..." : "Confirmar"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
