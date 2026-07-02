import { useEffect, useRef, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../../app/contexts/AuthContext";
import { useAccount } from "../../../app/contexts/AccountContext";
import { UnidadeStatus } from "../../../domain/unidade/UnidadeStatus";
import { getNegotiationStatusLabel } from "../../../domain/negociacao/NegotiationStatusLabel";
import { useNegotiationsOverview } from "../hooks/useNegotiationsOverview";
import NegotiationImportWizard from "../components/NegotiationImportWizard";
import { EmptyState } from "../../../shared/components/EmptyState";
import { SearchableSelect } from "../../../shared/components/SearchableSelect";
import { createClient } from "../../../infra/repositories/clientsSupabaseRepository";
import { getPermissions } from "../../../shared/utils/permissoes";
import { formatCurrency } from "../../../shared/utils/masks";
import { useScreen } from "../../../shared/hooks/useIsMobile";

const STATUS_PILLS = [
  { value: "all", label: "Todos" },
  { value: "OPEN", label: "Aberta" },
  { value: "IN_PROGRESS", label: "Em negociação" },
  { value: "PROPOSAL", label: "Proposta" },
  { value: "RESERVATION", label: "Reserva" },
  { value: "WON", label: "Ganhas" },
  { value: "LOST", label: "Perdidas" },
  { value: "CANCELLED", label: "Canceladas" },
];

const STATUS_COLOR: Record<string, { fg: string; bg: string }> = {
  OPEN: { fg: "#60A5FA", bg: "rgba(96,165,250,0.1)" },
  IN_PROGRESS: { fg: "#4ADE80", bg: "rgba(74,222,128,0.1)" },
  PROPOSAL: { fg: "#A78BFA", bg: "rgba(167,139,250,0.1)" },
  RESERVATION: { fg: "#60A5FA", bg: "rgba(96,165,250,0.1)" },
  WON: { fg: "#22C55E", bg: "rgba(34,197,94,0.1)" },
  LOST: { fg: "#F87171", bg: "rgba(248,113,113,0.1)" },
  CANCELLED: { fg: "#706B5F", bg: "rgba(112,107,95,0.1)" },
};

const daysSince = (d: string | Date) => {
  const t = (d instanceof Date ? d : new Date(d)).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((Date.now() - t) / 86400000));
};

const btnPrimary: React.CSSProperties = {
  background: "var(--color-sprout)",
  color: "var(--color-ink)",
  border: "none",
  borderRadius: 8,
  padding: "0 16px",
  height: 36,
  fontSize: 13,
  fontWeight: 700,
};

const btnSecondary: React.CSSProperties = {
  background: "transparent",
  color: "var(--color-bone)",
  border: "1px solid var(--color-stone)",
  borderRadius: 8,
  padding: "0 16px",
  height: 36,
  fontSize: 13,
  fontWeight: 700,
};

export default function NegotiationsPage() {
  const navigateToSimulador = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedUnitId = searchParams.get("unitId");
  const { authenticatedProfile } = useAuth();
  const { isBroker, brokerId } = useAccount();
  const screen = useScreen();
  const {
    accountContext: {
      account,
      errorMessage: accountErrorMessage,
      status: accountStatus,
    },
    developmentContext: {
      development,
      errorMessage: developmentErrorMessage,
      status: developmentStatus,
    },
    negotiationsState: {
      createNegotiation,
      errorMessage: negotiationErrorMessage,
      isLoading: isLoadingNegotiations,
      isUpdating,
      negotiations,
      status: negotiationStatus,
    },
    clientsState: { clients, isLoading: isLoadingClients, refetch: refetchClients },
    brokersState: { brokers, isLoading: isLoadingBrokers },
    unitsState: {
      errorMessage: unitsErrorMessage,
      isLoading: isLoadingUnits,
      status: unitsStatus,
      units,
    },
  } = useNegotiationsOverview();

  const [showForm, setShowForm] = useState(!!preselectedUnitId);
  const [showImport, setShowImport] = useState(false);
  const [selectedUnitId, setSelectedUnitId] = useState(preselectedUnitId ?? "");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedBrokerId, setSelectedBrokerId] = useState("");
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const firstInputRef = useRef<HTMLSelectElement>(null);

  // Quick client creation
  const [showNewClient, setShowNewClient] = useState(false);
  const [ncName, setNcName] = useState(""); const [ncEmail, setNcEmail] = useState(""); const [ncPhone, setNcPhone] = useState("");
  const [ncSaving, setNcSaving] = useState(false); const [ncErr, setNcErr] = useState<string | null>(null);

  // Table filters (director/manager only)
  const [filterBroker, setFilterBroker] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [sortBy, setSortBy] = useState<"date" | "score">("date");
  const canFilter = getPermissions(account?.role ?? null).canViewFullDashboard;
  // Importar negociações é restrito a MANAGER_ROLES (owner/director/manager).
  const canImport = ["owner", "director", "manager"].includes(account?.role ?? "");

  useEffect(() => {
    if (showForm) firstInputRef.current?.focus();
  }, [showForm]);

  const isLoading =
    isLoadingNegotiations || isLoadingUnits || isLoadingClients || isLoadingBrokers;
  const unitsById = new Map(units.map((unit) => [unit.id, unit]));
  const clientsById = new Map(clients.map((c) => [c.id, c]));
  const brokersById = new Map(brokers.map((b) => [b.id, b]));
  const availableUnits = units.filter(
    (unit) => unit.status === UnidadeStatus.DISPONIVEL,
  );

  async function handleCreateNegotiation() {
    if (!account || !development || !selectedUnitId || !selectedClientId) return;
    const effectiveBrokerId = isBroker ? brokerId : (selectedBrokerId || null);
    const result = await createNegotiation({
      accountId: account.accountId,
      developmentId: development.developmentId,
      unitId: selectedUnitId,
      clientId: selectedClientId,
      brokerId: effectiveBrokerId,
      performedBy: authenticatedProfile?.id ?? null,
    });
    if (result) {
      setShowForm(false);
      setSelectedUnitId("");
      setSelectedClientId("");
      setSelectedBrokerId("");
      setErrorMsg(null);
      setSuccessMsg("Salvo com sucesso");
      // Criar negociação leva para a ficha da negociação criada (não p/ o pipeline).
      navigateToSimulador(`/negociacoes/${result.id}`);
    } else {
      // Erro completo já vai ao console pelo hook; aqui, toast legível em PT.
      setSuccessMsg(null);
      setErrorMsg("Não foi possível criar a negociação. Verifique os dados e tente novamente.");
    }
  }

  async function handleQuickClient() {
    if (!account?.accountId || !ncName.trim() || !ncEmail.trim() || !ncPhone.trim()) return;
    setNcSaving(true); setNcErr(null);
    try {
      const c = await createClient({ accountId: account.accountId, name: ncName.trim(), email: ncEmail.trim(), phone: ncPhone.trim(), city: "", createdBy: authenticatedProfile?.id });
      setSelectedClientId(c.id);
      setShowNewClient(false); setNcName(""); setNcEmail(""); setNcPhone("");
      refetchClients();
    } catch (e: unknown) { setNcErr(e instanceof Error ? e.message : "Falha ao criar cliente."); }
    finally { setNcSaving(false); }
  }

  if (isLoading) {
    return <p style={{ color: "var(--color-fog)" }}>Carregando negociações...</p>;
  }

  if (accountStatus === "no_access" || accountStatus === "error") {
    return <p style={{ color: "var(--color-fog)" }}>{accountErrorMessage ?? "Conta indisponível."}</p>;
  }

  if (developmentStatus === "empty" || developmentStatus === "error") {
    return <p style={{ color: "var(--color-fog)" }}>{developmentErrorMessage ?? "Empreendimento indisponível."}</p>;
  }

  if (negotiationStatus === "idle") {
    return <p style={{ color: "var(--color-fog)" }}>Selecione conta e empreendimento para continuar.</p>;
  }

  if (negotiationStatus === "error") {
    return <p style={{ color: "var(--color-red)" }}>{negotiationErrorMessage}</p>;
  }

  if (unitsStatus === "error") {
    return <p style={{ color: "var(--color-red)" }}>{unitsErrorMessage}</p>;
  }

  return (
    <div>
      {/* Page header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{
            fontFamily: "'Instrument Serif', Georgia, serif",
            fontStyle: "italic", fontSize: 28, color: "var(--color-bone)",
            fontWeight: 400, margin: 0, lineHeight: 1.1,
          }}>
            Negociações
          </h1>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-fog)", marginTop: 4, letterSpacing: "0.05em" }}>
            {(() => {
              const total = negotiations.length;
              const emAndamento = negotiations.filter((n) => n.status === "IN_PROGRESS" || n.status === "OPEN").length;
              const totalVGV = negotiations
                .filter((n) => n.status !== "LOST" && n.status !== "CANCELLED")
                .reduce((acc, n) => acc + (unitsById.get(n.unitId)?.valor ?? 0), 0);
              let s = `${total} ${total === 1 ? "registro" : "registros"}`;
              if (emAndamento > 0) s += ` · ${emAndamento} em andamento`;
              if (totalVGV > 0) s += ` · ${formatCurrency(totalVGV)} em pipeline`;
              return s;
            })()}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <a href="/pipeline" style={{ ...btnSecondary, fontSize: 12, textDecoration: "none", display: "inline-flex", alignItems: "center" }}>Pipeline</a>
          {canImport && (
            <button type="button" onClick={() => setShowImport(true)} style={btnSecondary}>
              Importar negociações
            </button>
          )}
          <button type="button" onClick={() => setShowForm((p) => !p)} style={showForm ? btnSecondary : btnPrimary}>
            {showForm ? "Cancelar" : "Nova negociação"}
          </button>
        </div>
      </div>

      {canImport && (
        <NegotiationImportWizard
          open={showImport}
          onClose={() => setShowImport(false)}
          accountId={account?.accountId ?? null}
          developmentId={development?.developmentId ?? null}
          developmentName={development?.developmentName ?? null}
          onImported={refetchClients}
        />
      )}

      {successMsg ? (
        <div style={{ background: "var(--color-sprout-muted)", border: "1px solid var(--color-sprout)", borderRadius: 8, padding: "10px 16px", marginBottom: 16, fontSize: 13, color: "var(--color-sprout)", display: "flex", alignItems: "center", gap: 8 }}>
          <span>&#10003;</span> {successMsg}
        </div>
      ) : null}

      {errorMsg ? (
        <div style={{ background: "rgba(248,113,113,0.12)", border: "1px solid var(--color-red)", borderRadius: 8, padding: "10px 16px", marginBottom: 16, fontSize: 13, color: "var(--color-red)", display: "flex", alignItems: "center", gap: 8 }}>
          <span>&#9888;</span> {errorMsg}
        </div>
      ) : null}

      {/* Form */}
      {showForm ? (
        <div className="nexa-card" style={{ marginBottom: 24 }}>
          <div className="nexa-label" style={{ marginBottom: 16 }}>Criar nova negociação</div>
          <div style={{ display: "grid", gridTemplateColumns: screen.isMobile ? "1fr" : screen.isTablet ? "1fr 1fr" : "1fr 1fr 1fr", gap: 12, maxWidth: 700 }}>
            <label>
              <span className="nexa-label" style={{ display: "block", marginBottom: 6 }}>Unidade *</span>
              <select ref={firstInputRef} value={selectedUnitId} onChange={(e) => setSelectedUnitId(e.target.value)}>
                <option value="">{availableUnits.length === 0 ? "Nenhuma disponível" : "Selecione"}</option>
                {availableUnits.map((u) => (
                  <option key={u.id} value={u.id}>Q{u.quadra} L{u.lote} — R$ {u.valor.toLocaleString("pt-BR")}</option>
                ))}
              </select>
            </label>
            <div>
              <span className="nexa-label" style={{ display: "block", marginBottom: 6 }}>Cliente *</span>
              <div style={{ display: "flex", gap: 6 }}>
                <select value={selectedClientId} onChange={(e) => setSelectedClientId(e.target.value)} style={{ flex: 1 }}>
                  <option value="">{clients.length === 0 ? "Nenhum cliente" : "Selecione"}</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <button type="button" onClick={() => setShowNewClient(true)} style={{ padding: "0 10px", borderRadius: 6, border: "1px solid var(--color-stone)", background: "transparent", color: "var(--color-sprout)", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>+ Novo</button>
              </div>
            </div>
            {!isBroker ? (
              <label>
                <span className="nexa-label" style={{ display: "block", marginBottom: 6 }}>Corretor</span>
                <select value={selectedBrokerId} onChange={(e) => setSelectedBrokerId(e.target.value)}>
                  <option value="">Opcional</option>
                  {brokers.filter((b) => b.status === "active" && b.approvalStatus === "approved").map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
          <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
            <button type="button" disabled={!selectedUnitId || !selectedClientId || isUpdating} onClick={() => void handleCreateNegotiation()} style={btnPrimary}>
              {isUpdating ? "Criando..." : "Criar negociação"}
            </button>
          </div>
          {negotiationErrorMessage ? <p style={{ color: "var(--color-red)", marginTop: 8, fontSize: 12 }}>{negotiationErrorMessage}</p> : null}
        </div>
      ) : null}

      {/* Filters */}
      {canFilter && negotiations.length > 0 ? (
        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ minWidth: 220, maxWidth: 260, flex: "0 1 260px" }}>
            <SearchableSelect
              options={brokers.filter((b) => b.status === "active").map((b) => ({ value: b.id, label: b.name }))}
              value={filterBroker === "all" ? "" : filterBroker}
              onChange={(v) => setFilterBroker(v || "all")}
              placeholder="Buscar corretor..."
              emptyOptionLabel="Todos os corretores"
            />
          </div>

          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {STATUS_PILLS.map((opt) => {
              const active = filterStatus === opt.value || (filterStatus === "all" && opt.value === "all");
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFilterStatus(opt.value)}
                  style={{
                    padding: "6px 12px", borderRadius: 8,
                    border: active ? "1px solid rgba(74,222,128,0.3)" : "1px solid rgba(42,40,34,0.5)",
                    background: active ? "rgba(74,222,128,0.08)" : "transparent",
                    color: active ? "#4ADE80" : "#9C9686",
                    fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600,
                    cursor: "pointer", transition: "all 0.15s",
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "date" | "score")}
            style={{
              padding: "8px 32px 8px 12px", borderRadius: 8,
              background: "linear-gradient(145deg, var(--surface-raised), var(--surface-base))",
              border: "1px solid var(--border-default)",
              color: "var(--text-secondary)", fontFamily: "var(--font-mono)", fontSize: 11,
              appearance: "none",
              backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%239C9686' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E\")",
              backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center",
              cursor: "pointer",
            }}
          >
            <option value="date">Ordenar por data</option>
            <option value="score">Ordenar por score</option>
          </select>
        </div>
      ) : null}

      {(() => {
        let filtered = negotiations;
        if (filterBroker !== "all") filtered = filtered.filter((n) => n.brokerId === filterBroker);
        if (filterStatus !== "all") filtered = filtered.filter((n) => n.status === filterStatus);
        if (sortBy === "score") filtered = [...filtered].sort((a, b) => (b.score ?? 50) - (a.score ?? 50));
        return !filtered || filtered.length === 0 ? (
          <EmptyState icone={"\u2197"} titulo="Nenhuma negociação ainda" descricao="Comece simulando uma condição comercial para um cliente e envie para o pipeline." ctaLabel="Abrir Simulador" onCta={() => navigateToSimulador("/simulador")} />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {filtered.map((negotiation) => {
              const unit = unitsById.get(negotiation.unitId);
              const cl = negotiation.clientId ? clientsById.get(negotiation.clientId) : null;
              const br = negotiation.brokerId ? brokersById.get(negotiation.brokerId) : null;
              const days = daysSince(negotiation.createdAt);
              const isUrgent = days > 7;
              const isWarning = days > 4 && !isUrgent;
              const statusColor = STATUS_COLOR[negotiation.status] ?? { fg: "#9C9686", bg: "rgba(156,150,134,0.08)" };
              const score = negotiation.score ?? 0;

              return (
                <div
                  key={negotiation.id}
                  onClick={() => navigateToSimulador(`/negociacoes/${negotiation.id}`)}
                  style={{
                    display: "flex", alignItems: "center", gap: 14,
                    padding: "12px 16px", cursor: "pointer",
                    background: isUrgent
                      ? "linear-gradient(145deg, rgba(248,113,113,0.04), var(--surface-base))"
                      : "linear-gradient(145deg, var(--surface-raised), var(--surface-base))",
                    border: isUrgent ? "1px solid rgba(248,113,113,0.15)" : "1px solid var(--border-default)",
                    borderRadius: 10,
                    transition: "border-color 0.15s, transform 0.1s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "rgba(74,222,128,0.15)";
                    e.currentTarget.style.transform = "translateY(-1px)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = isUrgent ? "rgba(248,113,113,0.15)" : "var(--border-default)";
                    e.currentTarget.style.transform = "none";
                  }}
                >
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: "var(--text-primary)", minWidth: 70 }}>
                    {unit ? `Q${unit.quadra} L${unit.lote}` : (negotiation.unitId?.slice(0, 8) ?? "Imóvel")}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {cl?.name ?? <span style={{ color: "#706B5F", fontStyle: "italic" }}>Sem cliente</span>}
                    </div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {br?.name ?? "—"}
                    </div>
                  </div>

                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700, color: "#4ADE80", minWidth: 110, textAlign: "right" }}>
                    {unit ? formatCurrency(unit.valor) : "—"}
                  </div>

                  {score > 0 ? (
                    <div style={{
                      fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700,
                      color: score >= 70 ? "#4ADE80" : score >= 40 ? "#FBBF24" : "#F87171",
                      background: score >= 70 ? "rgba(74,222,128,0.1)" : score >= 40 ? "rgba(251,191,36,0.1)" : "rgba(248,113,113,0.1)",
                      padding: "3px 8px", borderRadius: 6, minWidth: 32, textAlign: "center",
                    }}>
                      {score}
                    </div>
                  ) : null}

                  <div style={{
                    fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 600,
                    color: statusColor.fg, background: statusColor.bg,
                    padding: "3px 8px", borderRadius: 4,
                    letterSpacing: "0.05em", whiteSpace: "nowrap", textTransform: "uppercase",
                  }}>
                    {getNegotiationStatusLabel(negotiation.status)}
                  </div>

                  <div style={{
                    fontFamily: "var(--font-mono)", fontSize: 10,
                    color: isUrgent ? "#F87171" : isWarning ? "#FBBF24" : "var(--text-muted)",
                    minWidth: 50, textAlign: "right",
                  }}>
                    {days === 0 ? "hoje" : `há ${days}d`}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* Quick client creation modal */}
      {showNewClient ? (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }} onClick={() => { if (!ncSaving) setShowNewClient(false); }}>
          <div style={{ background: "var(--color-carbon)", border: "1px solid var(--color-stone)", borderRadius: 16, padding: 32, width: "100%", maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--color-bone)", margin: "0 0 16px" }}>Novo cliente</h2>
            <div style={{ display: "grid", gap: 12 }}>
              <div><span className="nexa-label" style={{ display: "block", marginBottom: 6 }}>Nome *</span><input type="text" value={ncName} onChange={(e) => setNcName(e.target.value)} placeholder="Nome completo" autoFocus /></div>
              <div><span className="nexa-label" style={{ display: "block", marginBottom: 6 }}>E-mail *</span><input type="email" value={ncEmail} onChange={(e) => setNcEmail(e.target.value)} placeholder="email@exemplo.com" /></div>
              <div><span className="nexa-label" style={{ display: "block", marginBottom: 6 }}>Telefone *</span><input type="tel" value={ncPhone} onChange={(e) => setNcPhone(e.target.value)} placeholder="(00) 00000-0000" /></div>
            </div>
            {ncErr ? <div style={{ marginTop: 12, fontSize: 13, color: "#F87171" }}>{ncErr}</div> : null}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 20 }}>
              <button type="button" disabled={ncSaving} onClick={() => setShowNewClient(false)} style={{ ...btnSecondary, height: 36 }}>Cancelar</button>
              <button type="button" disabled={ncSaving || !ncName.trim() || !ncEmail.trim() || !ncPhone.trim()} onClick={() => void handleQuickClient()} style={{ ...btnPrimary, height: 36 }}>{ncSaving ? "Salvando..." : "Salvar cliente"}</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
