import { useEffect, useRef, useState } from "react";
import { useAccount } from "../../../app/contexts/AccountContext";
import { useBrokers } from "../hooks/useBrokers";
import { useBrokerages } from "../../imobiliarias/hooks/useBrokerages";
import { createBroker } from "../../../infra/repositories/brokersSupabaseRepository";
import type { Broker } from "../../../shared/types/broker";

const btnP: React.CSSProperties = { background: "var(--color-sprout)", color: "var(--color-ink)", border: "none", borderRadius: 8, padding: "0 16px", height: 36, fontSize: 13, fontWeight: 700 };
const btnS: React.CSSProperties = { background: "transparent", color: "var(--color-bone)", border: "1px solid var(--color-stone)", borderRadius: 8, padding: "0 16px", height: 36, fontSize: 13, fontWeight: 700 };

export default function BrokersPage() {
  const { account, errorMessage: accountError, isUsingMock, status: accountStatus } = useAccount();
  const { brokers, errorMessage, isLoading, status } = useBrokers(account?.accountId ?? null, isUsingMock);
  const { brokerages } = useBrokerages(account?.accountId ?? null, isUsingMock);
  const activeCount = brokers.filter((b) => b.status === "active").length;

  const [showForm, setShowForm] = useState(false);
  const [list, setList] = useState<Broker[]>([]);
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [phone, setPhone] = useState("");
  const [creci, setCreci] = useState(""); const [city, setCity] = useState(""); const [brokerageId, setBrokerageId] = useState("");
  const [saving, setSaving] = useState(false); const [err, setErr] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showForm) firstInputRef.current?.focus();
  }, [showForm]);

  const allBrokers = [...list, ...brokers];

  async function handleSave() {
    if (!account?.accountId || !name.trim() || !email.trim() || !phone.trim()) return;
    const selectedBrokerage = brokerages.find((b) => b.id === brokerageId);
    setSaving(true); setErr(null);
    try {
      const b = await createBroker({ accountId: account.accountId, name: name.trim(), email: email.trim(), phone: phone.trim(), city: city.trim(), creci: creci.trim() || undefined, brokerageId: brokerageId || undefined, brokerageName: selectedBrokerage?.name });
      setList((p) => [b, ...p]); setShowForm(false);
      setName(""); setEmail(""); setPhone(""); setCreci(""); setCity(""); setBrokerageId("");
      setSuccessMsg("Corretor criado com sucesso!"); setTimeout(() => setSuccessMsg(null), 3000);
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : "Falha ao criar corretor."); } finally { setSaving(false); }
  }

  if (isLoading) return <p style={{ color: "var(--color-fog)" }}>Carregando corretores...</p>;
  if (accountStatus === "no_access" || accountStatus === "error") return <p style={{ color: "var(--color-fog)" }}>{accountError ?? "Conta indisponível."}</p>;
  if (status === "error") return <p style={{ color: "var(--color-red)" }}>{errorMessage}</p>;
  if (status === "idle") return <p style={{ color: "var(--color-fog)" }}>Selecione uma conta para continuar.</p>;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--color-bone)", margin: 0 }}>Corretores</h1>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-fog)", marginTop: 4 }}>{allBrokers.length} registros · {activeCount + list.length} ativos</div>
        </div>
        <button type="button" onClick={() => setShowForm((p) => !p)} style={showForm ? btnS : btnP}>{showForm ? "Cancelar" : "Novo corretor"}</button>
      </div>
      {successMsg ? (
        <div style={{ background: "var(--color-sprout-muted)", border: "1px solid var(--color-sprout)", borderRadius: 8, padding: "10px 16px", marginBottom: 16, fontSize: 13, color: "var(--color-sprout)", display: "flex", alignItems: "center", gap: 8 }}>
          <span>&#10003;</span> {successMsg}
        </div>
      ) : null}
      {showForm ? (
        <div className="nexa-card" style={{ marginBottom: 24 }}>
          <div className="nexa-label" style={{ marginBottom: 16 }}>Cadastrar corretor</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, maxWidth: 700 }}>
            <label><span className="nexa-label" style={{ display: "block", marginBottom: 6 }}>Nome *</span><input ref={firstInputRef} type="text" value={name} onChange={(e) => setName(e.target.value)} /></label>
            <label><span className="nexa-label" style={{ display: "block", marginBottom: 6 }}>E-mail *</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
            <label><span className="nexa-label" style={{ display: "block", marginBottom: 6 }}>Telefone *</span><input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
            <label><span className="nexa-label" style={{ display: "block", marginBottom: 6 }}>CRECI</span><input type="text" value={creci} onChange={(e) => setCreci(e.target.value)} /></label>
            <label><span className="nexa-label" style={{ display: "block", marginBottom: 6 }}>Imobiliária</span>
              <select value={brokerageId} onChange={(e) => setBrokerageId(e.target.value)}>
                <option value="">Selecione</option>
                {brokerages.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </label>
            <label><span className="nexa-label" style={{ display: "block", marginBottom: 6 }}>Cidade</span><input type="text" value={city} onChange={(e) => setCity(e.target.value)} /></label>
          </div>
          {err ? <p style={{ color: "var(--color-red)", fontSize: 12, marginTop: 8 }}>{err}</p> : null}
          <button type="button" disabled={!name.trim() || !email.trim() || !phone.trim() || saving} onClick={() => void handleSave()} style={{ ...btnP, marginTop: 16 }}>{saving ? "Salvando..." : "Salvar corretor"}</button>
        </div>
      ) : null}
      {allBrokers.length === 0 ? (
        <div className="nexa-card"><p style={{ color: "var(--color-fog)" }}>Nenhum corretor encontrado.</p></div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="nexa-table">
            <thead><tr><th>Nome</th><th>E-mail</th><th>Telefone</th><th>Imobiliária</th><th>Cidade</th><th>Status</th></tr></thead>
            <tbody>{allBrokers.map((b) => (
              <tr key={b.id}>
                <td style={{ color: "var(--color-bone)", fontWeight: 600 }}>{b.name}</td><td>{b.email}</td><td>{b.phone}</td><td>{b.brokerageName}</td><td>{b.city}</td>
                <td><span className="nexa-badge" style={{ color: b.status === "active" ? "var(--color-sprout)" : "var(--color-fog)", background: b.status === "active" ? "var(--color-sprout-muted)" : "rgba(156,150,134,0.12)" }}>{b.status === "active" ? "Ativo" : "Inativo"}</span></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
