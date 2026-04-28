// NEXA — Sprint F1.1 (Hub Configurações)
// Bar superior do modo administrativo. Altura 44px (menor que topbar
// operacional 56px) e borda inferior sprout sutil sinalizam que o
// usuário está configurando, não operando.

import type { CSSProperties } from "react";

const T = {
  bgFrom: "var(--color-ink)",
  bgTo: "var(--color-carbon)",
  borderBottom: "rgba(74,222,128,0.18)",
  text: "var(--color-fog)",
  textHover: "var(--color-bone)",
  fontMono: "var(--font-mono)",
  fontSans: "var(--font-sans)",
};

interface AdminHeaderProps {
  onExit: () => void;
}

const GearIcon = ({ size = 14, color = "currentColor" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const headerStyle: CSSProperties = {
  height: 44,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "0 20px",
  background: `linear-gradient(180deg, ${T.bgFrom} 0%, ${T.bgTo} 100%)`,
  borderBottom: `1px solid ${T.borderBottom}`,
  flexShrink: 0,
};

const labelStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  fontFamily: T.fontMono,
  fontSize: 10,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: T.text,
  fontWeight: 600,
};

const exitButtonBaseStyle: CSSProperties = {
  background: "transparent",
  border: "none",
  padding: "6px 8px",
  cursor: "pointer",
  fontFamily: T.fontSans,
  fontSize: 12,
  color: T.text,
  transition: "color 150ms ease",
};

export default function AdminHeader({ onExit }: AdminHeaderProps) {
  return (
    <header style={headerStyle}>
      <span style={labelStyle}>
        <GearIcon size={14} color={T.text} />
        Modo administrativo
      </span>
      <button
        type="button"
        onClick={onExit}
        style={exitButtonBaseStyle}
        onMouseEnter={(e) => { e.currentTarget.style.color = T.textHover; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = T.text; }}
      >
        Sair do modo administrativo
      </button>
    </header>
  );
}
