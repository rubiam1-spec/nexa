import { useEffect, useLayoutEffect, useMemo, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useAccount } from "../../../app/contexts/AccountContext";
import { useDevelopment } from "../../../app/contexts/DevelopmentContext";
import { useAuth } from "../../../app/contexts/AuthContext";
import { useNegotiationsBoard } from "../hooks/useNegotiationsBoard";
import type { KanbanCard } from "../hooks/useKanbanData";
import { STAGES, stageMeta, type BoardStage } from "../board/stageColumn";
import { semaphoreOf, type SemaphoreLevel } from "../board/semaphore";
import { RESERVATION_REQUEST_PENDING_DB, RESERVATION_TERMINAL_DB_VALUES } from "../../../domain/status/reservation";
import { PROPOSAL_CLOSED_DB_VALUES } from "../../../domain/status/proposal";
import { usePipelineActions } from "../hooks/usePipelineActions";
import { CriarPropostaModal, SolicitarReservaModal, AprovarReservaModal, RegistrarVendaModal } from "../components/PipelineActionModals";
import { useScreen } from "../../../shared/hooks/useIsMobile";
import { useCelebration, CelebrationToasts } from "../../../shared/components/Celebration";
import { getPermissions } from "../../../shared/utils/permissoes";
import { supabase } from "../../../infra/supabase/supabaseClient";
import { deleteSimulation } from "../../../infra/repositories/pipelineSimulationsSupabaseRepository";
import { timeAgo } from "../../../shared/utils/timeAgo";
import { fetchMyQueuePositions } from "../../units/hooks/useUnitQueue";
import CancelNegotiationModal from "../../../shared/components/CancelNegotiationModal";
import { useLeads, type LeadView } from "../../leads/useLeads";
import LeadCard from "../../leads/LeadCard";
import { AssignModal, DiscardModal } from "../../leads/LeadActionModals";
import { splitLeadColumns } from "../../leads/leadColumns";
import { EntityNameLink } from "../../../shared/navigation/EntityLink";
import { NexaSelect } from "../../../shared/ui/NexaSelect";
import { NexaModal } from "../../../shared/ui/NexaModal";

const MONO = "var(--font-mono)";
const SEMA_COLOR: Record<SemaphoreLevel, string> = { green: "#4ADE80", amber: "#E8B45A", red: "#F87171", neutral: "#706B5F" };
const DENSE_THRESHOLD = 30; // acima disso, coluna não renderiza tudo — rodapé salta p/ Lista
const DENSE_VISIBLE = 25; // quantos cards a coluna densa renderiza antes do rodapé
// Área de cards da coluna: scroll independente + scrollbar fina/discreta.
const COL_SCROLL: React.CSSProperties = { flex: 1, minHeight: 0, overflowY: "auto", scrollbarWidth: "thin", scrollbarColor: "var(--border-strong, #3D3A30) transparent", WebkitOverflowScrolling: "touch" };

function fmtV(v: number) { return v >= 1e6 ? `R$ ${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `R$ ${(v / 1e3).toFixed(0)}k` : `R$ ${v}`; }
function fmtBRL(v: number | null) { return v ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }) : "—"; }

function unitDot(unitStatus: string | null): string {
  const s = (unitStatus || "").toLowerCase();
  if (s === "vendido" || s === "sold") return "#34D399";
  if (s === "reservado" || s === "reserved") return "#E8B45A";
  if (s === "em_negociacao") return "#7DA7F4";
  return "#4ADE80"; // disponível / desconhecido
}
function unitLabel(c: KanbanCard): string {
  if (c.thirdPartyPropertyId) return c.thirdPartyPropertyTitulo || "Imóvel";
  if (c.quadra) return `Q${c.quadra} · L${c.lote}`;
  return "Sem unidade";
}

const CAN_HOVER = typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(hover: hover)").matches;

export default function KanbanPage() {
  const navigate = useNavigate();
  const screen = useScreen();
  const isMobile = screen.isMobile;
  const { account, brokerId, isBroker, isBrokerManager, brokerageId, isConsultant, ownerProfileId } = useAccount();
  const { development } = useDevelopment();
  const { authenticatedProfile } = useAuth();
  const aId = account?.accountId ?? null, dId = development?.developmentId ?? null;
  const [refreshKey, setRefreshKey] = useState(0);
  const perms = getPermissions(account?.role ?? null);
  const { toasts, celebrate, celebrateSale, celebrateError } = useCelebration();
  const onActionSuccess = useCallback(() => setRefreshKey((k) => k + 1), []);
  const { criarProposta, solicitarReserva, aprovarReserva, registrarVenda, converterSimulacao, cancelarNegociacao } = usePipelineActions(aId, dId, onActionSuccess);
  const [convertingSimId, setConvertingSimId] = useState<string | null>(null);

  // Broker manager: team toggle
  const [brokerViewMode, setBrokerViewMode] = useState<"mine" | "team">("mine");
  const [teamBrokerIds, setTeamBrokerIds] = useState<string[]>([]);
  useEffect(() => {
    if (!isBrokerManager || !brokerageId || !supabase || !aId) return;
    supabase.from("brokers").select("profile_id, id").eq("brokerage_id", brokerageId).eq("account_id", aId).eq("status", "active").then(({ data }) => {
      setTeamBrokerIds((data ?? []).map((b: Record<string, unknown>) => (b.profile_id || b.id) as string).filter(Boolean));
    });
  }, [isBrokerManager, brokerageId, aId]);

  // Member filter (director/manager only)
  const [memberFilter, setMemberFilter] = useState("all");
  const [memberOptions, setMemberOptions] = useState<{ value: string; label: string }[]>([]);
  useEffect(() => {
    if (!perms.canViewFullDashboard || !supabase || !aId) return;
    Promise.all([
      supabase.from("brokers").select("id, name").eq("account_id", aId).eq("status", "active").eq("approval_status", "approved").order("name"),
      supabase.from("user_account_access").select("user_id, role, profiles(id, name)").eq("account_id", aId).eq("role", "commercial_consultant"),
    ]).then(([bRes, cRes]) => {
      const opts: { value: string; label: string }[] = [{ value: "all", label: "Todos os membros" }];
      (bRes.data ?? []).forEach((b: Record<string, unknown>) => opts.push({ value: `broker:${b.id}`, label: `${b.name} (Corretor)` }));
      (cRes.data ?? []).forEach((c: Record<string, unknown>) => {
        const p = Array.isArray(c.profiles) ? c.profiles[0] : c.profiles;
        if (p) opts.push({ value: `consultant:${(p as Record<string, unknown>).id}`, label: `${(p as Record<string, unknown>).name} (Consultor)` });
      });
      setMemberOptions(opts);
    });
  }, [perms.canViewFullDashboard, aId]);

  const effectiveFilters = useMemo(() => {
    if (isBroker) {
      if (isBrokerManager && brokerViewMode === "team") return undefined;
      return { brokerId };
    }
    if (isConsultant) return { ownerProfileId };
    if (memberFilter !== "all") {
      const [type, id] = memberFilter.split(":");
      if (type === "broker") return { brokerId: id };
      if (type === "consultant") return { ownerProfileId: id };
    }
    return undefined;
  }, [isBroker, isBrokerManager, brokerViewMode, brokerId, isConsultant, ownerProfileId, memberFilter]);

  const [busca, setBusca] = useState("");
  const teamFilterIds = isBroker && isBrokerManager && brokerViewMode === "team" ? teamBrokerIds : null;
  const { board, loading, error, thresholdDays } = useNegotiationsBoard({ accountId: aId, developmentId: dId, refreshKey, filters: effectiveFilters, search: busca, teamBrokerIds: teamFilterIds });

  // L1.8 — Colunas de lead (MESMA fonte de /leads: useLeads; permissões idênticas —
  // o hook escopa por papel). Contagens coerentes por construção (splitLeadColumns).
  const { leads: allLeads, members: leadMembers, brokerageDirectory: leadBrokerageDirectory, pendingBrokers: leadPendingBrokers, canAssign: canAssignLeads, actions: leadActions } = useLeads();
  const { novos: novosLeads, atendimento: atendLeads } = splitLeadColumns(allLeads);
  const [leadAssignTarget, setLeadAssignTarget] = useState<LeadView | null>(null);
  const [leadDiscardTarget, setLeadDiscardTarget] = useState<LeadView | null>(null);
  const [leadBusy, setLeadBusy] = useState<string | null>(null);
  const runLead = useCallback(async (key: string, fn: () => Promise<unknown>, okMsg: string) => {
    setLeadBusy(key);
    try { await fn(); celebrate(okMsg); } catch (e) { celebrateError("Falha na ação", e instanceof Error ? e.message : undefined); } finally { setLeadBusy(null); }
  }, [celebrate, celebrateError]);
  const convertLead = useCallback(async (l: LeadView) => {
    setLeadBusy(`convert-${l.client.id}`);
    try {
      const negId = await leadActions.convert(l); // patch otimista tira o lead da coluna
      if (negId) { celebrate("Convertido — na coluna Em negociação"); onActionSuccess(); } // refresh do board de negociação
      else celebrateError("Não foi possível criar a negociação");
    } catch (e) { celebrateError("Falha ao converter", e instanceof Error ? e.message : undefined); }
    finally { setLeadBusy(null); }
  }, [leadActions, celebrate, celebrateError, onActionSuccess]);
  const leadCardActions = useCallback((l: LeadView) => ({
    onAssign: () => setLeadAssignTarget(l),
    onStart: () => runLead(`svc-${l.client.id}`, () => leadActions.startService(l), "Atendimento iniciado ✓"),
    onQualify: () => runLead(`qua-${l.client.id}`, () => leadActions.qualify(l), "Lead qualificado ✓"),
    onConvert: () => convertLead(l),
    onDiscard: () => setLeadDiscardTarget(l),
  }), [runLead, convertLead, leadActions]);

  const [mobileTab, setMobileTab] = useState<BoardStage | "leads" | "atendimento">("em_negociacao");
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [modalProposta, setModalProposta] = useState<KanbanCard | null>(null);
  const [modalReserva, setModalReserva] = useState<KanbanCard | null>(null);
  const [modalAprovar, setModalAprovar] = useState<KanbanCard | null>(null);
  const [modalVenda, setModalVenda] = useState<KanbanCard | null>(null);
  const [cancelTarget, setCancelTarget] = useState<KanbanCard | null>(null);
  const [cardMenuOpen, setCardMenuOpen] = useState<string | null>(null);
  const [cardMenuPos, setCardMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [simDetail, setSimDetail] = useState<KanbanCard | null>(null);
  const [deletingSim, setDeletingSim] = useState(false);
  const [prefunnelOpen, setPrefunnelOpen] = useState(false);

  // Altura útil do board = viewport menos o topo do container (headers/faixas
  // acima). O board não rola a página; cada coluna rola seus cards.
  const boardRef = useRef<HTMLDivElement>(null);
  const [boardH, setBoardH] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const compute = () => setBoardH(Math.max(320, Math.round(window.innerHeight - el.getBoundingClientRect().top - 16)));
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, [isMobile, board.pending.length, loading]);

  const [myQueueMap, setMyQueueMap] = useState<Record<string, number>>({});
  useEffect(() => { const uid = authenticatedProfile?.id; if (uid) fetchMyQueuePositions(uid).then(setMyQueueMap); }, [authenticatedProfile?.id, refreshKey]);

  const nowMs = Date.now();
  const sema = useCallback((c: KanbanCard) => semaphoreOf({
    nextActionAt: c.nextActionAt, followUpAt: c.followUpAt, lastActivityAt: c.lastActivityAt,
    updatedAt: c.updatedAt, stageChangedAt: c.stageChangedAt, reservaExpiresAt: c.reservaExpiresAt,
    reservaAtiva: !!c.reservaStatus && !RESERVATION_TERMINAL_DB_VALUES.includes(c.reservaStatus),
    status: c.status, ownerProfileId: c.ownerProfileId,
  }, thresholdDays, nowMs), [thresholdDays, nowMs]);

  if (loading) return <div className="nexa-page-enter" style={{ padding: 24 }}><div className="nexa-skeleton" style={{ height: 24, width: 180, marginBottom: 20, borderRadius: 8 }} /><div style={{ display: "flex", gap: 12 }}>{[1,2,3,4,5].map(i => <div key={i} style={{ flex: 1 }}><div className="nexa-skeleton" style={{ height: 12, width: 80, marginBottom: 8, borderRadius: 4 }} /><div className="nexa-skeleton nexa-skeleton-card" /><div className="nexa-skeleton nexa-skeleton-card" /></div>)}</div></div>;
  if (error) return <div style={{ padding: 24, color: "#F87171", fontSize: 14 }}>Erro: {error}</div>;

  return (
    <>
    <div>
      {/* Header — números canônicos (fonte única) */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 28, fontWeight: 400, color: "var(--color-bone)", margin: 0, lineHeight: 1.1 }}>Negociações</h1>
          <p style={{ fontSize: 10.5, color: "var(--color-slate)", margin: "6px 0 0", fontFamily: MONO, letterSpacing: "0.05em" }}>
            {board.openCount} {board.openCount === 1 ? "aberta" : "abertas"} · {fmtV(board.openVGV)} em aberto (total){board.openVGV > 0 ? ` · ${board.openWithValue} de ${board.openCount} com valor` : ""} · {board.wonCount} {board.wonCount === 1 ? "venda" : "vendas"}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {isBrokerManager && teamBrokerIds.length > 0 ? (
            <div style={{ display: "flex", borderRadius: 16, overflow: "hidden", border: "1px solid var(--border-default)" }}>
              {(["mine", "team"] as const).map((m) => (
                <button key={m} type="button" onClick={() => setBrokerViewMode(m)} style={{ padding: "5px 14px", background: brokerViewMode === m ? "var(--color-sprout-muted)" : "transparent", color: brokerViewMode === m ? "var(--color-sprout)" : "var(--color-clay)", border: "none", fontSize: 11, fontWeight: 500, cursor: "pointer" }}>{m === "mine" ? "Minhas" : "Equipe"}</button>
              ))}
            </div>
          ) : null}
          {perms.canViewFullDashboard && memberOptions.length > 1 ? (
            <div style={{ width: 200 }}>
              <NexaSelect
                value={memberFilter}
                onChange={(v) => setMemberFilter(v)}
                options={memberOptions}
                ariaLabel="Filtrar por membro"
                recentKey="kanban-member-filter"
              />
            </div>
          ) : null}
          <input placeholder="Buscar cliente, unidade, corretor..." value={busca} onChange={(e) => setBusca(e.target.value)} style={{ background: "var(--surface-raised)", border: "1px solid var(--border-default)", borderRadius: 8, padding: "8px 14px", color: "var(--text-secondary)", fontSize: 13, outline: "none", width: isMobile ? "100%" : 220 }} />
        </div>
      </div>

      {/* Faixa de decisões pendentes */}
      {board.pending.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", background: "rgba(232,180,90,0.06)", border: "1px solid rgba(232,180,90,0.2)", borderRadius: 10, padding: "10px 14px", marginBottom: 14 }}>
          <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: "#E8B45A", letterSpacing: "0.08em", textTransform: "uppercase" }}>{board.pending.length} {board.pending.length === 1 ? "decisão pendente" : "decisões pendentes"}</span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", flex: 1 }}>
            {board.pending.slice(0, 4).map((p, i) => (
              <button key={`${p.id}-${p.kind}-${i}`} type="button" onClick={() => navigate(`/negociacoes/${p.id}`)} style={{ fontSize: 11, color: "var(--color-dust)", background: "transparent", border: "1px solid var(--border-default)", borderRadius: 6, padding: "3px 8px", cursor: "pointer" }}>
                {p.kind === "reservation_request" ? "Solicitação" : "Reserva vencida"}: {p.clienteNome || "Sem cliente"} {p.unitLabel ? `· ${p.unitLabel}` : ""}
              </button>
            ))}
            {board.pending.length > 4 ? <span style={{ fontSize: 11, color: "var(--color-slate)", alignSelf: "center" }}>+{board.pending.length - 4}</span> : null}
          </div>
        </div>
      )}

      {/* Board */}
      {isMobile ? (
        <>
          <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8, marginBottom: 12 }}>
            {([["leads", "Leads", novosLeads.length, "#7DA7F4"], ["atendimento", "Em atendimento", atendLeads.length, "#9DB8E8"]] as const).map(([id, label, count, cor]) => {
              const active = mobileTab === id;
              return (
                <button key={id} type="button" onClick={() => setMobileTab(id)} style={{ flexShrink: 0, padding: "5px 14px", borderRadius: 16, fontSize: 11, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap", minHeight: 44, border: active ? `1px solid ${cor}30` : "1px solid var(--border-default)", background: active ? `${cor}14` : "transparent", color: active ? cor : "var(--color-clay)" }}>
                  {label}{count > 0 ? ` · ${count}` : ""}
                </button>
              );
            })}
            {STAGES.map((est) => {
              const count = board.countByStage[est.id];
              const active = mobileTab === est.id;
              return (
                <button key={est.id} type="button" onClick={() => setMobileTab(est.id)} style={{ flexShrink: 0, padding: "5px 14px", borderRadius: 16, fontSize: 11, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap", minHeight: 44, border: active ? `1px solid ${est.color}30` : "1px solid var(--border-default)", background: active ? est.soft : "transparent", color: active ? est.color : "var(--color-clay)" }}>
                  {est.label}{count > 0 ? ` · ${count}` : ""}
                </button>
              );
            })}
          </div>
          <div ref={boardRef} style={{ display: "flex", flexDirection: "column", gap: 8, paddingBottom: 16, height: boardH ?? undefined, overflowY: "auto", scrollbarWidth: "thin", scrollbarColor: "var(--border-strong, #3D3A30) transparent", WebkitOverflowScrolling: "touch", overscrollBehavior: "contain" }}>
            {mobileTab === "leads" || mobileTab === "atendimento" ? (() => {
              const list = mobileTab === "leads" ? novosLeads : atendLeads;
              return list.length === 0
                ? <div style={{ textAlign: "center", padding: "32px 10px", border: "1px dashed var(--border-default)", borderRadius: 10, color: "var(--color-clay)", fontSize: 12, fontStyle: "italic" }}>Sem leads</div>
                : <>{list.slice(0, 8).map((l) => <LeadCard key={l.client.id} lead={l} canAssign={canAssignLeads} busy={!!leadBusy && leadBusy.endsWith(l.client.id)} actions={leadCardActions(l)} />)}{list.length > 8 ? <button type="button" onClick={() => navigate("/leads")} style={{ fontFamily: MONO, fontSize: 10, color: "var(--color-sprout)", padding: 8, background: "none", border: "1px dashed var(--border-default)", borderRadius: 8, cursor: "pointer" }}>ver todos ({list.length}) →</button> : null}</>;
            })() : (
              board.byStage[mobileTab].length === 0
                ? <div style={{ textAlign: "center", padding: "32px 10px", border: "1px dashed var(--border-default)", borderRadius: 10, color: "var(--color-clay)", fontSize: 12, fontStyle: "italic" }}>Sem {stageMeta(mobileTab).label.toLowerCase()}</div>
                : (() => {
                    // Mesma fonte e cap do desktop: densa (>30) mostra 25 + rodapé → Lista.
                    const cs = board.byStage[mobileTab];
                    const isDense = cs.length > DENSE_THRESHOLD;
                    const visible = isDense ? cs.slice(0, DENSE_VISIBLE) : cs;
                    const hidden = cs.length - visible.length;
                    return <>
                      {visible.map((c) => renderCard(c, mobileTab))}
                      {isDense && hidden > 0 ? (
                        <button type="button" onClick={() => navigate(`/negociacoes?view=lista&stage=${mobileTab}`)} style={{ marginTop: 4, flexShrink: 0, fontFamily: MONO, fontSize: 11, color: "var(--color-sprout)", textAlign: "center", padding: 12, minHeight: 44, background: "var(--surface-base, #16150F)", border: "1px dashed var(--border-default)", borderRadius: 8, cursor: "pointer" }}>+{hidden} · ver na Lista →</button>
                      ) : null}
                    </>;
                  })()
            )}
          </div>
        </>
      ) : (
        <div ref={boardRef} style={{ overflowX: "auto", overflowY: "hidden", paddingBottom: 16, height: boardH ?? undefined }}>
          <div style={{ display: "flex", gap: 10, alignItems: "stretch", minWidth: 1260, height: "100%" }}>
            {renderLeadColumn("Leads", novosLeads, "#7DA7F4")}
            {renderLeadColumn("Em atendimento", atendLeads, "#9DB8E8")}
            {STAGES.map((est) => {
              const cs = board.byStage[est.id];
              const vgv = board.vgvByStage[est.id];
              // Coluna rola seus cards (overflow-y). Densa (>30): renderiza só as
              // primeiras e o rodapé "+N · ver na Lista" (sticky) salta para a Lista.
              const isDense = cs.length > DENSE_THRESHOLD;
              const visible = isDense ? cs.slice(0, DENSE_VISIBLE) : cs;
              const hidden = cs.length - visible.length;
              return (
                <div key={est.id} style={{ flex: 1, minWidth: 168, height: "100%", display: "flex", flexDirection: "column" }}>
                  <div style={{ flexShrink: 0, padding: "12px 14px", background: "var(--surface-raised)", borderRadius: "10px 10px 0 0", border: "1px solid var(--border-default)", borderBottom: "none" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--color-dust)" }}>{est.label}{isDense ? <span style={{ fontFamily: MONO, fontSize: 8.5, fontWeight: 600, color: "var(--color-slate)", marginLeft: 6 }}>· denso</span> : null}</span>
                      <span style={{ fontFamily: MONO, fontSize: 9, color: "var(--color-clay)", background: "var(--border-default)", padding: "1px 6px", borderRadius: 6 }}>{cs.length}</span>
                    </div>
                    {vgv > 0 ? <div style={{ fontFamily: MONO, fontSize: 9, color: "var(--color-clay)" }}>{fmtV(vgv)}</div> : null}
                    <div style={{ height: 2, borderRadius: 1, marginTop: 8, background: `linear-gradient(90deg, ${est.color}60, ${est.color}15)` }} />
                  </div>
                  <div style={{ ...COL_SCROLL, padding: 6, background: "rgba(18,17,14,0.3)", borderRadius: "0 0 10px 10px", border: "1px solid var(--border-default)", borderTop: "none", display: "flex", flexDirection: "column", gap: 6 }}>
                    {cs.length === 0
                      ? <div style={{ textAlign: "center", padding: "20px 10px", border: "1px dashed var(--border-default)", borderRadius: 10, color: "var(--color-clay)", fontSize: 12, fontStyle: "italic" }}>Sem {est.label.toLowerCase()}</div>
                      : visible.map((c) => renderCard(c, est.id))}
                    {isDense && hidden > 0 && (
                      <button type="button" onClick={() => navigate(`/negociacoes?view=lista&stage=${est.id}`)} style={{ position: "sticky", bottom: 0, marginTop: "auto", flexShrink: 0, fontFamily: MONO, fontSize: 9, color: "var(--color-sprout)", textAlign: "center", padding: 8, background: "var(--surface-base, #16150F)", border: "1px dashed var(--border-default)", borderRadius: 8, cursor: "pointer" }}>+{hidden} · ver na Lista →</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Faixa de pré-funil (simulações) recolhível */}
      <div style={{ marginTop: 16, border: "1px solid var(--border-default)", borderRadius: 10, background: "rgba(156,150,134,0.04)" }}>
        <button type="button" onClick={() => setPrefunnelOpen((o) => !o)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "transparent", border: "none", cursor: "pointer" }}>
          <span style={{ fontFamily: MONO, fontSize: 11, color: "var(--color-fog)", letterSpacing: "0.04em" }}>
            Pré-funil · {board.prefunnel.count} {board.prefunnel.count === 1 ? "simulação" : "simulações"} · {fmtV(board.prefunnel.vgv)} potencial <span style={{ color: "var(--color-slate)" }}>(fora da conta)</span>
          </span>
          <span style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <span onClick={(e) => { e.stopPropagation(); navigate("/leads"); }} style={{ fontSize: 11, color: "var(--color-sprout)", cursor: "pointer" }}>Ver Leads →</span>
            <span onClick={(e) => { e.stopPropagation(); navigate("/simulador"); }} style={{ fontSize: 11, color: "var(--color-sprout)", cursor: "pointer" }}>Abrir Simulador →</span>
            <span style={{ color: "var(--color-slate)", fontSize: 12 }}>{prefunnelOpen ? "▾" : "▸"}</span>
          </span>
        </button>
        {prefunnelOpen && board.simulations.length > 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", padding: "0 14px 12px" }}>
            {board.simulations.map((c) => (
              <button key={c.id} type="button" onClick={() => setSimDetail(c)} style={{ textAlign: "left", background: "var(--surface-raised)", border: "1px solid var(--border-default)", borderRadius: 8, padding: "8px 10px", cursor: "pointer", minWidth: 150 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-bone)" }}>{c.clienteNome || <span style={{ color: "var(--color-clay)", fontStyle: "italic" }}>Sem cliente</span>}</div>
                <div style={{ fontFamily: MONO, fontSize: 10, color: "var(--color-fog)", marginTop: 2 }}>{unitLabel(c)} · {fmtBRL(c.valor)}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
    <CelebrationToasts toasts={toasts} />

    {/* ⋮ card menu (portal) */}
    {cardMenuOpen && cardMenuPos && (() => {
      const c = board.negotiations.find((x) => x.id === cardMenuOpen);
      if (!c) return null;
      const closeMenu = () => { setCardMenuOpen(null); setCardMenuPos(null); };
      const canCancel = c.status !== "WON" && perms.canCancelSale;
      return createPortal(
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 9998 }} onClick={closeMenu} />
          <div style={{ position: "fixed", top: cardMenuPos.top, left: cardMenuPos.left, background: "var(--surface-raised)", border: "1px solid var(--border-default)", borderRadius: 8, padding: 4, minWidth: 180, boxShadow: "0 8px 24px rgba(0,0,0,0.4)", zIndex: 9999 }}>
            <button type="button" onClick={() => { closeMenu(); navigate(`/negociacoes/${c.id}`); }} style={menuItem}>Abrir ficha</button>
            {canCancel ? (<><div style={{ height: 1, background: "var(--surface-overlay)", margin: "4px 8px" }} /><button type="button" onClick={() => { closeMenu(); setCancelTarget(c); }} style={{ ...menuItem, color: "#F87171" }}>Cancelar negociação</button></>) : null}
          </div>
        </>, document.body);
    })()}

    <CriarPropostaModal open={!!modalProposta} card={modalProposta} onClose={() => setModalProposta(null)} onConfirm={async ({ entradaPct, parcelas }) => { if (!modalProposta) return; const v = modalProposta.valor ?? 0; const ev = Math.round(v * entradaPct / 100); const pv = parcelas > 0 ? Math.round((v - ev) / parcelas) : 0; await criarProposta({ negotiationId: modalProposta.id, unitId: modalProposta.unitId!, clientId: modalProposta.clienteId!, brokerId: modalProposta.corretorId, amount: v, entradaPercentual: entradaPct, entradaValor: ev, parcelasQuantidade: parcelas, parcelasValor: pv }); celebrate("Proposta criada", `${modalProposta.clienteNome || "Cliente"} — ${unitLabel(modalProposta)}`); }} />
    <SolicitarReservaModal open={!!modalReserva} card={modalReserva} onClose={() => setModalReserva(null)} onConfirm={async () => { if (!modalReserva) return; try { await solicitarReserva({ negotiationId: modalReserva.id, unitId: modalReserva.unitId! }); celebrate("Reserva solicitada", "Aguardando aprovação"); setModalReserva(null); } catch (e) { celebrateError("Falha ao solicitar reserva", e instanceof Error ? e.message : undefined); } }} />
    <AprovarReservaModal open={!!modalAprovar} card={modalAprovar} onClose={() => setModalAprovar(null)} onConfirm={async () => { if (!modalAprovar) return; try { await aprovarReserva(modalAprovar.id, modalAprovar.unitId!, modalAprovar.reservaRequestId ?? undefined); celebrate("Reserva aprovada"); setModalAprovar(null); } catch (e) { celebrateError("Falha ao aprovar reserva", e instanceof Error ? e.message : undefined); } }} />
    <RegistrarVendaModal open={!!modalVenda} card={modalVenda} onClose={() => setModalVenda(null)} onConfirm={async () => { if (!modalVenda) return; try { await registrarVenda({ negotiationId: modalVenda.id, unitId: modalVenda.unitId!, amount: modalVenda.valor ?? 0 }); celebrateSale("Venda registrada!", `${modalVenda.clienteNome || "Cliente"} — ${unitLabel(modalVenda)}`); setModalVenda(null); } catch (e) { celebrateError("Falha ao registrar venda", e instanceof Error ? e.message : undefined); } }} />

    <CancelNegotiationModal
      isOpen={!!cancelTarget}
      onClose={() => setCancelTarget(null)}
      negotiation={{ id: cancelTarget?.id ?? "", clientName: cancelTarget?.clienteNome || "Cliente", unitLabel: cancelTarget ? unitLabel(cancelTarget) : "—", value: cancelTarget?.valor ?? 0, brokerName: cancelTarget?.corretorNome || "—" }}
      hasActiveReservation={!!cancelTarget?.reservaStatus && !RESERVATION_TERMINAL_DB_VALUES.includes(cancelTarget.reservaStatus)}
      hasActiveProposals={!!cancelTarget?.propostaStatus && !PROPOSAL_CLOSED_DB_VALUES.includes(cancelTarget.propostaStatus)}
      onConfirm={async (reason) => { if (!cancelTarget) return; try { await cancelarNegociacao({ negotiationId: cancelTarget.id, unitId: cancelTarget.unitId!, reason, currentStatus: cancelTarget.status }); celebrate("Negociação cancelada"); setCancelTarget(null); } catch (e) { celebrateError("Falha ao cancelar negociação", e instanceof Error ? e.message : undefined); } }}
    />

    {/* Simulação detail (preserva Iniciar negociação + Excluir) */}
    {simDetail ? (
      <NexaModal onClose={() => setSimDetail(null)}>
        <div style={{ background: "var(--color-carbon)", border: "1px solid var(--color-stone)", borderRadius: 16, padding: 28, width: "100%", maxWidth: 420 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--color-bone)", margin: "0 0 4px" }}>Simulação</h2>
          <div style={{ fontSize: 11, color: "var(--color-fog)", marginBottom: 16 }}>{simDetail.clienteNome || "Sem cliente"} · {unitLabel(simDetail)} · {fmtBRL(simDetail.valor)} · {timeAgo(simDetail.createdAt)}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button type="button" disabled={!!convertingSimId} onClick={() => { setConvertingSimId(simDetail.id); void converterSimulacao({ simulationId: simDetail.id, unitId: simDetail.unitId!, clientId: simDetail.clienteId, brokerId: simDetail.corretorId }).then(() => { celebrate("Negociação iniciada!"); setSimDetail(null); }).catch((e: unknown) => celebrateError("Falha ao iniciar negociação", e instanceof Error ? e.message : undefined)).finally(() => setConvertingSimId(null)); }} style={{ padding: 12, borderRadius: 8, border: "none", background: "var(--color-sprout)", color: "var(--interactive-on-primary)", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>{convertingSimId === simDetail.id ? "Criando..." : "Iniciar negociação"}</button>
            <button type="button" onClick={() => { navigate(`/simulador?simulationId=${simDetail.id}`); setSimDetail(null); }} style={{ padding: 10, borderRadius: 8, border: "1px solid var(--color-stone)", background: "transparent", color: "var(--color-bone)", fontSize: 13, cursor: "pointer" }}>Abrir no simulador</button>
            <button type="button" disabled={deletingSim} onClick={async () => { setDeletingSim(true); try { await deleteSimulation(simDetail.id); celebrate("Simulação excluída"); setSimDetail(null); onActionSuccess(); } catch (e: unknown) { celebrateError("Falha ao excluir", e instanceof Error ? e.message : undefined); } finally { setDeletingSim(false); } }} style={{ padding: 10, borderRadius: 8, border: "none", background: "transparent", color: "#F87171", fontSize: 12, cursor: "pointer" }}>{deletingSim ? "Excluindo..." : "Excluir simulação"}</button>
          </div>
        </div>
      </NexaModal>
    ) : null}
    {/* Modais de ação de lead (compartilhados com /leads) */}
    {leadAssignTarget ? (
      <AssignModal lead={leadAssignTarget} members={leadMembers} brokerageDirectory={leadBrokerageDirectory} pendingBrokers={leadPendingBrokers} onClose={() => setLeadAssignTarget(null)}
        onInvite={() => navigate("/corretores")}
        onPick={async (id, name) => { const t = leadAssignTarget; setLeadAssignTarget(null); await runLead(`assign-${t.client.id}`, () => leadActions.assign(t, id, name), `Lead atribuído a ${name} ✓`); }} />
    ) : null}
    {leadDiscardTarget ? (
      <DiscardModal lead={leadDiscardTarget} onClose={() => setLeadDiscardTarget(null)}
        onConfirm={async (reason) => { const t = leadDiscardTarget; setLeadDiscardTarget(null); await runLead(`disc-${t.client.id}`, () => leadActions.discard(t, reason), "Descartado — ver em Descartados"); }} />
    ) : null}
    </>
  );

  // ---- Coluna de lead (LeadCard compartilhado; coluna rola seus cards) ----
  function renderLeadColumn(title: string, list: LeadView[], accent: string) {
    const isDense = list.length > DENSE_THRESHOLD;
    const visible = isDense ? list.slice(0, DENSE_VISIBLE) : list;
    const hidden = list.length - visible.length;
    return (
      <div style={{ flex: 1, minWidth: 176, height: "100%", display: "flex", flexDirection: "column" }}>
        <div style={{ flexShrink: 0, padding: "12px 14px", background: "var(--surface-raised)", borderRadius: "10px 10px 0 0", border: "1px solid var(--border-default)", borderBottom: "none" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--color-dust)" }}>{title}</span>
            <span style={{ fontFamily: MONO, fontSize: 9, color: "var(--color-clay)", background: "var(--border-default)", padding: "1px 6px", borderRadius: 6 }}>{list.length}</span>
          </div>
          <div style={{ height: 2, borderRadius: 1, marginTop: 8, background: `linear-gradient(90deg, ${accent}60, ${accent}15)` }} />
        </div>
        <div style={{ ...COL_SCROLL, padding: 6, background: "rgba(18,17,14,0.3)", borderRadius: "0 0 10px 10px", border: "1px solid var(--border-default)", borderTop: "none", display: "flex", flexDirection: "column", gap: 6 }}>
          {list.length === 0
            ? <div style={{ textAlign: "center", padding: "20px 10px", border: "1px dashed var(--border-default)", borderRadius: 10, color: "var(--color-clay)", fontSize: 12, fontStyle: "italic" }}>Sem leads</div>
            : visible.map((l) => <LeadCard key={l.client.id} lead={l} canAssign={canAssignLeads} busy={!!leadBusy && leadBusy.endsWith(l.client.id)} actions={leadCardActions(l)} />)}
          {isDense && hidden > 0 && (
            <button type="button" onClick={() => navigate("/leads")} style={{ position: "sticky", bottom: 0, marginTop: "auto", flexShrink: 0, fontFamily: MONO, fontSize: 9, color: "var(--color-sprout)", textAlign: "center", padding: 8, background: "var(--surface-base, #16150F)", border: "1px dashed var(--border-default)", borderRadius: 8, cursor: "pointer" }}>ver todos ({list.length}) →</button>
          )}
        </div>
      </div>
    );
  }

  // ---- Card enxuto de 3 linhas + ações no hover ----
  function renderCard(c: KanbanCard, stage: BoardStage) {
    const isHovered = hoveredId === c.id;
    const s = sema(c);
    const showActions = (isHovered || isMobile || !CAN_HOVER) && stage !== "venda" && stage !== "perdido";
    const pendingReq = c.reservaRequestId && c.reservaRequestStatus === RESERVATION_REQUEST_PENDING_DB;
    return (
      <div key={c.id}
        onClick={() => navigate(`/negociacoes/${c.id}`)}
        onMouseEnter={() => setHoveredId(c.id)} onMouseLeave={() => setHoveredId(null)}
        style={{ position: "relative", zIndex: cardMenuOpen === c.id ? 30 : isHovered ? 20 : "auto", background: stage === "venda" ? "linear-gradient(145deg, rgba(52,211,153,0.08) 0%, #16150F 60%)" : "linear-gradient(145deg, #22211C 0%, #16150F 100%)", border: isHovered ? "1px solid rgba(74,222,128,0.18)" : "1px solid var(--border-default)", borderRadius: 9, padding: 11, cursor: "pointer", transition: "border-color 150ms ease, transform 150ms ease", transform: isHovered ? "translateY(-1px)" : "none", opacity: stage === "perdido" ? 0.6 : 1 }}>
        {/* Linha 1: CLIENTE (título, link p/ o Contato) + Importada + valor */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3, minWidth: 0 }}>
          <EntityNameLink entity="contact" id={c.clienteId} title="Abrir contato" style={{ flex: 1, minWidth: 0, display: "block", fontSize: 13, fontWeight: 700, color: "var(--color-bone)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {c.clienteNome || <span style={{ color: "var(--color-clay)", fontStyle: "italic", fontWeight: 400 }}>Sem cliente</span>}
          </EntityNameLink>
          {c.importBatchId ? <span style={{ flexShrink: 0, fontFamily: MONO, fontSize: 8, fontWeight: 700, color: "#7DA7F4", background: "rgba(125,167,244,0.12)", borderRadius: 4, padding: "1px 4px", letterSpacing: "0.03em", textTransform: "uppercase" }}>Importada</span> : null}
          <span style={{ flexShrink: 0, fontFamily: MONO, fontSize: 12, fontWeight: 700, color: stage === "venda" ? "#34D399" : "var(--color-bone)" }}>{fmtBRL(c.valor)}</span>
        </div>
        {/* Linha 2: unidade como METADADO fraco (link p/ a Ficha) + fila */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, minWidth: 0 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: unitDot(c.unitStatus), flexShrink: 0 }} />
          <EntityNameLink entity="unit" id={c.unitId} title="Abrir ficha da unidade" style={{ fontSize: 10.5, color: "var(--color-slate)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "inline-block", maxWidth: "70%" }}>{unitLabel(c)}</EntityNameLink>
          {c.unitId && myQueueMap[c.unitId] ? <span style={{ flexShrink: 0, fontSize: 9, padding: "1px 5px", borderRadius: 4, background: "#7DA7F420", color: "#7DA7F4", fontWeight: 600 }}>Fila #{myQueueMap[c.unitId]}</span> : null}
        </div>
        {/* Linha 3: semáforo (ou motivo, se perdido) */}
        {stage === "perdido" && c.lostReason ? (
          <div style={{ fontSize: 10.5, color: "#F87171" }}>Motivo: {c.lostReason}</div>
        ) : stage === "venda" ? (
          <div style={{ fontSize: 10.5, color: "#34D399", fontFamily: MONO }}>Concluída · {c.corretorNome || "—"}</div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: SEMA_COLOR[s.level], flexShrink: 0 }} />
            <span style={{ fontSize: 10.5, color: SEMA_COLOR[s.level], fontFamily: MONO }}>{s.label}</span>
            <EntityNameLink entity="broker" id={c.corretorId} title="Abrir corretor" style={{ marginLeft: "auto", fontSize: 10, color: "var(--color-slate)" }}>{c.corretorNome || "—"}</EntityNameLink>
          </div>
        )}
        {/* Indicação de solicitação pendente (não muda coluna) */}
        {pendingReq ? <div style={{ marginTop: 5, fontSize: 9.5, color: "#E8B45A", fontFamily: MONO }}>Solicitação aguardando aprovação</div> : null}
        {/* Ações no hover */}
        {showActions ? (
          <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(61,58,48,0.12)" }} onClick={(e) => e.stopPropagation()}>
            {stage === "em_negociacao" ? <HoverBtn label="Criar proposta" cor="#7DA7F4" onClick={() => setModalProposta(c)} /> : null}
            {stage === "proposta" ? <HoverBtn label="Solicitar reserva" cor="#E8B45A" onClick={() => setModalReserva(c)} /> : null}
            {stage === "reserva" ? <>{perms.canCompleteSale ? <HoverBtn label="Registrar venda" cor="#34D399" onClick={() => setModalVenda(c)} /> : null}{perms.canApproveReservation && pendingReq ? <HoverBtn label="Aprovar" cor="#E8B45A" onClick={() => setModalAprovar(c)} /> : null}</> : null}
            <span style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
              <button type="button" onClick={(e) => { e.stopPropagation(); navigate(`/negociacoes/${c.id}`); }} style={{ fontSize: 11, color: "var(--color-sprout)", background: "none", border: "none", cursor: "pointer" }}>abrir ficha →</button>
              <button type="button" onClick={(e) => { e.stopPropagation(); if (cardMenuOpen === c.id) { setCardMenuOpen(null); setCardMenuPos(null); return; } const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect(); const top = window.innerHeight - rect.bottom < 120 ? rect.top - 120 : rect.bottom + 4; setCardMenuOpen(c.id); setCardMenuPos({ top, left: Math.max(8, rect.right - 180) }); }} style={{ background: "none", border: "none", color: "var(--color-clay)", fontSize: 16, cursor: "pointer", padding: "0 4px", lineHeight: 1, minWidth: 28, minHeight: 28 }}>⋮</button>
            </span>
          </div>
        ) : null}
      </div>
    );
  }
}

const menuItem: React.CSSProperties = { display: "block", width: "100%", textAlign: "left", background: "transparent", border: "none", color: "var(--text-secondary)", fontSize: 13, padding: "8px 14px", cursor: "pointer", borderRadius: 6 };

function HoverBtn({ label, cor, onClick }: { label: string; cor: string; onClick: () => void }) {
  return <button type="button" onClick={(e) => { e.stopPropagation(); onClick(); }} style={{ fontSize: 11, padding: "7px 10px", minHeight: 34, borderRadius: 6, border: `1px solid ${cor}40`, background: `${cor}15`, color: cor, cursor: "pointer", whiteSpace: "nowrap" }}>{label}</button>;
}
