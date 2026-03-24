import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../app/contexts/AuthContext";
import { isMockFallbackEnabled } from "../../../shared/config/runtime";
import NexaIcon from "../../../shared/components/NexaIcon";

export default function LoginPage() {
  const navigate = useNavigate();
  const { errorMessage: authErrorMessage, isAuthenticated, isLoading, signIn, signInMock, signOut, status } =
    useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSignIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    const error = await signIn(email, password);
    if (error) {
      setErrorMessage(error);
      return;
    }
    navigate("/");
  }

  function handleMockSignIn() {
    signInMock();
    navigate("/");
  }

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate("/");
    }
  }, [isAuthenticated, isLoading, navigate]);

  const canUseRealLogin =
    status === "unauthenticated" || status === "error" || status === "profile_missing";
  const canUseMockFallback = status === "env_not_configured" && isMockFallbackEnabled;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--color-ink)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          background: "var(--color-carbon)",
          border: "1px solid var(--color-stone)",
          borderRadius: 12,
          padding: 40,
          maxWidth: 380,
          width: "100%",
        }}
      >
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <NexaIcon size={28} />
          <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: "0.1em", color: "var(--color-chalk)" }}>
            NEXA
          </span>
        </div>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-fog)", marginBottom: 32 }}>
          Plataforma comercial imobiliária
        </p>

        {isLoading ? (
          <p style={{ color: "var(--color-fog)", fontSize: 13 }}>Carregando sessão...</p>
        ) : null}

        {status === "env_not_configured" ? (
          <p style={{ color: "var(--color-terracotta)", fontSize: 12, marginBottom: 16 }}>
            {isMockFallbackEnabled
              ? "Ambiente Supabase não configurado. Modo mock disponível."
              : "Ambiente Supabase não configurado."}
          </p>
        ) : null}

        {status === "profile_missing" ? (
          <p style={{ color: "var(--color-terracotta)", fontSize: 12, marginBottom: 16 }}>
            {authErrorMessage ?? "Usuário autenticado sem perfil válido."}
          </p>
        ) : null}

        {status === "error" ? (
          <p style={{ color: "var(--color-red)", fontSize: 12, marginBottom: 16 }}>
            {authErrorMessage ?? "Falha ao carregar autenticação."}
          </p>
        ) : null}

        {canUseRealLogin ? (
          <form onSubmit={(e) => void handleSignIn(e)} style={{ display: "grid", gap: 16 }}>
            <label>
              <span className="nexa-label" style={{ display: "block", marginBottom: 6 }}>E-mail</span>
              <input
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label>
              <span className="nexa-label" style={{ display: "block", marginBottom: 6 }}>Senha</span>
              <input
                type="password"
                placeholder="Sua senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <button
              type="submit"
              style={{
                background: "var(--color-sprout)",
                color: "var(--color-ink)",
                border: "none",
                borderRadius: 8,
                height: 40,
                fontSize: 14,
                fontWeight: 700,
                width: "100%",
                marginTop: 8,
              }}
            >
              Entrar
            </button>
          </form>
        ) : null}

        {errorMessage ? (
          <p style={{ color: "var(--color-red)", fontSize: 12, marginTop: 12 }}>{errorMessage}</p>
        ) : null}

        {status === "profile_missing" ? (
          <button
            type="button"
            onClick={() => void signOut()}
            style={{
              background: "transparent",
              color: "var(--color-fog)",
              border: "1px solid var(--color-stone)",
              borderRadius: 8,
              height: 36,
              fontSize: 12,
              fontWeight: 600,
              width: "100%",
              marginTop: 12,
            }}
          >
            Limpar sessão atual
          </button>
        ) : null}

        {canUseMockFallback ? (
          <button
            type="button"
            onClick={handleMockSignIn}
            style={{
              background: "transparent",
              color: "var(--color-bone)",
              border: "1px solid var(--color-stone)",
              borderRadius: 8,
              height: 36,
              fontSize: 12,
              fontWeight: 600,
              width: "100%",
              marginTop: 12,
            }}
          >
            Entrar com mock
          </button>
        ) : null}
      </div>
    </div>
  );
}
