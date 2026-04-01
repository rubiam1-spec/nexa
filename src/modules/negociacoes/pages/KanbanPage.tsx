import { useEffect, useMemo, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
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
  { id: "negociacao", label: "Negociação", cor: "#60A5FA", bg: "rgba(96,165,250,0.1)", badge: "Em andamento" },
  { id: "proposta", label: "Proposta", cor: "#FBBF24", bg: "rgba(251,191,36,0.1)", badge: "Aguardando" },
  { id: "reserva", label: "Reserva", cor: "#A78BFA", bg: "rgba(167,139,250,0.1)", badge: "Reservado" },
  { id: "venda", label: "Venda", cor: "#4ADE80", bg: "rgba(74,222,128,0.1)", badge: "Vendido" },
  { id: "perdido", label: "Perdido", cor: "#F87171", bg: "rgba(248,113,113,0.1)", badge: "Perdido" },
];

function fmtV(v: number) { return v >= 1e6 ? `R$ ${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `R$ ${(v / 1e3).toFixed(0)}k` : `R$ ${v}`; }
function fmtBRL(v: number | null) { return v ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }) : "—"; }
function dRel(d: string) { return timeAgo(d); }

function getEstagio(c: KanbanCard): EstagioId {
  if (c.isSimulacao) return "simulacao";
  const s = (c.status || "").toUpperCase();
  const us = (c.unitStatus || "").toLowerCase();
  if (s === "LOST" || s === "CANCELLED") return "perdido";
  if (s === "WON" || s === "SOLD" || us === "sold" || us === "vendido") return "venda";
  if (c.reservaStatus && c.reservaStatus !== "expirada" && c.reservaStatus !== "cancelada" && c.reservaStatus !== "convertida") return "reserva";
  if (us === "reserved" || us === "reservado") return "reserva";
  if (c.reservaRequestId && c.reservaRequestStatus === "pending") return "reserva";
  if (c.propostaId) return "proposta";
  if (s === "IN_PROGRESS" || s === "OPEN") return "negociacao";
  return "simulacao";
}

function diasSemAtividade(c: KanbanCard) { return c.updatedAt ? Math.floor((Date.now() - new Date(c.updatedAt).getTime()) / 864e5) : 0; }

export default function KanbanPage() {
  const navigate = useNavigate();
  const screen = useScreen();
  const isMobile = screen.isMobile;
  const { account, brokerId, isBroker, isConsultant, ownerProfileId } = useAccount();
  const { development } = useDevelopment();
  const { authenticatedProfile } = useAuth();
  const aId = account?.accountId ?? null, dId = development?.developmentId ?? null;
  const [refreshKey, setRefreshKey] = useState(0);
  const nome = authenticatedProfile?.fullName ?? "você";
  const perms = getPermissions(account?.role ?? null);
  const { toasts, celebrate, celebrateSale } = useCelebration();
  const onActionSuccess = useCallback(() => setRefreshKey((k) => k + 1), []);
  const { criarProposta, solicitarReserva, aprovarReserva, registrarVenda, converterSimulacao, cancelarNegociacao } = usePipelineActions(aId, dId, onActionSuccess);
  const [convertingSimId, setConvertingSimId] = useState<string | null>(null);

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
    if (isBroker) return { brokerId };
    if (isConsultant) return { ownerProfileId };
    if (memberFilter !== "all") {
      const [type, id] = memberFilter.split(":");
      if (type === "broker") return { brokerId: id };
      if (type === "consultant") return { ownerProfileId: id };
    }
    return undefined;
  }, [isBroker, brokerId, isConsultant, ownerProfileId, memberFilter]);

  const { cards, loading, error } = useKanbanData(aId, dId, refreshKey, effectiveFilters);

  const [busca, setBusca] = useState("");
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [modalProposta, setModalProposta] = useState<KanbanCard | null>(null);
  const [modalReserva, setModalReserva] = useState<KanbanCard | null>(null);
  const [modalAprovar, setModalAprovar] = useState<KanbanCard | null>(null);
  const [modalVenda, setModalVenda] = useState<KanbanCard | null>(null);

  const [cancelTarget, setCancelTarget] = useState<KanbanCard | null>(null);
  const [cardMenuOpen, setCardMenuOpen] = useState<string | null>(null);

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

  // Greeting
  const saudacao = useMemo(() => { const h = new Date().getHours(); const f = nome.split(" ")[0]; return h < 12 ? `Bom dia, ${f}.` : h < 18 ? `Boa tarde, ${f}.` : `Boa noite, ${f}.`; }, [nome]);

  // Stale negotiations for "hoje" section
  const acoesHoje = useMemo(() => {
    return cards.filter((c) => {
      const dias = diasSemAtividade(c);
      const est = getEstagio(c);
      return est !== "venda" && dias >= 7;
    }).slice(0, 5);
  }, [cards]);

  // Filter + group
  const filtered = useMemo(() => {
    let cs = cards;
    if (busca) { const t = busca.toLowerCase(); cs = cs.filter((c) => c.clienteNome?.toLowerCase().includes(t) || c.quadra?.toLowerCase().includes(t) || c.lote?.toLowerCase().includes(t) || c.corretorNome?.toLowerCase().includes(t) || c.id.includes(t)); }
    return cs;
  }, [cards, busca]);

  const grupos = useMemo(() => {
    const g: Record<EstagioId, KanbanCard[]> = { simulacao: [], negociacao: [], proposta: [], reserva: [], venda: [], perdido: [] };
    filtered.forEach((c) => g[getEstagio(c)].push(c));
    return g;
  }, [filtered]);

  const vgvByStage = useMemo(() => { const r: Record<string, number> = {}; Object.entries(grupos).forEach(([k, cs]) => { r[k] = cs.reduce((s, c) => s + (c.valor ?? 0), 0); }); return r; }, [grupos]);
  const totalVGV = filtered.reduce((s, c) => s + (c.valor ?? 0), 0);

  if (loading) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}><span style={{ color: "#4ADE80", fontFamily: "var(--font-mono)", fontSize: 13 }}>Carregando pipeline...</span></div>;
  if (error) return <div style={{ padding: 24 }}><div style={{ color: "#F87171", fontSize: 14 }}>Erro: {error}</div></div>;

  return (
    <>
    <SimDrawer open={drawerOpen} unidade={drawerUnidade} onClose={() => setDrawerOpen(false)} onCriarProposta={() => { setDrawerOpen(false); if (drawerNegId) navigate(`/negociacoes/${drawerNegId}`); }} />
    <div>
      {/* Ações hoje */}
      {acoesHoje.length > 0 ? (
        <div style={{ background: "var(--surface-raised)", borderRadius: 14, padding: "16px 20px", marginBottom: 22, border: "1px solid var(--border-default)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-secondary)" }}>{saudacao}</div>
            <div style={{ fontSize: 11, color: "var(--text-disabled)", fontFamily: "var(--font-mono)" }}>{acoesHoje.length} pendência{acoesHoje.length !== 1 ? "s" : ""}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {acoesHoje.map((c) => (
              <div key={c.id} onClick={() => navigate(`/negociacoes/${c.id}`)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "var(--surface-base)", borderRadius: 10, border: "1px solid var(--border-default)", cursor: "pointer" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#FBBF24", flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{c.clienteNome || `Q${c.quadra}·L${c.lote}`} — {diasSemAtividade(c)} dias sem atividade</div>
                  <div style={{ fontSize: 11, color: "var(--text-disabled)", marginTop: 2 }}>Unidade Q{c.quadra}·L{c.lote} · {fmtBRL(c.valor)}</div>
                </div>
                <button type="button" onClick={(e) => { e.stopPropagation(); navigate(`/negociacoes/${c.id}`); }} style={{ fontSize: 11, fontWeight: 600, padding: "5px 12px", borderRadius: 7, border: "1px solid rgba(251,191,36,0.3)", background: "rgba(251,191,36,0.1)", color: "#FBBF24", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>Retomar</button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-secondary)", margin: 0 }}>Pipeline Comercial</h1>
          <p style={{ fontSize: 12, color: "var(--text-disabled)", margin: "4px 0 0", fontFamily: "var(--font-mono)" }}>{development?.developmentName} · {filtered.length} negociações</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {perms.canViewFullDashboard && memberOptions.length > 1 ? (
            <select value={memberFilter} onChange={(e) => setMemberFilter(e.target.value)} style={{ background: "var(--surface-raised)", border: "1px solid var(--border-strong)", borderRadius: 8, padding: "8px 12px", color: "var(--text-secondary)", fontSize: 13, outline: "none" }}>
              {memberOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          ) : null}
          <input placeholder="Buscar cliente, unidade..." value={busca} onChange={(e) => setBusca(e.target.value)} style={{ background: "var(--surface-raised)", border: "1px solid var(--border-strong)", borderRadius: 8, padding: "8px 14px", color: "var(--text-secondary)", fontSize: 13, outline: "none", width: isMobile ? "100%" : 200 }} />
          <button type="button" onClick={() => navigate("/negociacoes")} style={{ background: "transparent", border: "1px solid var(--border-strong)", borderRadius: 8, padding: "8px 14px", color: "var(--text-muted)", fontSize: 13, cursor: "pointer" }}>Ver Lista</button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${screen.columns}, minmax(0, 1fr))`, gap: 10, marginBottom: 16 }}>
        {[{ l: "Negociações", v: (grupos.negociacao.length + grupos.proposta.length + grupos.reserva.length + grupos.venda.length).toString() }, { l: "Simulações", v: grupos.simulacao.length.toString() }, { l: "Reservas", v: grupos.reserva.length.toString() }, { l: "VGV Pipeline", v: fmtV(totalVGV) }].map((s) => (
          <div key={s.l} style={{ background: "var(--surface-raised)", border: "1px solid var(--border-default)", borderRadius: 10, padding: "12px 16px" }}>
            <div style={{ fontSize: 10, color: "var(--text-disabled)", fontFamily: "var(--font-mono)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 5 }}>{s.l}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text-secondary)" }}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* Board */}
      <div style={{ overflowX: "auto", paddingBottom: 16, WebkitOverflowScrolling: "touch" }}>
        <div style={{ display: "flex", gap: 0, alignItems: "stretch", minWidth: screen.width < 1200 ? Math.max(screen.width * 1.5, 860) : 860 }}>
          {EST.map((est, idx) => {
            const cs = grupos[est.id];
            const vgv = vgvByStage[est.id] ?? 0;
            return (
              <div key={est.id} style={{ flex: [2.2, 2, 1.8, 1.6, 1.4, 1.2][idx], minWidth: 160, display: "flex", flexDirection: "column", borderRight: idx < 5 ? "1px solid #2A2822" : "none" }}>
                <div style={{ padding: "10px 12px 0", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: est.cor }}>{est.label}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {vgv > 0 ? <span style={{ fontSize: 10, color: "var(--text-disabled)", fontFamily: "var(--font-mono)" }}>{fmtV(vgv)}</span> : null}
                    <span style={{ fontSize: 11, fontWeight: 600, color: est.cor, background: est.bg, borderRadius: 20, padding: "2px 8px" }}>{cs.length}</span>
                  </div>
                </div>
                <div style={{ height: 3, margin: "5px 12px 8px", borderRadius: 2, background: est.cor, opacity: 0.7 }} />
                <div style={{ padding: "0 10px 10px", flex: 1 }}>
                  {cs.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "20px 10px", border: "1px dashed var(--border-default)", borderRadius: 10, color: "#5C5647", fontSize: 12 }}>Nenhuma</div>
                  ) : cs.map((c) => {
                    const dias = diasSemAtividade(c);
                    const isUrgent = est.id === "reserva";
                    const isHovered = hoveredId === c.id;
                    return (
                      <div key={c.id}
                        onClick={() => c.isSimulacao ? setSimDetail(c) : navigate(`/negociacoes/${c.id}`)}
                        onMouseEnter={() => setHoveredId(c.id)}
                        onMouseLeave={() => setHoveredId(null)}
                        style={{ background: isHovered ? "var(--surface-hover)" : "var(--surface-raised)", border: isUrgent ? "1px solid rgba(248,113,113,0.4)" : "1px solid var(--border-default)", borderLeft: `2px solid ${est.cor}`, borderRadius: "0 10px 10px 0", padding: "12px 13px 10px", marginBottom: 8, cursor: "pointer", animation: isUrgent ? "cardpulse 2s infinite" : "none", transition: "background 0.15s", opacity: est.id === "perdido" ? 0.6 : 1 }}>
                        {/* Cliente + badge + score */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6, marginBottom: 6 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", lineHeight: 1.3, flex: 1 }}>
                            {c.clienteNome || "Cliente não informado"}
                            {dias >= 7 ? <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 4, background: "rgba(248,113,113,0.15)", color: "#F87171", marginLeft: 5 }}>{dias}d</span> : null}
                          </span>
                          <div style={{ display: "flex", gap: 4, alignItems: "center", flexShrink: 0 }}>
                            {c.score != null && !c.isSimulacao && est.id !== "perdido" && est.id !== "venda" ? (
                              <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 6, fontFamily: "var(--font-mono)", background: c.score > 70 ? "rgba(74,222,128,0.15)" : c.score >= 40 ? "rgba(251,191,36,0.15)" : "rgba(248,113,113,0.15)", color: c.score > 70 ? "#4ADE80" : c.score >= 40 ? "#FBBF24" : "#F87171" }}>{c.score}</span>
                            ) : null}
                            <span style={{ fontSize: 10, fontWeight: 600, color: est.cor, background: est.bg, borderRadius: 20, padding: "2px 7px", whiteSpace: "nowrap" }}>{est.badge}</span>
                          </div>
                        </div>
                        {/* Unidade */}
                        {c.quadra ? <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginBottom: 6 }}>Q{c.quadra} · L{c.lote}{c.unitId && myQueueMap[c.unitId] ? <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: "#60A5FA20", color: "#60A5FA", fontWeight: 600, marginLeft: 6 }}>Fila #{myQueueMap[c.unitId]}</span> : null}</div> : null}
                        {/* Valor */}
                        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 6 }}>{fmtBRL(c.valor)}</div>
                        {/* Footer */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 7, borderTop: "1px solid var(--border-default)" }}>
                          <span style={{ fontSize: 11, color: "var(--text-disabled)" }}>{c.corretorNome || "—"}</span>
                          {(() => {
                            if (c.isSimulacao || est.id === "perdido" || est.id === "venda") return <span style={{ fontSize: 10, color: "#5C5647", fontFamily: "var(--font-mono)" }}>{dRel(c.updatedAt)}</span>;
                            const ref = c.stageChangedAt || c.updatedAt;
                            const daysInStage = ref ? Math.floor((Date.now() - new Date(ref).getTime()) / 864e5) : 0;
                            const threshold = 7; // default threshold days
                            const timeColor = daysInStage < threshold * 0.5 ? "#4ADE80" : daysInStage < threshold ? "#FBBF24" : "#F87171";
                            const timeIcon = daysInStage < threshold * 0.5 ? "✓" : daysInStage < threshold ? "⚠" : "●";
                            const timeLabel = daysInStage === 0 ? "hoje" : daysInStage === 1 ? "há 1 dia" : `há ${daysInStage}d`;
                            return <span style={{ fontSize: 10, color: timeColor, fontFamily: "var(--font-mono)", fontWeight: 600 }}>{timeLabel} {timeIcon}</span>;
                          })()}
                        </div>
                        {/* Lost reason */}
                        {est.id === "perdido" && c.lostReason && (
                          <div style={{ fontSize: 11, color: "#F87171", marginTop: 6, paddingTop: 6, borderTop: "1px solid var(--border-default)" }}>Motivo: {c.lostReason}</div>
                        )}
                        {/* Hover actions — primary action + ⋮ menu */}
                        {(isHovered || isMobile) && est.id !== "perdido" ? (
                          <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--border-default)" }} onClick={(e) => e.stopPropagation()}>
                            {/* Primary action */}
                            {est.id === "simulacao" && c.isSimulacao ? <HoverBtn label={convertingSimId === c.id ? "Criando..." : "Iniciar negociação"} cor="#4ADE80" onClick={() => { if (convertingSimId) return; setConvertingSimId(c.id); void converterSimulacao({ simulationId: c.id, unitId: c.unitId!, clientId: c.clienteId, brokerId: c.corretorId }).then(() => celebrate("Negociação iniciada!")).catch((e: unknown) => { alert(e instanceof Error ? e.message : "Erro"); }).finally(() => setConvertingSimId(null)); }} /> : null}
                            {est.id === "negociacao" ? <HoverBtn label="Criar proposta" cor="#FBBF24" onClick={() => setModalProposta(c)} /> : null}
                            {est.id === "proposta" ? <HoverBtn label="Solicitar reserva" cor="#A78BFA" onClick={() => setModalReserva(c)} /> : null}
                            {est.id === "reserva" ? <>{perms.canCompleteSale ? <HoverBtn label="Registrar venda" cor="#4ADE80" onClick={() => setModalVenda(c)} /> : null}{perms.canApproveReservation && c.reservaRequestId && c.reservaRequestStatus === "pending" ? <HoverBtn label="Aprovar" cor="#A78BFA" onClick={() => setModalAprovar(c)} /> : null}</> : null}
                            {/* ⋮ menu */}
                            <div style={{ position: "relative", marginLeft: "auto" }}>
                              <button type="button" onClick={(e) => { e.stopPropagation(); setCardMenuOpen(cardMenuOpen === c.id ? null : c.id); }} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 18, cursor: "pointer", padding: "2px 8px", borderRadius: 4, lineHeight: 1 }}>⋮</button>
                              {cardMenuOpen === c.id && (
                                <>
                                  <div style={{ position: "fixed", inset: 0, zIndex: 49 }} onClick={() => setCardMenuOpen(null)} />
                                  <div style={{ position: "absolute", right: 0, top: 28, background: "var(--surface-raised)", border: "1px solid var(--border-default)", borderRadius: 8, padding: 4, minWidth: 180, boxShadow: "0 8px 24px rgba(0,0,0,0.4)", zIndex: 50 }}>
                                    <button type="button" onClick={() => { setCardMenuOpen(null); navigate(`/negociacoes/${c.id}`); }} onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-overlay)"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }} style={{ display: "block", width: "100%", textAlign: "left", background: "transparent", border: "none", color: "var(--text-secondary)", fontSize: 13, padding: "8px 14px", cursor: "pointer", borderRadius: 6 }}>Detalhes</button>
                                    {est.id !== "venda" ? <button type="button" onClick={() => { setCardMenuOpen(null); abrirSimulador(c); }} onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-overlay)"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }} style={{ display: "block", width: "100%", textAlign: "left", background: "transparent", border: "none", color: "var(--text-secondary)", fontSize: 13, padding: "8px 14px", cursor: "pointer", borderRadius: 6 }}>Simular</button> : null}
                                    {est.id !== "venda" && est.id !== "simulacao" && perms.canCancelSale ? (
                                      <>
                                        <div style={{ height: 1, background: "var(--surface-overlay)", margin: "4px 8px" }} />
                                        <button type="button" onClick={() => { setCardMenuOpen(null); setCancelTarget(c); }} onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-overlay)"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }} style={{ display: "block", width: "100%", textAlign: "left", background: "transparent", border: "none", color: "#F87171", fontSize: 13, padding: "8px 14px", cursor: "pointer", borderRadius: 6 }}>Cancelar negociação</button>
                                      </>
                                    ) : null}
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
    <CelebrationToasts toasts={toasts} />
    <CriarPropostaModal open={!!modalProposta} card={modalProposta} onClose={() => setModalProposta(null)} onConfirm={async ({ entradaPct, parcelas }) => { if (!modalProposta) return; const v = modalProposta.valor ?? 0; const ev = Math.round(v * entradaPct / 100); const pv = parcelas > 0 ? Math.round((v - ev) / parcelas) : 0; await criarProposta({ negotiationId: modalProposta.id, unitId: modalProposta.unitId!, clientId: modalProposta.clienteId!, brokerId: modalProposta.corretorId, amount: v, entradaPercentual: entradaPct, entradaValor: ev, parcelasQuantidade: parcelas, parcelasValor: pv }); celebrate("Proposta criada", `${modalProposta.clienteNome || "Cliente"} — Q${modalProposta.quadra}·L${modalProposta.lote}`); }} />
    <SolicitarReservaModal open={!!modalReserva} card={modalReserva} onClose={() => setModalReserva(null)} onConfirm={async () => { if (!modalReserva) return; await solicitarReserva({ negotiationId: modalReserva.id, unitId: modalReserva.unitId! }); celebrate("Reserva solicitada", `Aguardando aprovação — Q${modalReserva.quadra}·L${modalReserva.lote}`); }} />
    <AprovarReservaModal open={!!modalAprovar} card={modalAprovar} onClose={() => setModalAprovar(null)} onConfirm={async () => { if (!modalAprovar) return; await aprovarReserva(modalAprovar.id, modalAprovar.unitId!, modalAprovar.reservaRequestId ?? undefined); celebrate("Reserva aprovada", `Unidade Q${modalAprovar.quadra}·L${modalAprovar.lote} reservada`); }} />
    <RegistrarVendaModal open={!!modalVenda} card={modalVenda} onClose={() => setModalVenda(null)} onConfirm={async () => { if (!modalVenda) return; await registrarVenda({ negotiationId: modalVenda.id, unitId: modalVenda.unitId!, amount: modalVenda.valor ?? 0 }); celebrateSale("Venda registrada!", `${modalVenda.clienteNome || "Cliente"} — Q${modalVenda.quadra}·L${modalVenda.lote}`); }} />

    {/* Cancel negotiation modal */}
    <CancelNegotiationModal
      isOpen={!!cancelTarget}
      onClose={() => setCancelTarget(null)}
      negotiation={{ id: cancelTarget?.id ?? "", clientName: cancelTarget?.clienteNome || "Cliente", unitLabel: `Q${cancelTarget?.quadra || "?"} · L${cancelTarget?.lote || "?"}`, value: cancelTarget?.valor ?? 0, brokerName: cancelTarget?.corretorNome || "—" }}
      hasActiveReservation={!!cancelTarget?.reservaStatus && cancelTarget.reservaStatus !== "cancelada" && cancelTarget.reservaStatus !== "expirada" && cancelTarget.reservaStatus !== "convertida"}
      hasActiveProposals={!!cancelTarget?.propostaStatus && !["REJECTED", "EXPIRED", "ACCEPTED"].includes(cancelTarget.propostaStatus)}
      onConfirm={async (reason) => { if (!cancelTarget) return; await cancelarNegociacao({ negotiationId: cancelTarget.id, unitId: cancelTarget.unitId!, reason }); celebrate("Negociação cancelada", `${cancelTarget.clienteNome || "Cliente"} — Q${cancelTarget.quadra}·L${cancelTarget.lote}`); setCancelTarget(null); }}
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
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-bone)", fontFamily: "var(--font-mono)" }}>{fmtBRL(simDetail.valor)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--color-stone)" }}>
              <span style={{ fontSize: 12, color: "var(--color-fog)" }}>Corretor</span>
              <span style={{ fontSize: 13, color: "var(--color-bone)" }}>{simDetail.corretorNome || "—"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0" }}>
              <span style={{ fontSize: 12, color: "var(--color-fog)" }}>Criada</span>
              <span style={{ fontSize: 12, color: "var(--color-fog)", fontFamily: "var(--font-mono)" }}>{timeAgo(simDetail.createdAt)}</span>
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
  const valor = unidade?.valor ?? 0;
  const entrada = Math.round(valor * entPct / 100);
  const saldo = valor - entrada;
  const parcela = parc > 0 ? Math.round(saldo / parc) : 0;
  const fm = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

  return createPortal(
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 9998, opacity: open ? 1 : 0, pointerEvents: open ? "all" : "none", transition: "opacity 0.25s" }} />
      <div style={{ position: "fixed", right: 0, top: 0, bottom: 0, width: window.innerWidth < 768 ? "100%" : 480, maxWidth: "100vw", background: "var(--surface-raised)", borderLeft: window.innerWidth >= 768 ? "1px solid var(--border-default)" : "none", zIndex: 9999, transform: open ? "translateX(0)" : "translateX(100%)", transition: "transform 0.3s cubic-bezier(0.32,0.72,0,1)", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: open ? "-8px 0 32px rgba(0,0,0,0.4)" : "none" }}>
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
