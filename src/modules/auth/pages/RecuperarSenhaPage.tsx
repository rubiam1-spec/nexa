import { useEffect, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../../infra/supabase/supabaseClient";
import { useIsMobile } from "../../../shared/hooks/useIsMobile";

// Brand v7.3 — pré-auth, não depende do ThemeProvider. Paleta duplicada
// intencionalmente com Login/EsqueciSenha; extração prevista em sprint
// de refactoring dedicada.
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
  terracotta: "#D97706",
  yellow: "#FBBF24",
  layer0Left: "#080A08",
  layer0Right: "#0F0E0C",
  divider: "rgba(61,58,48,0.4)",
  cardBorder: "rgba(74,68,56,0.55)",
  cardBorderTerracotta: "rgba(217,119,6,0.25)",
  cardBorderSprout: "rgba(74,222,128,0.25)",
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
  glowSprout:
    "radial-gradient(ellipse at 20% 30%, rgba(74,222,128,0.05) 0%, transparent 55%), #080A08",
  glowSproutIntense:
    "radial-gradient(ellipse at 20% 30%, rgba(74,222,128,0.08) 0%, transparent 55%), #080A08",
  glowTerracotta:
    "radial-gradient(ellipse at 20% 30%, rgba(217,119,6,0.05) 0%, transparent 55%), #080A08",
};

const COPYRIGHT_YEAR = new Date().getFullYear();
const APP_VERSION = "V1.4.0";

const AUTOFILL_CSS = `
.nexa-reset-input:-webkit-autofill,
.nexa-reset-input:-webkit-autofill:hover,
.nexa-reset-input:-webkit-autofill:focus,
.nexa-reset-input:-webkit-autofill:active {
  -webkit-box-shadow: 0 0 0 100px transparent inset !important;
  -webkit-text-fill-color: #FAF9F6 !important;
  caret-color: #FAF9F6;
  transition: background-color 9999s ease-in-out 0s;
}
@keyframes nexa-spin {
  to { transform: rotate(360deg); }
}
`;

type StrengthLabel = "FRACA" | "MÉDIA" | "FORTE" | "";
interface Strength {
  score: 0 | 1 | 2 | 3 | 4 | 5;
  label: StrengthLabel;
  color: string;
  percent: number;
}

function calcPasswordStrength(password: string): Strength {
  if (password.length === 0) return { score: 0, label: "", color: "transparent", percent: 0 };
  let score = 0;
  if (password.length >= 6) score++;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  // eslint-disable-next-line no-useless-escape
  if (/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)) score++;
  const percent = score * 20;
  if (score <= 2) {
    return {
      score: score as 0 | 1 | 2,
      label: "FRACA",
      color: score === 1 ? T.red : T.terracotta,
      percent,
    };
  }
  if (score === 3) return { score: 3, label: "MÉDIA", color: T.yellow, percent };
  return { score: score as 4 | 5, label: "FORTE", color: T.sprout, percent };
}

export default function RecuperarSenhaPage() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState(false);
  const [tokenValido, setTokenValido] = useState<boolean | null>(null);

  // LÓGICA PRESERVADA — polling do hash, triple guard, onAuthStateChange.
  // Token de recuperação pode demorar a materializar a sessão no mobile.
  useEffect(() => {
    if (!supabase) {
      setTokenValido(false);
      return;
    }

    let cancelled = false;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (
        !cancelled &&
        (event === "SIGNED_IN" ||
          event === "PASSWORD_RECOVERY" ||
          event === "TOKEN_REFRESHED")
      ) {
        setTokenValido(true);
      }
    });

    async function waitForSession() {
      const {
        data: { session },
      } = await supabase!.auth.getSession();
      if (session && !cancelled) {
        setTokenValido(true);
        return;
      }

      // Polling — hash processing can be slow on mobile.
      const hasHash = window.location.hash.includes("access_token");
      if (hasHash) {
        for (let i = 0; i < 10; i++) {
          await new Promise((r) => setTimeout(r, 500));
          if (cancelled) return;
          const {
            data: { session: s },
          } = await supabase!.auth.getSession();
          if (s) {
            setTokenValido(true);
            return;
          }
        }
      }

      // Final check after extra wait.
      await new Promise((r) => setTimeout(r, 2000));
      if (cancelled) return;
      const {
        data: { session: final },
      } = await supabase!.auth.getSession();
      if (final) {
        setTokenValido(true);
        return;
      }

      setTokenValido(false);
    }

    void waitForSession();

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit() {
    setErro("");
    if (senha.length < 6) {
      setErro("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (senha !== confirmar) {
      setErro("As senhas não coincidem.");
      return;
    }
    if (!supabase) {
      setErro("Supabase não configurado.");
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      setErro("Sessão expirada. Solicite um novo link.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setLoading(false);

    if (error) {
      setErro(
        error.message.includes("session")
          ? "Sessão expirada. Solicite um novo link."
          : "Não foi possível atualizar a senha. Tente novamente.",
      );
    } else {
      setSucesso(true);
      setTimeout(() => navigate("/entrar"), 2500);
    }
  }

  const strength = calcPasswordStrength(senha);
  const confirmInvalid = confirmar.length > 0 && confirmar !== senha;
  const canSubmit = senha.length >= 6 && senha === confirmar && !loading;

  // ── Estado A — verificando link ──
  if (tokenValido === null) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: T.layer0Left,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <style>{AUTOFILL_CSS}</style>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 24,
          }}
        >
          <BlocoN size={48} />
          <Spinner size={36} />
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
            Verificando link
          </span>
        </div>
      </div>
    );
  }

  // ── Estado B — link expirado ──
  if (tokenValido === false) {
    return (
      <TwoPaneShell
        isMobile={isMobile}
        leftGlow={T.glowTerracotta}
        heroHeadline="O link expirou."
        heroSubline="Sem problema — basta solicitar outro."
        heroHeadlineSize={38}
        heroSublineSize={15}
        card={
          <ExpiredCard
            onRequestNew={() => navigate("/auth/esqueci-senha")}
            onBackToLogin={() => navigate("/entrar")}
          />
        }
        cardMaxWidth={360}
        cardPadding="36px 32px"
        cardBorder={T.cardBorderTerracotta}
      />
    );
  }

  // ── Estado D — sucesso ──
  if (sucesso) {
    return (
      <TwoPaneShell
        isMobile={isMobile}
        leftGlow={T.glowSproutIntense}
        heroHeadline="Senha redefinida."
        heroSubline="Redirecionando para o login..."
        heroHeadlineSize={38}
        heroSublineSize={15}
        card={<SuccessCard />}
        cardMaxWidth={360}
        cardPadding="36px 32px"
        cardBorder={T.cardBorderSprout}
      />
    );
  }

  // ── Estado C — formulário de nova senha ──
  return (
    <TwoPaneShell
      isMobile={isMobile}
      leftGlow={T.glowSprout}
      heroHeadline="Defina sua nova senha."
      heroSubline="Sua senha protege todo o acesso comercial."
      heroHeadlineSize={48}
      heroSublineSize={16}
      card={
        <FormCard
          senha={senha}
          setSenha={setSenha}
          confirmar={confirmar}
          setConfirmar={setConfirmar}
          strength={strength}
          confirmInvalid={confirmInvalid}
          canSubmit={canSubmit}
          loading={loading}
          erro={erro}
          onSubmit={() => void handleSubmit()}
          onBackToLogin={() => navigate("/entrar")}
        />
      }
      cardMaxWidth={400}
      cardPadding="40px 36px"
      cardBorder={T.cardBorder}
    />
  );
}

// ── Shell split 50/50 (desktop) + stacked fallback (mobile) ───

function TwoPaneShell({
  isMobile,
  leftGlow,
  heroHeadline,
  heroSubline,
  heroHeadlineSize,
  heroSublineSize,
  card,
  cardMaxWidth,
  cardPadding,
  cardBorder,
}: {
  isMobile: boolean;
  leftGlow: string;
  heroHeadline: string;
  heroSubline: string;
  heroHeadlineSize: number;
  heroSublineSize: number;
  card: React.ReactNode;
  cardMaxWidth: number;
  cardPadding: string;
  cardBorder: string;
}) {
  if (isMobile) {
    // Fallback mobile simples — sprint v1.1 fará o refinamento de 4 zonas.
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
        <div style={{ background: leftGlow, padding: "32px 24px", display: "flex", flexDirection: "column", gap: 24 }}>
          <BrandLockup compact />
          <HeroBlock
            headline={heroHeadline}
            subline={heroSubline}
            headlineSize={28}
            sublineSize={14}
          />
        </div>
        <div style={{ padding: "0 24px 24px 24px", background: T.layer0Left, flex: 1 }}>
          <CardShell maxWidth="100%" padding="32px 24px" border={cardBorder}>
            {card}
          </CardShell>
        </div>
        <div
          style={{
            padding: "20px 24px calc(24px + env(safe-area-inset-bottom)) 24px",
            borderTop: `0.5px solid ${T.divider}`,
            display: "flex",
            justifyContent: "center",
            background: T.layer0Left,
          }}
        >
          <SessionMetadata />
        </div>
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
      {/* ESQUERDO */}
      <div
        style={{
          background: leftGlow,
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
          <HeroBlock
            headline={heroHeadline}
            subline={heroSubline}
            headlineSize={heroHeadlineSize}
            sublineSize={heroSublineSize}
          />
        </div>
        <LeftFooter />
      </div>

      {/* DIREITO */}
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
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <CardShell maxWidth={cardMaxWidth} padding={cardPadding} border={cardBorder}>
            {card}
          </CardShell>
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

// ── Cards por estado ─────────────────────────────────────

function ExpiredCard({
  onRequestNew,
  onBackToLogin,
}: {
  onRequestNew: () => void;
  onBackToLogin: () => void;
}) {
  return (
    <>
      <AlertTriangleIcon />
      <div style={{ height: 16 }} />
      <span
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 9,
          fontWeight: 500,
          color: T.terracotta,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          lineHeight: 1,
          display: "block",
          marginBottom: 10,
        }}
      >
        Link inválido
      </span>
      <h2
        style={{
          fontFamily: "'Outfit', sans-serif",
          fontSize: 22,
          fontWeight: 600,
          color: T.chalk,
          lineHeight: 1.25,
          letterSpacing: "-0.01em",
          margin: "0 0 12px 0",
        }}
      >
        Este link já foi usado ou expirou
      </h2>
      <p
        style={{
          fontFamily: "'Outfit', sans-serif",
          fontSize: 13,
          fontWeight: 400,
          color: T.fog,
          lineHeight: 1.55,
          margin: "0 0 24px 0",
        }}
      >
        Para sua segurança, links de recuperação são válidos por 1 hora e podem ser usados
        apenas uma vez.
      </p>
      <PrimaryButton onClick={onRequestNew} label="Solicitar novo link" />
      <div style={{ height: 16 }} />
      <BackToLoginLink onClick={onBackToLogin} />
    </>
  );
}

function SuccessCard() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(74,222,128,0.20) 0%, rgba(74,222,128,0.05) 80%)",
          border: `0.5px solid rgba(74,222,128,0.4)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 20,
        }}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke={T.sprout}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <span
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 9,
          fontWeight: 500,
          color: T.sprout,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          lineHeight: 1,
          marginBottom: 10,
        }}
      >
        Senha atualizada
      </span>
      <h2
        style={{
          fontFamily: "'Outfit', sans-serif",
          fontSize: 22,
          fontWeight: 600,
          color: T.chalk,
          lineHeight: 1.25,
          letterSpacing: "-0.01em",
          margin: "0 0 12px 0",
        }}
      >
        Tudo certo!
      </h2>
      <p
        style={{
          fontFamily: "'Outfit', sans-serif",
          fontSize: 13,
          fontWeight: 400,
          color: T.fog,
          lineHeight: 1.55,
          margin: "0 0 20px 0",
          maxWidth: 280,
        }}
      >
        Sua senha foi atualizada com sucesso. Você será redirecionado ao login em instantes.
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Spinner size={12} />
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
          Redirecionando
        </span>
      </div>
    </div>
  );
}

interface FormCardProps {
  senha: string;
  setSenha: (v: string) => void;
  confirmar: string;
  setConfirmar: (v: string) => void;
  strength: Strength;
  confirmInvalid: boolean;
  canSubmit: boolean;
  loading: boolean;
  erro: string;
  onSubmit: () => void;
  onBackToLogin: () => void;
}

function FormCard(props: FormCardProps) {
  const {
    senha,
    setSenha,
    confirmar,
    setConfirmar,
    strength,
    confirmInvalid,
    canSubmit,
    loading,
    erro,
    onSubmit,
    onBackToLogin,
  } = props;

  return (
    <>
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
            marginBottom: 8,
          }}
        >
          Redefinição
        </span>
        <h2
          style={{
            fontFamily: "'Outfit', sans-serif",
            fontSize: 24,
            fontWeight: 600,
            color: T.chalk,
            lineHeight: 1.2,
            letterSpacing: "-0.01em",
            margin: "0 0 12px 0",
          }}
        >
          Criar nova senha
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
          Escolha uma senha com pelo menos 6 caracteres.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) onSubmit();
        }}
        noValidate
      >
        {/* Nova senha */}
        <div style={{ marginBottom: 12 }}>
          <FieldLabel htmlFor="reset-new-password">Nova senha</FieldLabel>
          <GradientInputShell>
            <BareInput
              id="reset-new-password"
              type="password"
              autoComplete="new-password"
              placeholder="Mínimo 6 caracteres"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              style={{ letterSpacing: senha.length > 0 ? "0.15em" : "normal" }}
            />
          </GradientInputShell>
        </div>

        {/* Indicador de força — renderiza só com ≥ 1 caractere */}
        {senha.length > 0 ? (
          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                width: "100%",
                height: 3,
                background: "rgba(61,58,48,0.4)",
                borderRadius: 2,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${strength.percent}%`,
                  height: "100%",
                  background: strength.color,
                  borderRadius: 2,
                  transition: "width 300ms ease, background-color 300ms ease",
                }}
              />
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: 8,
              }}
            >
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 9,
                  fontWeight: 500,
                  color: T.fog,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  lineHeight: 1,
                }}
              >
                Força da senha
              </span>
              {strength.label ? (
                <span
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 9,
                    fontWeight: 500,
                    color: strength.color,
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    lineHeight: 1,
                  }}
                >
                  {strength.label}
                </span>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* Confirmar senha */}
        <div style={{ marginBottom: 28 }}>
          <FieldLabel htmlFor="reset-confirm-password">Confirmar senha</FieldLabel>
          <GradientInputShell invalid={confirmInvalid}>
            <BareInput
              id="reset-confirm-password"
              type="password"
              autoComplete="new-password"
              placeholder="Repita a senha"
              value={confirmar}
              onChange={(e) => setConfirmar(e.target.value)}
              style={{ letterSpacing: confirmar.length > 0 ? "0.15em" : "normal" }}
            />
          </GradientInputShell>
          {confirmInvalid ? (
            <span
              style={{
                fontFamily: "'Outfit', sans-serif",
                fontSize: 11,
                color: T.red,
                marginTop: 6,
                display: "block",
              }}
            >
              As senhas não coincidem.
            </span>
          ) : null}
        </div>

        {erro ? (
          <div
            role="alert"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "rgba(248,113,113,0.08)",
              border: "1px solid rgba(248,113,113,0.3)",
              color: T.red,
              padding: "10px 14px",
              borderRadius: 8,
              fontFamily: "'Outfit', sans-serif",
              fontSize: 12,
              marginBottom: 16,
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ flexShrink: 0 }}
              aria-hidden="true"
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <span>{erro}</span>
          </div>
        ) : null}

        <button
          type="submit"
          disabled={!canSubmit}
          style={{
            width: "100%",
            height: 48,
            borderRadius: 8,
            border: "none",
            background: T.buttonBg,
            boxShadow: T.buttonShadow,
            color: T.ink,
            opacity: canSubmit ? 1 : 0.55,
            fontFamily: "'Outfit', sans-serif",
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: "0.01em",
            cursor: canSubmit ? "pointer" : "not-allowed",
            transition: "opacity 200ms ease",
            marginBottom: 20,
            WebkitAppearance: "none",
            appearance: "none",
          }}
        >
          {loading ? "Salvando..." : "Salvar nova senha"}
        </button>

        <BackToLoginLink onClick={onBackToLogin} />
      </form>
    </>
  );
}

// ── Helpers compartilhados ───────────────────────────────

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

function HeroBlock({
  headline,
  subline,
  headlineSize,
  sublineSize,
}: {
  headline: string;
  subline: string;
  headlineSize: number;
  sublineSize: number;
}) {
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
        {headline}
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
        {subline}
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

function CardShell({
  children,
  maxWidth,
  padding,
  border,
}: {
  children: React.ReactNode;
  maxWidth: number | string;
  padding: string;
  border: string;
}) {
  return (
    <div
      style={{
        width: "100%",
        maxWidth,
        background: T.cardBg,
        border: `0.5px solid ${border}`,
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

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label
      htmlFor={htmlFor}
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
      {children}
    </label>
  );
}

function GradientInputShell({
  children,
  invalid,
}: {
  children: React.ReactNode;
  invalid?: boolean;
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
        height: 48,
        padding: "0 16px",
        background,
        border: `0.5px solid ${borderColor}`,
        borderRadius: 8,
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
  "ref" | "className"
>;

function BareInput(props: BareInputProps) {
  const { style, ...rest } = props;
  return (
    <input
      {...rest}
      className="nexa-reset-input"
      style={{
        width: "100%",
        height: "100%",
        background: "transparent",
        color: T.chalk,
        fontFamily: "'Outfit', sans-serif",
        fontSize: 14,
        fontWeight: 400,
        border: "none",
        outline: "none",
        padding: 0,
        ...style,
      }}
    />
  );
}

function PrimaryButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "100%",
        height: 48,
        borderRadius: 8,
        border: "none",
        background: T.buttonBg,
        boxShadow: T.buttonShadow,
        color: T.ink,
        fontFamily: "'Outfit', sans-serif",
        fontSize: 14,
        fontWeight: 600,
        letterSpacing: "0.01em",
        cursor: "pointer",
        transition: "opacity 200ms ease",
        WebkitAppearance: "none",
        appearance: "none",
      }}
    >
      {label}
    </button>
  );
}

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

// ── SVGs ─────────────────────────────────────────────────

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

function Spinner({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      aria-hidden="true"
      style={{ animation: "nexa-spin 900ms linear infinite", display: "block" }}
    >
      <circle
        cx="18"
        cy="18"
        r="15"
        stroke="rgba(156,150,134,0.25)"
        strokeWidth="2"
        fill="none"
      />
      <path
        d="M 18 3 A 15 15 0 0 1 33 18"
        stroke={T.sprout}
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

function AlertTriangleIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke={T.terracotta}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}
