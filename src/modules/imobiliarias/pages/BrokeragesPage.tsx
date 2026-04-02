import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAccount } from "../../../app/contexts/AccountContext";
import { useBrokerages } from "../hooks/useBrokerages";
import { createBrokerage } from "../../../infra/repositories/brokeragesSupabaseRepository";
import { supabase } from "../../../infra/supabase/supabaseClient";
const btnP: React.CSSProperties = { background: "var(--color-sprout)", color: "var(--color-ink)", border: "none", borderRadius: 8, padding: "0 16px", height: 36, fontSize: 13, fontWeight: 700, cursor: "pointer" };
const btnS: React.CSSProperties = { background: "transparent", color: "var(--color-bone)", border: "1px solid var(--color-stone)", borderRadius: 8, padding: "0 16px", height: 36, fontSize: 13, fontWeight: 700, cursor: "pointer" };

function maskCNPJ(v: string) { return v.replace(/\D/g, "").replace(/(\d{2})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1/$2").replace(/(\d{4})(\d)/, "$1-$2").slice(0, 18); }
function maskPhone(v: string) { return v.replace(/\D/g, "").replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4,5})(\d{4})$/, "$1-$2").slice(0, 15); }

export default function BrokeragesPage() {
  const navigate = useNavigate();
  const { account, errorMessage: accountError, isUsingMock, status: accountStatus } = useAccount();
  const { brokerages, errorMessage, isLoading, status } = useBrokerages(account?.accountId ?? null, isUsingMock);
  const accountId = account?.accountId ?? null;

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState(""); const [cnpj, setCnpj] = useState(""); const [creci, setCreci] = useState("");
  const [responsavel, setResponsavel] = useState(""); const [phone, setPhone] = useState(""); const [city, setCity] = useState("");
  const [saving, setSaving] = useState(false); const [err, setErr] = useState<string | null>(null);
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [busca, setBusca] = useState("");
  const [brokerCounts, setBrokerCounts] = useState<Record<string, number>>({});

  // Fetch broker counts per brokerage
  useEffect(() => {
    if (!supabase || !accountId || brokerages.length === 0) return;
    const ids = brokerages.map((b) => b.id);
    supabase.from("brokers").select("brokerage_id").eq("account_id", accountId).in("brokerage_id", ids).then(({ data }) => {
      const counts: Record<string, number> = {};
      (data ?? []).forEach((r: Record<string, unknown>) => { const bid = r.brokerage_id as string; counts[bid] = (counts[bid] || 0) + 1; });
      setBrokerCounts(counts);
    });
  }, [accountId, brokerages]);

  async function buscarCNPJ(raw: string) {
    if (raw.length !== 14) return;
    setCnpjLoading(true);
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${raw}`);
      if (!res.ok) return;
      const d = await res.json();
      if (d.nome_fantasia) setName(d.nome_fantasia);
      if (d.razao_social && !d.nome_fantasia) setName(d.razao_social);
      if (d.ddd_telefone_1) setPhone(d.ddd_telefone_1.replace(/\D/g, ""));
      if (d.municipio) setCity(d.municipio);
      if (d.razao_social) setResponsavel(d.razao_social);
    } catch { /* silencioso */ }
    finally { setCnpjLoading(false); }
  }

  async function handleSave() {
    if (!accountId || !name.trim()) return;
    setSaving(true); setErr(null);
    try {
      const b = await createBrokerage({ accountId, name: name.trim(), email: "", phone: phone.replace(/\D/g, ""), city: city.trim(), cnpj: cnpj.replace(/\D/g, "") || undefined });
      // Update creci + responsavel directly if provided
      if (supabase && (creci.trim() || responsavel.trim())) {
        await supabase.from("brokerages").update({ creci: creci.trim() || null, responsavel: responsavel.trim() || null }).eq("id", b.id);
      }
      navigate(`/imobiliarias/${b.id}`);
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : "Falha ao criar."); }
    finally { setSaving(false); }
  }

  if (isLoading) return <p style={{ color: "var(--color-fog)" }}>Carregando imobiliárias...</p>;
  if (accountStatus === "no_access" || accountStatus === "error") return <p style={{ color: "var(--color-fog)" }}>{accountError ?? "Conta indisponível."}</p>;
  if (status === "error") return <p style={{ color: "var(--color-red)" }}>{errorMessage}</p>;
  if (status === "idle") return <p style={{ color: "var(--color-fog)" }}>Selecione uma conta para continuar.</p>;

  const filtered = busca ? brokerages.filter((b) => {
    const t = busca.toLowerCase();
    return b.name.toLowerCase().includes(t) || (b.cnpj || "").includes(t) || (b.city || "").toLowerCase().includes(t);
  }) : brokerages;

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--color-bone)", margin: 0 }}>Imobiliárias</h1>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-fog)", marginTop: 4 }}>{brokerages.length} registros</div>
        </div>
        <button type="button" onClick={() => setShowForm((p) => !p)} style={showForm ? btnS : btnP}>{showForm ? "Cancelar" : "Nova imobiliária"}</button>
      </div>

      {/* Quick create form */}
      {showForm && (
        <div className="nexa-card" style={{ marginBottom: 24 }}>
          <div className="nexa-label" style={{ marginBottom: 12 }}>Cadastro rápido</div>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
            <label style={{ flex: 2, minWidth: 140 }}><span className="nexa-label" style={{ display: "block", marginBottom: 6 }}>Nome *</span><input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome da imobiliária" /></label>
            <label style={{ flex: 1.5, minWidth: 130 }}><span className="nexa-label" style={{ display: "block", marginBottom: 6 }}>CNPJ {cnpjLoading && <span style={{ fontSize: 9, color: "var(--color-fog)" }}>buscando...</span>}</span><input type="text" value={maskCNPJ(cnpj)} onChange={(e) => { const raw = e.target.value.replace(/\D/g, "").slice(0, 14); setCnpj(raw); if (raw.length === 14) buscarCNPJ(raw); }} maxLength={18} placeholder="00.000.000/0000-00" /></label>
            <label style={{ flex: 1, minWidth: 100 }}><span className="nexa-label" style={{ display: "block", marginBottom: 6 }}>CRECI-J</span><input type="text" value={creci} onChange={(e) => setCreci(e.target.value)} placeholder="00000/UF" /></label>
            <label style={{ flex: 1.5, minWidth: 120 }}><span className="nexa-label" style={{ display: "block", marginBottom: 6 }}>Responsável</span><input type="text" value={responsavel} onChange={(e) => setResponsavel(e.target.value)} placeholder="Nome" /></label>
            <label style={{ flex: 1, minWidth: 110 }}><span className="nexa-label" style={{ display: "block", marginBottom: 6 }}>Telefone</span><input type="tel" value={maskPhone(phone)} onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 11))} maxLength={15} placeholder="(00) 00000-0000" /></label>
            <label style={{ flex: 1, minWidth: 100 }}><span className="nexa-label" style={{ display: "block", marginBottom: 6 }}>Cidade</span><input type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Cidade" /></label>
            <button type="button" disabled={!name.trim() || saving} onClick={() => void handleSave()} style={{ ...btnP, whiteSpace: "nowrap", flexShrink: 0 }}>{saving ? "..." : "Salvar ✓"}</button>
          </div>
          {err && <p style={{ color: "var(--color-red)", fontSize: 12, marginTop: 8 }}>{err}</p>}
          <div style={{ fontSize: 11, color: "var(--color-fog)", marginTop: 8 }}>Dados completos ficam na ficha da imobiliária.</div>
        </div>
      )}

      {/* Search */}
      {brokerages.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome, CNPJ ou cidade..." style={{ background: "var(--surface-raised)", border: "1px solid var(--color-stone)", borderRadius: 8, padding: "8px 14px", color: "var(--color-bone)", fontSize: 13, outline: "none", width: "100%", maxWidth: 360 }} />
        </div>
      )}

      {/* List */}
      {filtered.length === 0 ? (
        <div className="nexa-card" style={{ textAlign: "center", padding: 24 }}><p style={{ color: "var(--color-fog)", fontSize: 13 }}>Nenhuma imobiliária encontrada.</p></div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="nexa-table">
            <thead><tr><th>Nome</th><th>CNPJ</th><th>CRECI-J</th><th>Responsável</th><th>Telefone</th><th>Cidade</th><th>Corretores</th><th>Status</th></tr></thead>
            <tbody>{filtered.map((b) => (
              <tr key={b.id} style={{ cursor: "pointer" }} onClick={() => navigate(`/imobiliarias/${b.id}`)}>
                <td style={{ color: "var(--color-bone)", fontWeight: 600 }}>{b.name}</td>
                <td style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{b.cnpj ? maskCNPJ(b.cnpj) : "—"}</td>
                <td>{(b as Record<string, unknown>).creci as string || "—"}</td>
                <td>{(b as Record<string, unknown>).responsavel as string || "—"}</td>
                <td>{b.phone ? maskPhone(b.phone) : "—"}</td>
                <td>{b.city || "—"}</td>
                <td style={{ textAlign: "center" }}>{brokerCounts[b.id] || 0}</td>
                <td><span className="nexa-badge" style={{ color: b.status === "active" ? "var(--color-sprout)" : "var(--color-fog)", background: b.status === "active" ? "var(--color-sprout-muted)" : "rgba(156,150,134,0.12)" }}>{b.status === "active" ? "Ativa" : "Inativa"}</span></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
