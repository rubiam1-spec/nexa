import { useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../../infra/supabase/supabaseClient";
import { useIsMobile } from "../../../shared/hooks/useIsMobile";

// Brand v7.3 — tela pré-auth, não depende do ThemeProvider. Mesma paleta e
// mesmas camadas de superfície do LoginPage v7.3 (por enquanto duplicado;
// extração para `auth/components/` prevista em sprint de refactoring).
const T = {
  ink: "#12110F",
  chalk: "#FAF9F6",
  bone: "#E8E5DE",
  fog: "#9C9686",
  slate: "#706B5F",
  clay: "#5C5647",
  sprout: "#4ADE80",
  sproutDim: "#3FC970",
  red: "#F87171",
  layer0Left: "#080A08",
  layer0Right: "#0F0E0C",
  divider: "rgba(61,58,48,0.4)",
  cardBorder: "rgba(74,68,56,0.55)",
  inputBorder: "rgba(61,58,48,0.6)",
  inputBorderFocus: "rgba(74,222,128,0.45)",
  cardBg: "radial-gradient(ellipse at 50% -20%, #23211D 0%, #141311 75%)",
  cardShadow:
    "0 16px 48px rgba(0,0,0,0.35), 0 1px 0 rgba(255,255,255,0.02) inset",
  inputBgIdle: "linear-gradient(180deg, #2A2822 0%, #242220 100%)",
  inputBgFocus:
    "radial-gradient(ellipse at center, rgba(74,222,128,0.10) 0%, #2A2822 80%)",
  inputShadowFocus: "0 0 0 3px rgba(74,222,128,0.06)",
  buttonBg: "linear-gradient(180deg, #4ADE80 0%, #3FC970 100%)",
  buttonShadow: "0 1px 0 rgba(255,255,255,0.15) inset",
  leftGlow:
    "radial-gradient(ellipse at 20% 30%, rgba(74,222,128,0.05) 0%, transparent 55%), #080A08",
};

const COPYRIGHT_YEAR = new Date().getFullYear();
const APP_VERSION = "V1.4.0";

const HERO_HEADLINE = "Recupere o acesso em segundos.";
const HERO_SUBLINE = "Enviamos um link seguro para o seu email.";

const AUTOFILL_CSS = `
.nexa-recover-input:-webkit-autofill,
.nexa-recover-input:-webkit-autofill:hover,
.nexa-recover-input:-webkit-autofill:focus,
.nexa-recover-input:-webkit-autofill:active {
  -webkit-box-shadow: 0 0 0 100px transparent inset !important;
  -webkit-text-fill-color: #FAF9F6 !important;
  caret-color: #FAF9F6;
  transition: background-color 9999s ease-in-out 0s;
}
`;

export default function EsqueciSenhaPage() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [enviado, setEnviado] = useState(false);

  async function handleEnviar() {
    if (!email.trim()) return;
    setLoading(true);
    setErro("");
    if (!supabase) {
      setErro("Supabase não configurado.");
      setLoading(false);
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/recuperar-senha`,
    });
    setLoading(false);
    if (error) {
      setErro("Erro ao enviar. Tente novamente.");
    } else {
      setEnviado(true);
    }
  }

  const canSubmit = email.trim().length > 0 && !loading;

  // Card: dois estados — formulário e link enviado.
  const cardContent = enviado ? (
    <SentCard
      email={email}
      isMobile={isMobile}
      onBackToLogin={() => navigate("/entrar")}
      onResend={() => {
        setEnviado(false);
        setErro("");
      }}
    />
  ) : (
    <FormCard
      email={email}
      setEmail={setEmail}
      loading={loading}
      erro={erro}
      canSubmit={canSubmit}
      isMobile={isMobile}
      onSubmit={() => void handleEnviar()}
      onBackToLogin={() => navigate("/entrar")}
    />
  );

  if (isMobile) {
    return (
      <div
        style={{
          minHeight: "100dvh",
          background: T.layer0Left,
          color: T.chalk,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <style>{AUTOFILL_CSS}</style>

        {/* ZONA A — marca leve */}
        <div
          style={{
            padding: "32px 24px 0 24px",
            background:
              "radial-gradient(ellipse at 20% 10%, rgba(74,222,128,0.05) 0%, transparent 55%), #080A08",
          }}
        >
          <BrandLockup compact />
        </div>

        {/* ZONA B — hero */}
        <div style={{ padding: "40px 24px 32px 24px", background: T.layer0Left }}>
          <h1
            style={{
              fontFamily: "'Instrument Serif', Georgia, serif",
              fontStyle: "italic",
              fontSize: 34,
              lineHeight: 1.12,
              letterSpacing: "-0.015em",
              fontWeight: 400,
              color: T.chalk,
              margin: 0,
              marginBottom: 16,
            }}
          >
            {HERO_HEADLINE}
          </h1>
          <p
            style={{
              fontFamily: "'Outfit', sans-serif",
              fontWeight: 400,
              fontSize: 14,
              lineHeight: 1.5,
              color: T.fog,
              margin: 0,
            }}
          >
            {HERO_SUBLINE}
          </p>
        </div>

        {/* ZONA C — card */}
        <div style={{ padding: "0 24px 32px 24px", background: T.layer0Left, flex: 1 }}>
          <CardShell mobile>{cardContent}</CardShell>
        </div>

        {/* ZONA D — footer institucional (2 linhas + safe-area) */}
        {(() => {
          const footerLabel: CSSProperties = {
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 8,
            fontWeight: 500,
            color: T.clay,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            lineHeight: 1,
          };
          const sepDot = (
            <span
              style={{
                width: 3,
                height: 3,
                borderRadius: "50%",
                background: T.slate,
                display: "inline-block",
              }}
            />
          );
          return (
            <div
              style={{
                padding: "20px 24px calc(28px + env(safe-area-inset-bottom)) 24px",
                borderTop: `0.5px solid ${T.divider}`,
                background: T.layer0Left,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 8,
              }}
            >
              {/* Linha 1 — sessão segura */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={footerLabel}>Sessão Segura</span>
                <span
                  style={{
                    width: 4,
                    height: 4,
                    borderRadius: "50%",
                    background: T.sprout,
                    display: "inline-block",
                  }}
                />
                <span style={footerLabel}>TLS 1.3</span>
              </div>
              {/* Linha 2 — rastreabilidade */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={footerLabel}>© NEXA · {COPYRIGHT_YEAR}</span>
                {sepDot}
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <span
                    style={{
                      width: 3,
                      height: 3,
                      borderRadius: "50%",
                      background: T.sprout,
                      display: "inline-block",
                    }}
                  />
                  <span style={footerLabel}>Produção</span>
                </span>
                {sepDot}
                <span style={footerLabel}>{APP_VERSION}</span>
              </div>
            </div>
          );
        })()}
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: T.ink,
        color: T.chalk,
        display: "grid",
        gridTemplateColumns: "repeat(2, 1fr)",
      }}
    >
      <style>{AUTOFILL_CSS}</style>
      {/* ESQUERDO — brand / hero / rodapé rastreável */}
      <div
        style={{
          background: T.leftGlow,
          padding: "48px 56px",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <BrandLockup />
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            maxWidth: 520,
            gap: 24,
            padding: "24px 0",
          }}
        >
          <HeroBlock headlineSize={48} sublineSize={16} />
        </div>
        <LeftFooter />
      </div>

      {/* DIREITO — spacer 40 / card / metadado */}
      <div
        style={{
          background: T.layer0Right,
          borderLeft: `0.5px solid ${T.divider}`,
          padding: "48px 56px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ height: 40 }} />
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <CardShell>{cardContent}</CardShell>
        </div>
        <div
          style={{
            paddingTop: 24,
            borderTop: `0.5px solid ${T.divider}`,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <SessionMetadata />
        </div>
      </div>
    </div>
  );
}

// ── Painel esquerdo ───────────────────────────────────────

function BrandLockup({ compact = false }: { compact?: boolean }) {
  const blocoSize = compact ? 32 : 40;
  const wordmarkSize = compact ? 17 : 20;
  const taglineSize = compact ? 8 : 9;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: compact ? 14 : 16 }}>
      <BlocoN size={blocoSize} />
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span
          style={{
            fontFamily: "'Outfit', sans-serif",
            fontSize: wordmarkSize,
            fontWeight: 700,
            color: T.chalk,
            letterSpacing: "0.02em",
            lineHeight: 1,
          }}
        >
          NEXA
        </span>
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: taglineSize,
            fontWeight: 500,
            color: T.slate,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            lineHeight: 1,
          }}
        >
          Plataforma Comercial
        </span>
      </div>
    </div>
  );
}

function HeroBlock({ headlineSize, sublineSize }: { headlineSize: number; sublineSize: number }) {
  return (
    <>
      <h1
        style={{
          fontFamily: "'Instrument Serif', Georgia, serif",
          fontStyle: "italic",
          fontSize: headlineSize,
          lineHeight: 1.1,
          letterSpacing: "-0.015em",
          fontWeight: 400,
          color: T.chalk,
          margin: 0,
        }}
      >
        {HERO_HEADLINE}
      </h1>
      <p
        style={{
          fontFamily: "'Outfit', sans-serif",
          fontWeight: 400,
          fontSize: sublineSize,
          lineHeight: 1.5,
          color: T.fog,
          margin: 0,
          maxWidth: 440,
        }}
      >
        {HERO_SUBLINE}
      </p>
    </>
  );
}

function LeftFooter() {
  const label: CSSProperties = {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 9,
    fontWeight: 500,
    color: T.clay,
    letterSpacing: "0.16em",
    textTransform: "uppercase",
    lineHeight: 1,
  };
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        paddingTop: 24,
        borderTop: `0.5px solid ${T.divider}`,
      }}
    >
      <span style={label}>© NEXA · {COPYRIGHT_YEAR}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              width: 4,
              height: 4,
              borderRadius: "50%",
              background: T.sprout,
              display: "inline-block",
            }}
          />
          <span style={label}>Produção</span>
        </span>
        <span style={label}>{APP_VERSION}</span>
      </div>
    </div>
  );
}

function SessionMetadata() {
  const label: CSSProperties = {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 9,
    fontWeight: 500,
    color: T.clay,
    letterSpacing: "0.16em",
    textTransform: "uppercase",
    lineHeight: 1,
  };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={label}>Sessão Segura</span>
      <span
        style={{
          width: 4,
          height: 4,
          borderRadius: "50%",
          background: T.sprout,
          display: "inline-block",
        }}
      />
      <span style={label}>TLS 1.3</span>
    </div>
  );
}

// ── Card ──────────────────────────────────────────────────

function CardShell({
  children,
  mobile = false,
}: {
  children: React.ReactNode;
  mobile?: boolean;
}) {
  return (
    <div
      style={{
        width: "100%",
        maxWidth: mobile ? "100%" : 400,
        background: T.cardBg,
        border: `0.5px solid ${T.cardBorder}`,
        borderRadius: mobile ? 16 : 14,
        boxShadow: T.cardShadow,
        padding: mobile ? "32px 24px" : "40px 36px",
        position: "relative",
      }}
    >
      {children}
    </div>
  );
}

// ── Formulário ────────────────────────────────────────────

interface FormCardProps {
  email: string;
  setEmail: (v: string) => void;
  loading: boolean;
  erro: string;
  canSubmit: boolean;
  isMobile: boolean;
  onSubmit: () => void;
  onBackToLogin: () => void;
}

function FormCard(props: FormCardProps) {
  const { email, setEmail, loading, erro, canSubmit, isMobile, onSubmit, onBackToLogin } = props;

  // Dimensionamento mobile ≠ desktop — v1 desktop preservado.
  const h1Size = isMobile ? 20 : 24;
  const h1LineHeight = isMobile ? 1.25 : 1.2;
  const labelMarginBottom = isMobile ? 6 : 8;
  const h1MarginBottom = isMobile ? 10 : 12;
  const fieldMarginBottom = isMobile ? 24 : 28;
  const inputHeight = isMobile ? 52 : 48;
  const inputRadius = isMobile ? 10 : 8;
  const inputFontSize = isMobile ? 15 : 14;
  const buttonHeight = isMobile ? 52 : 48;
  const buttonRadius = isMobile ? 10 : 8;
  const buttonFontSize = isMobile ? 15 : 14;
  const buttonMarginBottom = isMobile ? 16 : 20;

  return (
    <>
      {/* Header */}
      <div style={{ display: "flex", flexDirection: "column", marginBottom: 24 }}>
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 9,
            fontWeight: 500,
            color: T.slate,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            lineHeight: 1,
            marginBottom: labelMarginBottom,
          }}
        >
          Recuperação
        </span>
        <h2
          style={{
            fontFamily: "'Outfit', sans-serif",
            fontSize: h1Size,
            fontWeight: 600,
            color: T.chalk,
            lineHeight: h1LineHeight,
            letterSpacing: "-0.01em",
            margin: `0 0 ${h1MarginBottom}px 0`,
          }}
        >
          Recuperar senha
        </h2>
        <p
          style={{
            fontFamily: "'Outfit', sans-serif",
            fontSize: 13,
            fontWeight: 400,
            color: T.fog,
            lineHeight: 1.55,
            margin: 0,
          }}
        >
          Digite seu email e enviaremos um link para redefinir sua senha.
        </p>
      </div>

      {erro ? (
        <div
          role="alert"
          style={{
            background: "rgba(248,113,113,0.08)",
            border: "1px solid rgba(248,113,113,0.3)",
            color: T.red,
            padding: "10px 14px",
            borderRadius: 8,
            fontFamily: "'Outfit', sans-serif",
            fontSize: 13,
            marginBottom: 16,
          }}
        >
          {erro}
        </div>
      ) : null}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) onSubmit();
        }}
        noValidate
      >
        <div style={{ marginBottom: fieldMarginBottom }}>
          <label
            htmlFor="recover-email"
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 9,
              fontWeight: 500,
              color: T.fog,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              marginBottom: 10,
              display: "block",
              lineHeight: 1,
            }}
          >
            E-mail
          </label>
          <GradientInputShell height={inputHeight} radius={inputRadius}>
            <BareInput
              id="recover-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              fontSize={inputFontSize}
            />
          </GradientInputShell>
        </div>

        <button
          type="submit"
          disabled={!canSubmit}
          style={{
            width: "100%",
            height: buttonHeight,
            borderRadius: buttonRadius,
            border: "none",
            background: T.buttonBg,
            boxShadow: T.buttonShadow,
            color: T.ink,
            opacity: canSubmit ? 1 : 0.55,
            fontFamily: "'Outfit', sans-serif",
            fontSize: buttonFontSize,
            fontWeight: 600,
            letterSpacing: "0.01em",
            cursor: canSubmit ? "pointer" : "not-allowed",
            transition: "opacity 200ms ease",
            marginBottom: buttonMarginBottom,
            WebkitAppearance: "none",
            appearance: "none",
          }}
        >
          {loading ? "Enviando..." : "Enviar link de recuperação"}
        </button>

        <BackToLoginLink onClick={onBackToLogin} />
      </form>
    </>
  );
}

// ── Estado pós-envio ──────────────────────────────────────

function SentCard({
  email,
  isMobile,
  onBackToLogin,
  onResend,
}: {
  email: string;
  isMobile: boolean;
  onBackToLogin: () => void;
  onResend: () => void;
}) {
  const h1Size = isMobile ? 20 : 24;
  const h1LineHeight = isMobile ? 1.25 : 1.2;
  const labelMarginBottom = isMobile ? 6 : 8;
  const h1MarginBottom = isMobile ? 10 : 12;
  const headerMarginBottom = isMobile ? 24 : 28;
  const buttonHeight = isMobile ? 52 : 48;
  const buttonRadius = isMobile ? 10 : 8;
  const buttonFontSize = isMobile ? 15 : 14;

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", marginBottom: headerMarginBottom }}>
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 9,
            fontWeight: 500,
            color: T.sprout,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            lineHeight: 1,
            marginBottom: labelMarginBottom,
          }}
        >
          Link Enviado
        </span>
        <h2
          style={{
            fontFamily: "'Outfit', sans-serif",
            fontSize: h1Size,
            fontWeight: 600,
            color: T.chalk,
            lineHeight: h1LineHeight,
            letterSpacing: "-0.01em",
            margin: `0 0 ${h1MarginBottom}px 0`,
          }}
        >
          Email enviado
        </h2>
        <p
          style={{
            fontFamily: "'Outfit', sans-serif",
            fontSize: 13,
            fontWeight: 400,
            color: T.fog,
            lineHeight: 1.55,
            margin: 0,
          }}
        >
          Enviamos um link de recuperação para{" "}
          <strong style={{ color: T.bone, fontWeight: 500 }}>{email}</strong>. Verifique sua caixa
          de entrada e spam.
        </p>
      </div>

      <button
        type="button"
        onClick={onBackToLogin}
        style={{
          width: "100%",
          height: buttonHeight,
          borderRadius: buttonRadius,
          border: "none",
          background: T.buttonBg,
          boxShadow: T.buttonShadow,
          color: T.ink,
          fontFamily: "'Outfit', sans-serif",
          fontSize: buttonFontSize,
          fontWeight: 600,
          letterSpacing: "0.01em",
          cursor: "pointer",
          marginBottom: 16,
          WebkitAppearance: "none",
          appearance: "none",
        }}
      >
        Voltar ao login
      </button>

      <div style={{ display: "flex", justifyContent: "center" }}>
        <button
          type="button"
          onClick={onResend}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#FAF9F6"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#9C9686"; }}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            color: "#9C9686",
            fontFamily: "'Outfit', sans-serif",
            fontSize: 13,
            fontWeight: 400,
            cursor: "pointer",
            transition: "color 200ms ease",
          }}
        >
          Reenviar email
        </button>
      </div>
    </>
  );
}

// ── Link "Voltar ao login" ────────────────────────────────

function BackToLoginLink({ onClick }: { onClick: () => void }) {
  return (
    <div style={{ display: "flex", justifyContent: "center" }}>
      <button
        type="button"
        onClick={onClick}
        onMouseEnter={(e) => {
          const el = e.currentTarget as HTMLButtonElement;
          el.style.color = "#FAF9F6";
          el.querySelectorAll("path").forEach((p) => p.setAttribute("stroke", "#FAF9F6"));
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget as HTMLButtonElement;
          el.style.color = "#9C9686";
          el.querySelectorAll("path").forEach((p) => p.setAttribute("stroke", "#9C9686"));
        }}
        style={{
          background: "none",
          border: "none",
          padding: 0,
          color: "#9C9686",
          fontFamily: "'Outfit', sans-serif",
          fontSize: 13,
          fontWeight: 400,
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          transition: "color 200ms ease",
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M19 12H5M5 12L12 19M5 12L12 5"
            stroke="#9C9686"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Voltar ao login
      </button>
    </div>
  );
}

// ── Input ─────────────────────────────────────────────────

function GradientInputShell({
  children,
  invalid,
  height = 48,
  radius = 8,
}: {
  children: React.ReactNode;
  invalid?: boolean;
  height?: number;
  radius?: number;
}) {
  const [focused, setFocused] = useState(false);
  const borderColor = invalid
    ? "rgba(248,113,113,0.5)"
    : focused
    ? T.inputBorderFocus
    : T.inputBorder;
  const background = focused ? T.inputBgFocus : T.inputBgIdle;
  const boxShadow = focused && !invalid ? T.inputShadowFocus : "none";
  return (
    <div
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={() => setFocused(false)}
      style={{
        height,
        padding: "0 16px",
        background,
        border: `0.5px solid ${borderColor}`,
        borderRadius: radius,
        boxShadow,
        transition: "border-color 200ms ease, background 200ms ease, box-shadow 200ms ease",
        display: "flex",
        alignItems: "center",
      }}
    >
      {children}
    </div>
  );
}

type BareInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "ref" | "style" | "className"
> & { fontSize?: number };

function BareInput(props: BareInputProps) {
  const { fontSize = 14, ...rest } = props;
  return (
    <input
      {...rest}
      className="nexa-recover-input"
      style={{
        width: "100%",
        height: "100%",
        background: "transparent",
        color: T.chalk,
        fontFamily: "'Outfit', sans-serif",
        fontSize,
        fontWeight: 400,
        border: "none",
        outline: "none",
        padding: 0,
      }}
    />
  );
}

// ── Bloco N ──────────────────────────────────────────────

function BlocoN({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      aria-hidden="true"
      style={{ flexShrink: 0, display: "block" }}
    >
      <path
        d="M40 0 H370 L512 142 V472 Q512 512 472 512 H40 Q0 512 0 472 V40 Q0 0 40 0 Z"
        fill="#2A2822"
      />
      <polygon
        points="148,380 148,132 200,132 316,308 316,132 364,132 364,380 316,380 200,204 200,380"
        fill={T.sprout}
      />
    </svg>
  );
}
