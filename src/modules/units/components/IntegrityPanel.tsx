// Painel "Saúde do dado" (U5) — seção discreta e colapsável no topo do módulo
// Unidades. Zero divergências → linha única "Dados consistentes ✓"; com
// divergências → cards por issue (número + rótulo + ação), ordenados por
// severidade. Cards de issue de unidade acionam o modo foco; won_sem_unidade
// leva à Lista em Venda. Sem regra aqui — só apresentação.
import type { IntegrityCard } from "../../../domain/unidade/unitIntegrityIssues";

const MONO = "var(--font-mono)";
const ACCENT = (kind: IntegrityCard["kind"]) => (kind === "negotiation" ? "#7DA7F4" : "#E8B45A");

export function IntegrityPanel({
  cards, consistent, isLoading, open, onToggle, focusBusy, onFocusIssue, onOpenWonNegotiations, isMobile,
}: {
  cards: IntegrityCard[];
  consistent: boolean;
  isLoading: boolean;
  open: boolean;
  onToggle: () => void;
  focusBusy: boolean;
  onFocusIssue: (id: string, label: string) => void;
  onOpenWonNegotiations: () => void;
  isMobile: boolean;
}) {
  const total = cards.reduce((s, c) => s + c.count, 0);
  const summary = consistent ? "Dados consistentes ✓" : `${total} ${total === 1 ? "divergência" : "divergências"} em ${cards.length} ${cards.length === 1 ? "tipo" : "tipos"}`;

  return (
    <div style={{ marginBottom: 16, border: "1px solid var(--border-default)", borderRadius: 10, background: "rgba(156,150,134,0.03)" }}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 14px", minHeight: 44, background: "transparent", border: "none", cursor: "pointer" }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.14em", textTransform: "uppercase" }}>Saúde do dado</span>
          <span style={{ fontSize: 12, color: consistent ? "var(--text-muted)" : "#E8B45A", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{isLoading ? "verificando…" : summary}</span>
        </span>
        <span style={{ color: "var(--text-muted)", fontSize: 12, flexShrink: 0 }}>{open ? "▾" : "▸"}</span>
      </button>

      {open && !isLoading && (
        consistent ? (
          <div style={{ padding: "0 14px 12px", fontSize: 12.5, color: "var(--text-muted)" }}>
            Nenhuma divergência entre unidade, negociação, reserva e venda neste empreendimento.
          </div>
        ) : (
          <div style={{ display: "flex", gap: 8, padding: "0 14px 12px", ...(isMobile ? { overflowX: "auto", WebkitOverflowScrolling: "touch", paddingBottom: 12 } : { flexWrap: "wrap" }) }}>
            {cards.map((card) => {
              const accent = ACCENT(card.kind);
              const isUnit = card.kind === "unit";
              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => (isUnit ? onFocusIssue(card.id, card.label) : onOpenWonNegotiations())}
                  disabled={focusBusy}
                  style={{ flexShrink: 0, minWidth: isMobile ? 210 : 220, maxWidth: 300, minHeight: 44, textAlign: "left", padding: "10px 12px", borderRadius: 8, border: `1px solid ${accent}40`, background: `${accent}10`, cursor: focusBusy ? "wait" : "pointer", display: "flex", alignItems: "center", gap: 10 }}
                >
                  <span style={{ fontFamily: MONO, fontSize: 22, fontWeight: 800, color: accent, lineHeight: 1, flexShrink: 0 }}>{card.count}</span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.25 }}>{card.label}</span>
                    <span style={{ display: "block", fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{isUnit ? card.action : "ver negociações →"}</span>
                  </span>
                </button>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}

export default IntegrityPanel;
