import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../../infra/supabase/supabaseClient";
import NexaIcon from "../../../shared/components/NexaIcon";

export default function DefinirSenhaPage() {
  const navigate = useNavigate();
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [tokenValido, setTokenValido] = useState<boolean | null>(null);

  useEffect(() => {
    if (!supabase) { setTokenValido(false); return; }

    let cancelled = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (!cancelled && (event === "SIGNED_IN" || event === "PASSWORD_RECOVERY" || event === "TOKEN_REFRESHED")) {
        setTokenValido(true);
      }
    });

    async function waitForSession() {
      // Check existing session first
      const { data: { session } } = await supabase!.auth.getSession();
      if (session && !cancelled) { setTokenValido(true); return; }

      // Poll for session (hash processing can be slow on mobile)
      const hasHash = window.location.hash.includes("access_token");
      if (hasHash) {
        for (let i = 0; i < 10; i++) {
          await new Promise((r) => setTimeout(r, 500));
          if (cancelled) return;
          const { data: { session: s } } = await supabase!.auth.getSession();
          if (s) { setTokenValido(true); return; }
        }
      }

      // Final check after extra wait
      await new Promise((r) => setTimeout(r, 2000));
      if (cancelled) return;
      const { data: { session: final } } = await supabase!.auth.getSession();
      if (final) { setTokenValido(true); return; }

      setTokenValido(false);
    }

    void waitForSession();

    return () => { cancelled = true; subscription.unsubscribe(); };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (senha.length < 8) { setErro("A senha deve ter pelo menos 8 caracteres."); return; }
    if (senha !== confirmar) { setErro("As senhas não coincidem."); return; }
    if (!supabase) { setErro("Supabase não configurado."); return; }

    // Verify session is still alive
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setErro("Sessão expirada. Solicite um novo convite ao administrador."); return; }

    setSalvando(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setSalvando(false);

    if (error) {
      setErro(error.message.includes("session") ? "Sessão expirada. Solicite um novo convite." : "Não foi possível definir a senha. Tente novamente.");
      return;
    }
    setSucesso(true);
    setTimeout(() => navigate("/selecionar-empreendimento"), 2500);
  }

  const box: React.CSSProperties = { minHeight: "100vh", background: "var(--color-ink)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px" };
  const card: React.CSSProperties = { background: "var(--color-carbon)", border: "1px solid var(--color-stone)", borderRadius: 16, padding: "36px 32px", maxWidth: 380, width: "100%" };
  const inp: React.CSSProperties = { width: "100%", background: "var(--color-ink)", border: "1px solid var(--color-stone)", borderRadius: 8, padding: "12px 14px", color: "var(--color-bone)", fontSize: 15, outline: "none", fontFamily: "inherit", boxSizing: "border-box" };
  const lbl: React.CSSProperties = { fontSize: 11, color: "var(--color-fog)", fontFamily: "var(--font-mono)", letterSpacing: "0.1em", display: "block", marginBottom: 6 };

  // Loading
  if (tokenValido === null) {
    return (
      <div style={box}>
        <div style={{ textAlign: "center", color: "var(--color-fog)", fontFamily: "var(--font-mono)", fontSize: 13 }}>Verificando convite...</div>
      </div>
    );
  }

  // Token invalid
  if (tokenValido === false) {
    return (
      <div style={box}>
        <div style={card}>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <NexaIcon size={28} />
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: "var(--color-bone)", marginBottom: 12, fontFamily: "var(--font-display)", fontStyle: "italic" }}>Link expirado</div>
            <p style={{ color: "var(--color-fog)", fontSize: 13, lineHeight: 1.6, marginBottom: 24 }}>
              Este link já foi utilizado ou expirou. Solicite um novo convite ao administrador do sistema ou use a opção "Esqueci minha senha" na tela de login.
            </p>
            <button type="button" onClick={() => navigate("/auth/esqueci-senha")} style={{ width: "100%", padding: "13px", borderRadius: 8, border: "none", background: "var(--color-sprout)", color: "var(--color-ink)", fontSize: 14, fontWeight: 700, cursor: "pointer", marginBottom: 12 }}>
              Recuperar senha
            </button>
            <button type="button" onClick={() => navigate("/entrar")} style={{ width: "100%", padding: "10px", background: "none", border: "none", color: "var(--color-fog)", fontSize: 13, cursor: "pointer" }}>
              Voltar ao login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Success
  if (sucesso) {
    return (
      <div style={box}>
        <div style={{ ...card, textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 16, color: "var(--color-sprout)" }}>&#10003;</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "var(--color-sprout)", marginBottom: 8 }}>Senha definida!</div>
          <div style={{ fontSize: 13, color: "var(--color-fog)" }}>Redirecionando para o sistema...</div>
        </div>
      </div>
    );
  }

  // Form
  return (
    <div style={box}>
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <NexaIcon size={28} />
          <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: "0.1em", color: "var(--color-chalk)" }}>NEXA</span>
        </div>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-fog)", marginBottom: 28 }}>Plataforma comercial imobiliária</p>

        <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--color-bone)", margin: "0 0 4px" }}>Bem-vindo ao NEXA</h1>
        <p style={{ fontSize: 13, color: "var(--color-fog)", marginBottom: 24 }}>Defina sua senha para continuar.</p>

        <form onSubmit={(e) => void handleSubmit(e)} style={{ display: "grid", gap: 14 }}>
          <div>
            <label style={lbl}>NOVA SENHA</label>
            <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Mínimo 8 caracteres" style={inp} autoFocus />
          </div>
          <div>
            <label style={lbl}>CONFIRMAR SENHA</label>
            <input type="password" value={confirmar} onChange={(e) => setConfirmar(e.target.value)} placeholder="Repita a senha"
              style={{ ...inp, borderColor: confirmar && confirmar !== senha ? "rgba(248,113,113,0.4)" : "var(--color-stone)" }} />
            {confirmar && senha !== confirmar ? <div style={{ fontSize: 12, color: "var(--color-red)", marginTop: 6 }}>As senhas não coincidem</div> : null}
          </div>

          {erro ? <div style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "var(--color-red)" }}>{erro}</div> : null}

          <button type="submit" disabled={salvando || !senha || !confirmar}
            style={{ width: "100%", padding: "13px", borderRadius: 8, border: "none", marginTop: 4, background: salvando || !senha || !confirmar ? "var(--color-stone)" : "var(--color-sprout)", color: salvando || !senha || !confirmar ? "var(--color-fog)" : "var(--color-ink)", fontSize: 15, fontWeight: 700, cursor: salvando || !senha || !confirmar ? "not-allowed" : "pointer" }}>
            {salvando ? "Salvando..." : "Definir senha e entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
