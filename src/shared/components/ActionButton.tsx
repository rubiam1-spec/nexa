import { type CSSProperties, type ReactNode } from "react";

interface ActionButtonProps {
  children: ReactNode;
  onClick?: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger";
  style?: CSSProperties;
  type?: "button" | "submit";
}

const variants: Record<string, { bg: string; color: string; border: string }> = {
  primary:   { bg: "#4ADE80", color: "var(--interactive-on-primary)", border: "none" },
  secondary: { bg: "transparent", color: "var(--text-muted)", border: "1px solid var(--border-strong)" },
  danger:    { bg: "rgba(248,113,113,0.1)", color: "#F87171", border: "1px solid rgba(248,113,113,0.3)" },
};

export function ActionButton({ children, onClick, loading, disabled, variant = "primary", style, type = "button" }: ActionButtonProps) {
  const v = variants[variant];
  const isDisabled = disabled || loading;
  return (
    <button type={type} onClick={onClick} disabled={isDisabled} style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
      padding: "10px 20px", borderRadius: 10, fontSize: 13, fontWeight: 700,
      background: v.bg, color: v.color, border: v.border,
      cursor: isDisabled ? "not-allowed" : "pointer",
      opacity: isDisabled ? 0.5 : 1,
      transition: "opacity 0.15s, transform 0.1s",
      ...style,
    }}>
      {loading ? <Spinner color={v.color} /> : null}
      {children}
    </button>
  );
}

function Spinner({ color }: { color: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" style={{ animation: "spin 0.8s linear infinite", flexShrink: 0 }}>
      <circle cx="7" cy="7" r="5.5" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeDasharray="20 12" opacity="0.7" />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </svg>
  );
}
