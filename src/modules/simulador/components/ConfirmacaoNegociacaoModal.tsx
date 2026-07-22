import { createPortal } from "react-dom";
import { formatDateBRT } from "../../../shared/utils/dateUtils";
interface NegExistente { id: string; clienteNome: string | null; status: string; criadaEm: string }

const fmtD = (d: string) => formatDateBRT(d);
const LS: Record<string, string> = { IN_PROGRESS: "Em negociação", OPEN: "Aberta" };

export function ConfirmacaoNegociacaoModal({ open, neg, onUsarExistente, onCriarNova, onCancelar, enviando }: {
  open: boolean; neg: NegExistente; onUsarExistente: () => void; onCriarNova: () => void; onCancelar: () => void; enviando: boolean;
}) {
  if (!open) return null;
  return createPortal(
    <>
      <div onClick={onCancelar} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 9998 }} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 9999, width: 460, maxWidth: "95vw", background: "var(--surface-raised)", border: "1px solid var(--border-default)", borderRadius: 16, overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.5)" }}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border-default)", display: "flex", alignItems: "flex-start", gap: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0, background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>!</div>
          <div><div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-secondary)" }}>Unidade já em negociação</div><div style={{ fontSize: 12, color: "var(--text-disabled)", marginTop: 3 }}>Esta unidade já possui uma negociação ativa</div></div>
        </div>
        <div style={{ padding: "16px 24px" }}>
          <div style={{ background: "var(--surface-base)", border: "1px solid var(--border-default)", borderRadius: 10, padding: "14px 16px", marginBottom: 16 }}>
            <div style={{ fontSize: 10, color: "var(--text-disabled)", fontFamily: "var(--font-mono)", letterSpacing: "0.08em", marginBottom: 8 }}>NEGOCIAÇÃO EXISTENTE</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div><div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-secondary)" }}>{neg.clienteNome || "Sem cliente"}</div><div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>Criada em {fmtD(neg.criadaEm)}</div></div>
              <span style={{ fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 20, background: "rgba(96,165,250,0.1)", color: "#60A5FA" }}>{LS[neg.status] || neg.status}</span>
            </div>
          </div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6, marginBottom: 20 }}>Como deseja prosseguir?</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <button type="button" onClick={onUsarExistente} disabled={enviando} style={{ padding: "14px 16px", borderRadius: 10, border: "1px solid rgba(74,222,128,0.3)", background: "rgba(74,222,128,0.08)", cursor: enviando ? "not-allowed" : "pointer", textAlign: "left" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#4ADE80", marginBottom: 3 }}>Adicionar à negociação existente</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Salvar como nova proposta na negociação com {neg.clienteNome || "este cliente"}</div>
            </button>
            <button type="button" onClick={onCriarNova} disabled={enviando} style={{ padding: "14px 16px", borderRadius: 10, border: "1px solid rgba(96,165,250,0.3)", background: "rgba(96,165,250,0.08)", cursor: enviando ? "not-allowed" : "pointer", textAlign: "left" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#60A5FA", marginBottom: 3 }}>Criar nova negociação</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Negociação paralela com outro cliente ou condição</div>
            </button>
            <button type="button" onClick={onCancelar} disabled={enviando} style={{ padding: "10px", borderRadius: 8, border: "1px solid var(--border-strong)", background: "transparent", color: "var(--text-muted)", fontSize: 13, cursor: "pointer" }}>Cancelar</button>
          </div>
          {enviando ? <div style={{ fontSize: 12, color: "#4ADE80", textAlign: "center", marginTop: 12, fontFamily: "var(--font-mono)" }}>Enviando para as negociações...</div> : null}
        </div>
      </div>
    </>,
    document.body
  );
}
