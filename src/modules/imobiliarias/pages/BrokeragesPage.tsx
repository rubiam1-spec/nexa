import { useState } from "react";
import { useAccount } from "../../../app/contexts/AccountContext";
import { useBrokerages } from "../hooks/useBrokerages";
import { createBrokerage } from "../../../infra/repositories/brokeragesSupabaseRepository";
import type { Brokerage } from "../../../shared/types/brokerage";

const btnP: React.CSSProperties = { background: "var(--color-sprout)", color: "var(--color-ink)", border: "none", borderRadius: 8, padding: "0 16px", height: 36, fontSize: 13, fontWeight: 700 };
const btnS: React.CSSProperties = { background: "transparent", color: "var(--color-bone)", border: "1px solid var(--color-stone)", borderRadius: 8, padding: "0 16px", height: 36, fontSize: 13, fontWeight: 700 };

export default function BrokeragesPage() {
  const { account, errorMessage: accountError, isUsingMock, status: accountStatus } = useAccount();
  const { brokerages, errorMessage, isLoading, status } = useBrokerages(account?.accountId ?? null, isUsingMock);
  const activeCount = brokerages.filter((b) => b.status === "active").length;

  const [showForm, setShowForm] = useState(false);
  const [list, setList] = useState<Brokerage[]>([]);
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [phone, setPhone] = useState("");
  const [cnpj, setCnpj] = useState(""); const [city, setCity] = useState("");
  const [saving, setSaving] = useState(false); const [err, setErr] = useState<string | null>(null);

  const all = [...list, ...brokerages];

  async function handleSave() {
    if (!account?.accountId || !name.trim() || !email.trim() || !phone.trim()) return;
    setSaving(true); setErr(null);
    try {
      const b = await createBrokerage({ accountId: account.accountId, name: name.trim(), email: email.trim(), phone: phone.trim(), city: city.trim(), cnpj: cnpj.trim() || undefined });
      setList((p) => [b, ...p]); setShowForm(false);
      setName(""); setEmail(""); setPhone(""); setCnpj(""); setCity("");
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : "Falha ao criar imobiliária."); } finally { setSaving(false); }
  }

  if (isLoading) return <p style={{ color: "var(--color-fog)" }}>Carregando imobiliárias...</p>;
  if (accountStatus === "no_access" || accountStatus === "error") return <p style={{ color: "var(--color-fog)" }}>{accountError ?? "Conta indisponível."}</p>;
  if (status === "error") return <p style={{ color: "var(--color-red)" }}>{errorMessage}</p>;
  if (status === "idle") return <p style={{ color: "var(--color-fog)" }}>Selecione uma conta para continuar.</p>;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--color-bone)", margin: 0 }}>Imobiliárias</h1>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-fog)", marginTop: 4 }}>{all.length} registros · {activeCount + list.length} ativas</div>
        </div>
        <button type="button" onClick={() => setShowForm((p) => !p)} style={showForm ? btnS : btnP}>{showForm ? "Cancelar" : "Nova imobiliária"}</button>
      </div>
      {showForm ? (
        <div className="nexa-card" style={{ marginBottom: 24 }}>
          <div className="nexa-label" style={{ marginBottom: 16 }}>Cadastrar imobiliária</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, maxWidth: 700 }}>
            <label><span className="nexa-label" style={{ display: "block", marginBottom: 6 }}>Nome *</span><input type="text" value={name} onChange={(e) => setName(e.target.value)} /></label>
            <label><span className="nexa-label" style={{ display: "block", marginBottom: 6 }}>E-mail *</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
            <label><span className="nexa-label" style={{ display: "block", marginBottom: 6 }}>Telefone *</span><input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
            <label><span className="nexa-label" style={{ display: "block", marginBottom: 6 }}>CNPJ</span><input type="text" value={cnpj} onChange={(e) => setCnpj(e.target.value)} /></label>
            <label><span className="nexa-label" style={{ display: "block", marginBottom: 6 }}>Cidade</span><input type="text" value={city} onChange={(e) => setCity(e.target.value)} /></label>
          </div>
          {err ? <p style={{ color: "var(--color-red)", fontSize: 12, marginTop: 8 }}>{err}</p> : null}
          <button type="button" disabled={!name.trim() || !email.trim() || !phone.trim() || saving} onClick={() => void handleSave()} style={{ ...btnP, marginTop: 16 }}>{saving ? "Salvando..." : "Salvar imobiliária"}</button>
        </div>
      ) : null}
      {all.length === 0 ? (
        <div className="nexa-card"><p style={{ color: "var(--color-fog)" }}>Nenhuma imobiliária encontrada.</p></div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="nexa-table">
            <thead><tr><th>Nome</th><th>E-mail</th><th>Telefone</th><th>Cidade</th><th>Status</th></tr></thead>
            <tbody>{all.map((b) => (
              <tr key={b.id}>
                <td style={{ color: "var(--color-bone)", fontWeight: 600 }}>{b.name}</td><td>{b.email}</td><td>{b.phone}</td><td>{b.city}</td>
                <td><span className="nexa-badge" style={{ color: b.status === "active" ? "var(--color-sprout)" : "var(--color-fog)", background: b.status === "active" ? "var(--color-sprout-muted)" : "rgba(156,150,134,0.12)" }}>{b.status === "active" ? "Ativa" : "Inativa"}</span></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
