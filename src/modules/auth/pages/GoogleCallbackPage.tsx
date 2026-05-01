import { useEffect, useState } from "react";
import { setStoredToken } from "../../../shared/services/googleDriveService";

export default function GoogleCallbackPage() {
  const [status, setStatus] = useState<"processing" | "error">("processing");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    // Caso 1: Token processado pelo servidor (fluxo server-side)
    const token = params.get("token");
    const returnUrlParam = params.get("return_url");

    if (token) {
      setStoredToken(decodeURIComponent(token));

      // URLSearchParams já decodifica — não fazer decodeURIComponent extra
      const destination = returnUrlParam || "/empreendimentos";

      // Diagnóstico temporário do redirect
      console.log("[NEXA] destination:", destination);
      console.log("[NEXA] raw return_url:", returnUrlParam);

      window.location.href = destination;
      return;
    }

    // Caso 2: Erro OAuth
    const error = params.get("error") || params.get("oauth_error");
    if (error) {
      setStatus("error");
      setErrorMsg(error);
      return;
    }

    // Caso 3: Code direto (fallback legado)
    const code = params.get("code");
    if (code) {
      window.location.href = "/empreendimentos";
      return;
    }

    setStatus("error");
    setErrorMsg("Parâmetros de callback inválidos.");
  }, []);

  if (status === "error") {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        minHeight: "100vh", background: "var(--color-carbon)"
      }}>
        <div style={{
          background: "var(--color-ink)", border: "1px solid var(--color-stone)",
          borderRadius: 12, padding: 32, maxWidth: 400, textAlign: "center"
        }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--color-red)", marginBottom: 12 }}>
            Erro na autenticação
          </div>
          <p style={{ fontSize: 13, color: "var(--color-fog)", marginBottom: 20 }}>{errorMsg}</p>
          <button
            type="button"
            onClick={() => { window.location.href = "/empreendimentos"; }}
            style={{
              background: "var(--color-sprout)", color: "var(--color-ink)",
              border: "none", borderRadius: 8, padding: "8px 20px",
              fontSize: 13, fontWeight: 700, cursor: "pointer"
            }}
          >
            Voltar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      minHeight: "100vh", background: "var(--color-carbon)"
    }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 14, color: "var(--color-fog)", marginBottom: 8 }}>
          Conectando ao Google Drive...
        </div>
        <div style={{ fontSize: 11, color: "var(--color-slate)" }}>
          Aguarde, você será redirecionado.
        </div>
      </div>
    </div>
  );
}
