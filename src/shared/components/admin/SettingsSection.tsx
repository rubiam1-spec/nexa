// NEXA — Sprint F1.1 (Hub Configurações)
// Wrapper de subpágina de configuração. Header (título Instrument
// Serif + descrição Outfit) + conteúdo + footer fixo opcional com
// Salvar/Cancelar.
//
// Footer usa position: sticky; bottom: 0 — para funcionar, o ancestral
// scrollável precisa ser o container de conteúdo do SettingsLayout
// (overflow-y: auto). Funciona naturalmente quando montado dentro
// do SettingsLayout.

import type { CSSProperties, ReactNode } from "react";

const T = {
  cardBg: "rgba(28,27,24,0.4)",
  cardBorder: "rgba(61,58,48,0.3)",
  divider: "rgba(61,58,48,0.5)",
  footerBg: "linear-gradient(180deg, rgba(28,27,24,0) 0%, rgba(18,17,15,0.85) 100%)",
  footerBackdrop: "blur(8px)",
  titleColor: "var(--color-chalk)",
  descColor: "var(--color-fog)",
  primaryBg: "var(--color-sprout)",
  primaryColor: "var(--color-ink)",
  secondaryColor: "var(--color-fog)",
  secondaryBorder: "var(--color-stone)",
  fontDisplay: "var(--font-display)",
  fontSans: "var(--font-sans)",
};

interface SettingsSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
  actions?: {
    onSave: () => void;
    onCancel?: () => void;
    saving?: boolean;
    saveLabel?: string;
    cancelLabel?: string;
    disabled?: boolean;
  };
}

const containerStyle: CSSProperties = {
  maxWidth: 720,
  margin: "0 auto",
  padding: 32,
  background: T.cardBg,
  border: `1px solid ${T.cardBorder}`,
  borderRadius: 12,
  display: "flex",
  flexDirection: "column",
  gap: 20,
  fontFamily: T.fontSans,
};

const titleStyle: CSSProperties = {
  fontFamily: T.fontDisplay,
  fontSize: 26,
  fontWeight: 400,
  color: T.titleColor,
  margin: 0,
  lineHeight: 1.2,
};

const descStyle: CSSProperties = {
  fontFamily: T.fontSans,
  fontSize: 14,
  color: T.descColor,
  margin: "8px 0 0",
  maxWidth: 500,
  lineHeight: 1.5,
};

const footerWrapperStyle: CSSProperties = {
  position: "sticky",
  bottom: -32,
  marginLeft: -32,
  marginRight: -32,
  marginBottom: -32,
  marginTop: 8,
  padding: "16px 32px",
  borderTop: `1px solid ${T.divider}`,
  background: T.footerBg,
  backdropFilter: T.footerBackdrop,
  WebkitBackdropFilter: T.footerBackdrop,
  display: "flex",
  justifyContent: "flex-end",
  gap: 8,
};

const primaryBtnStyle: CSSProperties = {
  fontFamily: T.fontSans,
  fontSize: 14,
  fontWeight: 600,
  background: T.primaryBg,
  color: T.primaryColor,
  border: "none",
  borderRadius: 6,
  padding: "8px 16px",
  cursor: "pointer",
};

const secondaryBtnStyle: CSSProperties = {
  fontFamily: T.fontSans,
  fontSize: 14,
  fontWeight: 500,
  background: "transparent",
  color: T.secondaryColor,
  border: `1px solid ${T.secondaryBorder}`,
  borderRadius: 6,
  padding: "8px 16px",
  cursor: "pointer",
};

export default function SettingsSection({ title, description, children, actions }: SettingsSectionProps) {
  const saveLabel = actions?.saveLabel ?? "Salvar";
  const cancelLabel = actions?.cancelLabel ?? "Cancelar";
  const isDisabled = Boolean(actions?.disabled || actions?.saving);

  return (
    <section style={containerStyle}>
      <header>
        <h2 style={titleStyle}>{title}</h2>
        {description ? <p style={descStyle}>{description}</p> : null}
      </header>

      <div>{children}</div>

      {actions ? (
        <div style={footerWrapperStyle}>
          {actions.onCancel ? (
            <button
              type="button"
              onClick={actions.onCancel}
              disabled={isDisabled}
              style={{
                ...secondaryBtnStyle,
                opacity: isDisabled ? 0.55 : 1,
                cursor: isDisabled ? "not-allowed" : "pointer",
              }}
            >
              {cancelLabel}
            </button>
          ) : null}
          <button
            type="button"
            onClick={actions.onSave}
            disabled={isDisabled}
            style={{
              ...primaryBtnStyle,
              opacity: isDisabled ? 0.55 : 1,
              cursor: isDisabled ? "not-allowed" : "pointer",
            }}
          >
            {actions.saving ? "Salvando..." : saveLabel}
          </button>
        </div>
      ) : null}
    </section>
  );
}
