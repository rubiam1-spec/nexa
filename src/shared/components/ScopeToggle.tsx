// Padrão ÚNICO de alternador de escopo (Lei 4) — pílulas de apresentação.
// Genérico: recebe opções {value,label}. NÃO decide papel/permissão — quem
// chama já filtrou os escopos permitidos. <2 opções → não há o que alternar.
export type ScopeOption<T extends string = string> = { value: T; label: string };

export function ScopeToggle<T extends string>({ options, value, onChange, ariaLabel = "Escopo" }: {
  options: ScopeOption<T>[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel?: string;
}) {
  if (options.length < 2) return null;
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }} role="group" aria-label={ariaLabel}>
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
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
              minHeight: 40,
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export default ScopeToggle;
