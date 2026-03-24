import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAccount } from "../../../app/contexts/AccountContext";
import { useAuth } from "../../../app/contexts/AuthContext";
import type { DevelopmentContextData } from "../../../shared/types/development";
import {
  getDevelopmentsByAccountId,
  createDevelopment,
} from "../../../infra/repositories/developmentsSupabaseRepository";

const btnP: React.CSSProperties = { background: "var(--color-sprout)", color: "var(--color-ink)", border: "none", borderRadius: 8, padding: "0 16px", height: 36, fontSize: 13, fontWeight: 700 };
const btnS: React.CSSProperties = { background: "transparent", color: "var(--color-bone)", border: "1px solid var(--color-stone)", borderRadius: 8, padding: "0 16px", height: 36, fontSize: 13, fontWeight: 700 };

export default function DevelopmentsPage() {
  const { account, status: accountStatus, errorMessage: accountError } = useAccount();
  const { sessionSource } = useAuth();
  const accountId = account?.accountId ?? null;

  const [developments, setDevelopments] = useState<DevelopmentContextData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [devName, setDevName] = useState("");
  const [devCity, setDevCity] = useState("");
  const [devState, setDevState] = useState("");
  const [devDesc, setDevDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showForm) firstInputRef.current?.focus();
  }, [showForm]);

  useEffect(() => {
    if (!accountId || sessionSource === "mock") return;
    let m = true;
    setIsLoading(true); setError(null);
    getDevelopmentsByAccountId(accountId)
      .then((data) => { if (m) setDevelopments(data); })
      .catch((e: unknown) => { if (m) setError(e instanceof Error ? e.message : "Falha ao carregar."); })
      .finally(() => { if (m) setIsLoading(false); });
    return () => { m = false; };
  }, [accountId, sessionSource]);

  async function handleCreate() {
    if (!accountId || !devName.trim()) return;
    setSaving(true); setError(null);
    try {
      const dev = await createDevelopment({ accountId, name: devName.trim(), city: devCity.trim() || undefined, state: devState.trim() || undefined, description: devDesc.trim() || undefined });
      setDevelopments((c) => [dev, ...c]);
      setShowForm(false); setDevName(""); setDevCity(""); setDevState(""); setDevDesc("");
      setSuccessMsg("Empreendimento criado com sucesso!"); setTimeout(() => setSuccessMsg(null), 3000);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Falha ao criar."); }
    finally { setSaving(false); }
  }

  if (isLoading) return <p style={{ color: "var(--color-fog)" }}>Carregando empreendimentos...</p>;
  if (accountStatus === "no_access" || accountStatus === "error") return <p style={{ color: "var(--color-fog)" }}>{accountError ?? "Conta indisponível."}</p>;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--color-bone)", margin: 0 }}>Empreendimentos</h1>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-fog)", marginTop: 4 }}>
            {developments.length} registros · {account?.accountName}
          </div>
        </div>
        <button type="button" onClick={() => setShowForm((p) => !p)} style={showForm ? btnS : btnP}>
          {showForm ? "Cancelar" : "Novo empreendimento"}
        </button>
      </div>

      {error ? <p style={{ color: "var(--color-red)", fontSize: 12, marginBottom: 16 }}>{error}</p> : null}

      {successMsg ? (
        <div style={{ background: "var(--color-sprout-muted)", border: "1px solid var(--color-sprout)", borderRadius: 8, padding: "10px 16px", marginBottom: 16, fontSize: 13, color: "var(--color-sprout)", display: "flex", alignItems: "center", gap: 8 }}>
          <span>&#10003;</span> {successMsg}
        </div>
      ) : null}

      {showForm ? (
        <div className="nexa-card" style={{ marginBottom: 24 }}>
          <div className="nexa-label" style={{ marginBottom: 16 }}>Criar empreendimento</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, maxWidth: 600 }}>
            <label style={{ gridColumn: "1 / -1" }}><span className="nexa-label" style={{ display: "block", marginBottom: 6 }}>Nome *</span><input ref={firstInputRef} type="text" value={devName} onChange={(e) => setDevName(e.target.value)} placeholder="Nome do empreendimento" /></label>
            <label><span className="nexa-label" style={{ display: "block", marginBottom: 6 }}>Cidade</span><input type="text" value={devCity} onChange={(e) => setDevCity(e.target.value)} /></label>
            <label><span className="nexa-label" style={{ display: "block", marginBottom: 6 }}>Estado</span><input type="text" value={devState} onChange={(e) => setDevState(e.target.value)} placeholder="UF" /></label>
            <label style={{ gridColumn: "1 / -1" }}><span className="nexa-label" style={{ display: "block", marginBottom: 6 }}>Descrição</span><textarea value={devDesc} onChange={(e) => setDevDesc(e.target.value)} rows={2} /></label>
          </div>
          <button type="button" disabled={!devName.trim() || saving} onClick={() => void handleCreate()} style={{ ...btnP, marginTop: 16 }}>{saving ? "Criando..." : "Criar empreendimento"}</button>
        </div>
      ) : null}

      {developments.length === 0 ? (
        <div className="nexa-card"><p style={{ color: "var(--color-fog)" }}>Nenhum empreendimento encontrado.</p></div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {developments.map((dev) => (
            <div key={dev.developmentId} className="nexa-card" style={{ padding: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 16, fontWeight: 700, color: "var(--color-bone)" }}>{dev.developmentName}</span>
                  <span className="nexa-badge" style={{
                    color: dev.status === "active" ? "var(--color-sprout)" : "var(--color-fog)",
                    background: dev.status === "active" ? "var(--color-sprout-muted)" : "rgba(156,150,134,0.12)",
                  }}>{dev.status === "active" ? "Ativo" : "Inativo"}</span>
                </div>
                {(dev.city || dev.state) ? (
                  <div style={{ fontSize: 12, color: "var(--color-fog)", marginTop: 4 }}>{[dev.city, dev.state].filter(Boolean).join(" · ")}</div>
                ) : null}
              </div>
              <Link to={`/empreendimentos/${dev.developmentId}`} style={{
                background: "transparent", color: "var(--color-sprout)", border: "1px solid var(--color-sprout-muted)",
                borderRadius: 8, padding: "0 16px", height: 32, display: "inline-flex", alignItems: "center",
                fontSize: 12, fontWeight: 600, textDecoration: "none",
              }}>
                Abrir
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
