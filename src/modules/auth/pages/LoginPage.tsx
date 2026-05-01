import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { useAuth } from "../../../app/contexts/AuthContext";
import { isMockFallbackEnabled } from "../../../shared/config/runtime";
import { supabase } from "../../../infra/supabase/supabaseClient";
import { useIsMobile } from "../../../shared/hooks/useIsMobile";
import LoginMural from "../components/LoginMural";
import { useLoginMural } from "../hooks/useLoginMural";
import { SHOW_LOGIN_MURAL } from "../config";

// Brand v7.3 — login é pré-auth, não depende do ThemeProvider.
// Camadas de superfície, glow contextual e gradientes aplicados inline.
const T = {
  ink: "#12110F",
  carbon: "#1C1B18",
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
  inputBorderInvalid: "rgba(248,113,113,0.5)",
  // v7.3: gradiente do card mais perceptível + luz "vindo de cima"
  cardBg: "radial-gradient(ellipse at 50% -20%, #23211D 0%, #141311 75%)",
  cardShadow:
    "0 16px 48px rgba(0,0,0,0.35), 0 1px 0 rgba(255,255,255,0.02) inset",
  inputBgIdle: "linear-gradient(180deg, #2A2822 0%, #242220 100%)",
  // v7.3: glow 8% → 10% para ser visível
  inputBgFocus:
    "radial-gradient(ellipse at center, rgba(74,222,128,0.10) 0%, #2A2822 80%)",
  // v7.3: outer bloom no input focus
  inputShadowFocus: "0 0 0 3px rgba(74,222,128,0.06)",
  buttonBg: "linear-gradient(180deg, #4ADE80 0%, #3FC970 100%)",
  buttonShadow: "0 1px 0 rgba(255,255,255,0.15) inset",
  // v7.3: glow 4% → 5% no canto do painel esquerdo
  leftGlow:
    "radial-gradient(ellipse at 20% 30%, rgba(74,222,128,0.05) 0%, transparent 55%), #080A08",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const COPYRIGHT_YEAR = new Date().getFullYear();
const APP_VERSION = "V1.4.0";

const STATIC_HEADLINE = "A plataforma comercial das incorporadoras.";
const STATIC_SUBLINE = "Do lead ao contrato. Sem zona cega.";

// v7.3: CSS global scoped para anular o amarelo/lilás do autofill do Chrome.
// O input é bare — o container externo carrega o gradiente. Autofill tentaria
// pintar fundo do próprio <input>; forçamos transparente e mantemos a cor Chalk.
const AUTOFILL_CSS = `
.nexa-login-input:-webkit-autofill,
.nexa-login-input:-webkit-autofill:hover,
.nexa-login-input:-webkit-autofill:focus,
.nexa-login-input:-webkit-autofill:active {
  -webkit-box-shadow: 0 0 0 100px transparent inset !important;
  -webkit-text-fill-color: #FAF9F6 !important;
  caret-color: #FAF9F6;
  transition: background-color 9999s ease-in-out 0s;
}
`;

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const returnTo = (location.state as { from?: string } | null)?.from || "/";
  const passwordInputRef = useRef<HTMLInputElement | null>(null);
  const {
    errorMessage: authErrorMessage,
    isAuthenticated,
    isLoading,
    signIn,
    signInMock,
    signOut,
    status,
  } = useAuth();
  const [email, setEmail] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [processingInvite, setProcessingInvite] = useState(false);
  const isMobile = useIsMobile();

  const { item: muralItem } = useLoginMural();

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash || !supabase) return;
    const params = new URLSearchParams(hash.substring(1));
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    const type = params.get("type");
    if (!accessToken || !(type === "invite" || type === "signup" || type === "recovery" || type === "magiclink")) return;
    setProcessingInvite(true);
    supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken ?? "" }).then(({ data, error }) => {
      if (error) {
        console.error("[NEXA] Erro ao processar convite:", error);
        setProcessingInvite(false);
        return;
      }
      if (data.session) {
        window.history.replaceState({}, document.title, window.location.pathname);
        if (type === "invite") navigate("/auth/definir-senha");
        else if (type === "recovery") navigate("/auth/recuperar-senha");
        else navigate("/selecionar-empreendimento");
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isLoading && isAuthenticated && !processingInvite) navigate(returnTo, { replace: true });
  }, [isAuthenticated, isLoading, navigate, processingInvite, returnTo]);

  useEffect(() => {
    if (searchParams.get("prefill") !== "1") return;
    try {
      const lastEmail = window.localStorage.getItem("nexa:last_email");
      if (lastEmail) {
        setEmail(lastEmail);
        setEmailTouched(true);
        window.setTimeout(() => passwordInputRef.current?.focus(), 50);
      }
    } catch { /* storage indisponível */ }
    setSearchParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const emailInvalid = emailTouched && email.length > 0 && !EMAIL_RE.test(email);
  const canSubmit = email.trim().length > 0 && password.length > 0 && !submitting;

  async function handleSignIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const error = await signIn(email.trim(), password);
      if (error) {
        setErrorMessage(error);
        return;
      }
      navigate(returnTo, { replace: true });
    } finally {
      setSubmitting(false);
    }
  }

  function handleMockSignIn() {
    signInMock();
    navigate(returnTo, { replace: true });
  }

  const canUseRealLogin =
    status === "unauthenticated" || status === "error" || status === "profile_missing";
  const canUseMockFallback = status === "env_not_configured" && isMockFallbackEnabled;

  const form = (
    <LoginForm
      isMobile={isMobile}
      email={email}
      setEmail={(v) => { setEmail(v); if (!emailTouched) setEmailTouched(true); }}
      onEmailBlur={() => setEmailTouched(true)}
      emailInvalid={emailInvalid}
      password={password}
      setPassword={setPassword}
      passwordRef={passwordInputRef}
      showPassword={showPassword}
      togglePassword={() => setShowPassword((v) => !v)}
      onSubmit={handleSignIn}
      submitting={submitting}
      canSubmit={canSubmit}
      errorMessage={errorMessage}
      navigateTo={navigate}
      canUseRealLogin={canUseRealLogin}
      canUseMockFallback={canUseMockFallback}
      onMockSignIn={handleMockSignIn}
      status={status}
      authErrorMessage={authErrorMessage}
      onSignOut={() => void signOut()}
      showLoading={(isLoading && !isAuthenticated) || processingInvite}
      processingInvite={processingInvite}
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
        <div
          style={{
            padding: "40px 24px 32px 24px",
            background: T.layer0Left,
          }}
        >
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
            {STATIC_HEADLINE}
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
            {STATIC_SUBLINE}
          </p>
          {SHOW_LOGIN_MURAL && muralItem ? (
            <div style={{ marginTop: 16 }}>
              <LoginMural item={muralItem} compact />
            </div>
          ) : null}
        </div>

        {/* ZONA C — card de acesso */}
        <div
          style={{
            padding: "0 24px 32px 24px",
            background: T.layer0Left,
            flex: 1,
          }}
        >
          <div
            style={{
              width: "100%",
              background: T.cardBg,
              border: `0.5px solid ${T.cardBorder}`,
              borderRadius: 16,
              boxShadow: T.cardShadow,
              padding: "32px 24px",
              position: "relative",
            }}
          >
            {form}
          </div>
        </div>

        {/* ZONA D — footer institucional */}
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
      {/* ESQUERDO — 3 zonas: brand / manifesto (flex:1) / rodapé */}
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
          }}
        >
          <ManifestoHeadline size={48} />
          <ManifestoSubline size={16} />
          {SHOW_LOGIN_MURAL && muralItem ? <LoginMural item={muralItem} /> : null}
        </div>
        <LeftFooter />
      </div>

      {/* DIREITO — 3 zonas equivalentes: spacer 40 / card (flex:1) / rodapé */}
      <div
        style={{
          background: T.layer0Right,
          borderLeft: `0.5px solid ${T.divider}`,
          padding: "48px 56px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Zona topo — espaçador equivalente ao BrandLockup (40px) */}
        <div style={{ height: 40 }} />
        {/* Zona centro — card */}
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <FormCard>{form}</FormCard>
        </div>
        {/* Zona rodapé — metadado alinhado ao rodapé esquerdo */}
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

function ManifestoHeadline({ size }: { size: number }) {
  return (
    <h1
      style={{
        fontFamily: "'Instrument Serif', Georgia, serif",
        fontStyle: "italic",
        fontSize: size,
        lineHeight: 1.1,
        letterSpacing: "-0.015em",
        fontWeight: 400,
        color: T.chalk,
        margin: 0,
      }}
    >
      {STATIC_HEADLINE}
    </h1>
  );
}

function ManifestoSubline({ size }: { size: number }) {
  return (
    <p
      style={{
        fontFamily: "'Outfit', sans-serif",
        fontWeight: 400,
        fontSize: size,
        lineHeight: 1.5,
        color: T.fog,
        margin: 0,
        maxWidth: 440,
      }}
    >
      {STATIC_SUBLINE}
    </p>
  );
}

function LeftFooter({ stacked = false }: { stacked?: boolean }) {
  const label: CSSProperties = {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 9,
    fontWeight: 500,
    color: T.clay,
    letterSpacing: "0.16em",
    textTransform: "uppercase",
    lineHeight: 1,
  };
  const copyright = <span style={label}>© NEXA · {COPYRIGHT_YEAR}</span>;
  const env = (
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
  );
  const version = <span style={label}>{APP_VERSION}</span>;

  if (stacked) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          paddingTop: 24,
          borderTop: `0.5px solid ${T.divider}`,
        }}
      >
        {copyright}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {env}
          {version}
        </div>
      </div>
    );
  }
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
      {copyright}
      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        {env}
        {version}
      </div>
    </div>
  );
}

// ── Painel direito ────────────────────────────────────────

function FormCard({
  children,
  maxWidth = 400,
  padding = "40px 36px",
}: {
  children: React.ReactNode;
  maxWidth?: number | string;
  padding?: string;
}) {
  return (
    <div
      style={{
        width: "100%",
        maxWidth,
        background: T.cardBg,
        border: `0.5px solid ${T.cardBorder}`,
        borderRadius: 14,
        boxShadow: T.cardShadow,
        padding,
        position: "relative",
      }}
    >
      {children}
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

// ── Formulário ────────────────────────────────────────────

interface LoginFormProps {
  isMobile: boolean;
  email: string;
  setEmail: (v: string) => void;
  onEmailBlur: () => void;
  emailInvalid: boolean;
  password: string;
  setPassword: (v: string) => void;
  passwordRef?: React.RefObject<HTMLInputElement | null>;
  showPassword: boolean;
  togglePassword: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  submitting: boolean;
  canSubmit: boolean;
  errorMessage: string | null;
  navigateTo: (path: string) => void;
  canUseRealLogin: boolean;
  canUseMockFallback: boolean;
  onMockSignIn: () => void;
  status: string;
  authErrorMessage: string | null;
  onSignOut: () => void;
  showLoading: boolean;
  processingInvite: boolean;
}

function LoginForm(props: LoginFormProps) {
  const {
    isMobile, email, setEmail, onEmailBlur, emailInvalid,
    password, setPassword, passwordRef, showPassword, togglePassword,
    onSubmit, submitting, canSubmit, errorMessage,
    navigateTo, canUseRealLogin, canUseMockFallback, onMockSignIn,
    status, authErrorMessage, onSignOut, showLoading, processingInvite,
  } = props;

  // v7.4 — dimensionamento mobile ≠ desktop (preserva desktop v7.3)
  const inputFontSize = isMobile ? 15 : 14;
  const inputHeight = isMobile ? 52 : 48;
  const inputRadius = isMobile ? 10 : 8;
  const h1FontSize = isMobile ? 20 : 24;
  const headerMarginBottom = isMobile ? 28 : 32;
  const emailMarginBottom = isMobile ? 20 : 16;
  const passwordMarginBottom = isMobile ? 12 : 10;
  const esqueciMarginBottom = isMobile ? 28 : 32;
  const esqueciFontSize = isMobile ? 13 : 12;
  const buttonHeight = isMobile ? 52 : 48;
  const buttonFontSize = isMobile ? 15 : 14;
  const headerLabelMarginBottom = isMobile ? 6 : 8;

  return (
    <div>
      {/* Header do card */}
      <div style={{ display: "flex", flexDirection: "column", gap: headerLabelMarginBottom, marginBottom: headerMarginBottom }}>
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 9,
            fontWeight: 500,
            color: T.slate,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            lineHeight: 1,
          }}
        >
          Acesso
        </span>
        <h2
          style={{
            fontFamily: "'Outfit', sans-serif",
            fontSize: h1FontSize,
            fontWeight: 600,
            color: T.chalk,
            lineHeight: isMobile ? 1.25 : 1.2,
            letterSpacing: "-0.01em",
            margin: 0,
          }}
        >
          Entrar na plataforma
        </h2>
      </div>

      {status === "env_not_configured" ? (
        <p style={{ color: "#D97706", fontSize: 12, marginBottom: 16 }}>
          {isMockFallbackEnabled
            ? "Ambiente Supabase não configurado. Modo mock disponível."
            : "Ambiente Supabase não configurado."}
        </p>
      ) : null}

      {status === "profile_missing" ? (
        <p style={{ color: "#D97706", fontSize: 12, marginBottom: 16 }}>
          {authErrorMessage ?? "Usuário autenticado sem perfil válido."}
        </p>
      ) : null}

      {showLoading ? (
        <p style={{ color: T.fog, fontSize: 13, marginBottom: 16 }}>
          {processingInvite ? "Processando convite..." : "Carregando sessão..."}
        </p>
      ) : null}

      {errorMessage ? (
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
          {errorMessage}
        </div>
      ) : null}

      {canUseRealLogin ? (
        <form onSubmit={onSubmit} noValidate>
          <div style={{ marginBottom: emailMarginBottom }}>
            <InputField
              id="login-email"
              label="E-mail"
              invalid={emailInvalid}
              invalidHint="E-mail inválido."
            >
              <GradientInputShell invalid={emailInvalid} height={inputHeight} radius={inputRadius}>
                <BareInput
                  id="login-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={onEmailBlur}
                  fontSize={inputFontSize}
                />
              </GradientInputShell>
            </InputField>
          </div>

          <div style={{ marginBottom: passwordMarginBottom }}>
            <InputField id="login-password" label="Senha">
              <GradientInputShell
                height={inputHeight}
                radius={inputRadius}
                action={
                  <button
                    type="button"
                    onClick={togglePassword}
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    style={{
                      flexShrink: 0,
                      width: isMobile ? 28 : 24,
                      height: isMobile ? 28 : 24,
                      border: "none",
                      background: "transparent",
                      color: T.fog,
                      cursor: "pointer",
                      padding: 0,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {showPassword ? <EyeOffIcon size={isMobile ? 18 : 16} /> : <EyeIcon size={isMobile ? 18 : 16} />}
                  </button>
                }
              >
                <BareInput
                  id="login-password"
                  ref={passwordRef}
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  fontSize={inputFontSize}
                />
              </GradientInputShell>
            </InputField>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: esqueciMarginBottom }}>
            <button
              type="button"
              onClick={() => navigateTo("/auth/esqueci-senha")}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#FAF9F6"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#9C9686"; }}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                color: "#9C9686",
                fontFamily: "'Outfit', sans-serif",
                fontSize: esqueciFontSize,
                fontWeight: 400,
                cursor: "pointer",
                transition: "color 200ms ease",
              }}
            >
              Esqueci minha senha
            </button>
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            style={{
              width: "100%",
              height: buttonHeight,
              borderRadius: inputRadius,
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
              WebkitAppearance: "none",
              appearance: "none",
            }}
          >
            {submitting ? "Entrando..." : "Entrar"}
          </button>
        </form>
      ) : null}

      {status === "profile_missing" ? (
        <button
          type="button"
          onClick={onSignOut}
          style={{
            marginTop: 16,
            width: "100%",
            height: 40,
            borderRadius: 8,
            background: "transparent",
            color: T.bone,
            border: "1px solid rgba(156,150,134,0.2)",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Limpar sessão atual
        </button>
      ) : null}

      {canUseMockFallback ? (
        <button
          type="button"
          onClick={onMockSignIn}
          style={{
            marginTop: 16,
            width: "100%",
            height: 40,
            borderRadius: 8,
            background: "transparent",
            color: T.bone,
            border: "1px solid rgba(156,150,134,0.2)",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Entrar com mock
        </button>
      ) : null}
    </div>
  );
}

// ── Campos do formulário ──────────────────────────────────

function InputField({
  id,
  label,
  invalid,
  invalidHint,
  children,
}: {
  id: string;
  label: string;
  invalid?: boolean;
  invalidHint?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <label
        htmlFor={id}
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 9,
          fontWeight: 500,
          color: T.fog,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          marginBottom: 10,
          lineHeight: 1,
        }}
      >
        {label}
      </label>
      {children}
      {invalid && invalidHint ? (
        <span
          style={{
            fontFamily: "'Outfit', sans-serif",
            fontSize: 11,
            color: T.red,
            marginTop: 6,
          }}
        >
          {invalidHint}
        </span>
      ) : null}
    </div>
  );
}

// Container gradient que reage a focus-within. O input interno é bare
// (transparente) — evita "input dentro do input" no autofill do Chrome.
function GradientInputShell({
  children,
  action,
  invalid,
  height = 48,
  radius = 8,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
  invalid?: boolean;
  height?: number;
  radius?: number;
}) {
  const [focused, setFocused] = useState(false);
  const borderColor = invalid
    ? T.inputBorderInvalid
    : focused
    ? T.inputBorderFocus
    : T.inputBorder;
  const background = invalid ? T.inputBgIdle : focused ? T.inputBgFocus : T.inputBgIdle;
  const boxShadow = focused && !invalid ? T.inputShadowFocus : "none";
  return (
    <div
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={() => setFocused(false)}
      style={{
        height,
        padding: action ? "0 12px 0 16px" : "0 16px",
        background,
        border: `0.5px solid ${borderColor}`,
        borderRadius: radius,
        boxShadow,
        transition: "border-color 200ms ease, background 200ms ease, box-shadow 200ms ease",
        display: "flex",
        alignItems: "center",
        gap: action ? 8 : 0,
      }}
    >
      <div style={{ flex: 1, minWidth: 0, height: "100%", display: "flex", alignItems: "center" }}>
        {children}
      </div>
      {action}
    </div>
  );
}

interface BareInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "ref" | "style" | "className"> {
  fontSize: number;
}

const BareInput = (() => {
  const Comp = (
    props: BareInputProps & { forwardRef?: React.RefObject<HTMLInputElement | null> },
  ) => {
    const { fontSize, forwardRef, ...rest } = props;
    const style: CSSProperties = {
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
    };
    return (
      <input
        {...rest}
        ref={forwardRef ?? undefined}
        className="nexa-login-input"
        style={style}
      />
    );
  };
  return function BareInputAdapter({
    ref,
    ...props
  }: BareInputProps & { ref?: React.RefObject<HTMLInputElement | null> }) {
    return <Comp {...props} forwardRef={ref} />;
  };
})();

// ── Ícones ────────────────────────────────────────────────

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

function EyeIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}
