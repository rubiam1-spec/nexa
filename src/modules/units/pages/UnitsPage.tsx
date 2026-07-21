import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { EmptyState } from "../../../shared/components/EmptyState";
import { useAccount } from "../../../app/contexts/AccountContext";
import { useDevelopment } from "../../../app/contexts/DevelopmentContext";
import { useAuth } from "../../../app/contexts/AuthContext";
import { UnidadeStatus } from "../../../domain/unidade/UnidadeStatus";
import UnitFichaModal from "../components/UnitFichaModal";
import { formatDateBRT } from "../../../shared/utils/dateUtils";
import { useNegotiations } from "../../negociacoes/hooks/useNegotiations";
import { useUnits } from "../hooks/useUnits";
import { useUnitQueue, fetchQueueSummary, type QueueSummary } from "../hooks/useUnitQueue";
import { useCommercialSettings } from "../../configuracoes/hooks/useCommercialSettings";
import { useScreen } from "../../../shared/hooks/useIsMobile";
import { useMapaPins } from "../hooks/useMapaPins";
import MapaInterativo from "../components/MapaInterativo";
import QueueEntryModal from "../../../shared/components/QueueEntryModal";
import { NexaModal } from "../../../shared/ui/NexaModal";
import { getPermissions } from "../../../shared/utils/permissoes";
import ChangeUnitStatusModal, { type StatusTarget } from "../components/ChangeUnitStatusModal";
import type { Unidade } from "../../../domain/unidade/Unidade";

// ── v7 constants ──
const CARD_BG = "linear-gradient(168deg, rgba(34,33,28,0.5) 0%, rgba(18,17,14,0.15) 100%)";
const CARD_BORDER = "1px solid rgba(61,58,48,0.1)";
const MONO = "var(--font-mono)";

const STATUS_CFG: Record<string, { bg: string; border: string; color: string; label: string; hoverBg: string; hoverBorder: string }> = {
  [UnidadeStatus.DISPONIVEL]: { bg: "linear-gradient(145deg, rgba(74,222,128,0.18), rgba(22,21,15,0.95))", border: "rgba(74,222,128,0.25)", color: "#4ADE80", label: "Disponível", hoverBg: "linear-gradient(145deg, rgba(74,222,128,0.28), rgba(22,21,15,0.9))", hoverBorder: "rgba(74,222,128,0.5)" },
  [UnidadeStatus.EM_NEGOCIACAO]: { bg: "linear-gradient(145deg, rgba(96,165,250,0.16), rgba(22,21,15,0.95))", border: "rgba(96,165,250,0.25)", color: "#60A5FA", label: "Em negociação", hoverBg: "linear-gradient(145deg, rgba(96,165,250,0.26), rgba(22,21,15,0.9))", hoverBorder: "rgba(96,165,250,0.5)" },
  [UnidadeStatus.RESERVADO]: { bg: "linear-gradient(145deg, rgba(217,119,6,0.18), rgba(22,21,15,0.95))", border: "rgba(217,119,6,0.25)", color: "#D97706", label: "Reservada", hoverBg: "linear-gradient(145deg, rgba(217,119,6,0.28), rgba(22,21,15,0.9))", hoverBorder: "rgba(217,119,6,0.5)" },
  [UnidadeStatus.VENDIDO]: { bg: "linear-gradient(145deg, rgba(248,113,113,0.15), rgba(22,21,15,0.95))", border: "rgba(248,113,113,0.22)", color: "#F87171", label: "Vendida", hoverBg: "linear-gradient(145deg, rgba(248,113,113,0.25), rgba(22,21,15,0.9))", hoverBorder: "rgba(248,113,113,0.45)" },
};
const FALLBACK = { bg: "linear-gradient(145deg, rgba(92,86,71,0.1), rgba(22,21,15,0.95))", border: "rgba(92,86,71,0.2)", color: "#5C5647", label: "—", hoverBg: "linear-gradient(145deg, rgba(92,86,71,0.2), rgba(22,21,15,0.9))", hoverBorder: "rgba(92,86,71,0.35)" };

function fmtValor(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return v.toString();
}

function KpiBar({ availableCount, soldCount, reservedCount, totalUnits, soldPct, reservedPct }: { availableCount: number; soldCount: number; reservedCount: number; totalUnits: number; soldPct: number; reservedPct: number }) {
  const availPct = totalUnits > 0 ? Math.round((availableCount / totalUnits) * 100) : 0;
  const kpis = [
    { key: "available", label: "DISPONIVEIS", value: availableCount, color: "#4ADE80", pct: availPct, icon: "D" },
    { key: "sold", label: "VENDIDAS", value: soldCount, color: "#F87171", pct: soldPct, icon: "V" },
    { key: "reserved", label: "RESERVADAS", value: reservedCount, color: "#D97706", pct: reservedPct, icon: "R" },
  ];
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 12 }}>
        {kpis.map((item) => (
          <div key={item.key} style={{
            padding: "14px 16px", borderRadius: 10,
            background: "linear-gradient(145deg, #1F1E1A, #16150F)",
            border: "1px solid rgba(42,40,34,0.5)",
            position: "relative", overflow: "hidden",
          }}>
            <div aria-hidden style={{
              position: "absolute", top: -15, right: -15, width: 60, height: 60,
              borderRadius: "50%", background: item.color + "15", filter: "blur(15px)",
              pointerEvents: "none",
            }} />
            <div style={{ position: "relative", zIndex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontFamily: MONO, fontSize: 9, color: "#706B5F", letterSpacing: "0.1em", textTransform: "uppercase" }}>{item.label}</span>
                <span style={{
                  width: 22, height: 22, borderRadius: 5, background: item.color + "18",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: MONO, fontSize: 10, fontWeight: 700, color: item.color,
                }}>{item.icon}</span>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 6 }}>
                <span style={{ fontFamily: MONO, fontSize: 28, fontWeight: 700, color: "#FAF9F6", lineHeight: 1 }}>{item.value}</span>
                <span style={{ fontFamily: MONO, fontSize: 12, color: item.color, fontWeight: 600 }}>{item.pct}%</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      {/* Stock bar — 3 segments */}
      <div style={{ height: 6, borderRadius: 3, overflow: "hidden", display: "flex", background: "rgba(42,40,34,0.3)", marginBottom: 20 }}>
        {availPct > 0 && <div style={{ width: `${availPct}%`, background: "linear-gradient(90deg, #22C55E, #4ADE80)", transition: "width 0.5s" }} />}
        {reservedPct > 0 && <div style={{ width: `${reservedPct}%`, background: "#D97706", transition: "width 0.5s" }} />}
        {soldPct > 0 && <div style={{ width: `${soldPct}%`, background: "linear-gradient(90deg, #EF4444, #F87171)", transition: "width 0.5s" }} />}
      </div>
    </>
  );
}

export default function UnitsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const screen = useScreen();
  const isMobile = screen.isMobile;
  const { account, isUsingMock: mockA } = useAccount();
  const { development, isUsingMock: mockD } = useDevelopment();
  const useMock = mockA || mockD;
  const accountId = account?.accountId ?? null;
  const developmentId = development?.developmentId ?? null;
  const role = account?.role ?? null;

  const unitsState = useUnits(accountId, developmentId, useMock);
  const { units, isLoading, refetch: refetchUnits } = unitsState;
  const canManageStatus = getPermissions(role).canManageUnitStatus;
  const negState = useNegotiations(accountId, developmentId, useMock, role, unitsState);
  const { developmentSettings: ds } = useCommercialSettings(accountId, developmentId, useMock, role);

  const { authenticatedProfile } = useAuth();
  const userId = authenticatedProfile?.id ?? null;
  const isBroker = account?.role === "broker";
  const lblGrupo = ds?.labelAgrupamento ?? "Quadra";
  const lblUnidade = ds?.labelUnidade ?? "Lote";
  const { pins } = useMapaPins(developmentId);
  const temMapaInterativo = !!ds?.mapaUrl;
  const queueEnabled = ds?.queueEnabled === true;

  // Queue summary for badges
  const [queueSummary, setQueueSummary] = useState<Record<string, QueueSummary>>({});
  const refetchSummary = useCallback(() => { if (accountId && queueEnabled) fetchQueueSummary(accountId, userId).then(setQueueSummary); }, [accountId, queueEnabled, userId]);
  useEffect(() => { refetchSummary(); }, [refetchSummary]);

  const urlView = searchParams.get("view");
  const [vis, setVis] = useState<"mapa" | "interativo" | "tabela">(urlView === "mapa" && temMapaInterativo ? "interativo" : "mapa");
  const [grupoFiltro, setGrupoFiltro] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Seleção múltipla (modo massa) + alvo do modal de alteração de status.
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [statusTargets, setStatusTargets] = useState<StatusTarget[] | null>(null);
  const [fichaRefresh, setFichaRefresh] = useState(0); // força reload da ficha após alterar status
  const [showQueueModal, setShowQueueModal] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [leavingQueue, setLeavingQueue] = useState(false);
  const [queueToast, setQueueToast] = useState<string | null>(null);

  // Pre-select from URL
  const urlUnitId = searchParams.get("unitId");
  useEffect(() => { if (urlUnitId && units.length > 0) setSelectedId(urlUnitId); }, [urlUnitId, units.length]);
  useEffect(() => { if (urlView === "mapa" && temMapaInterativo) setVis("interativo"); }, [urlView, temMapaInterativo]);

  const grupos = useMemo(() => {
    const set = new Set(units.map((u) => u.quadra));
    return Array.from(set).sort((a, b) => {
      const na = parseInt(a), nb = parseInt(b);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return a.localeCompare(b);
    });
  }, [units]);

  const filtered = grupoFiltro ? units.filter((u) => u.quadra === grupoFiltro) : units;

  // Seleção múltipla (fonte: `filtered`; "selecionar visíveis" = filtrados).
  const toTarget = (u: Unidade): StatusTarget => ({ id: u.id, quadra: u.quadra, lote: u.lote, status: u.status });
  const toggleSelect = (id: string) => setSelectedIds((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const clearSelection = () => setSelectedIds(new Set());
  const allVisibleSelected = filtered.length > 0 && filtered.every((u) => selectedIds.has(u.id));
  const someVisibleSelected = filtered.some((u) => selectedIds.has(u.id));
  const toggleAllVisible = () => setSelectedIds(allVisibleSelected ? new Set() : new Set(filtered.map((u) => u.id)));
  const exitSelectMode = () => { setSelectMode(false); clearSelection(); };
  const byGrupo = useMemo(() => {
    const m = new Map<string, Unidade[]>();
    for (const u of filtered) { const a = m.get(u.quadra) ?? []; a.push(u); m.set(u.quadra, a); }
    return m;
  }, [filtered]);

  const sel = units.find((u) => u.id === selectedId) ?? null;
  const selNeg = sel ? negState.negotiations.find((n) => n.unitId === sel.id) ?? null : null;
  const selQueue = useUnitQueue(queueEnabled ? selectedId : null, accountId, developmentId);
  useEffect(() => { if (userId && selQueue.queue.length > 0) selQueue.checkMyPosition(userId); }, [userId, selQueue.queue.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Stock counts
  const totalUnits = units.length;
  const availableCount = units.filter((u) => u.status === UnidadeStatus.DISPONIVEL).length;
  const soldCount = units.filter((u) => u.status === UnidadeStatus.VENDIDO).length;
  const reservedCount = units.filter((u) => u.status === UnidadeStatus.RESERVADO).length;
  const soldPct = totalUnits > 0 ? Math.round((soldCount / totalUnits) * 100) : 0;
  const reservedPct = totalUnits > 0 ? Math.round((reservedCount / totalUnits) * 100) : 0;

  if (isLoading || negState.isLoading) return <p style={{ color: "var(--color-fog)" }}>Carregando mapa de unidades...</p>;

  return (
    <div>
      {/* === HEADER FIXO (always visible) === */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <h1 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontStyle: "italic", fontSize: 28, fontWeight: 400, color: "#FAF9F6", margin: 0, lineHeight: 1.1 }}>Unidades</h1>
          <div style={{ fontFamily: MONO, fontSize: 11, color: "#9C9686", marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {totalUnits} {lblUnidade.toLowerCase()}s · {grupos.length} {lblGrupo.toLowerCase()}s{isMobile ? "" : ` · ${development?.developmentName ?? ""}`}
          </div>
        </div>
        {/* Tab toggle v7 — always visible */}
        <div style={{ display: "flex", gap: 0, border: "1px solid rgba(61,58,48,0.15)", borderRadius: 8, overflow: "hidden" }}>
          {([
            { k: "mapa" as const, l: "Mapa" },
            ...(temMapaInterativo ? [{ k: "interativo" as const, l: "Planta" }] : []),
            { k: "tabela" as const, l: "Tabela" },
          ]).map((v, i, arr) => (
            <button key={v.k} type="button" onClick={() => setVis(v.k)}
              style={{
                padding: isMobile ? "7px 12px" : "7px 18px", fontSize: 11, fontWeight: 600, cursor: "pointer",
                border: "none",
                borderRight: i < arr.length - 1 ? "1px solid rgba(61,58,48,0.1)" : "none",
                color: vis === v.k ? "#4ADE80" : "#5C5647",
                background: vis === v.k ? "rgba(74,222,128,0.06)" : "transparent",
                transition: "all 100ms ease",
              }}>
              {v.l}
            </button>
          ))}
        </div>
      </div>

      {/* === KPIs + Stock bar + Filters (hidden only on Planta) === */}
      {vis !== "interativo" && (
        <>
        {/* KPI Summary */}
        <KpiBar availableCount={availableCount} soldCount={soldCount} reservedCount={reservedCount} totalUnits={totalUnits} soldPct={soldPct} reservedPct={reservedPct} />

        {/* Grupo filter */}
        <div
          className="nexa-settings-tabs"
          style={
            isMobile
              ? { display: "flex", gap: 6, flexWrap: "nowrap", marginBottom: 20, overflowX: "auto", WebkitOverflowScrolling: "touch", paddingBottom: 4 }
              : { display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 20 }
          }
        >
          <button type="button" onClick={() => setGrupoFiltro(null)}
            style={{ flexShrink: 0, padding: "6px 12px", borderRadius: 8, fontFamily: MONO, fontSize: 10, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", border: grupoFiltro === null ? "1px solid rgba(74,222,128,0.3)" : "1px solid rgba(42,40,34,0.5)", color: grupoFiltro === null ? "#4ADE80" : "#9C9686", background: grupoFiltro === null ? "rgba(74,222,128,0.08)" : "transparent" }}>
            Todas
          </button>
          {grupos.map((q) => (
            <button key={q} type="button" onClick={() => setGrupoFiltro(q)}
              style={{ flexShrink: 0, padding: "6px 12px", borderRadius: 8, fontFamily: MONO, fontSize: 10, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", border: grupoFiltro === q ? "1px solid rgba(74,222,128,0.3)" : "1px solid rgba(42,40,34,0.5)", color: grupoFiltro === q ? "#4ADE80" : "#9C9686", background: grupoFiltro === q ? "rgba(74,222,128,0.08)" : "transparent" }}>
              {lblGrupo} {q}
            </button>
          ))}
        </div>
        </>
      )}

      {/* Toolbar de seleção múltipla (Tabela) — só para quem gere status */}
      {(vis === "tabela" || vis === "mapa") && canManageStatus && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
          {!selectMode ? (
            <button type="button" onClick={() => setSelectMode(true)} style={{ minHeight: 44, padding: "0 14px", borderRadius: 8, fontFamily: MONO, fontSize: 11, fontWeight: 600, cursor: "pointer", border: "1px solid rgba(61,58,48,0.4)", background: "transparent", color: "#9C9686" }}>Selecionar</button>
          ) : (
            <>
              <button type="button" onClick={toggleAllVisible} style={{ minHeight: 44, padding: "0 14px", borderRadius: 8, fontFamily: MONO, fontSize: 11, fontWeight: 600, cursor: "pointer", border: "1px solid rgba(74,222,128,0.3)", background: "rgba(74,222,128,0.08)", color: "#4ADE80" }}>{allVisibleSelected ? "Desmarcar visíveis" : `Selecionar visíveis (${filtered.length})`}</button>
              <button type="button" onClick={exitSelectMode} style={{ minHeight: 44, padding: "0 14px", borderRadius: 8, fontFamily: MONO, fontSize: 11, fontWeight: 600, cursor: "pointer", border: "1px solid rgba(61,58,48,0.4)", background: "transparent", color: "#9C9686" }}>Cancelar seleção</button>
              <span style={{ fontFamily: MONO, fontSize: 11, color: "#9C9686" }}>{selectedIds.size} selecionada{selectedIds.size === 1 ? "" : "s"}</span>
            </>
          )}
        </div>
      )}

      {/* Content */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
        {vis === "interativo" && ds?.mapaUrl ? (
          <MapaInterativo
            mapaUrl={ds.mapaUrl} units={units} pins={pins}
            labelAgrupamento={lblGrupo} labelUnidade={lblUnidade}
            quadras={grupos} selectedQuadra={grupoFiltro} onQuadraChange={setGrupoFiltro}
            logoUrl={ds?.logoEmpreendimentoUrl ?? null} developmentName={development?.developmentName ?? ""}
            activeView={vis} onViewChange={setVis} hasPlanta={temMapaInterativo}
            onSelectUnit={(unitId) => setSelectedId(unitId)}
          />
        ) : vis === "mapa" ? (
          /* ═══ MAPA GRID ═══ */
          <div style={{ display: "grid", gridTemplateColumns: isMobile || (grupoFiltro !== null) ? "1fr" : "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
            {Array.from(byGrupo.entries()).map(([grupo, gUnits]) => {
              const disp = gUnits.filter((u) => u.status === UnidadeStatus.DISPONIVEL).length;
              return (
                <div key={grupo} style={{ background: CARD_BG, border: CARD_BORDER, borderRadius: 12, padding: 16 }}>
                  <div style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "8px 12px", marginBottom: 10,
                    background: "linear-gradient(145deg, #1F1E1A, #16150F)",
                    border: "1px solid rgba(42,40,34,0.5)",
                    borderRadius: 8,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {selectMode && canManageStatus && (
                        <input type="checkbox" aria-label={`Selecionar todo o ${lblGrupo} ${grupo}`}
                          checked={gUnits.every((u) => selectedIds.has(u.id))}
                          ref={(el) => { if (el) el.indeterminate = gUnits.some((u) => selectedIds.has(u.id)) && !gUnits.every((u) => selectedIds.has(u.id)); }}
                          onChange={() => setSelectedIds((prev) => { const n = new Set(prev); const all = gUnits.every((u) => n.has(u.id)); gUnits.forEach((u) => (all ? n.delete(u.id) : n.add(u.id))); return n; })}
                          style={{ width: 18, height: 18, cursor: "pointer", accentColor: "#4ADE80", flexShrink: 0 }} />
                      )}
                      <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: "#FAF9F6", letterSpacing: "0.08em", textTransform: "uppercase" }}>{lblGrupo} {grupo}</span>
                      <span style={{ fontFamily: MONO, fontSize: 9, color: "#706B5F" }}>{gUnits.length} {lblUnidade.toLowerCase()}{gUnits.length !== 1 ? "s" : ""}</span>
                    </div>
                    <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 600, padding: "2px 8px", borderRadius: 4, color: disp > 0 ? "#4ADE80" : "#5C5647", background: disp > 0 ? "rgba(74,222,128,0.08)" : "rgba(61,58,48,0.15)", border: `1px solid ${disp > 0 ? "rgba(74,222,128,0.15)" : "rgba(61,58,48,0.15)"}` }}>
                      {disp} disponíve{disp !== 1 ? "is" : "l"}
                    </span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(56px, 1fr))", gap: 5 }}>
                    {gUnits.sort((a, b) => { const na = parseInt(a.lote), nb = parseInt(b.lote); return !isNaN(na) && !isNaN(nb) ? na - nb : a.lote.localeCompare(b.lote); }).map((u) => {
                      const cfg = STATUS_CFG[u.status] ?? FALLBACK;
                      const isChecked = selectMode && selectedIds.has(u.id);
                      const isSel = u.id === selectedId || isChecked;
                      const qs = queueEnabled ? queueSummary[u.id] : undefined;
                      const hasFila = qs && qs.totalWaiting > 0;
                      const isMyQueue = qs?.myPosition !== null && qs?.myPosition !== undefined;
                      const isSold = u.status === UnidadeStatus.VENDIDO;
                      return (
                        <button key={u.id} type="button" onClick={() => (selectMode ? toggleSelect(u.id) : setSelectedId(u.id))}
                          title={`${lblUnidade} ${u.lote}\n${lblGrupo} ${u.quadra}\nValor: R$ ${u.valor.toLocaleString("pt-BR")}\nStatus: ${cfg.label}${(u as unknown as { area?: number }).area ? `\nÁrea: ${(u as unknown as { area: number }).area} m²` : ""}${hasFila ? `\n${qs!.totalWaiting} na fila` : ""}`}
                          style={{ width: "100%", minHeight: 52, borderRadius: 8, background: cfg.bg, border: isSel ? `2px solid ${cfg.color}` : `1px solid ${cfg.border}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, cursor: "pointer", transition: "transform 0.15s, border-color 0.15s, box-shadow 0.15s", boxShadow: isSel ? `0 0 0 3px ${cfg.color}40` : "none", padding: "6px 4px", position: "relative", opacity: isSold && !isChecked ? 0.55 : 1, zIndex: 1 }}
                          onMouseEnter={(e) => { const el = e.currentTarget; el.style.transform = "translateY(-2px)"; el.style.background = cfg.hoverBg; el.style.borderColor = "rgba(74,222,128,0.4)"; el.style.boxShadow = "0 4px 12px rgba(0,0,0,0.3)"; el.style.zIndex = "10"; }}
                          onMouseLeave={(e) => { const el = e.currentTarget; el.style.transform = "none"; el.style.background = cfg.bg; el.style.borderColor = isSel ? cfg.color : cfg.border; el.style.boxShadow = isSel ? `0 0 0 3px ${cfg.color}40` : "none"; el.style.zIndex = "1"; }}>
                          {isChecked && (
                            <div aria-hidden="true" style={{ position: "absolute", top: -4, left: -4, width: 16, height: 16, borderRadius: "50%", background: "#4ADE80", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: "#16150F", zIndex: 3, border: "2px solid var(--surface-base)" }}>✓</div>
                          )}
                          {hasFila && (
                            <div style={{ position: "absolute", top: -4, right: -4, width: isMyQueue ? 22 : 18, height: isMyQueue ? 22 : 18, borderRadius: "50%", background: isMyQueue ? "rgba(74,222,128,0.9)" : "rgba(167,139,250,0.9)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontFamily: MONO, fontWeight: 700, color: isMyQueue ? "var(--interactive-on-primary)" : "#FFFFFF", zIndex: 2, border: "2px solid var(--surface-base)" }}>
                              {isMyQueue ? `#${qs!.myPosition}` : qs!.totalWaiting}
                            </div>
                          )}
                          <span style={{ fontSize: 13, fontWeight: 700, color: "#C4BFB3", fontFamily: MONO, lineHeight: 1 }}>{u.lote}</span>
                          {u.status === UnidadeStatus.DISPONIVEL && u.valor > 0 ? <span style={{ fontSize: 8, color: cfg.color, fontFamily: MONO, lineHeight: 1, marginTop: 1, opacity: 0.85 }}>{fmtValor(u.valor)}</span> : null}
                          {u.status === UnidadeStatus.EM_NEGOCIACAO ? <span style={{ fontSize: 7, color: cfg.color, fontFamily: MONO, fontWeight: 700, lineHeight: 1, marginTop: 1, letterSpacing: "0.05em" }}>NEG</span> : null}
                          {u.status === UnidadeStatus.RESERVADO ? <span style={{ fontSize: 7, color: cfg.color, fontFamily: MONO, fontWeight: 700, lineHeight: 1, marginTop: 1, letterSpacing: "0.05em" }}>RES</span> : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* ═══ TABELA ═══ */
          <div style={{ background: "linear-gradient(168deg, rgba(34,33,28,0.3), rgba(18,17,14,0.1))", borderRadius: 12, border: "1px solid rgba(42,40,34,0.3)", overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr>
                    {selectMode && (
                      <th style={{ width: 40, padding: "10px 12px", borderBottom: "1px solid rgba(42,40,34,0.3)" }}>
                        <input type="checkbox" aria-label="Selecionar todas as unidades visíveis" checked={allVisibleSelected}
                          ref={(el) => { if (el) el.indeterminate = someVisibleSelected && !allVisibleSelected; }}
                          onChange={toggleAllVisible} style={{ width: 18, height: 18, cursor: "pointer", accentColor: "#4ADE80" }} />
                      </th>
                    )}
                    {[lblGrupo, lblUnidade, "Área", "Valor", "Status"].map((h) => (
                      <th key={h} style={{ textAlign: "left", padding: "10px 12px", fontFamily: MONO, fontSize: 9, color: "#706B5F", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600, borderBottom: "1px solid rgba(42,40,34,0.3)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.sort((a, b) => { const qa = a.quadra.localeCompare(b.quadra); if (qa !== 0) return qa; const na = parseInt(a.lote), nb = parseInt(b.lote); return !isNaN(na) && !isNaN(nb) ? na - nb : a.lote.localeCompare(b.lote); }).map((u) => {
                    const cfg = STATUS_CFG[u.status] ?? FALLBACK;
                    const rowBg = u.id === selectedId ? "linear-gradient(145deg, rgba(74,222,128,0.06), #16150F)" : "linear-gradient(145deg, #1F1E1A, #16150F)";
                    const hoverBg = "linear-gradient(145deg, rgba(74,222,128,0.03), #16150F)";
                    const isChecked = selectedIds.has(u.id);
                    return (
                      <tr key={u.id} onClick={() => (selectMode ? toggleSelect(u.id) : setSelectedId(u.id))}
                        style={{ borderBottom: "1px solid rgba(42,40,34,0.15)", cursor: "pointer", background: selectMode && isChecked ? "linear-gradient(145deg, rgba(74,222,128,0.08), #16150F)" : rowBg, transition: "background 0.15s, transform 0.1s" }}
                        onMouseEnter={(e) => { if (u.id !== selectedId && !(selectMode && isChecked)) { e.currentTarget.style.background = hoverBg; e.currentTarget.style.transform = "translateX(2px)"; } }}
                        onMouseLeave={(e) => { if (u.id !== selectedId && !(selectMode && isChecked)) { e.currentTarget.style.background = rowBg; e.currentTarget.style.transform = "none"; } }}>
                        {selectMode && (
                          <td style={{ padding: "10px 12px" }} onClick={(e) => e.stopPropagation()}>
                            <input type="checkbox" aria-label={`Selecionar ${lblGrupo} ${u.quadra} ${lblUnidade} ${u.lote}`} checked={isChecked} onChange={() => toggleSelect(u.id)} style={{ width: 18, height: 18, cursor: "pointer", accentColor: "#4ADE80" }} />
                          </td>
                        )}
                        <td style={{ padding: "10px 12px", color: "#FAF9F6", fontWeight: 700, fontFamily: MONO, fontSize: 13 }}>{u.quadra}</td>
                        <td style={{ padding: "10px 12px", color: "#FAF9F6", fontWeight: 700, fontFamily: MONO, fontSize: 13 }}>{u.lote}</td>
                        <td style={{ padding: "10px 12px", color: "#9C9686", fontFamily: MONO, fontSize: 12 }}>{(u as Record<string, unknown>).area ? `${(u as Record<string, unknown>).area} m²` : "—"}</td>
                        <td style={{ padding: "10px 12px", fontFamily: MONO, fontSize: 13, fontWeight: 700, color: u.valor > 0 ? "#4ADE80" : "#5C5647" }}>{u.valor > 0 ? `R$ ${u.valor.toLocaleString("pt-BR")}` : "—"}</td>
                        <td style={{ padding: "10px 12px" }}>
                          <span style={{ fontFamily: MONO, fontSize: 8, fontWeight: 600, padding: "3px 8px", borderRadius: 4, textTransform: "uppercase", letterSpacing: "0.06em", color: cfg.color, background: `${cfg.color}1A`, border: `1px solid ${cfg.color}33` }}>{cfg.label}</span>
                          {queueEnabled && queueSummary[u.id]?.totalWaiting > 0 && <span style={{ fontFamily: MONO, fontSize: 10, color: queueSummary[u.id]?.myPosition ? "#4ADE80" : "#A78BFA", marginLeft: 8 }}>{queueSummary[u.id]?.myPosition ? `#${queueSummary[u.id].myPosition}` : `${queueSummary[u.id].totalWaiting} na fila`}</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Ficha da Unidade (modal) — substitui o antigo cartão lateral */}
        {sel ? (
          <UnitFichaModal
            key={`ficha-${sel.id}-${fichaRefresh}`}
            unit={sel}
            negotiation={selNeg ? { id: selNeg.id, status: selNeg.status, clientId: selNeg.clientId } : null}
            lblGrupo={lblGrupo}
            lblUnidade={lblUnidade}
            canManageStatus={canManageStatus}
            useMock={useMock}
            isMobile={isMobile}
            onClose={() => setSelectedId(null)}
            onOpenNegotiation={(id) => navigate(`/negociacoes/${id}`)}
            onConciliar={() => navigate(`/negociacoes?unitId=${sel.id}`)}
            onAlterarStatus={() => setStatusTargets([toTarget(sel)])}
            queueSection={queueEnabled && sel.status !== UnidadeStatus.DISPONIVEL && sel.status !== UnidadeStatus.VENDIDO ? (
              <div>
                <div style={{ fontFamily: MONO, fontSize: 8.5, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>Fila de espera{selQueue.queueCount ? ` (${selQueue.queueCount})` : ""}</div>
                {selQueue.myPosition && (
                  <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.25)", marginBottom: 10 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#4ADE80" }}>Você está na posição #{selQueue.myPosition}</div>
                  </div>
                )}
                {selQueue.queue.length > 0 ? (isBroker ? selQueue.queue.filter((q) => q.requested_by === userId) : selQueue.queue).map((entry) => {
                  const isMe = entry.requested_by === userId;
                  return (
                    <div key={entry.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8, border: isMe ? "1px solid rgba(74,222,128,0.3)" : CARD_BORDER, marginBottom: 6, background: isMe ? "rgba(74,222,128,0.04)" : "rgba(18,17,14,0.3)" }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: isMe ? "#4ADE80" : "#5C5647", minWidth: 20, textAlign: "center", fontFamily: MONO }}>#{entry.position}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 500, color: "#E8E5DE" }}>{entry.clients?.name || entry.brokers?.name || entry.profiles?.name || "Interesse registrado"}{isMe ? <span style={{ fontSize: 10, color: "#4ADE80", marginLeft: 6 }}>VOCÊ</span> : ""}</div>
                        <div style={{ fontSize: 10, color: "#706B5F" }}>Corretor: {entry.brokers?.name || entry.profiles?.name || "—"} · {formatDateBRT(entry.created_at)}</div>
                      </div>
                    </div>
                  );
                }) : <div style={{ fontSize: 12, color: "#5C5647", marginBottom: 8 }}>Nenhum interessado na fila.</div>}
                {!selQueue.myPosition ? (
                  <button type="button" onClick={() => setShowQueueModal(true)} style={{ width: "100%", minHeight: 44, borderRadius: 8, fontSize: 13, fontWeight: 600, background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.2)", color: "#4ADE80", cursor: "pointer", marginTop: 8 }}>Entrar na fila</button>
                ) : (
                  <button type="button" onClick={() => setShowLeaveConfirm(true)} style={{ width: "100%", marginTop: 8, background: "transparent", border: "none", color: "#706B5F", fontSize: 12, cursor: "pointer", textDecoration: "underline" }}>Sair da fila</button>
                )}
                {queueToast && <div style={{ fontSize: 12, color: "#4ADE80", background: "rgba(74,222,128,0.08)", borderRadius: 8, padding: "8px 12px", marginTop: 8 }}>{queueToast}</div>}
              </div>
            ) : undefined}
          />
        ) : null}
      </div>

      {/* Legend (below map/grid) */}
      {vis === "mapa" && (
        <div style={{ display: "flex", gap: 16, marginTop: 16, flexWrap: "wrap" }}>
          {Object.entries(STATUS_CFG).map(([st, cfg]) => {
            const count = units.filter((u) => u.status === st).length;
            if (count === 0) return null;
            return (
              <div key={st} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: 3, background: cfg.color, opacity: 0.7 }} />
                <span style={{ fontSize: 10.5, color: "#706B5F" }}>{cfg.label} ({count})</span>
              </div>
            );
          })}
        </div>
      )}

      {units.length === 0 ? <EmptyState icone={"\uD83C\uDFE0"} titulo="Nenhuma unidade cadastrada" descricao="Cadastre as unidades do empreendimento para começar a negociar." ctaLabel="Ir para empreendimento" onCta={() => navigate("/empreendimentos")} /> : null}

      {showQueueModal && sel && (
        <QueueEntryModal
          isOpen={showQueueModal} onClose={() => setShowQueueModal(false)}
          unit={{ id: sel.id, quadra: sel.quadra, lote: sel.lote, valor: sel.valor, status: sel.status }}
          queuePosition={selQueue.getEstimatedPosition()}
          onSuccess={() => { setShowQueueModal(false); selQueue.fetchQueue(); refetchSummary(); setQueueToast("Entrada na fila confirmada!"); setTimeout(() => setQueueToast(null), 3000); }}
        />
      )}

      {showLeaveConfirm && sel && selQueue.myPosition && (
        (() => {
          const myEntry = selQueue.queue.find((q) => q.requested_by === userId);
          return (
            <NexaModal onClose={() => setShowLeaveConfirm(false)}>
              <div style={{ background: "var(--surface-raised)", border: "1px solid var(--border-default)", borderRadius: 12, padding: 24, width: 380, maxWidth: "90vw" }}>
                <div style={{ fontSize: 16, fontWeight: 600, color: "#E8E5DE", marginBottom: 8 }}>Sair da fila</div>
                <div style={{ fontSize: 13, color: "#706B5F", marginBottom: 6 }}>Tem certeza que deseja sair da fila do {lblUnidade} {sel.lote}?</div>
                <div style={{ fontSize: 13, color: "#F87171", marginBottom: 20 }}>Sua posição #{selQueue.myPosition} será perdida. Esta ação não pode ser desfeita.</div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button type="button" onClick={() => setShowLeaveConfirm(false)} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "1px solid rgba(61,58,48,0.2)", background: "transparent", color: "#706B5F", fontSize: 13, cursor: "pointer" }}>Cancelar</button>
                  <button type="button" disabled={leavingQueue} onClick={async () => {
                    if (!userId || !myEntry) return;
                    setLeavingQueue(true);
                    try {
                      await selQueue.leaveQueue(userId);
                      refetchSummary();
                      setShowLeaveConfirm(false);
                      setQueueToast(`Você saiu da fila do ${lblUnidade} ${sel.lote}.`);
                      setTimeout(() => setQueueToast(null), 3000);
                    } catch (err) { console.error("Erro ao sair da fila:", err); }
                    finally { setLeavingQueue(false); }
                  }} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", background: "#F87171", color: "#FFFFFF", fontSize: 13, fontWeight: 600, cursor: leavingQueue ? "not-allowed" : "pointer", opacity: leavingQueue ? 0.6 : 1 }}>
                    {leavingQueue ? "Saindo..." : "Sim, sair da fila"}
                  </button>
                </div>
              </div>
            </NexaModal>
          );
        })()
      )}

      {/* Barra de ação flutuante — seleção em massa */}
      {selectMode && selectedIds.size > 0 && (
        <div style={{ position: "fixed", left: 0, right: 0, bottom: 16, display: "flex", justifyContent: "center", zIndex: 200, pointerEvents: "none", padding: "0 12px" }}>
          <div style={{ pointerEvents: "auto", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", justifyContent: "center", background: "var(--surface-raised, #1C1B18)", border: "1px solid var(--border-strong, #3D3A30)", borderRadius: 12, padding: "8px 10px 8px 16px", boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}>
            <span style={{ fontFamily: MONO, fontSize: 12, color: "#E8E5DE", fontWeight: 600 }}>{selectedIds.size} selecionada{selectedIds.size === 1 ? "" : "s"}</span>
            <button type="button" onClick={() => setStatusTargets(units.filter((u) => selectedIds.has(u.id)).map(toTarget))} style={{ minHeight: 44, padding: "0 16px", borderRadius: 8, border: "none", background: "var(--color-sprout)", color: "var(--interactive-on-primary, #16150F)", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Alterar status</button>
            <button type="button" onClick={clearSelection} style={{ minHeight: 44, padding: "0 14px", borderRadius: 8, border: "1px solid var(--border-default)", background: "transparent", color: "#9C9686", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Limpar</button>
          </div>
        </div>
      )}

      {statusTargets && (
        <ChangeUnitStatusModal
          open={!!statusTargets}
          targets={statusTargets}
          onClose={() => setStatusTargets(null)}
          onChanged={() => { refetchUnits(); clearSelection(); setFichaRefresh((k) => k + 1); }}
        />
      )}
    </div>
  );
}
