import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../../app/contexts/AuthContext";
import { useAccount } from "../../../app/contexts/AccountContext";
import { UnidadeStatus } from "../../../domain/unidade/UnidadeStatus";
import { useNegotiationsOverview } from "../hooks/useNegotiationsOverview";
import { useNegotiationsBoard } from "../hooks/useNegotiationsBoard";
import type { KanbanCard } from "../hooks/useKanbanData";
import { STAGES, stageMeta, columnOfStatus, type BoardStage } from "../board/stageColumn";
import { semaphoreOf, type SemaphoreLevel } from "../board/semaphore";
import { NegotiationStatus, type NegotiationStatus as NegotiationStatusType } from "../../../domain/status/negotiation";
import { RESERVATION_TERMINAL_DB_VALUES } from "../../../domain/status/reservation";
import NegotiationImportWizard from "../components/NegotiationImportWizard";
import { EmptyState } from "../../../shared/components/EmptyState";
import { SearchableSelect } from "../../../shared/components/SearchableSelect";
import { NexaSelect } from "../../../shared/ui/NexaSelect";
import { NexaModal } from "../../../shared/ui/NexaModal";
import { createClient } from "../../../infra/repositories/clientsSupabaseRepository";
import { getPermissions } from "../../../shared/utils/permissoes";
import { formatCurrency } from "../../../shared/utils/masks";
import { useScreen } from "../../../shared/hooks/useIsMobile";

// Rótulos/cores de estágio vêm da fonte única (board/stageColumn) — sem vocabulário
// local. "Todas" + 5 estágios canônicos, cada chip com contador da fonte única.
const SEMA_COLOR: Record<SemaphoreLevel, string> = { green: "#4ADE80", amber: "#E8B45A", red: "#F87171" };

function boardUnitLabel(c: KanbanCard): string {
  if (c.thirdPartyPropertyId) return c.thirdPartyPropertyTitulo || "Imóvel";
  if (c.quadra) return `Q${c.quadra} · L${c.lote}`;
  return "Sem unidade";
}
function boardUnitDot(unitStatus: string | null): string {
  const s = (unitStatus || "").toLowerCase();
  if (s === "vendido" || s === "sold") return "#34D399";
  if (s === "reservado" || s === "reserved") return "#E8B45A";
  if (s === "em_negociacao") return "#7DA7F4";
  return "#4ADE80";
}
const NEG_STATUS_VALUES = new Set<string>(Object.values(NegotiationStatus));
function coerceStatus(raw: string): NegotiationStatusType {
  const up = (raw || "").trim().toUpperCase();
  return (NEG_STATUS_VALUES.has(up) ? up : NegotiationStatus.IN_PROGRESS) as NegotiationStatusType;
}

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
  const { isBroker, brokerId, isConsultant, ownerProfileId } = useAccount();
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
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  // Quick client creation
  const [showNewClient, setShowNewClient] = useState(false);
  const [ncName, setNcName] = useState(""); const [ncEmail, setNcEmail] = useState(""); const [ncPhone, setNcPhone] = useState("");
  const [ncSaving, setNcSaving] = useState(false); const [ncErr, setNcErr] = useState<string | null>(null);

  // Table filters (director/manager only)
  const [filterBroker, setFilterBroker] = useState("all");
  const [selectedStage, setSelectedStage] = useState<BoardStage | "all">("all");
  const [sortBy, setSortBy] = useState<"date" | "valor">("date");
  const canFilter = getPermissions(account?.role ?? null).canViewFullDashboard;

  // Fonte ÚNICA da Lista (mesma do Kanban/Funil): números idênticos por construção.
  const listFilters = isBroker
    ? { brokerId }
    : isConsultant
      ? { ownerProfileId }
      : filterBroker !== "all"
        ? { brokerId: filterBroker }
        : undefined;
  const { board, thresholdDays } = useNegotiationsBoard({
    accountId: account?.accountId ?? null,
    developmentId: development?.developmentId ?? null,
    filters: listFilters,
    search,
  });
  // Importar negociações é restrito a MANAGER_ROLES (owner/director/manager).
  const canImport = ["owner", "director", "manager"].includes(account?.role ?? "");

  const isLoading =
    isLoadingNegotiations || isLoadingUnits || isLoadingClients || isLoadingBrokers;
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
      // Criar negociação leva para a ficha, que exibe o toast de confirmação.
      navigateToSimulador(`/negociacoes/${result.id}`, { state: { justCreated: true } });
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
              // Números canônicos da fonte única — idênticos ao Kanban/Funil.
              let s = `${board.openCount} ${board.openCount === 1 ? "aberta" : "abertas"}`;
              if (board.openVGV > 0) s += ` · ${formatCurrency(board.openVGV)} no funil`;
              if (board.wonCount > 0) s += ` · ${board.wonCount} ${board.wonCount === 1 ? "venda" : "vendas"}`;
              return s;
            })()}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
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
              <NexaSelect
                value={selectedUnitId ?? ""}
                onChange={(v) => setSelectedUnitId(v)}
                options={availableUnits.map((u) => ({ value: u.id, label: `Q${u.quadra} L${u.lote} — R$ ${u.valor.toLocaleString("pt-BR")}` }))}
                placeholder={availableUnits.length === 0 ? "Nenhuma disponível" : "Selecione"}
                ariaLabel="Unidade"
                autoFocus={showForm}
              />
            </label>
            <div>
              <span className="nexa-label" style={{ display: "block", marginBottom: 6 }}>Cliente *</span>
              <div style={{ display: "flex", gap: 6 }}>
                <div style={{ flex: 1 }}>
                  <NexaSelect
                    value={selectedClientId ?? ""}
                    onChange={(v) => setSelectedClientId(v)}
                    options={clients.map((c) => ({ value: c.id, label: c.name }))}
                    placeholder={clients.length === 0 ? "Nenhum cliente" : "Selecione"}
                    ariaLabel="Cliente"
                  />
                </div>
                <button type="button" onClick={() => setShowNewClient(true)} style={{ padding: "0 10px", borderRadius: 6, border: "1px solid var(--color-stone)", background: "transparent", color: "var(--color-sprout)", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>+ Novo</button>
              </div>
            </div>
            {!isBroker ? (
              <label>
                <span className="nexa-label" style={{ display: "block", marginBottom: 6 }}>Corretor</span>
                <NexaSelect
                  value={selectedBrokerId ?? ""}
                  onChange={(v) => setSelectedBrokerId(v)}
                  options={[
                    { value: "", label: "Opcional" },
                    ...brokers.filter((b) => b.status === "active" && b.approvalStatus === "approved").map((b) => ({ value: b.id, label: b.name })),
                  ]}
                  recentKey="negotiation-broker"
                  placeholder="Opcional"
                  ariaLabel="Corretor"
                />
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

      {/* Busca — disponível a todos os perfis */}
      {board.totalCount > 0 ? (
        <div style={{ marginBottom: 12 }}>
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} placeholder="Buscar por cliente, unidade ou corretor..." style={{ width: "100%", maxWidth: 420, background: "var(--surface-raised)", border: "1px solid var(--border-default)", borderRadius: 8, padding: "10px 14px", color: "var(--text-primary)", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
        </div>
      ) : null}

      {/* Filtros — chips de estágio com contadores (todos os perfis) + corretor (gestão) */}
      {board.totalCount > 0 ? (
        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
          {canFilter ? (
            <div style={{ minWidth: 220, maxWidth: 260, flex: "0 1 260px" }}>
              <SearchableSelect
                options={brokers.filter((b) => b.status === "active").map((b) => ({ value: b.id, label: b.name }))}
                value={filterBroker === "all" ? "" : filterBroker}
                onChange={(v) => setFilterBroker(v || "all")}
                placeholder="Buscar corretor..."
                emptyOptionLabel="Todos os corretores"
              />
            </div>
          ) : null}

          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {[{ id: "all" as const, label: "Todas", count: board.totalCount, color: "#9C9686" },
              ...STAGES.map((s) => ({ id: s.id, label: s.label, count: board.countByStage[s.id], color: s.color }))].map((chip) => {
              const active = selectedStage === chip.id;
              return (
                <button key={chip.id} type="button" onClick={() => { setSelectedStage(chip.id); setPage(0); }}
                  style={{ padding: "6px 12px", borderRadius: 8,
                    border: active ? `1px solid ${chip.color}55` : "1px solid rgba(42,40,34,0.5)",
                    background: active ? `${chip.color}14` : "transparent",
                    color: active ? chip.color : "var(--color-fog)",
                    fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                  {chip.label} · {chip.count}
                </button>
              );
            })}
          </div>

          <div style={{ width: 200 }}>
            <NexaSelect
              value={sortBy}
              onChange={(v) => setSortBy(v as "date" | "valor")}
              options={[
                { value: "date", label: "Ordenar por data" },
                { value: "valor", label: "Ordenar por valor" },
              ]}
              ariaLabel="Ordenação"
            />
          </div>
        </div>
      ) : null}

      {(() => {
        // Lista consome a MESMA fonte (board.negotiations, já filtrada por busca/corretor
        // pelo hook). Aqui só: filtro por chip de estágio, ordenação e paginação.
        const nowMs = Date.now();
        let filtered = selectedStage === "all"
          ? board.negotiations
          : board.negotiations.filter((c) => columnOfStatus(coerceStatus(c.status)) === selectedStage);
        filtered = [...filtered].sort((a, b) =>
          sortBy === "valor"
            ? (b.valor ?? 0) - (a.valor ?? 0)
            : new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        );
        const PAGE_SIZE = 25;
        const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
        const safePage = Math.min(page, Math.max(0, pageCount - 1));
        return filtered.length === 0 ? (
          <EmptyState icone={"\u2197"} titulo="Nenhuma negociação ainda" descricao="Comece simulando uma condição comercial para um cliente e envie para o pipeline." ctaLabel="Abrir Simulador" onCta={() => navigateToSimulador("/simulador")} />
        ) : (
          <>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE).map((c) => {
              const meta = stageMeta(columnOfStatus(coerceStatus(c.status)));
              const s = semaphoreOf({
                nextActionAt: c.nextActionAt, followUpAt: c.followUpAt, lastActivityAt: c.lastActivityAt,
                updatedAt: c.updatedAt, stageChangedAt: c.stageChangedAt, reservaExpiresAt: c.reservaExpiresAt,
                reservaAtiva: !!c.reservaStatus && !RESERVATION_TERMINAL_DB_VALUES.includes(c.reservaStatus),
              }, thresholdDays, nowMs);
              const upd = Math.max(0, Math.floor((nowMs - new Date(c.updatedAt).getTime()) / 86400000));
              return (
                <div key={c.id} onClick={() => navigateToSimulador(`/negociacoes/${c.id}`)}
                  style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", cursor: "pointer",
                    background: "linear-gradient(145deg, var(--surface-raised), var(--surface-base))",
                    border: "1px solid var(--border-default)", borderRadius: 10, transition: "border-color 0.15s, transform 0.1s" }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(74,222,128,0.15)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border-default)"; e.currentTarget.style.transform = "none"; }}>
                  {/* Negociação: bolinha unidade + cliente + código */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: boardUnitDot(c.unitStatus), flexShrink: 0 }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {c.clienteNome ?? <span style={{ color: "#706B5F", fontStyle: "italic" }}>Sem cliente</span>}
                      </div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{boardUnitLabel(c)}</div>
                    </div>
                  </div>
                  {/* Corretor */}
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)", minWidth: 90, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.corretorNome ?? "—"}</div>
                  {/* Estágio */}
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700, color: meta.color, background: meta.soft, padding: "3px 8px", borderRadius: 4, letterSpacing: "0.05em", whiteSpace: "nowrap", textTransform: "uppercase", minWidth: 92, textAlign: "center" }}>{meta.label}</div>
                  {/* Valor */}
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700, color: "var(--color-bone)", minWidth: 100, textAlign: "right" }}>{c.valor ? formatCurrency(c.valor) : "—"}</div>
                  {/* Próxima ação (semáforo) */}
                  <div style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 120 }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: SEMA_COLOR[s.level], flexShrink: 0 }} />
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: SEMA_COLOR[s.level], whiteSpace: "nowrap" }}>{s.label}</span>
                  </div>
                  {/* Atualizada */}
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)", minWidth: 54, textAlign: "right" }}>{upd === 0 ? "hoje" : `há ${upd}d`}</div>
                </div>
              );
            })}
          </div>
          {pageCount > 1 ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginTop: 16 }}>
              <button type="button" disabled={safePage <= 0} onClick={() => setPage(safePage - 1)} style={{ ...btnSecondary, height: 36, opacity: safePage <= 0 ? 0.4 : 1 }}>Anterior</button>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-muted)" }}>Página {safePage + 1} de {pageCount} · {filtered.length} negociações</span>
              <button type="button" disabled={safePage >= pageCount - 1} onClick={() => setPage(safePage + 1)} style={{ ...btnSecondary, height: 36, opacity: safePage >= pageCount - 1 ? 0.4 : 1 }}>Próxima</button>
            </div>
          ) : null}
          </>
        );
      })()}

      {/* Quick client creation modal */}
      {showNewClient ? (
        <NexaModal onClose={() => { if (!ncSaving) setShowNewClient(false); }}>
          <div style={{ background: "var(--color-carbon)", border: "1px solid var(--color-stone)", borderRadius: 16, padding: 32, width: "100%", maxWidth: 400 }}>
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
        </NexaModal>
      ) : null}
    </div>
  );
}
