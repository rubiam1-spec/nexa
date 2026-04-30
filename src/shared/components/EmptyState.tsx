interface EmptyStateProps {
  titulo: string;
  descricao: string;
  icone?: string;
  ctaLabel?: string;
  onCta?: () => void;
}

export function EmptyState({ titulo, descricao, icone, ctaLabel, onCta }: EmptyStateProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 24px", textAlign: "center" }}>
      {icone ? (
        <div style={{ width: 56, height: 56, borderRadius: 16, background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, marginBottom: 20 }}>{icone}</div>
      ) : null}
      <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 8 }}>{titulo}</div>
      <div style={{ fontSize: 13, color: "var(--text-muted)", maxWidth: 340, lineHeight: 1.6 }}>{descricao}</div>
      {ctaLabel && onCta ? (
        <button type="button" onClick={onCta} style={{ marginTop: 20, background: "var(--interactive-primary)", color: "var(--interactive-on-primary)", border: "none", borderRadius: 10, padding: "10px 24px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{ctaLabel}</button>
      ) : null}
    </div>
  );
}
