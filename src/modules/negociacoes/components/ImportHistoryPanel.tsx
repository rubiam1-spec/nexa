// Histórico de importações — superfície permanente para ver lotes importados e
// desfazê-los. Só apresentação/orquestração de UI: os dados e o undo vêm do
// hook useNegotiationImport (repositório Supabase-only). Zero supabase.from aqui.
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNegotiationImport } from "../hooks/useNegotiationImport";
import { formatDateBRT, formatTimeBRT } from "../../../shared/utils/dateUtils";

interface Props {
  open: boolean;
  onClose: () => void;
  accountId: string | null;
  developmentId: string | null;
  onChanged?: () => void; // avisa a página quando um lote é desfeito
}

type Badge = { label: string; color: string; bg: string };

function statusBadge(status: string): Badge {
  if (status === "committed") return { label: "Importado", color: "var(--color-sprout)", bg: "var(--color-sprout-muted)" };
  if (status === "undone") return { label: "Desfeito", color: "var(--text-muted)", bg: "rgba(120,120,120,0.12)" };
  return { label: "Em revisão", color: "#E8B45A", bg: "rgba(232,180,90,0.12)" };
}

const btnGhost: React.CSSProperties = {
  background: "transparent",
  color: "var(--color-bone)",
  border: "1px solid var(--color-stone)",
  borderRadius: 8,
  padding: "6px 12px",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
};

const btnDanger: React.CSSProperties = {
  background: "#F87171",
  color: "var(--interactive-on-primary, #1C1B18)",
  border: "none",
  borderRadius: 8,
  padding: "8px 16px",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
};

export default function ImportHistoryPanel({ open, onClose, accountId, developmentId, onChanged }: Props) {
  const imp = useNegotiationImport(accountId, developmentId);
  const { imports, isLoadingImports, isUndoing, errorMessage, loadImports, runUndo, clearError } = imp;

  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSuccessMsg(null);
    setConfirmId(null);
    clearError();
    void loadImports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (confirmId) setConfirmId(null);
        else onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, confirmId, onClose]);

  const doUndo = useCallback(
    async (batchId: string) => {
      const result = await runUndo(batchId);
      if (result) {
        setSuccessMsg(
          `${result.deleted} negociações removidas · ${result.clientsKept} contatos e ${result.brokersKept} corretores preservados.`,
        );
        setConfirmId(null);
        await loadImports();
        onChanged?.();
      }
      // erro (ex.: batch_has_downstream_records) fica em errorMessage e é exibido.
    },
    [runUndo, loadImports, onChanged],
  );

  if (!open) return null;

  return createPortal(
    <div
      onClick={() => (confirmId ? setConfirmId(null) : onClose())}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "rgba(0,0,0,0.6)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 720,
          maxHeight: "86vh",
          display: "flex",
          flexDirection: "column",
          background: "var(--surface-raised, #1C1B18)",
          border: "1px solid var(--border-default, #3D3A30)",
          borderRadius: 16,
          overflow: "hidden",
          boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
        }}
      >
        {/* Header */}
        <div style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--border-default, #3D3A30)" }}>
          <div style={{ fontFamily: "var(--font-serif, 'Instrument Serif', serif)", fontStyle: "italic", fontSize: 22, color: "var(--text-primary)" }}>
            Histórico de importações
          </div>
          <button onClick={onClose} aria-label="Fechar" style={{ background: "transparent", border: "none", color: "var(--text-muted)", fontSize: 24, cursor: "pointer", lineHeight: 1, padding: 4 }}>
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ overflowY: "auto", padding: 20 }}>
          {successMsg && (
            <div style={{ background: "var(--color-sprout-muted)", border: "1px solid var(--color-sprout)", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: "var(--color-sprout)" }}>
              ✓ {successMsg}
            </div>
          )}
          {errorMessage && (
            <div style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: "#F87171" }}>
              {errorMessage}
            </div>
          )}

          {isLoadingImports ? (
            <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Carregando importações...</p>
          ) : imports.length === 0 ? (
            <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Nenhuma importação registrada nesta conta.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {imports.map((b) => {
                const badge = statusBadge(b.status);
                const canUndo = b.status === "committed";
                const isConfirming = confirmId === b.batchId;
                return (
                  <div key={b.batchId} style={{ border: "1px solid var(--border-default, #3D3A30)", borderRadius: 12, padding: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {b.fileName}{b.sheetName ? ` · ${b.sheetName}` : ""}
                        </div>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>
                          {b.createdAt ? `${formatDateBRT(b.createdAt)} ${formatTimeBRT(b.createdAt)}` : "—"} · {b.imported} importadas · {b.skipped} puladas · {b.errors} erros
                        </div>
                      </div>
                      <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, color: badge.color, background: badge.bg, borderRadius: 999, padding: "3px 10px" }}>
                        {badge.label}
                      </span>
                    </div>

                    {canUndo && !isConfirming && (
                      <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
                        <button type="button" onClick={() => { clearError(); setSuccessMsg(null); setConfirmId(b.batchId); }} style={btnGhost}>
                          Desfazer
                        </button>
                      </div>
                    )}

                    {isConfirming && (
                      <div style={{ marginTop: 12, background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.25)", borderRadius: 10, padding: 14 }}>
                        <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 12 }}>
                          Remove {b.imported} negociações deste lote. Contatos e corretores criados serão preservados. Esta ação não pode ser desfeita.
                        </div>
                        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                          <button type="button" disabled={isUndoing} onClick={() => setConfirmId(null)} style={btnGhost}>
                            Cancelar
                          </button>
                          <button type="button" disabled={isUndoing} onClick={() => void doUndo(b.batchId)} style={{ ...btnDanger, opacity: isUndoing ? 0.6 : 1, cursor: isUndoing ? "not-allowed" : "pointer" }}>
                            {isUndoing ? "Desfazendo…" : "Desfazer importação"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
