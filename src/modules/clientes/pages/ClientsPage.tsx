import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAccount } from "../../../app/contexts/AccountContext";
import { useAuth } from "../../../app/contexts/AuthContext";
import { useClients } from "../hooks/useClients";
import { useClientFilter } from "../../../shared/hooks/useClientFilter";
import { useScreen } from "../../../shared/hooks/useIsMobile";
import { useBrokers } from "../../corretores/hooks/useBrokers";
import { createClient } from "../../../infra/repositories/clientsSupabaseRepository";
import { supabase } from "../../../infra/supabase/supabaseClient";
import type { Client } from "../../../shared/types/client";
import { EmptyState } from "../../../shared/components/EmptyState";
import { getPermissions } from "../../../shared/utils/permissoes";
import { formatPhone } from "../../../shared/utils/masks";
import SpouseLinkModal from "../components/SpouseLinkModal";
import type { MaritalStatus, LegalRegime } from "../../../shared/types/client";
import { NexaSelect } from "../../../shared/ui/NexaSelect";

const TEMP_COLORS: Record<string, string> = { hot: "#F87171", warm: "#FBBF24", cold: "#60A5FA", quente: "#F87171", morno: "#FBBF24", frio: "#60A5FA" };

const btnP: React.CSSProperties = { background: "var(--color-sprout)", color: "var(--color-ink)", border: "none", borderRadius: 8, padding: "0 16px", height: 36, fontSize: 13, fontWeight: 700, cursor: "pointer" };
const btnS: React.CSSProperties = { background: "transparent", color: "var(--color-bone)", border: "1px solid var(--color-stone)", borderRadius: 8, padding: "0 16px", height: 36, fontSize: 13, fontWeight: 700, cursor: "pointer" };

const AVATAR_COLORS = ["#4ADE80", "#60A5FA", "#A78BFA", "#F87171", "#FBBF24", "#D97706", "#EC4899", "#22D3EE"];
function getAvatarColor(name: string): string {
  const hash = (name ?? "").split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}
function getInitials(name: string): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return "??";
}

const STATUS_MAP: Record<string, { color: string; label: string }> = {
  lead: { color: "#60A5FA", label: "LEAD" },
  contacted: { color: "#FBBF24", label: "CONTATADO" },
  qualified: { color: "#F97316", label: "QUALIFICADO" },
  active: { color: "#4ADE80", label: "ATIVO" },
  customer: { color: "#22C55E", label: "CLIENTE" },
  lost: { color: "#9C9686", label: "PERDIDO" },
};

export default function ClientsPage() {
  const navigate = useNavigate();
  const { account, errorMessage: accountError, isUsingMock, status: accountStatus, isBroker, brokerId } = useAccount();
  const { authenticatedProfile } = useAuth();
  const clientFilter = useClientFilter();
  const { clients, errorMessage, isLoading, status } = useClients(account?.accountId ?? null, isUsingMock, clientFilter);
  const { brokers } = useBrokers(account?.accountId ?? null, isUsingMock);
  const screen = useScreen();
  const isMobile = screen.isMobile;
  const perms = getPermissions(account?.role ?? null);

  const [showForm, setShowForm] = useState(false);
  const [list] = useState<Client[]>([]);
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [phone, setPhone] = useState("");
  const [cpf, setCpf] = useState("");
  const [selectedBrokerId, setSelectedBrokerId] = useState(isBroker ? (brokerId ?? "") : "");
  const [saving, setSaving] = useState(false); const [err, setErr] = useState<string | null>(null);
  // Engrenagem de Partes v1 — estado civil + regime + fluxo de cônjuge após criar
  const [maritalStatus, setMaritalStatus] = useState<"" | "solteiro" | "casado" | "divorciado" | "viuvo" | "uniao_estavel">("");
  const [regimeCasamento, setRegimeCasamento] = useState<"comunhao_parcial" | "comunhao_universal" | "separacao_total" | "participacao_final_aquestos">("comunhao_parcial");
  const [pendingSpouseFor, setPendingSpouseFor] = useState<{ id: string; name: string; regime: "comunhao_parcial" | "comunhao_universal" | "separacao_total" | "participacao_final_aquestos" | null } | null>(null);
  const [successMsg] = useState<string | null>(null);
  const [filterBroker, setFilterBroker] = useState("all");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showForm) firstInputRef.current?.focus();
  }, [showForm]);
  useEffect(() => { if (isBroker && brokerId) setSelectedBrokerId(brokerId); }, [isBroker, brokerId]);

  const allClients = [...list, ...clients];
  const visibleClients = (() => {
    let r = allClients;
    if (filterBroker !== "all") r = r.filter((c) => c.brokerId === filterBroker);
    if (statusFilter !== "all") r = r.filter((c) => (c.status || "active") === statusFilter);
    if (search.trim()) { const t = search.toLowerCase(); r = r.filter((c) => c.name?.toLowerCase().includes(t) || c.email?.toLowerCase().includes(t) || c.phone?.includes(t) || (c as Record<string, unknown>).cpf_cnpj?.toString().includes(t)); }
    return r;
  })();

  async function handleSave() {
    if (!account?.accountId || !name.trim()) return;
    setSaving(true); setErr(null);
    try {
      // Engrenagem de Partes v1 — só grava regime se o estado civil comporta.
      const maritalNeedsRegime = maritalStatus === "casado" || maritalStatus === "uniao_estavel";
      const c = await createClient({
        accountId: account.accountId, name: name.trim(),
        email: email.trim() || undefined, phone: phone.trim() || undefined,
        cpf: cpf.trim() || undefined, createdBy: authenticatedProfile?.id,
        brokerId: selectedBrokerId || undefined,
        maritalStatus: (maritalStatus || undefined) as MaritalStatus | undefined,
        regimeCasamento: maritalNeedsRegime ? (regimeCasamento as LegalRegime) : undefined,
      });
      // Auto-distribute if no broker selected (weighted round-robin from lead_distribution)
      if (!selectedBrokerId && supabase) {
        try {
          const { data: dist } = await supabase.from("lead_distribution").select("id, consultant_id, current_count, weight").eq("account_id", account.accountId).eq("active", true);
          if (dist && dist.length > 0) {
            // Weighted round-robin: pick member with lowest (current_count / weight) score
            type DistRow = { id: string; consultant_id: string; current_count: number; weight: number };
            const rows = dist as DistRow[];
            const scored = rows.map((d) => ({ ...d, score: Number(d.current_count ?? 0) / Math.max(Number(d.weight ?? 1), 1) }));
            scored.sort((a, b) => a.score - b.score);
            const next = scored[0];
            await supabase.from("clients").update({ assigned_to: next.consultant_id, assigned_at: new Date().toISOString() }).eq("id", c.id);
            await supabase.from("lead_distribution").update({ current_count: Number(next.current_count ?? 0) + 1, last_assigned_at: new Date().toISOString() }).eq("id", next.id);
            supabase.from("notifications").insert({ account_id: account.accountId, recipient_id: next.consultant_id, sender_id: authenticatedProfile?.id ?? null, type: "new_lead_assigned", title: "Novo lead atribuído", message: `${name.trim()} foi atribuído a você pela distribuição automática.`, action_url: `/contatos/${c.id}`, read: false }).then(() => {}, () => {});
          }
        } catch { /* distribution is optional — don't block client creation */ }
      }
      // Engrenagem de Partes v1 — cliente casado: pedir cônjuge antes de navegar.
      if (maritalNeedsRegime) {
        setPendingSpouseFor({
          id: c.id,
          name: c.fullName || c.name,
          regime: regimeCasamento,
        });
        // Reseta campos do form (usuário permanece em /contatos até decidir).
        setName(""); setEmail(""); setPhone(""); setCpf("");
        setMaritalStatus(""); setRegimeCasamento("comunhao_parcial");
        setShowForm(false);
        return;
      }
      navigate(`/clientes/${c.id}`);
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
          <h1 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontStyle: "italic", fontSize: 28, fontWeight: 400, color: "var(--color-bone)", margin: 0, lineHeight: 1.1 }}>Contatos</h1>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-fog)", marginTop: 6, letterSpacing: "0.03em" }}>
            {allClients.length} {allClients.length === 1 ? "contato" : "contatos"}
            {allClients.filter((c) => (c.status as string) === "lead").length > 0 ? ` · ${allClients.filter((c) => (c.status as string) === "lead").length} leads` : ""}
            {allClients.filter((c) => c.temperature === "hot").length > 0 ? ` · ${allClients.filter((c) => c.temperature === "hot").length} quentes` : ""}
            {allClients.filter((c) => !c.assignedTo).length > 0 ? <span style={{ color: "#D97706" }}> · {allClients.filter((c) => !c.assignedTo).length} sem responsável</span> : null}
          </div>
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
          {/* Engrenagem de Partes v1 — estado civil + regime condicional */}
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap", marginTop: 10 }}>
            <label style={{ flex: 1, minWidth: 140 }}>
              <span className="nexa-label" style={{ display: "block", marginBottom: 6 }}>Estado civil</span>
              <NexaSelect value={maritalStatus} onChange={(v) => setMaritalStatus(v as typeof maritalStatus)} placeholder="— Selecione" ariaLabel="Estado civil" options={[{ value: "solteiro", label: "Solteiro(a)" }, { value: "casado", label: "Casado(a)" }, { value: "divorciado", label: "Divorciado(a)" }, { value: "viuvo", label: "Viúvo(a)" }, { value: "uniao_estavel", label: "União estável" }]} />
            </label>
            {(maritalStatus === "casado" || maritalStatus === "uniao_estavel") ? (
              <label style={{ flex: 2, minWidth: 220 }}>
                <span className="nexa-label" style={{ display: "block", marginBottom: 6 }}>Regime de bens *</span>
                <NexaSelect value={regimeCasamento} onChange={(v) => setRegimeCasamento(v as typeof regimeCasamento)} ariaLabel="Regime de bens" options={[{ value: "comunhao_parcial", label: "Comunhão parcial de bens" }, { value: "comunhao_universal", label: "Comunhão universal de bens" }, { value: "separacao_total", label: "Separação total de bens" }, { value: "participacao_final_aquestos", label: "Participação final nos aquestos" }]} />
              </label>
            ) : null}
          </div>
          {err ? <p style={{ color: "var(--color-red)", fontSize: 12, marginTop: 8 }}>{err}</p> : null}
          <div style={{ fontSize: 11, color: "var(--color-fog)", marginTop: 8 }}>
            {maritalStatus === "casado" || maritalStatus === "uniao_estavel"
              ? "Após salvar, pediremos o cônjuge (cliente existente ou novo cadastro)."
              : "Dados completos (endereço, cônjuge, documentos) ficam na ficha do cliente."}
          </div>
        </div>
      ) : null}

      {/* Search + filters */}
      {allClients.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <input type="text" placeholder="Buscar por nome, email, telefone..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: "100%", maxWidth: 480, padding: "10px 14px", background: "var(--surface-base)", border: "1px solid var(--color-stone)", borderRadius: 8, color: "var(--text-primary)", fontSize: 14, outline: "none", marginBottom: 12, boxSizing: "border-box" }} />
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
            {[["all", "Todos", allClients.length], ["lead", "Leads", allClients.filter((c) => (c.status as string) === "lead").length], ["active", "Ativos", allClients.filter((c) => c.status === "active" || !c.status).length], ["customer", "Clientes", allClients.filter((c) => (c.status as string) === "customer").length], ["lost", "Perdidos", allClients.filter((c) => (c.status as string) === "lost").length]].map(([k, l, n]) => (
              <button key={k as string} type="button" onClick={() => setStatusFilter(k as string)} style={{ padding: "6px 14px", borderRadius: 8, fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600, letterSpacing: "0.03em", background: statusFilter === k ? "rgba(74,222,128,0.08)" : "transparent", color: statusFilter === k ? "#4ADE80" : "var(--text-muted)", border: `1px solid ${statusFilter === k ? "rgba(74,222,128,0.3)" : "var(--color-stone)"}`, cursor: "pointer", transition: "all 0.15s" }}>{l} ({n})</button>
            ))}
          </div>
          {perms.canViewFullDashboard && (
            <div style={{ maxWidth: 260 }}>
              <NexaSelect value={filterBroker} onChange={(v) => setFilterBroker(v)} ariaLabel="Filtrar por corretor" options={[{ value: "all", label: "Todos os corretores" }, ...activeBrokers.map((b) => ({ value: b.id, label: b.name }))]} />
            </div>
          )}
        </div>
      )}

      {visibleClients.length === 0 && allClients.length === 0 ? (
        <EmptyState icone={"\u25CB"} titulo="Nenhum cliente cadastrado" descricao="Cadastre seu primeiro cliente para começar a criar simulações e negociações." ctaLabel="Novo cliente" onCta={() => setShowForm(true)} />
      ) : visibleClients.length === 0 ? (
        <div className="nexa-card" style={{ textAlign: "center", padding: 24 }}><p style={{ color: "var(--color-fog)", fontSize: 13 }}>Nenhum cliente encontrado para este filtro.</p></div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {visibleClients.map((c) => {
            const s = (c.status as string) || "active";
            const statusInfo = STATUS_MAP[s] || { color: "#9C9686", label: s.toUpperCase() };
            const tempColor = c.temperature ? TEMP_COLORS[c.temperature] : null;
            return (
              <div
                key={c.id}
                onClick={() => navigate(`/clientes/${c.id}`)}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 14px", cursor: "pointer",
                  background: "linear-gradient(145deg, var(--surface-raised), var(--surface-base))",
                  border: "1px solid var(--border-default)",
                  borderRadius: 10,
                  transition: "border-color 0.15s, transform 0.1s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(74,222,128,0.25)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border-default)"; e.currentTarget.style.transform = "none"; }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                  background: getAvatarColor(c.name),
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, color: "#12110F",
                  position: "relative",
                }}>
                  {getInitials(c.name)}
                  {tempColor && (
                    <span title={`Temperatura: ${c.temperature}`} style={{ position: "absolute", top: -2, right: -2, width: 10, height: 10, borderRadius: "50%", background: tempColor, border: "2px solid var(--surface-base)", boxShadow: c.temperature === "hot" ? `0 0 6px ${tempColor}80` : "none" }} />
                  )}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <Link to={`/clientes/${c.id}`} onClick={(e) => e.stopPropagation()} style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.name}
                    </Link>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, fontWeight: 700, color: statusInfo.color, background: statusInfo.color + "18", padding: "1px 6px", borderRadius: 4, letterSpacing: "0.08em" }}>
                      {statusInfo.label}
                    </span>
                    {!c.assignedTo && (
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, fontWeight: 700, color: "#D97706", background: "rgba(217,119,6,0.12)", padding: "1px 6px", borderRadius: 4, letterSpacing: "0.08em" }}>
                        SEM RESP.
                      </span>
                    )}
                  </div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {c.email || "—"}
                    {c.phone ? ` · ${formatPhone(c.phone)}` : ""}
                  </div>
                </div>

                {!isMobile && (
                  <div style={{ minWidth: 160, maxWidth: 220, fontFamily: "var(--font-mono)", fontSize: 10, color: "#9C9686", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "right" }}>
                    {c.brokerName || c.assignedToName || <span style={{ fontStyle: "italic", color: "var(--text-disabled)" }}>Sem responsável</span>}
                    {c.city ? ` · ${c.city}` : ""}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Engrenagem de Partes v1 — modal para vincular/cadastrar cônjuge após criar cliente casado */}
      {pendingSpouseFor ? (
        <SpouseLinkModal
          open={true}
          clientId={pendingSpouseFor.id}
          clientName={pendingSpouseFor.name}
          clientRegimeCasamento={pendingSpouseFor.regime}
          onClose={() => {
            // Pular — cliente foi salvo mas permanece sem cônjuge vinculado.
            // Ao abrir /clientes/:id dele, o Banner CTA aparecerá.
            const targetId = pendingSpouseFor.id;
            setPendingSpouseFor(null);
            navigate(`/clientes/${targetId}`);
          }}
          onLinked={() => {
            const targetId = pendingSpouseFor.id;
            setPendingSpouseFor(null);
            navigate(`/clientes/${targetId}`);
          }}
        />
      ) : null}
    </div>
  );
}
