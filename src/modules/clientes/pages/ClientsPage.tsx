import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAccount } from "../../../app/contexts/AccountContext";
import { useAuth } from "../../../app/contexts/AuthContext";
import { useClients } from "../hooks/useClients";
import { useClientFilter } from "../../../shared/hooks/useClientFilter";
import { useScreen } from "../../../shared/hooks/useIsMobile";
import { useBrokers } from "../../corretores/hooks/useBrokers";
import { createClient } from "../../../infra/repositories/clientsSupabaseRepository";
import type { Client } from "../../../shared/types/client";
import { EmptyState } from "../../../shared/components/EmptyState";
import { getPermissions } from "../../../shared/utils/permissoes";

const btnP: React.CSSProperties = { background: "var(--color-sprout)", color: "var(--color-ink)", border: "none", borderRadius: 8, padding: "0 16px", height: 36, fontSize: 13, fontWeight: 700, cursor: "pointer" };
const btnS: React.CSSProperties = { background: "transparent", color: "var(--color-bone)", border: "1px solid var(--color-stone)", borderRadius: 8, padding: "0 16px", height: 36, fontSize: 13, fontWeight: 700, cursor: "pointer" };

export default function ClientsPage() {
  const { account, errorMessage: accountError, isUsingMock, status: accountStatus, isBroker, brokerId } = useAccount();
  const { authenticatedProfile } = useAuth();
  const clientFilter = useClientFilter();
  const { clients, errorMessage, isLoading, status } = useClients(account?.accountId ?? null, isUsingMock, clientFilter);
  const { brokers } = useBrokers(account?.accountId ?? null, isUsingMock);
  useScreen(); // for responsive hooks
  const perms = getPermissions(account?.role ?? null);
  const activeCount = clients.filter((c) => c.status === "active").length;

  const [showForm, setShowForm] = useState(false);
  const [list] = useState<Client[]>([]);
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [phone, setPhone] = useState("");
  const [cpf, setCpf] = useState("");
  const [selectedBrokerId, setSelectedBrokerId] = useState(isBroker ? (brokerId ?? "") : "");
  const [saving, setSaving] = useState(false); const [err, setErr] = useState<string | null>(null);
  const [successMsg] = useState<string | null>(null);
  const [filterBroker, setFilterBroker] = useState("all");
  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showForm) firstInputRef.current?.focus();
  }, [showForm]);
  useEffect(() => { if (isBroker && brokerId) setSelectedBrokerId(brokerId); }, [isBroker, brokerId]);

  const allClients = [...list, ...clients];
  const visibleClients = filterBroker === "all" ? allClients : allClients.filter((c) => c.brokerId === filterBroker);

  async function handleSave() {
    if (!account?.accountId || !name.trim()) return;
    setSaving(true); setErr(null);
    try {
      const c = await createClient({
        accountId: account.accountId, name: name.trim(),
        email: email.trim() || undefined, phone: phone.trim() || undefined,
        cpf: cpf.trim() || undefined, createdBy: authenticatedProfile?.id,
        brokerId: selectedBrokerId || undefined,
      });
      // Redirect to detail page for full form with tabs
      window.location.href = `/clientes/${c.id}`;
      return;
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : "Falha ao criar cliente."); } finally { setSaving(false); }
  }

  if (isLoading) return <p style={{ color: "var(--color-fog)" }}>Carregando clientes...</p>;
  if (accountStatus === "no_access" || accountStatus === "error") return <p style={{ color: "var(--color-fog)" }}>{accountError ?? "Conta indisponível."}</p>;
  if (status === "error") return <p style={{ color: "var(--color-red)" }}>{errorMessage}</p>;
  if (status === "idle") return <p style={{ color: "var(--color-fog)" }}>Selecione uma conta para continuar.</p>;

  const activeBrokers = brokers.filter((b) => b.status === "active" && b.approvalStatus === "approved");

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--color-bone)", margin: 0 }}>Clientes</h1>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-fog)", marginTop: 4 }}>{allClients.length} registros · {activeCount + list.length} ativos</div>
        </div>
        <button type="button" onClick={() => setShowForm((p) => !p)} style={showForm ? btnS : btnP}>{showForm ? "Cancelar" : "Novo cliente"}</button>
      </div>
      {successMsg ? (
        <div style={{ background: "var(--color-sprout-muted)", border: "1px solid var(--color-sprout)", borderRadius: 8, padding: "10px 16px", marginBottom: 16, fontSize: 13, color: "var(--color-sprout)", display: "flex", alignItems: "center", gap: 8 }}>
          <span>&#10003;</span> {successMsg}
        </div>
      ) : null}
      {showForm ? (
        <div className="nexa-card" style={{ marginBottom: 24 }}>
          <div className="nexa-label" style={{ marginBottom: 12 }}>Cadastro rápido</div>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
            <label style={{ flex: 2, minWidth: 140 }}><span className="nexa-label" style={{ display: "block", marginBottom: 6 }}>Nome *</span><input ref={firstInputRef} type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome completo" /></label>
            <label style={{ flex: 1, minWidth: 120 }}><span className="nexa-label" style={{ display: "block", marginBottom: 6 }}>Telefone</span><input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(44) 99999-0000" /></label>
            <label style={{ flex: 1.5, minWidth: 140 }}><span className="nexa-label" style={{ display: "block", marginBottom: 6 }}>Email</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemplo.com" /></label>
            <label style={{ flex: 1, minWidth: 110 }}><span className="nexa-label" style={{ display: "block", marginBottom: 6 }}>CPF</span><input type="text" value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="000.000.000-00" /></label>
            <button type="button" disabled={!name.trim() || saving} onClick={() => void handleSave()} style={{ ...btnP, whiteSpace: "nowrap", flexShrink: 0 }}>{saving ? "..." : "Salvar ✓"}</button>
          </div>
          {err ? <p style={{ color: "var(--color-red)", fontSize: 12, marginTop: 8 }}>{err}</p> : null}
          <div style={{ fontSize: 11, color: "var(--color-fog)", marginTop: 8 }}>Dados completos (endereço, cônjuge, documentos) ficam na ficha do cliente.</div>
        </div>
      ) : null}

      {/* Broker filter for director/manager */}
      {perms.canViewFullDashboard && allClients.length > 0 ? (
        <div style={{ marginBottom: 16 }}>
          <select value={filterBroker} onChange={(e) => setFilterBroker(e.target.value)} style={{ background: "var(--surface-raised)", border: "1px solid var(--color-stone)", borderRadius: 8, padding: "6px 12px", color: "var(--color-bone)", fontSize: 12 }}>
            <option value="all">Todos os corretores</option>
            {activeBrokers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
      ) : null}

      {visibleClients.length === 0 && allClients.length === 0 ? (
        <EmptyState icone={"\u25CB"} titulo="Nenhum cliente cadastrado" descricao="Cadastre seu primeiro cliente para começar a criar simulações e negociações." ctaLabel="Novo cliente" onCta={() => setShowForm(true)} />
      ) : visibleClients.length === 0 ? (
        <div className="nexa-card" style={{ textAlign: "center", padding: 24 }}><p style={{ color: "var(--color-fog)", fontSize: 13 }}>Nenhum cliente encontrado para este filtro.</p></div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="nexa-table">
            <thead><tr><th>Nome</th><th>E-mail</th><th>Telefone</th><th>Corretor</th><th>Cidade</th><th>Status</th></tr></thead>
            <tbody>{visibleClients.map((c) => (
              <tr key={c.id} style={{ cursor: "pointer" }} onClick={() => window.location.href = `/clientes/${c.id}`}>
                <td><Link to={`/clientes/${c.id}`} style={{ color: "var(--color-bone)", fontWeight: 600, textDecoration: "none" }} onClick={(e) => e.stopPropagation()}>{c.name}</Link></td>
                <td>{c.email || "—"}</td>
                <td>{c.phone || "—"}</td>
                <td>{c.brokerName || "—"}</td>
                <td>{c.city || "—"}</td>
                <td>{(() => {
                  const s = c.status || "active";
                  const map: Record<string, [string, string]> = { lead: ["#60A5FA", "LEAD"], contacted: ["#FBBF24", "CONTATADO"], qualified: ["#F97316", "QUALIFICADO"], active: ["var(--color-sprout)", "ATIVO"], customer: ["#4ADE80", "CLIENTE"], lost: ["var(--color-fog)", "PERDIDO"] };
                  const [color, label] = map[s] || ["var(--color-fog)", s.toUpperCase()];
                  return <span className="nexa-badge" style={{ color, background: color + "15" }}>{label}</span>;
                })()}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
