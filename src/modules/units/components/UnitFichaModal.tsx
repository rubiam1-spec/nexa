// Ficha da Unidade v2 — design nível Linear/Attio (Brand Book v7 + DS).
// Funcionalidade inalterada; foco em hierarquia, ritmo e uma-moldura-só:
// "Alterar status" é ESTÁGIO INTERNO (o corpo desliza), nunca modal-sobre-modal.
// createPortal, fixed inset-0 z-9000; mobile full-screen. Só apresentação +
// leitura + o hook de status (mesma fonte do fluxo em massa).
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { Unidade } from "../../../domain/unidade/Unidade";
import { UnidadeStatus } from "../../../domain/unidade/UnidadeStatus";
import type { NegotiationStatus } from "../../../domain/negociacao/NegotiationStatus";
import { getNegotiationStatusLabel } from "../../../domain/negociacao/NegotiationStatusLabel";
import { parseUnitHistoryAction, unitStatusLabelTolerant } from "../../../domain/unidade/unitHistoryDisplay";
import { bulkBlockReasonLabel } from "../../../domain/unidade/bulkStatusReason";
import { getUnitDetail, type UnitDetail } from "../../../infra/repositories/unitsSupabaseRepository";
import { getClientById } from "../../../infra/repositories/clientsSupabaseRepository";
import { useUnitTimeline } from "../hooks/useUnitTimeline";
import { useUnitStatusChange } from "../hooks/useUnitStatusChange";
import { NexaSelect } from "../../../shared/ui/NexaSelect";
import { formatDateBRT, formatTimeBRT } from "../../../shared/utils/dateUtils";
import { compactBRL, vgvOrDash } from "../../../shared/viz";

export type LinkedNegotiation = { id: string; status: NegotiationStatus; clientId: string | null } | null;

const MONO = "var(--font-mono)";
const MIN_REASON = 5;
const CHIP: Record<string, { c: string; label: string }> = {
  [UnidadeStatus.DISPONIVEL]: { c: "#4ADE80", label: "Disponível" },
  [UnidadeStatus.EM_NEGOCIACAO]: { c: "#60A5FA", label: "Em negociação" },
  [UnidadeStatus.RESERVADO]: { c: "#D97706", label: "Reservada" },
  [UnidadeStatus.VENDIDO]: { c: "#F87171", label: "Vendida" },
};
const DB2ENUM: Record<string, string> = { available: "DISPONIVEL", reserved: "RESERVADO", in_negotiation: "EM_NEGOCIACAO", sold: "VENDIDO" };
function chipMeta(raw: string | null): { c: string; label: string } {
  if (!raw) return { c: "#5C5647", label: "—" };
  const e = DB2ENUM[raw] ?? raw;
  return CHIP[e] ?? { c: "#5C5647", label: unitStatusLabelTolerant(raw) };
}

function StatusChip({ status }: { status: string }) {
  const m = chipMeta(status);
  return <span style={{ fontFamily: MONO, fontSize: 10.5, fontWeight: 700, color: m.c, background: `${m.c}1A`, border: `1px solid ${m.c}40`, borderRadius: 6, padding: "2px 8px", whiteSpace: "nowrap" }}>{m.label}</span>;
}

function Overline({ children }: { children: ReactNode }) {
  return <div style={{ fontFamily: MONO, fontSize: 8.5, color: "var(--text-muted)", letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 600, marginBottom: 10 }}>{children}</div>;
}
const HR = <div style={{ height: 1, background: "rgba(61,58,48,0.4)", margin: "20px 0" }} />;

export default function UnitFichaModal({
  unit, negotiation, lblGrupo, lblUnidade, totalUnits, canManageStatus, useMock, queueSection, isMobile,
  onClose, onOpenNegotiation, onConciliar, onStatusChanged,
}: {
  unit: Unidade;
  negotiation: LinkedNegotiation;
  lblGrupo: string; lblUnidade: string;
  totalUnits: number;
  canManageStatus: boolean;
  useMock: boolean;
  queueSection?: ReactNode;
  isMobile: boolean;
  onClose: () => void;
  onOpenNegotiation: (negId: string) => void;
  onConciliar: () => void;
  onStatusChanged: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [detail, setDetail] = useState<UnitDetail | null>(null);
  const [clientName, setClientName] = useState<string | null>(null);
  const timeline = useUnitTimeline(useMock ? null : unit.id);

  // Estágio interno: ficha | status. `enter` anima a troca (slide+fade).
  const [stage, setStage] = useState<"ficha" | "status">("ficha");
  const [entering, setEntering] = useState(false);
  const goStage = (next: "ficha" | "status") => {
    setStage(next);
    if (typeof requestAnimationFrame !== "undefined") {
      setEntering(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setEntering(false)));
    }
  };

  // Formulário de status (estágio interno) — mesmo hook do fluxo em massa.
  const { submit, isSubmitting, errorMessage, reset } = useUnitStatusChange(() => { onStatusChanged(); void timeline.refetch(); });
  const [destino, setDestino] = useState<UnidadeStatus | "">("");
  const [reason, setReason] = useState("");
  const [blockMsg, setBlockMsg] = useState<string | null>(null);
  const reasonOk = reason.trim().length >= MIN_REASON;
  const statusOptions = useMemo(
    () => ([UnidadeStatus.DISPONIVEL, UnidadeStatus.EM_NEGOCIACAO, UnidadeStatus.RESERVADO, UnidadeStatus.VENDIDO] as UnidadeStatus[])
      .filter((s) => s !== unit.status)
      .map((s) => ({ value: s, label: CHIP[s].label })),
    [unit.status],
  );

  // Animação de abertura (fade+scale) + a11y (foco + Esc/Voltar).
  const [shown, setShown] = useState(false);
  useEffect(() => {
    setShown(true);
    const panel = panelRef.current;
    panel?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { if (stage === "status") goStage("ficha"); else onClose(); return; }
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
  }, [stage, onClose]);

  useEffect(() => {
    if (useMock) return;
    let alive = true;
    getUnitDetail(unit.id).then((d) => { if (alive) setDetail(d); }).catch(() => { if (alive) setDetail(null); });
    return () => { alive = false; };
  }, [unit.id, useMock]);

  useEffect(() => {
    const cid = negotiation?.clientId;
    if (!cid || useMock) { setClientName(null); return; }
    let alive = true;
    getClientById(cid).then((c) => { if (alive) setClientName(c?.name ?? null); }).catch(() => { if (alive) setClientName(null); });
    return () => { alive = false; };
  }, [negotiation?.clientId, useMock]);

  async function confirmStatus() {
    if (!destino || !reasonOk) return;
    setBlockMsg(null);
    const r = await submit([unit.id], destino, reason.trim());
    if (!r) return; // exception → errorMessage inline
    if (r.updated === 1) { setDestino(""); setReason(""); reset(); goStage("ficha"); return; }
    if (r.blocked.length > 0) setBlockMsg(bulkBlockReasonLabel(r.blocked[0].reason));
  }
  function openStatus() { setBlockMsg(null); setDestino(""); setReason(""); reset(); goStage("status"); }

  // Condições sugeridas (só as presentes).
  const condicoes = useMemo(() => {
    const rows: { label: string; value: string }[] = [];
    if (detail?.entradaSugerida) rows.push({ label: "Entrada", value: compactBRL(detail.entradaSugerida) });
    if (detail?.balaoSugerido) rows.push({ label: "Balão", value: compactBRL(detail.balaoSugerido) });
    if (detail?.parcelaSugerida) rows.push({ label: "Parcela", value: compactBRL(detail.parcelaSugerida) });
    return rows;
  }, [detail]);

  // Metadados numa linha só — o VALOR aparece UMA vez aqui.
  const metaParts: string[] = [];
  if (detail?.area && detail.area > 0) metaParts.push(`${detail.area.toLocaleString("pt-BR")} m²`);
  metaParts.push(vgvOrDash(unit.valor));
  metaParts.push(`${totalUnits} no espelho`);

  const vendidaSemNeg = unit.status === UnidadeStatus.VENDIDO && !negotiation;

  const bodyAnim: React.CSSProperties = { transform: entering ? "translateX(14px)" : "translateX(0)", opacity: entering ? 0 : 1, transition: "transform 180ms ease, opacity 180ms ease" };

  const panelStyle: React.CSSProperties = isMobile
    ? { position: "fixed", inset: 0, width: "100%", height: "100%", maxHeight: "100%", overflowY: "auto", background: "var(--surface-raised, #1C1B18)", padding: "max(18px, env(safe-area-inset-top)) 18px max(18px, env(safe-area-inset-bottom))", outline: "none" }
    : { width: "100%", maxWidth: 540, maxHeight: "88vh", overflowY: "auto", background: "var(--surface-raised, #1C1B18)", border: "1px solid var(--border-default, #3D3A30)", borderRadius: 16, padding: 28, outline: "none", boxShadow: "0 24px 64px rgba(0,0,0,0.6)", opacity: shown ? 1 : 0, transform: shown ? "scale(1)" : "scale(0.98)", transition: "opacity 120ms ease, transform 120ms ease" };

  return createPortal(
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 9000, display: "flex", alignItems: isMobile ? "stretch" : "center", justifyContent: "center", padding: isMobile ? 0 : 16, background: "rgba(0,0,0,0.6)", opacity: shown ? 1 : 0, transition: "opacity 120ms ease" }}>
      <div ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="ficha-title" onClick={(e) => e.stopPropagation()} style={panelStyle}>
        {/* HEADER — display serif + chip de status; metadados em uma linha (valor 1x) */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 6 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <h2 id="ficha-title" style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontStyle: "italic", fontSize: 26, fontWeight: 400, color: "var(--color-bone, #E8E5DE)", margin: 0, lineHeight: 1.1 }}>
                {lblGrupo} {unit.quadra} · {lblUnidade} {unit.lote}{stage === "status" ? <span style={{ color: "var(--text-muted)" }}> · Alterar status</span> : null}
              </h2>
              {stage === "ficha" ? <StatusChip status={unit.status} /> : null}
            </div>
            <div style={{ fontFamily: MONO, fontSize: 11, color: "var(--text-muted)", marginTop: 8, letterSpacing: "0.03em" }}>{metaParts.join(" · ")}</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" style={{ background: "transparent", border: "none", color: "var(--text-muted)", fontSize: 22, lineHeight: 1, cursor: "pointer", minWidth: 44, minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8 }}>×</button>
        </div>

        {stage === "status" ? (
          /* ══ ESTÁGIO INTERNO: ALTERAR STATUS ══ */
          <div style={bodyAnim}>
            <button type="button" onClick={() => goStage("ficha")} style={{ background: "transparent", border: "none", color: "var(--text-secondary)", fontSize: 12, cursor: "pointer", padding: "6px 0", marginBottom: 8 }}>← Voltar</button>

            <div style={{ marginBottom: 16 }}>
              <Overline>Status destino</Overline>
              <NexaSelect value={destino} onChange={(v) => setDestino(v as UnidadeStatus)} options={statusOptions} placeholder="Selecionar status..." ariaLabel="Status destino" />
            </div>

            {/* Resumo visual da transição — chips, não string */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <StatusChip status={unit.status} />
              <span style={{ color: "var(--text-muted)", fontSize: 14 }}>→</span>
              {destino ? <StatusChip status={destino} /> : <span style={{ fontFamily: MONO, fontSize: 10.5, color: "var(--text-disabled)", border: "1px dashed var(--border-default)", borderRadius: 6, padding: "2px 8px" }}>destino</span>}
            </div>

            <div style={{ marginBottom: 16 }}>
              <Overline>Motivo</Overline>
              <div style={{ position: "relative" }}>
                <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Por que este status está mudando?"
                  style={{ width: "100%", resize: "vertical", background: "var(--surface-base)", border: `1px solid ${reason.length > 0 && !reasonOk ? "#F87171" : "var(--border-default)"}`, borderRadius: 8, padding: "10px 12px", color: "var(--text-primary)", fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit", lineHeight: 1.5 }} />
                <span style={{ position: "absolute", right: 10, bottom: 8, fontFamily: MONO, fontSize: 10, color: reasonOk ? "var(--text-disabled)" : "var(--text-muted)" }}>{reason.trim().length}/{MIN_REASON} mín.</span>
              </div>
            </div>

            {blockMsg && <div style={{ background: "rgba(232,180,90,0.08)", border: "1px solid rgba(232,180,90,0.3)", borderRadius: 8, padding: "10px 12px", fontSize: 12.5, color: "#E8B45A", marginBottom: 14 }}>{blockMsg}</div>}
            {errorMessage && <div style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: 8, padding: "10px 12px", fontSize: 12.5, color: "#F87171", marginBottom: 14 }}>{errorMessage}</div>}

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
              <button type="button" onClick={() => goStage("ficha")} style={{ minHeight: 40, padding: "0 18px", borderRadius: 8, border: "1px solid var(--border-default)", background: "transparent", color: "var(--text-secondary)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancelar</button>
              <button type="button" disabled={isSubmitting || !destino || !reasonOk} onClick={() => void confirmStatus()} style={{ minHeight: 40, padding: "0 22px", borderRadius: 8, border: "none", background: "var(--color-sprout)", color: "var(--interactive-on-primary, #16150F)", fontSize: 13, fontWeight: 700, cursor: isSubmitting || !destino || !reasonOk ? "not-allowed" : "pointer", opacity: isSubmitting || !destino || !reasonOk ? 0.5 : 1 }}>{isSubmitting ? "Alterando..." : "Confirmar"}</button>
            </div>
          </div>
        ) : (
          /* ══ ESTÁGIO FICHA ══ */
          <div style={bodyAnim}>
            {HR}
            {/* NEGOCIAÇÃO */}
            <Overline>Negociação</Overline>
            {negotiation ? (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{clientName ?? "Cliente —"}</span>
                  <span style={{ fontFamily: MONO, fontSize: 10.5, fontWeight: 700, color: "var(--text-secondary)", background: "var(--surface-base)", border: "1px solid var(--border-default)", borderRadius: 6, padding: "2px 8px", whiteSpace: "nowrap" }}>{getNegotiationStatusLabel(negotiation.status) ?? negotiation.status}</span>
                </div>
                <button type="button" onClick={() => onOpenNegotiation(negotiation.id)} style={{ background: "transparent", border: "none", color: "var(--color-sprout)", fontSize: 13, fontWeight: 600, cursor: "pointer", padding: 4 }}>abrir →</button>
              </div>
            ) : vendidaSemNeg ? (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", border: "1px solid rgba(232,180,90,0.3)", borderRadius: 8, padding: "10px 12px" }}>
                <span style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>Venda sem negociação registrada</span>
                <button type="button" onClick={onConciliar} style={{ background: "transparent", border: "none", color: "#E8B45A", fontSize: 12.5, fontWeight: 600, cursor: "pointer", padding: 4 }}>Conciliar →</button>
              </div>
            ) : (
              <div style={{ fontSize: 13, color: "var(--text-muted)", fontStyle: "italic" }}>Sem negociação vinculada.</div>
            )}

            {/* CONDIÇÕES SUGERIDAS — só quando existem */}
            {condicoes.length > 0 && (<>{HR}<Overline>Condições sugeridas</Overline>
              <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                {condicoes.map((c) => (
                  <div key={c.label}>
                    <div style={{ fontFamily: MONO, fontSize: 8.5, color: "var(--text-muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>{c.label}</div>
                    <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginTop: 2 }}>{c.value}</div>
                  </div>
                ))}
              </div></>)}

            {/* FILA (portada) */}
            {queueSection ? <>{HR}<Overline>Fila</Overline>{queueSection}</> : null}

            {/* HISTÓRICO — timeline viva */}
            {HR}
            <Overline>Histórico</Overline>
            <Timeline unit={unit} loading={timeline.isLoading} events={timeline.events} lblGrupo={lblGrupo} lblUnidade={lblUnidade} />

            {/* RODAPÉ — ação primária dimensionada, à direita */}
            {canManageStatus && (
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 24 }}>
                <button type="button" onClick={openStatus} style={{ minHeight: 40, padding: "0 20px", borderRadius: 8, border: "none", background: "var(--color-sprout)", color: "var(--interactive-on-primary, #16150F)", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Alterar status</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

function Node({ color, children }: { color: string; children: ReactNode }) {
  return (
    <div style={{ position: "relative", paddingLeft: 22, paddingBottom: 16 }}>
      <div aria-hidden="true" style={{ position: "absolute", left: 1, top: 3, width: 9, height: 9, borderRadius: "50%", background: color, border: "2px solid var(--surface-raised, #1C1B18)", zIndex: 1 }} />
      {children}
    </div>
  );
}

function Timeline({ unit, loading, events, lblGrupo, lblUnidade }: {
  unit: Unidade; loading: boolean; events: ReturnType<typeof useUnitTimeline>["events"]; lblGrupo: string; lblUnidade: string;
}) {
  void lblGrupo; void lblUnidade;
  const line = <div aria-hidden="true" style={{ position: "absolute", left: 5, top: 4, bottom: 8, width: 1, background: "rgba(61,58,48,0.5)" }} />;

  if (loading) {
    return (
      <div style={{ position: "relative" }}>{line}
        {[0, 1].map((i) => (
          <Node key={i} color="var(--border-strong, #3D3A30)">
            <div className="nexa-skeleton" style={{ height: 9, width: 120, borderRadius: 4, marginBottom: 6 }} />
            <div className="nexa-skeleton" style={{ height: 12, width: 180, borderRadius: 4 }} />
          </Node>
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    // Sem eventos: NÃO mostrar vazio tracejado — sintetizar o começo da história.
    const created = unit.createdAt instanceof Date ? unit.createdAt : new Date(unit.createdAt as unknown as string);
    return (
      <div style={{ position: "relative" }}>{line}
        <Node color={chipMeta(unit.status).c}>
          <div style={{ fontFamily: MONO, fontSize: 10, color: "var(--text-muted)" }}>{formatDateBRT(created)}</div>
          <div style={{ fontSize: 13, color: "var(--text-primary)", marginTop: 2 }}>
            Status atual: <StatusChip status={unit.status} /> · <span style={{ color: "var(--text-muted)" }}>registrada na carga do mapa de lotes</span>
          </div>
        </Node>
      </div>
    );
  }

  return (
    <div style={{ position: "relative" }}>{line}
      {events.map((ev) => {
        const act = parseUnitHistoryAction(ev.actionRaw);
        return (
          <Node key={ev.id} color={chipMeta(ev.toStatus).c}>
            <div style={{ fontFamily: MONO, fontSize: 10, color: "var(--text-muted)" }}>{formatDateBRT(ev.createdAt)} {formatTimeBRT(ev.createdAt)} · {ev.performerName ?? "—"}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
              <StatusChip status={ev.fromStatus ?? "—"} />
              <span style={{ color: "var(--text-muted)", fontSize: 12 }}>→</span>
              <StatusChip status={ev.toStatus} />
            </div>
            {act.reason ? <div style={{ fontSize: 12.5, color: "var(--text-secondary)", fontStyle: "italic", marginTop: 4 }}>{act.reason}</div> : <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>{act.label}</div>}
          </Node>
        );
      })}
    </div>
  );
}
