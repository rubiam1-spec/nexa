import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { exchangeCodeForToken, setStoredToken } from "../../../shared/services/googleDriveService";

export default function GoogleCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get("code");
    if (!code) {
      setError("Código de autorização não encontrado na URL.");
      return;
    }

    // Recuperar a URL de retorno salva antes do redirect OAuth
    const returnUrl = localStorage.getItem("nexa_oauth_return_url") || "/empreendimentos";
    localStorage.removeItem("nexa_oauth_return_url");

    exchangeCodeForToken(code)
      .then((token) => {
        setStoredToken(token);
        navigate(returnUrl, { replace: true });
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Falha na autenticação com Google.");
      });
  }, [searchParams, navigate]);

  if (error) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "var(--color-carbon)" }}>
        <div style={{ background: "var(--color-ink)", border: "1px solid var(--color-stone)", borderRadius: 12, padding: 32, maxWidth: 400, textAlign: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--color-red)", marginBottom: 12 }}>Erro na autenticação</div>
          <p style={{ fontSize: 13, color: "var(--color-fog)", marginBottom: 20 }}>{error}</p>
          <button
            type="button"
            onClick={() => navigate("/empreendimentos", { replace: true })}
            style={{ background: "var(--color-sprout)", color: "var(--color-ink)", border: "none", borderRadius: 8, padding: "8px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
          >
            Voltar para empreendimentos
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "var(--color-carbon)" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 14, color: "var(--color-fog)", marginBottom: 8 }}>Conectando ao Google Drive...</div>
        <div style={{ fontSize: 11, color: "var(--color-slate)" }}>Aguarde, você será redirecionado.</div>
      </div>
    </div>
  );
}
