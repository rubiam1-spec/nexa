// Alternador de escopo (Minhas métricas / Equipe / Geral) — pílulas no mesmo
// padrão visual do filtro de período da página de Relatórios. Puramente de
// apresentação: recebe os escopos permitidos (derivados do registry) e emite
// onChange. NÃO decide permissão nem role — só organiza o header.
import type { ReportScope } from "../domain/reportRegistry";

const SCOPE_LABELS: Record<ReportScope, string> = {
  self: "Minhas métricas",
  team: "Equipe",
  global: "Geral",
};

interface Props {
  scopes: ReportScope[];
  value: ReportScope;
  onChange: (scope: ReportScope) => void;
}

export default function ScopeToggle({ scopes, value, onChange }: Props) {
  // Menos de 2 escopos: não há o que alternar (ex.: consultora só tem 'self').
  if (scopes.length < 2) return null;
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }} role="group" aria-label="Escopo do relatório">
      {scopes.map((scope) => {
        const active = value === scope;
        return (
          <button
            key={scope}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(scope)}
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              border: active ? "1px solid var(--interactive-primary)" : "1px solid var(--border-default)",
              background: active ? "var(--status-sprout-muted)" : "transparent",
              color: active ? "var(--interactive-primary)" : "var(--text-muted)",
              transition: "all 120ms ease",
              fontFamily: "var(--font-sans)",
            }}
          >
            {SCOPE_LABELS[scope]}
          </button>
        );
      })}
    </div>
  );
}
