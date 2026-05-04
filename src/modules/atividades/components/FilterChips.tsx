import type { CSSProperties } from "react";

export type FilterChip = {
  id: string;
  label: string;
  removable?: boolean;
};

type Props = {
  chips: FilterChip[];
  onRemove?: (id: string) => void;
  className?: string;
};

const tokens = {
  bg: "var(--surface-raised)",
  bgRemovable: "var(--surface-hover)",
  border: "var(--border-default)",
  text: "var(--text-secondary)",
  textPrimary: "var(--text-primary)",
  accent: "var(--interactive-primary)",
};

const baseChip: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "5px 10px",
  borderRadius: 999,
  border: `1px solid ${tokens.border}`,
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  letterSpacing: "0.02em",
  lineHeight: 1,
  whiteSpace: "nowrap" as const,
};

const fixedChip: CSSProperties = {
  ...baseChip,
  background: tokens.bg,
  color: tokens.text,
};

const removableChip: CSSProperties = {
  ...baseChip,
  background: tokens.bgRemovable,
  color: tokens.textPrimary,
  cursor: "default",
};

const closeBtn: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 14,
  height: 14,
  borderRadius: "50%",
  background: "transparent",
  border: "none",
  color: tokens.text,
  fontSize: 13,
  lineHeight: 1,
  cursor: "pointer",
  padding: 0,
};

export default function FilterChips({ chips, onRemove }: Props) {
  if (chips.length === 0) return null;
  return (
    <div
      style={{
        display: "flex",
        gap: 6,
        flexWrap: "wrap",
        alignItems: "center",
        marginBottom: 12,
      }}
    >
      {chips.map((chip) => (
        <span key={chip.id} style={chip.removable ? removableChip : fixedChip}>
          {chip.label}
          {chip.removable && onRemove && (
            <button
              type="button"
              onClick={() => onRemove(chip.id)}
              style={closeBtn}
              aria-label={`Remover filtro ${chip.label}`}
            >
              ×
            </button>
          )}
        </span>
      ))}
    </div>
  );
}
