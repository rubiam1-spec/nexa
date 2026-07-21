// Ficha da Unidade — modal central (createPortal, fixed inset-0 z-9000; mobile
// full-screen). Substitui o antigo cartão lateral. Só apresentação + fetch de
// leitura (detalhe, cliente, timeline via hook); nenhuma regra de negócio.
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { Unidade } from "../../../domain/unidade/Unidade";
import { UnidadeStatus } from "../../../domain/unidade/UnidadeStatus";
import type { NegotiationStatus } from "../../../domain/negociacao/NegotiationStatus";
import { getNegotiationStatusLabel } from "../../../domain/negociacao/NegotiationStatusLabel";
import { parseUnitHistoryAction, unitStatusLabelTolerant } from "../../../domain/unidade/unitHistoryDisplay";
import { getUnitDetail, type UnitDetail } from "../../../infra/repositories/unitsSupabaseRepository";
import { getClientById } from "../../../infra/repositories/clientsSupabaseRepository";
import { useUnitTimeline } from "../hooks/useUnitTimeline";
import { formatDateBRT, formatTimeBRT } from "../../../shared/utils/dateUtils";
import { compactBRL, vgvOrDash, VizFrame } from "../../../shared/viz";

export type LinkedNegotiation = { id: string; status: NegotiationStatus; clientId: string | null } | null;

const BADGE: Record<string, { c: string; label: string }> = {
  [UnidadeStatus.DISPONIVEL]: { c: "#4ADE80", label: "Disponível" },
  [UnidadeStatus.EM_NEGOCIACAO]: { c: "#60A5FA", label: "Em negociação" },
  [UnidadeStatus.RESERVADO]: { c: "#D97706", label: "Reservada" },
  [UnidadeStatus.VENDIDO]: { c: "#F87171", label: "Vendida" },
};
const MONO = "var(--font-mono)";

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontFamily: MONO, fontSize: 8, color: "var(--text-muted)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 3 }}>{label}</div>
      <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{value}</div>
    </div>
  );
}

export default function UnitFichaModal({
  unit, negotiation, lblGrupo, lblUnidade, canManageStatus, useMock, queueSection, isMobile,
  onClose, onOpenNegotiation, onConciliar, onAlterarStatus,
}: {
  unit: Unidade;
  negotiation: LinkedNegotiation;
  lblGrupo: string; lblUnidade: string;
  canManageStatus: boolean;
  useMock: boolean;
  queueSection?: ReactNode;
  isMobile: boolean;
  onClose: () => void;
  onOpenNegotiation: (negId: string) => void;
  onConciliar: () => void;
  onAlterarStatus: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [detail, setDetail] = useState<UnitDetail | null>(null);
  const [clientName, setClientName] = useState<string | null>(null);
  const { events, isLoading: loadingHistory } = useUnitTimeline(useMock ? null : unit.id);

  // Detalhe (área + condições sugeridas) — leitura sob demanda.
  useEffect(() => {
    if (useMock) return;
    let alive = true;
    getUnitDetail(unit.id).then((d) => { if (alive) setDetail(d); }).catch(() => { if (alive) setDetail(null); });
    return () => { alive = false; };
  }, [unit.id, useMock]);

  // Nome do cliente da negociação vinculada.
  useEffect(() => {
    const cid = negotiation?.clientId;
    if (!cid || useMock) { setClientName(null); return; }
    let alive = true;
    getClientById(cid).then((c) => { if (alive) setClientName(c?.name ?? null); }).catch(() => { if (alive) setClientName(null); });
    return () => { alive = false; };
  }, [negotiation?.clientId, useMock]);

  // a11y: foco preso + Esc.
  useEffect(() => {
    const panel = panelRef.current;
    panel?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "Tab" && panel) {
        const list = Array.from(panel.querySelectorAll<HTMLElement>('button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])')).filter((el) => !el.hasAttribute("disabled") && el.offsetParent !== null);
        if (!list.length) return;
        const first = list[0], last = list[list.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const badge = BADGE[unit.status] ?? { c: "#5C5647", label: unit.status };

  // DADOS: só linhas com valor (não poluir com "—").
  const dados = useMemo(() => {
    const rows: { label: string; value: string }[] = [];
    if (detail?.area && detail.area > 0) rows.push({ label: "Área", value: `${detail.area.toLocaleString("pt-BR")} m²` });
    if (unit.valor > 0) rows.push({ label: "Valor", value: compactBRL(unit.valor) });
    if (detail?.entradaSugerida && detail.entradaSugerida > 0) rows.push({ label: "Entrada sugerida", value: compactBRL(detail.entradaSugerida) });
    if (detail?.balaoSugerido && detail.balaoSugerido > 0) rows.push({ label: "Balão sugerido", value: compactBRL(detail.balaoSugerido) });
    if (detail?.parcelaSugerida && detail.parcelaSugerida > 0) rows.push({ label: "Parcela sugerida", value: compactBRL(detail.parcelaSugerida) });
    return rows;
  }, [detail, unit.valor]);

  const vendidaSemNeg = unit.status === UnidadeStatus.VENDIDO && !negotiation;

  const panelStyle: React.CSSProperties = isMobile
    ? { position: "fixed", inset: 0, width: "100%", height: "100%", maxHeight: "100%", overflowY: "auto", background: "var(--surface-raised, #1C1B18)", padding: "max(16px, env(safe-area-inset-top)) 16px max(16px, env(safe-area-inset-bottom))", outline: "none" }
    : { width: "100%", maxWidth: 560, maxHeight: "88vh", overflowY: "auto", background: "var(--surface-raised, #1C1B18)", border: "1px solid var(--border-default, #3D3A30)", borderRadius: 16, padding: 24, outline: "none", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" };

  return createPortal(
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 9000, display: "flex", alignItems: isMobile ? "stretch" : "center", justifyContent: "center", padding: isMobile ? 0 : 16, background: "rgba(0,0,0,0.6)" }}>
      <div ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="ficha-title" onClick={(e) => e.stopPropagation()} style={panelStyle}>
        {/* HEADER */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
          <div>
            <div id="ficha-title" style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>{lblGrupo} {unit.quadra} · {lblUnidade} {unit.lote}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
              <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: badge.c, background: `${badge.c}1A`, border: `1px solid ${badge.c}40`, borderRadius: 6, padding: "3px 10px", textTransform: "uppercase", letterSpacing: "0.05em" }}>{badge.label}</span>
              <span style={{ fontFamily: MONO, fontSize: 18, fontWeight: 700, color: unit.valor > 0 ? "#4ADE80" : "var(--text-muted)" }}>{vgvOrDash(unit.valor)}</span>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" style={{ background: "transparent", border: "none", color: "var(--text-muted)", fontSize: 24, lineHeight: 1, cursor: "pointer", padding: 2, minWidth: 44, minHeight: 44 }}>×</button>
        </div>

        {/* DADOS */}
        {dados.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 18 }}>
            {dados.map((d) => <DataRow key={d.label} label={d.label} value={d.value} />)}
          </div>
        )}

        {/* NEGOCIAÇÃO VINCULADA */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontFamily: MONO, fontSize: 8.5, color: "var(--text-muted)", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600, marginBottom: 8 }}>Negociação</div>
          {negotiation ? (
            <div style={{ border: "1px solid var(--border-default)", borderRadius: 10, padding: "12px 14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{clientName ?? "Cliente —"}</div>
                  <div style={{ fontFamily: MONO, fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{getNegotiationStatusLabel(negotiation.status) ?? negotiation.status} · NEG-{negotiation.id.slice(0, 4).toUpperCase()}</div>
                </div>
                <button type="button" onClick={() => onOpenNegotiation(negotiation.id)} style={{ minHeight: 44, padding: "0 14px", borderRadius: 8, border: "1px solid rgba(74,222,128,0.25)", background: "rgba(74,222,128,0.08)", color: "#4ADE80", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>abrir negociação →</button>
              </div>
            </div>
          ) : vendidaSemNeg ? (
            <div style={{ border: "1px solid rgba(248,113,113,0.3)", background: "rgba(248,113,113,0.06)", borderRadius: 10, padding: "12px 14px" }}>
              <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 10 }}>Venda sem negociação registrada</div>
              <button type="button" onClick={onConciliar} style={{ minHeight: 44, padding: "0 14px", borderRadius: 8, border: "none", background: "var(--color-sprout)", color: "var(--interactive-on-primary, #16150F)", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Conciliar → criar negociação</button>
            </div>
          ) : (
            <div style={{ fontSize: 13, color: "var(--text-muted)", fontStyle: "italic" }}>Sem negociação vinculada.</div>
          )}
        </div>

        {/* FILA (portada do cartão lateral) */}
        {queueSection ? <div style={{ marginBottom: 18 }}>{queueSection}</div> : null}

        {/* HISTÓRICO */}
        <div style={{ marginBottom: canManageStatus ? 18 : 0 }}>
          <VizFrame title="Histórico" loading={loadingHistory} empty={!loadingHistory && events.length === 0} emptyLabel="Sem histórico registrado para esta unidade." height={0}>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {events.map((ev) => {
                const act = parseUnitHistoryAction(ev.actionRaw);
                return (
                  <div key={ev.id} style={{ borderLeft: "2px solid var(--border-strong, #3D3A30)", paddingLeft: 12 }}>
                    <div style={{ fontFamily: MONO, fontSize: 10, color: "var(--text-muted)" }}>{formatDateBRT(ev.createdAt)} {formatTimeBRT(ev.createdAt)} · {ev.performerName ?? "—"}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginTop: 2 }}>{act.label}</div>
                    {act.reason ? <div style={{ fontSize: 12, color: "#E8B45A", marginTop: 2 }}>Motivo: {act.reason}</div> : null}
                    <div style={{ fontFamily: MONO, fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{unitStatusLabelTolerant(ev.fromStatus)} → {unitStatusLabelTolerant(ev.toStatus)}</div>
                  </div>
                );
              })}
            </div>
          </VizFrame>
        </div>

        {/* RODAPÉ */}
        {canManageStatus && (
          <button type="button" onClick={onAlterarStatus} style={{ width: "100%", minHeight: 44, borderRadius: 8, border: "none", background: "var(--color-sprout)", color: "var(--interactive-on-primary, #16150F)", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Alterar status</button>
        )}
      </div>
    </div>,
    document.body,
  );
}
