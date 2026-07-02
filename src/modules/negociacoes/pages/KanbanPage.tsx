import { useEffect, useMemo, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "../../../shared/hooks/useIsMobile";
import { useAccount } from "../../../app/contexts/AccountContext";
import { useDevelopment } from "../../../app/contexts/DevelopmentContext";
import { useAuth } from "../../../app/contexts/AuthContext";
import { useKanbanData, type KanbanCard } from "../hooks/useKanbanData";
import { usePipelineActions } from "../hooks/usePipelineActions";
import { CriarPropostaModal, SolicitarReservaModal, AprovarReservaModal, RegistrarVendaModal } from "../components/PipelineActionModals";
import { useScreen } from "../../../shared/hooks/useIsMobile";
import { useCelebration, CelebrationToasts } from "../../../shared/components/Celebration";
import { getPermissions } from "../../../shared/utils/permissoes";
import { supabase } from "../../../infra/supabase/supabaseClient";
import { timeAgo } from "../../../shared/utils/timeAgo";
import { fetchMyQueuePositions } from "../../units/hooks/useUnitQueue";
import CancelNegotiationModal from "../../../shared/components/CancelNegotiationModal";

type EstagioId = "simulacao" | "negociacao" | "proposta" | "reserva" | "venda" | "perdido";

const EST: { id: EstagioId; label: string; cor: string; bg: string; badge: string; empty?: string }[] = [
  { id: "simulacao", label: "Simulação", cor: "#9C9686", bg: "rgba(156,150,134,0.1)", badge: "Rascunho" },
  { id: "negociacao", label: "Negociação", cor: "#4ADE80", bg: "rgba(74,222,128,0.1)", badge: "Em andamento" },
  { id: "proposta", label: "Proposta", cor: "#60A5FA", bg: "rgba(96,165,250,0.1)", badge: "Aguardando" },
  { id: "reserva", label: "Reserva", cor: "#D97706", bg: "rgba(217,119,6,0.1)", badge: "Reservado" },
  { id: "venda", label: "Venda", cor: "#4ADE80", bg: "rgba(74,222,128,0.1)", badge: "Vendido" },
  { id: "perdido", label: "Perdido", cor: "#F87171", bg: "rgba(248,113,113,0.1)", badge: "Perdido" },
];

const CARD_BG = "linear-gradient(145deg, #22211C 0%, #16150F 100%)";
const CARD_BG_HOVER = "linear-gradient(145deg, #2A2924 0%, #1A1914 100%)";
const CARD_BG_SALE = "linear-gradient(145deg, rgba(74,222,128,0.08) 0%, #16150F 60%)";
const CARD_BG_WARNING = "linear-gradient(145deg, rgba(251,191,36,0.06) 0%, #16150F 60%)";
const CARD_BG_URGENT = "linear-gradient(145deg, rgba(248,113,113,0.07) 0%, #16150F 60%)";
const CARD_BORDER = "1px solid rgba(61,58,48,0.5)";
const MONO = "var(--font-mono)";
const MAX_CARDS_PER_COL = 5;

function fmtV(v: number) { return v >= 1e6 ? `R$ ${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `R$ ${(v / 1e3).toFixed(0)}k` : `R$ ${v}`; }
function fmtBRL(v: number | null) { return v ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }) : "—"; }
function dRel(d: string) { return timeAgo(d); }

function getEstagio(c: KanbanCard): EstagioId {
  if (c.isSimulacao) return "simulacao";
  const s = (c.status || "").toUpperCase();
  const us = (c.unitStatus || "").toLowerCase();
  if (s === "LOST" || s === "CANCELLED") return "perdido";
  if (s === "WON" || s === "SOLD" || us === "sold" || us === "vendido") return "venda";
  if (c.reservaStatus && !["expirada", "cancelada", "convertida", "expired", "cancelled", "converted"].includes(c.reservaStatus)) return "reserva";
  if (us === "reserved" || us === "reservado") return "reserva";
  if (c.reservaRequestId && (c.reservaRequestStatus === "pending" || c.reservaRequestStatus === "requested")) return "reserva";
  if (c.propostaId) return "proposta";
  if (s === "IN_PROGRESS" || s === "OPEN") return "negociacao";
  return "simulacao";
}

function diasSemAtividade(c: KanbanCard) { return c.updatedAt ? Math.floor((Date.now() - new Date(c.updatedAt).getTime()) / 864e5) : 0; }

function getExpirationText(expiresAt: string | null): string | null {
  if (!expiresAt) return null;
  const diffMs = new Date(expiresAt).getTime() - Date.now();
  if (diffMs <= 0) return "Expirada";
  const hours = Math.floor(diffMs / 36e5);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d`;
  if (hours > 0) return `${hours}h`;
  return "<1h";
}

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
  const { toasts, celebrate, celebrateSale } = useCelebration();
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

  // Compute effective kanban filters (profile-based OR member dropdown)
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

  const { cards, loading, error } = useKanbanData(aId, dId, refreshKey, effectiveFilters);

  // Cadence threshold for time badges (days)
  const [cadenceThresholdDays, setCadenceThresholdDays] = useState(7);
  useEffect(() => {
    if (!supabase || !aId) return;
    supabase.from("cadence_settings").select("negotiation_idle_hours").eq("account_id", aId).limit(1).maybeSingle().then(({ data }) => {
      if (data?.negotiation_idle_hours) setCadenceThresholdDays(Math.max(1, Math.round(Number(data.negotiation_idle_hours) / 24)));
    });
  }, [aId]);

  const [busca, setBusca] = useState("");
  const [mobileTab, setMobileTab] = useState<EstagioId>("negociacao");
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [modalProposta, setModalProposta] = useState<KanbanCard | null>(null);
  const [modalReserva, setModalReserva] = useState<KanbanCard | null>(null);
  const [modalAprovar, setModalAprovar] = useState<KanbanCard | null>(null);
  const [modalVenda, setModalVenda] = useState<KanbanCard | null>(null);

  const [cancelTarget, setCancelTarget] = useState<KanbanCard | null>(null);
  const [cardMenuOpen, setCardMenuOpen] = useState<string | null>(null);
  const [cardMenuPos, setCardMenuPos] = useState<{ top: number; left: number } | null>(null);

  // Queue positions for current user
  const [myQueueMap, setMyQueueMap] = useState<Record<string, number>>({});
  useEffect(() => { const uid = authenticatedProfile?.id; if (uid) fetchMyQueuePositions(uid).then(setMyQueueMap); }, [authenticatedProfile?.id, refreshKey]);

  // Simulation detail
  const [simDetail, setSimDetail] = useState<KanbanCard | null>(null);
  const [deletingSim, setDeletingSim] = useState(false);

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerUnidade, setDrawerUnidade] = useState<{ quadra: string | null; lote: string | null; valor: number | null } | null>(null);
  const [drawerNegId, setDrawerNegId] = useState<string | null>(null);
  const abrirSimulador = useCallback((c: KanbanCard) => {
    setDrawerUnidade({ quadra: c.quadra, lote: c.lote, valor: c.valor });
    setDrawerNegId(c.id);
    setDrawerOpen(true);
  }, []);

  // Filter + group
  const filtered = useMemo(() => {
    let cs = cards;
    if (isBroker && isBrokerManager && brokerViewMode === "team" && teamBrokerIds.length > 0) {
      cs = cs.filter((c) => c.corretorId && teamBrokerIds.includes(c.corretorId));
    }
    if (busca) { const t = busca.toLowerCase(); cs = cs.filter((c) => c.clienteNome?.toLowerCase().includes(t) || c.quadra?.toLowerCase().includes(t) || c.lote?.toLowerCase().includes(t) || c.corretorNome?.toLowerCase().includes(t) || c.thirdPartyPropertyTitulo?.toLowerCase().includes(t) || c.id.includes(t)); }
    return cs;
  }, [cards, busca, isBroker, isBrokerManager, brokerViewMode, teamBrokerIds]);

  const grupos = useMemo(() => {
    const g: Record<EstagioId, KanbanCard[]> = { simulacao: [], negociacao: [], proposta: [], reserva: [], venda: [], perdido: [] };
    filtered.forEach((c) => g[getEstagio(c)].push(c));
    return g;
  }, [filtered]);

  const vgvByStage = useMemo(() => { const r: Record<string, number> = {}; Object.entries(grupos).forEach(([k, cs]) => { r[k] = cs.reduce((s, c) => s + (c.valor ?? 0), 0); }); return r; }, [grupos]);
  const totalVGV = filtered.reduce((s, c) => s + (c.valor ?? 0), 0);
  const urgentCount = useMemo(() => {
    let n = 0;
    grupos.reserva.forEach((c) => {
      const e = getExpirationText(c.reservaExpiresAt);
      if (e === "Expirada" || (e != null && !e.includes("d"))) n += 1;
    });
    filtered.forEach((c) => { if (!c.isSimulacao && diasSemAtividade(c) >= cadenceThresholdDays) n += 1; });
    return n;
  }, [grupos.reserva, filtered, cadenceThresholdDays]);

  // Expanded columns (for "+N mais")
  const [expandedCols, setExpandedCols] = useState<Set<EstagioId>>(new Set());

  if (loading) return <div className="nexa-page-enter" style={{ padding: 24 }}><div className="nexa-skeleton" style={{ height: 24, width: 180, marginBottom: 20, borderRadius: 8 }} /><div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 20 }}>{[1,2,3,4].map(i => <div key={i} className="nexa-skeleton nexa-skeleton-kpi" />)}</div><div style={{ display: "flex", gap: 12 }}>{[1,2,3,4,5].map(i => <div key={i} style={{ flex: 1 }}><div className="nexa-skeleton" style={{ height: 12, width: 80, marginBottom: 8, borderRadius: 4 }} /><div className="nexa-skeleton nexa-skeleton-card" /><div className="nexa-skeleton nexa-skeleton-card" /></div>)}</div></div>;
  if (error) return <div style={{ padding: 24 }}><div style={{ color: "#F87171", fontSize: 14 }}>Erro: {error}</div></div>;

  const stageCount = EST.filter((e) => grupos[e.id].length > 0).length;

  return (
    <>
    <SimDrawer open={drawerOpen} unidade={drawerUnidade} onClose={() => setDrawerOpen(false)} onCriarProposta={() => { setDrawerOpen(false); if (drawerNegId) navigate(`/negociacoes/${drawerNegId}`); }} />
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontStyle: "italic", fontSize: 28, fontWeight: 400, color: "#E8E5DE", margin: 0, lineHeight: 1.1 }}>Pipeline</h1>
          <p style={{ fontSize: 10.5, color: "#706B5F", margin: "6px 0 0", fontFamily: MONO, letterSpacing: "0.05em" }}>
            {filtered.length} negociações · {fmtV(totalVGV)} em pipeline · {stageCount} de {EST.length} estágios ativos
            {urgentCount > 0 ? <span style={{ color: "#F87171", marginLeft: 8 }}>· {urgentCount} {urgentCount === 1 ? "requer" : "requerem"} atenção</span> : null}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {isBrokerManager && teamBrokerIds.length > 0 ? (
            <div style={{ display: "flex", borderRadius: 16, overflow: "hidden", border: "1px solid rgba(61,58,48,0.2)" }}>
              {(["mine", "team"] as const).map((m) => (
                <button key={m} type="button" onClick={() => setBrokerViewMode(m)} style={{ padding: "5px 14px", background: brokerViewMode === m ? "rgba(74,222,128,0.06)" : "transparent", color: brokerViewMode === m ? "#4ADE80" : "#5C5647", border: "none", fontSize: 11, fontWeight: 500, cursor: "pointer" }}>{m === "mine" ? "Minhas" : "Equipe"}</button>
              ))}
            </div>
          ) : null}
          {perms.canViewFullDashboard && memberOptions.length > 1 ? (
            <select value={memberFilter} onChange={(e) => setMemberFilter(e.target.value)} style={{ background: "var(--surface-raised)", border: "1px solid rgba(61,58,48,0.2)", borderRadius: 8, padding: "8px 12px", color: "var(--text-secondary)", fontSize: 13, outline: "none" }}>
              {memberOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          ) : null}
          <input placeholder="Buscar cliente, unidade, imóvel..." value={busca} onChange={(e) => setBusca(e.target.value)} style={{ background: "var(--surface-raised)", border: "1px solid rgba(61,58,48,0.2)", borderRadius: 8, padding: "8px 14px", color: "var(--text-secondary)", fontSize: 13, outline: "none", width: isMobile ? "100%" : 200 }} />
          <button type="button" onClick={() => navigate("/negociacoes")} style={{ background: "transparent", border: "1px solid rgba(61,58,48,0.2)", borderRadius: 8, padding: "8px 14px", color: "#5C5647", fontSize: 13, cursor: "pointer" }}>Ver Lista</button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${screen.columns}, minmax(0, 1fr))`, gap: 10, marginBottom: 12 }}>
        {[
          { l: "Negociações", n: (grupos.negociacao.length + grupos.proposta.length + grupos.reserva.length + grupos.venda.length), v: (grupos.negociacao.length + grupos.proposta.length + grupos.reserva.length + grupos.venda.length).toString(), glow: "#4ADE80", icon: "N" },
          { l: "Propostas", n: grupos.proposta.length, v: grupos.proposta.length.toString(), glow: "#60A5FA", icon: "P" },
          { l: "Reservas", n: grupos.reserva.length, v: grupos.reserva.length.toString(), glow: "#A78BFA", icon: "R" },
          { l: "VGV Pipeline", n: totalVGV, v: fmtV(totalVGV), glow: "#D97706", icon: "R$" },
        ].map((s) => {
          const isZero = s.n === 0;
          return (
            <div key={s.l} style={{
              background: isZero ? "linear-gradient(145deg, #181713 0%, #121110 100%)" : CARD_BG,
              border: isZero ? "1px solid rgba(61,58,48,0.25)" : CARD_BORDER,
              borderRadius: 12, padding: "14px 16px", position: "relative", overflow: "hidden",
              opacity: isZero ? 0.55 : 1,
            }}>
              {!isZero && <div style={{ position: "absolute", top: -20, right: -20, width: 80, height: 80, borderRadius: "50%", background: s.glow, opacity: 0.08, filter: "blur(20px)", pointerEvents: "none" }} />}
              <div style={{ position: "relative", zIndex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div style={{ fontSize: 8.5, color: "#5C5647", fontFamily: MONO, letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 500 }}>{s.l}</div>
                  <div style={{ width: 22, height: 22, borderRadius: 6, background: `${s.glow}${isZero ? "08" : "15"}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: MONO, fontSize: 9, fontWeight: 700, color: s.glow }}>{s.icon}</div>
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: isZero ? "#706B5F" : "#FAF9F6", fontFamily: MONO }}>{s.v}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Distribution bar + legend */}
      {filtered.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", height: 6, borderRadius: 3, overflow: "hidden", background: "rgba(61,58,48,0.35)" }}>
            {EST.map((est) => {
              const pct = (grupos[est.id].length / filtered.length) * 100;
              return pct > 0 ? <div key={est.id} style={{ width: `${pct}%`, minWidth: 4, background: est.cor, transition: "width 0.3s" }} /> : null;
            })}
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 6, flexWrap: "wrap" }}>
            {EST.filter((est) => grupos[est.id].length > 0).map((est) => (
              <div key={est.id} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: est.cor }} />
                <span style={{ fontFamily: MONO, fontSize: 9, color: "#706B5F", letterSpacing: "0.03em" }}>
                  {est.label} {grupos[est.id].length}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Board */}
      {isMobile ? (
        <>
          {/* Mobile tab pills — v7 style */}
          <div style={{ display: "flex", gap: 6, overflowX: "auto", WebkitOverflowScrolling: "touch", paddingBottom: 8, marginBottom: 12 }}>
            {EST.map((est) => {
              const count = grupos[est.id].length;
              const active = mobileTab === est.id;
              return (
                <button key={est.id} type="button" onClick={() => setMobileTab(est.id)} style={{
                  flexShrink: 0, padding: "5px 14px", borderRadius: 16, fontSize: 11, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap", minHeight: 36,
                  border: active ? `1px solid ${est.cor}30` : "1px solid rgba(61,58,48,0.2)",
                  background: active ? `${est.cor}10` : "transparent",
                  color: active ? est.cor : "#5C5647",
                }}>
                  {est.label}{count > 0 ? ` · ${count}` : ""}
                </button>
              );
            })}
          </div>
          {/* Mobile card list */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingBottom: 16 }}>
            {(() => {
              const est = EST.find((e) => e.id === mobileTab)!;
              const cs = grupos[mobileTab];
              if (cs.length === 0) return <div style={{ textAlign: "center", padding: "32px 10px", border: "1px dashed rgba(61,58,48,0.4)", borderRadius: 10, color: "#5C5647", fontSize: 12, fontStyle: "italic" }}>Sem {est.label.toLowerCase()}</div>;
              return cs.map((c) => {
                const dias = diasSemAtividade(c);
                const isReserva = mobileTab === "reserva";
                const isVenda = mobileTab === "venda";
                const expText = isReserva ? getExpirationText(c.reservaExpiresAt) : null;
                const isExpired = expText === "Expirada";
                const isUrgent = isReserva && (isExpired || (expText != null && !expText.includes("d")));
                return (
                  <div key={c.id} onClick={() => c.isSimulacao ? setSimDetail(c) : navigate(`/negociacoes/${c.id}`)} style={{
                    background: isVenda ? CARD_BG_SALE : CARD_BG,
                    border: isUrgent ? "1px solid rgba(248,113,113,0.2)" : CARD_BORDER,
                    borderLeft: isUrgent ? "2.5px solid #F87171" : `2.5px solid ${est.cor}`,
                    borderRadius: "0 10px 10px 0", padding: "14px 16px", cursor: "pointer",
                    opacity: mobileTab === "perdido" ? 0.6 : 1,
                  }}>
                    {/* ID + expiration/temp */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <span style={{ fontFamily: MONO, fontSize: 8.5, color: "#5C5647", fontWeight: 500 }}>{`NEG-${c.id.substring(0, 4).toUpperCase()}`}</span>
                      {expText ? (
                        <span style={{ fontFamily: MONO, fontSize: 7, color: isExpired ? "#F87171" : "#D97706", background: isExpired ? "rgba(248,113,113,0.08)" : "rgba(217,119,6,0.08)", padding: "2px 5px", borderRadius: 3, fontWeight: 600, textTransform: "uppercase" }}>
                          {isExpired ? "EXPIRADA" : `EXPIRA ${expText}`}
                        </span>
                      ) : c.score != null && !c.isSimulacao && mobileTab !== "perdido" && mobileTab !== "venda" ? (() => {
                        const dotColor = c.score > 70 ? "#4ADE80" : c.score >= 40 ? "#FBBF24" : "#F87171";
                        const pillBg = c.score > 70 ? "rgba(74,222,128,0.15)" : c.score >= 40 ? "rgba(251,191,36,0.15)" : "rgba(248,113,113,0.15)";
                        return (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 6, fontFamily: MONO, background: pillBg, color: dotColor }}>
                            <span style={{ width: 4, height: 4, borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
                            {c.score}
                          </span>
                        );
                      })() : null}
                    </div>
                    {/* Client name */}
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#E8E5DE", marginBottom: 3 }}>
                      {c.clienteNome || <span style={{ color: "#5C5647", fontStyle: "italic", fontWeight: 400 }}>Sem cliente</span>}
                      {dias >= 7 && mobileTab !== "venda" ? <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 4, background: "rgba(248,113,113,0.15)", color: "#F87171", marginLeft: 5 }}>{dias}d</span> : null}
                    </div>
                    {/* Unit */}
                    {c.thirdPartyPropertyId ? (
                      <div style={{ fontSize: 11, color: "#706B5F", marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", color: "#D97706", background: "rgba(217,119,6,0.08)", padding: "2px 6px", borderRadius: 4 }}>IMÓVEL</span>
                        <span>{c.thirdPartyPropertyTitulo || "Imóvel"}</span>
                      </div>
                    ) : c.quadra ? <div style={{ fontFamily: MONO, fontSize: 9.5, color: "#9C9686", marginBottom: 4 }}>Q{c.quadra} · L{c.lote}</div> : null}
                    {/* Value */}
                    <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: "#4ADE80", marginBottom: 6 }}>{fmtBRL(c.valor)}</div>
                    {/* Footer */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 10, color: "#706B5F" }}>{c.corretorNome || "—"}</span>
                      {isVenda && <span style={{ fontFamily: MONO, fontSize: 7, fontWeight: 600, padding: "2px 5px", borderRadius: 3, color: "#4ADE80", background: "rgba(74,222,128,0.08)", textTransform: "uppercase" }}>Concluída</span>}
                    </div>
                    {/* Mobile actions */}
                    {mobileTab !== "perdido" ? (
                      <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(61,58,48,0.06)" }} onClick={(e) => e.stopPropagation()}>
                        {mobileTab === "simulacao" && c.isSimulacao ? <HoverBtn label={convertingSimId === c.id ? "..." : "Negociação"} cor="#4ADE80" onClick={() => { if (convertingSimId) return; setConvertingSimId(c.id); void converterSimulacao({ simulationId: c.id, unitId: c.unitId!, clientId: c.clienteId, brokerId: c.corretorId }).then(() => celebrate("Negociação iniciada!")).catch((e: unknown) => { alert(e instanceof Error ? e.message : "Erro"); }).finally(() => setConvertingSimId(null)); }} /> : null}
                        {mobileTab === "negociacao" ? <HoverBtn label="Proposta" cor="#FBBF24" onClick={() => setModalProposta(c)} /> : null}
                        {mobileTab === "proposta" ? <HoverBtn label="Reserva" cor="#A78BFA" onClick={() => setModalReserva(c)} /> : null}
                        {mobileTab === "reserva" ? <>{perms.canCompleteSale ? <HoverBtn label="Venda" cor="#4ADE80" onClick={() => setModalVenda(c)} /> : null}{perms.canApproveReservation && c.reservaRequestId && (c.reservaRequestStatus === "pending" || c.reservaRequestStatus === "requested") ? <HoverBtn label="Aprovar" cor="#A78BFA" onClick={() => setModalAprovar(c)} /> : null}</> : null}
                        <span style={{ marginLeft: "auto", fontSize: 10, color: "#5C5647", fontFamily: MONO }}>{dRel(c.updatedAt)}</span>
                      </div>
                    ) : c.lostReason ? <div style={{ fontSize: 11, color: "#F87171", marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(61,58,48,0.06)" }}>Motivo: {c.lostReason}</div> : null}
                  </div>
                );
              });
            })()}
          </div>
        </>
      ) : (
      <div style={{ overflowX: "auto", paddingBottom: 16, WebkitOverflowScrolling: "touch" }}>
        <div style={{ display: "flex", gap: 0, alignItems: "stretch", minWidth: screen.width < 1200 ? Math.max(screen.width * 1.5, 860) : 860 }}>
          {EST.map((est, idx) => {
            const cs = grupos[est.id];
            const vgv = vgvByStage[est.id] ?? 0;
            const isExpanded = expandedCols.has(est.id);
            const visibleCards = isExpanded ? cs : cs.slice(0, MAX_CARDS_PER_COL);
            const hiddenCount = cs.length - visibleCards.length;
            return (
              <div key={est.id} style={{ flex: [2.2, 2, 1.8, 1.6, 1.4, 1.2][idx], minWidth: 160, display: "flex", flexDirection: "column" }}>
                {/* Column header v7 */}
                <div style={{ padding: "12px 14px", background: CARD_BG, borderRadius: "10px 10px 0 0", border: "1px solid rgba(61,58,48,0.08)", borderBottom: "none" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: "#C4BFB3" }}>{est.label}</span>
                    <span style={{ fontFamily: MONO, fontSize: 9, color: "#5C5647", background: "rgba(61,58,48,0.2)", padding: "1px 6px", borderRadius: 6 }}>{cs.length}</span>
                  </div>
                  {vgv > 0 ? <div style={{ fontFamily: MONO, fontSize: 9, color: "#5C5647" }}>{fmtV(vgv)}</div> : null}
                  <div style={{ height: 2, borderRadius: 1, marginTop: 8, background: `linear-gradient(90deg, ${est.cor}60, ${est.cor}15)` }} />
                </div>
                {/* Column body */}
                <div style={{ flex: 1, padding: 6, background: "rgba(18,17,14,0.3)", borderRadius: "0 0 10px 10px", border: "1px solid rgba(61,58,48,0.06)", borderTop: "none", display: "flex", flexDirection: "column", gap: 6, minHeight: 200 }}>
                  {cs.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "20px 10px", border: "1px dashed rgba(61,58,48,0.4)", borderRadius: 10, color: "#5C5647", fontSize: 12, fontStyle: "italic" }}>Sem {est.label.toLowerCase()}</div>
                  ) : visibleCards.map((c, ci) => {
                    const dias = diasSemAtividade(c);
                    const isReserva = est.id === "reserva";
                    const isVenda = est.id === "venda";
                    const isHovered = hoveredId === c.id;
                    const expText = isReserva ? getExpirationText(c.reservaExpiresAt) : null;
                    const isExpired = expText === "Expirada";
                    const isUrgent = isReserva && (isExpired || (expText != null && !expText.includes("d")));
                    const isIdleWarn = !c.isSimulacao && !isUrgent && dias >= Math.max(1, Math.round(cadenceThresholdDays * 0.7)) && dias < cadenceThresholdDays;
                    const isIdleUrgent = !c.isSimulacao && !isUrgent && dias >= cadenceThresholdDays;
                    const cardBg = isVenda ? CARD_BG_SALE
                      : isHovered ? CARD_BG_HOVER
                      : (isUrgent || isIdleUrgent) ? CARD_BG_URGENT
                      : isIdleWarn ? CARD_BG_WARNING
                      : CARD_BG;
                    const cardBorder = isHovered ? "1px solid rgba(74,222,128,0.18)"
                      : (isUrgent || isIdleUrgent) ? "1px solid rgba(248,113,113,0.22)"
                      : isIdleWarn ? "1px solid rgba(251,191,36,0.2)"
                      : CARD_BORDER;
                    return (
                      <div key={c.id}
                        onClick={() => c.isSimulacao ? setSimDetail(c) : navigate(`/negociacoes/${c.id}`)}
                        onMouseEnter={() => setHoveredId(c.id)}
                        onMouseLeave={() => setHoveredId(null)}
                        style={{
                          position: "relative",
                          zIndex: cardMenuOpen === c.id ? 30 : isHovered ? 20 : "auto",
                          background: cardBg,
                          border: cardBorder,
                          borderLeft: isUrgent ? "2.5px solid #F87171" : undefined,
                          borderRadius: 9, padding: 12, cursor: "pointer",
                          animation: isUrgent ? "cardpulse 2s infinite" : `fadeInUp 300ms cubic-bezier(0.16,1,0.3,1) both`,
                          animationDelay: isUrgent ? undefined : `${Math.min(ci, 5) * 40}ms`,
                          transition: "background 150ms ease, transform 150ms ease, border-color 150ms ease, z-index 0ms",
                          transform: isHovered ? "translateY(-1px)" : "none",
                          opacity: est.id === "perdido" ? 0.6 : 1,
                        }}>
                        {/* Line 1: ID + expiration/score */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                          <span style={{ fontFamily: MONO, fontSize: 8.5, color: "#5C5647", fontWeight: 500 }}>{`NEG-${c.id.substring(0, 4).toUpperCase()}`}</span>
                          {expText ? (
                            <span style={{ fontFamily: MONO, fontSize: 7, color: isExpired ? "#F87171" : "#D97706", background: isExpired ? "rgba(248,113,113,0.08)" : "rgba(217,119,6,0.08)", padding: "2px 5px", borderRadius: 3, fontWeight: 600, textTransform: "uppercase" }}>
                              {isExpired ? "EXPIRADA" : `EXPIRA ${expText}`}
                            </span>
                          ) : c.score != null && !c.isSimulacao && est.id !== "perdido" && est.id !== "venda" ? (() => {
                            const dotColor = c.score > 70 ? "#4ADE80" : c.score >= 40 ? "#FBBF24" : "#F87171";
                            const pillBg = c.score > 70 ? "rgba(74,222,128,0.15)" : c.score >= 40 ? "rgba(251,191,36,0.15)" : "rgba(248,113,113,0.15)";
                            return (
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 6, fontFamily: MONO, background: pillBg, color: dotColor }}>
                                <span style={{ width: 4, height: 4, borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
                                {c.score}
                              </span>
                            );
                          })() : null}
                        </div>
                        {/* Line 2: Client name */}
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#E8E5DE", marginBottom: 3, lineHeight: 1.3 }}>
                          {c.clienteId && c.clienteNome ? <span onClick={(e) => { e.stopPropagation(); navigate(`/clientes/${c.clienteId}`); }} style={{ cursor: "pointer", borderBottom: "1px dashed rgba(92,86,71,0.3)" }}>{c.clienteNome}</span> : (c.clienteNome || <span style={{ color: "#5C5647", fontStyle: "italic", fontWeight: 400 }}>Sem cliente</span>)}
                          {dias >= 7 && est.id !== "venda" ? <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 4, background: "rgba(248,113,113,0.15)", color: "#F87171", marginLeft: 5 }}>{dias}d</span> : null}
                        </div>
                        {/* Line 3: Unit */}
                        {c.thirdPartyPropertyId ? (
                          <div style={{ fontSize: 11, color: "#706B5F", marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", color: "#D97706", background: "rgba(217,119,6,0.08)", padding: "2px 6px", borderRadius: 4 }}>IMÓVEL</span>
                            <span>{c.thirdPartyPropertyTitulo || "Imóvel"}</span>
                          </div>
                        ) : c.quadra ? <div style={{ fontFamily: MONO, fontSize: 9.5, color: "#9C9686", marginBottom: 4 }}>Q{c.quadra} · L{c.lote}{c.unitId && myQueueMap[c.unitId] ? <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: "#60A5FA20", color: "#60A5FA", fontWeight: 600, marginLeft: 6 }}>Fila #{myQueueMap[c.unitId]}</span> : null}</div> : null}
                        {/* Line 4: Value */}
                        <div style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: "#4ADE80", marginTop: 4 }}>{fmtBRL(c.valor)}</div>
                        {/* Line 5: Broker + badge/time */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                          <span style={{ fontSize: 10, color: "#706B5F" }}>{c.corretorNome || "—"}</span>
                          {isVenda ? (
                            <span style={{ fontFamily: MONO, fontSize: 7, fontWeight: 600, padding: "2px 5px", borderRadius: 3, color: "#4ADE80", background: "rgba(74,222,128,0.08)", textTransform: "uppercase" }}>Concluída</span>
                          ) : (() => {
                            if (c.isSimulacao || est.id === "perdido") return <span style={{ fontSize: 10, color: "#5C5647", fontFamily: MONO }}>{dRel(c.updatedAt)}</span>;
                            const ref = c.stageChangedAt || c.updatedAt;
                            const daysInStage = ref ? Math.floor((Date.now() - new Date(ref).getTime()) / 864e5) : 0;
                            const threshold = cadenceThresholdDays;
                            const timeColor = daysInStage < threshold * 0.5 ? "#4ADE80" : daysInStage < threshold ? "#FBBF24" : "#F87171";
                            const timeLabel = daysInStage === 0 ? "hoje" : daysInStage === 1 ? "há 1 dia" : `há ${daysInStage}d`;
                            return <span style={{ fontSize: 10, color: timeColor, fontFamily: MONO, fontWeight: 600 }}>{timeLabel}</span>;
                          })()}
                        </div>
                        {/* Lost reason */}
                        {est.id === "perdido" && c.lostReason && (
                          <div style={{ fontSize: 11, color: "#F87171", marginTop: 6, paddingTop: 6, borderTop: "1px solid rgba(61,58,48,0.06)" }}>Motivo: {c.lostReason}</div>
                        )}
                        {/* Hover actions */}
                        {(isHovered || isMobile) && est.id !== "perdido" ? (
                          <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(61,58,48,0.06)" }} onClick={(e) => e.stopPropagation()}>
                            {est.id === "simulacao" && c.isSimulacao ? <HoverBtn label={convertingSimId === c.id ? "Criando..." : "Iniciar negociação"} cor="#4ADE80" onClick={() => { if (convertingSimId) return; setConvertingSimId(c.id); void converterSimulacao({ simulationId: c.id, unitId: c.unitId!, clientId: c.clienteId, brokerId: c.corretorId }).then(() => celebrate("Negociação iniciada!")).catch((e: unknown) => { alert(e instanceof Error ? e.message : "Erro"); }).finally(() => setConvertingSimId(null)); }} /> : null}
                            {est.id === "negociacao" ? <HoverBtn label="Criar proposta" cor="#FBBF24" onClick={() => setModalProposta(c)} /> : null}
                            {est.id === "proposta" ? <HoverBtn label="Solicitar reserva" cor="#A78BFA" onClick={() => setModalReserva(c)} /> : null}
                            {est.id === "reserva" ? <>{perms.canCompleteSale ? <HoverBtn label="Registrar venda" cor="#4ADE80" onClick={() => setModalVenda(c)} /> : null}{perms.canApproveReservation && c.reservaRequestId && (c.reservaRequestStatus === "pending" || c.reservaRequestStatus === "requested") ? <HoverBtn label="Aprovar" cor="#A78BFA" onClick={() => setModalAprovar(c)} /> : null}</> : null}
                            {/* ⋮ menu trigger (portal rendered at page bottom) */}
                            <div style={{ marginLeft: "auto" }}>
                              <button type="button" onClick={(e) => {
                                e.stopPropagation();
                                if (cardMenuOpen === c.id) { setCardMenuOpen(null); setCardMenuPos(null); return; }
                                const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                                const menuWidth = 180;
                                const menuHeight = 140;
                                const spaceBelow = window.innerHeight - rect.bottom;
                                const top = spaceBelow < menuHeight ? rect.top - menuHeight - 4 : rect.bottom + 4;
                                const left = Math.max(8, rect.right - menuWidth);
                                setCardMenuOpen(c.id);
                                setCardMenuPos({ top, left });
                              }} style={{ background: "none", border: "none", color: "#5C5647", fontSize: 18, cursor: "pointer", padding: "6px 10px", borderRadius: 4, lineHeight: 1, minWidth: 32, minHeight: 32 }}>⋮</button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                  {/* +N mais */}
                  {hiddenCount > 0 && (
                    <button type="button" onClick={() => setExpandedCols((s) => { const n = new Set(s); n.add(est.id); return n; })} style={{ fontFamily: MONO, fontSize: 9, color: "#706B5F", textAlign: "center", padding: 8, background: "none", border: "1px dashed rgba(61,58,48,0.15)", borderRadius: 8, cursor: "pointer" }}>
                      +{hiddenCount} {est.label.toLowerCase()}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      )}
    </div>
    <CelebrationToasts toasts={toasts} />

    {/* ⋮ card menu — portal rendered to break out of card stacking context */}
    {cardMenuOpen && cardMenuPos && (() => {
      const c = cards.find((x) => x.id === cardMenuOpen);
      if (!c) return null;
      const est = getEstagio(c);
      return createPortal(
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 9998 }} onClick={() => { setCardMenuOpen(null); setCardMenuPos(null); }} />
          <div style={{ position: "fixed", top: cardMenuPos.top, left: cardMenuPos.left, background: "var(--surface-raised)", border: "1px solid var(--border-default)", borderRadius: 8, padding: 4, minWidth: 180, boxShadow: "0 8px 24px rgba(0,0,0,0.4)", zIndex: 9999 }}>
            <button type="button" onClick={() => { setCardMenuOpen(null); setCardMenuPos(null); navigate(`/negociacoes/${c.id}`); }} onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-overlay)"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }} style={{ display: "block", width: "100%", textAlign: "left", background: "transparent", border: "none", color: "var(--text-secondary)", fontSize: 13, padding: "8px 14px", cursor: "pointer", borderRadius: 6 }}>Detalhes</button>
            {est !== "venda" ? <button type="button" onClick={() => { setCardMenuOpen(null); setCardMenuPos(null); abrirSimulador(c); }} onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-overlay)"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }} style={{ display: "block", width: "100%", textAlign: "left", background: "transparent", border: "none", color: "var(--text-secondary)", fontSize: 13, padding: "8px 14px", cursor: "pointer", borderRadius: 6 }}>Simular</button> : null}
            {est !== "venda" && est !== "simulacao" && perms.canCancelSale ? (
              <>
                <div style={{ height: 1, background: "var(--surface-overlay)", margin: "4px 8px" }} />
                <button type="button" onClick={() => { setCardMenuOpen(null); setCardMenuPos(null); setCancelTarget(c); }} onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-overlay)"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }} style={{ display: "block", width: "100%", textAlign: "left", background: "transparent", border: "none", color: "#F87171", fontSize: 13, padding: "8px 14px", cursor: "pointer", borderRadius: 6 }}>Cancelar negociação</button>
              </>
            ) : null}
          </div>
        </>,
        document.body
      );
    })()}
    <CriarPropostaModal open={!!modalProposta} card={modalProposta} onClose={() => setModalProposta(null)} onConfirm={async ({ entradaPct, parcelas }) => { if (!modalProposta) return; const v = modalProposta.valor ?? 0; const ev = Math.round(v * entradaPct / 100); const pv = parcelas > 0 ? Math.round((v - ev) / parcelas) : 0; await criarProposta({ negotiationId: modalProposta.id, unitId: modalProposta.unitId!, clientId: modalProposta.clienteId!, brokerId: modalProposta.corretorId, amount: v, entradaPercentual: entradaPct, entradaValor: ev, parcelasQuantidade: parcelas, parcelasValor: pv }); celebrate("Proposta criada", `${modalProposta.clienteNome || "Cliente"} — Q${modalProposta.quadra}·L${modalProposta.lote}`); }} />
    <SolicitarReservaModal open={!!modalReserva} card={modalReserva} onClose={() => setModalReserva(null)} onConfirm={async () => { if (!modalReserva) return; await solicitarReserva({ negotiationId: modalReserva.id, unitId: modalReserva.unitId! }); celebrate("Reserva solicitada", `Aguardando aprovação — Q${modalReserva.quadra}·L${modalReserva.lote}`); }} />
    <AprovarReservaModal open={!!modalAprovar} card={modalAprovar} onClose={() => setModalAprovar(null)} onConfirm={async () => { if (!modalAprovar) return; await aprovarReserva(modalAprovar.id, modalAprovar.unitId!, modalAprovar.reservaRequestId ?? undefined); celebrate("Reserva aprovada", `Unidade Q${modalAprovar.quadra}·L${modalAprovar.lote} reservada`); }} />
    <RegistrarVendaModal open={!!modalVenda} card={modalVenda} onClose={() => setModalVenda(null)} onConfirm={async () => { if (!modalVenda) return; await registrarVenda({ negotiationId: modalVenda.id, unitId: modalVenda.unitId!, amount: modalVenda.valor ?? 0 }); celebrateSale("Venda registrada!", `${modalVenda.clienteNome || "Cliente"} — Q${modalVenda.quadra}·L${modalVenda.lote}`); }} />

    {/* Cancel negotiation modal */}
    <CancelNegotiationModal
      isOpen={!!cancelTarget}
      onClose={() => setCancelTarget(null)}
      negotiation={{ id: cancelTarget?.id ?? "", clientName: cancelTarget?.clienteNome || "Cliente", unitLabel: `Q${cancelTarget?.quadra || "?"} · L${cancelTarget?.lote || "?"}`, value: cancelTarget?.valor ?? 0, brokerName: cancelTarget?.corretorNome || "—" }}
      hasActiveReservation={!!cancelTarget?.reservaStatus && !["cancelada", "expirada", "convertida", "cancelled", "expired", "converted"].includes(cancelTarget.reservaStatus)}
      hasActiveProposals={!!cancelTarget?.propostaStatus && !["REJECTED", "EXPIRED", "ACCEPTED", "rejected", "expired", "accepted"].includes(cancelTarget.propostaStatus)}
      onConfirm={async (reason) => { if (!cancelTarget) return; await cancelarNegociacao({ negotiationId: cancelTarget.id, unitId: cancelTarget.unitId!, reason, currentStatus: cancelTarget.status }); celebrate("Negociação cancelada", `${cancelTarget.clienteNome || "Cliente"} — Q${cancelTarget.quadra}·L${cancelTarget.lote}`); setCancelTarget(null); }}
    />

    {/* Simulation detail modal */}
    {simDetail ? (
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }} onClick={() => setSimDetail(null)}>
        <div style={{ background: "var(--color-carbon)", border: "1px solid var(--color-stone)", borderRadius: 16, padding: 32, width: "100%", maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--color-bone)", margin: 0 }}>Simulação</h2>
              <span style={{ fontSize: 10, color: "var(--text-muted)", background: "rgba(156,150,134,0.12)", borderRadius: 20, padding: "2px 8px", marginTop: 6, display: "inline-block" }}>Rascunho</span>
            </div>
            <button type="button" onClick={() => setSimDetail(null)} style={{ background: "transparent", border: "none", color: "var(--color-fog)", fontSize: 18, cursor: "pointer" }}>×</button>
          </div>
          <div style={{ display: "grid", gap: 12, marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--color-stone)" }}>
              <span style={{ fontSize: 12, color: "var(--color-fog)" }}>Cliente</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-bone)" }}>{simDetail.clienteNome || "Não informado"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--color-stone)" }}>
              <span style={{ fontSize: 12, color: "var(--color-fog)" }}>Unidade</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-bone)" }}>{simDetail.quadra && simDetail.lote ? `Q${simDetail.quadra} L${simDetail.lote}` : "—"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--color-stone)" }}>
              <span style={{ fontSize: 12, color: "var(--color-fog)" }}>Valor</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-bone)", fontFamily: MONO }}>{fmtBRL(simDetail.valor)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--color-stone)" }}>
              <span style={{ fontSize: 12, color: "var(--color-fog)" }}>Corretor</span>
              <span style={{ fontSize: 13, color: "var(--color-bone)" }}>{simDetail.corretorNome || "—"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0" }}>
              <span style={{ fontSize: 12, color: "var(--color-fog)" }}>Criada</span>
              <span style={{ fontSize: 12, color: "var(--color-fog)", fontFamily: MONO }}>{timeAgo(simDetail.createdAt)}</span>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button type="button" disabled={!!convertingSimId} onClick={() => {
              setConvertingSimId(simDetail.id);
              void converterSimulacao({ simulationId: simDetail.id, unitId: simDetail.unitId!, clientId: simDetail.clienteId, brokerId: simDetail.corretorId })
                .then(() => { celebrate("Negociação iniciada!"); setSimDetail(null); })
                .catch((e: unknown) => { alert(e instanceof Error ? e.message : "Erro"); })
                .finally(() => setConvertingSimId(null));
            }} style={{ padding: "12px", borderRadius: 8, border: "none", background: convertingSimId === simDetail.id ? "rgba(74,222,128,0.3)" : "#4ADE80", color: "var(--interactive-on-primary)", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
              {convertingSimId === simDetail.id ? "Criando..." : "Iniciar negociação"}
            </button>
            <button type="button" onClick={() => { navigate(`/simulador?simulationId=${simDetail.id}`); setSimDetail(null); }} style={{ padding: "10px", borderRadius: 8, border: "1px solid var(--color-stone)", background: "transparent", color: "var(--color-bone)", fontSize: 13, cursor: "pointer" }}>
              Abrir no simulador
            </button>
            <button type="button" disabled={deletingSim} onClick={async () => {
              if (!supabase) return;
              setDeletingSim(true);
              try {
                const { error: delErr } = await supabase.from("pipeline_simulations").delete().eq("id", simDetail.id);
                if (delErr) throw delErr;
                celebrate("Simulação excluída");
                setSimDetail(null);
                onActionSuccess();
              } catch (e: unknown) {
                celebrate(e instanceof Error ? e.message : "Erro ao excluir");
              } finally {
                setDeletingSim(false);
              }
            }} style={{ padding: "10px", borderRadius: 8, border: "none", background: "transparent", color: "#F87171", fontSize: 12, cursor: "pointer" }}>
              {deletingSim ? "Excluindo..." : "Excluir simulação"}
            </button>
          </div>
        </div>
      </div>
    ) : null}
    </>
  );
}

function SimDrawer({ open, unidade, onClose, onCriarProposta }: { open: boolean; unidade: { quadra: string | null; lote: string | null; valor: number | null } | null; onClose: () => void; onCriarProposta: () => void }) {
  const [entPct, setEntPct] = useState(20);
  const [parc, setParc] = useState(36);
  const isMobile = useIsMobile();
  const valor = unidade?.valor ?? 0;
  const entrada = Math.round(valor * entPct / 100);
  const saldo = valor - entrada;
  const parcela = parc > 0 ? Math.round(saldo / parc) : 0;
  const fm = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

  return createPortal(
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 9998, opacity: open ? 1 : 0, pointerEvents: open ? "all" : "none", transition: "opacity 0.25s" }} />
      <div style={{ position: "fixed", right: 0, top: 0, bottom: 0, width: isMobile ? "100%" : 480, maxWidth: "100vw", background: "var(--surface-raised)", borderLeft: !isMobile ? "1px solid var(--border-default)" : "none", zIndex: 9999, transform: open ? "translateX(0)" : "translateX(100%)", transition: "transform 0.3s cubic-bezier(0.32,0.72,0,1)", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: open ? "-8px 0 32px rgba(0,0,0,0.4)" : "none" }}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border-default)", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-secondary)" }}>Simulador Rápido</div>
              <div style={{ fontSize: 12, color: "var(--text-disabled)", marginTop: 3, fontFamily: "var(--font-mono)" }}>{unidade ? `Q${unidade.quadra} · L${unidade.lote}` : "—"}</div>
            </div>
            <button type="button" onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-disabled)", cursor: "pointer", fontSize: 22, padding: "0 4px", lineHeight: 1 }}>x</button>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
          <div style={{ background: "var(--surface-base)", borderRadius: 10, padding: "14px 16px", marginBottom: 20, border: "1px solid var(--border-default)" }}>
            <div style={{ fontSize: 10, color: "var(--text-disabled)", fontFamily: "var(--font-mono)", letterSpacing: "0.08em", marginBottom: 4 }}>UNIDADE</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-secondary)" }}>Quadra {unidade?.quadra} · Lote {unidade?.lote}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{fm(valor)}</div>
          </div>
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}><span style={{ fontSize: 13, color: "var(--text-muted)" }}>Entrada</span><span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>{entPct}% — {fm(entrada)}</span></div>
            <input type="range" min={10} max={80} value={entPct} onChange={(e) => setEntPct(Number(e.target.value))} style={{ width: "100%", accentColor: "#4ADE80" }} />
          </div>
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}><span style={{ fontSize: 13, color: "var(--text-muted)" }}>Parcelas</span><span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>{parc}x</span></div>
            <input type="range" min={12} max={120} value={parc} onChange={(e) => setParc(Number(e.target.value))} style={{ width: "100%", accentColor: "#4ADE80" }} />
          </div>
          <div style={{ background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)", borderRadius: 12, padding: "18px 20px", marginBottom: 20 }}>
            <div style={{ fontSize: 10, color: "#4ADE80", fontFamily: "var(--font-mono)", letterSpacing: "0.1em", marginBottom: 6 }}>PARCELA MENSAL</div>
            <div style={{ fontSize: 38, fontWeight: 800, color: "#4ADE80", fontFamily: "var(--font-mono)", lineHeight: 1 }}>{fm(parcela)}</div>
            <div style={{ fontSize: 12, color: "rgba(74,222,128,0.6)", marginTop: 6 }}>{parc}x · sem banco</div>
          </div>
          <div style={{ background: "var(--surface-base)", borderRadius: 10, padding: "14px 16px", border: "1px solid var(--border-default)" }}>
            {([["Valor negociado", fm(valor)], ["Entrada", fm(entrada)], ["Saldo a financiar", fm(saldo)]] as [string, string][]).map(([l, v]) => (
              <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #1C1B18" }}><span style={{ fontSize: 12, color: "var(--text-muted)" }}>{l}</span><span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>{v}</span></div>
            ))}
          </div>
        </div>
        <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border-default)", display: "flex", gap: 10, flexShrink: 0 }}>
          <button type="button" onClick={onClose} style={{ flex: 1, padding: "11px", borderRadius: 8, border: "1px solid var(--border-strong)", background: "transparent", color: "var(--text-muted)", fontSize: 13, cursor: "pointer" }}>Fechar</button>
          <button type="button" onClick={onCriarProposta} style={{ flex: 2, padding: "11px", borderRadius: 8, border: "none", background: "var(--interactive-primary)", color: "var(--interactive-on-primary)", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Criar proposta</button>
        </div>
      </div>
    </>,
    document.body
  );
}

function HoverBtn({ label, cor, onClick }: { label: string; cor: string; onClick: () => void }) {
  return <button type="button" onClick={(e) => { e.stopPropagation(); onClick(); }} style={{ fontSize: 11, padding: "4px 9px", borderRadius: 6, border: `1px solid ${cor}40`, background: `${cor}15`, color: cor, cursor: "pointer", whiteSpace: "nowrap" }}>{label}</button>;
}
