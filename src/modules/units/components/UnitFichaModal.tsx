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
import { UNIT_STATUS_COLOR, UNIT_STATUS_COLOR_FALLBACK } from "../../../domain/unidade/unitStatusColor";
import { EntityLink } from "../../../shared/navigation/EntityLink";
import { openActionLabel } from "../../../shared/navigation/entityRoutes";
import { bulkBlockReasonLabel } from "../../../domain/unidade/bulkStatusReason";
import { getUnitDetail, type UnitDetail } from "../../../infra/repositories/unitsSupabaseRepository";
import { getClientById, getClients, createClient } from "../../../infra/repositories/clientsSupabaseRepository";
import { useUnitTimeline } from "../hooks/useUnitTimeline";
import { useUnitStatusChange } from "../hooks/useUnitStatusChange";
import { useRegisterSale } from "../hooks/useRegisterSale";
import { NexaSelect } from "../../../shared/ui/NexaSelect";
import { formatDateBRT, formatTimeBRT } from "../../../shared/utils/dateUtils";
import { compactBRL, vgvOrDash } from "../../../shared/viz";

export type LinkedNegotiation = { id: string; status: NegotiationStatus; clientId: string | null } | null;

const MONO = "var(--font-mono)";
const MIN_REASON = 5;
// Cores canônicas do status vêm da fonte única (unitStatusColor) — mesmas do
// espelho/legenda; nunca redeclarar hex aqui.
const CHIP: Record<string, { c: string; label: string }> = {
  [UnidadeStatus.DISPONIVEL]: { c: UNIT_STATUS_COLOR[UnidadeStatus.DISPONIVEL], label: "Disponível" },
  [UnidadeStatus.EM_NEGOCIACAO]: { c: UNIT_STATUS_COLOR[UnidadeStatus.EM_NEGOCIACAO], label: "Em negociação" },
  [UnidadeStatus.RESERVADO]: { c: UNIT_STATUS_COLOR[UnidadeStatus.RESERVADO], label: "Reservada" },
  [UnidadeStatus.VENDIDO]: { c: UNIT_STATUS_COLOR[UnidadeStatus.VENDIDO], label: "Vendida" },
};
const DB2ENUM: Record<string, string> = { available: "DISPONIVEL", reserved: "RESERVADO", in_negotiation: "EM_NEGOCIACAO", sold: "VENDIDO" };
function chipMeta(raw: string | null): { c: string; label: string } {
  if (!raw) return { c: UNIT_STATUS_COLOR_FALLBACK, label: "—" };
  const e = DB2ENUM[raw] ?? raw;
  return CHIP[e] ?? { c: UNIT_STATUS_COLOR_FALLBACK, label: unitStatusLabelTolerant(raw) };
}

function StatusChip({ status, dot }: { status: string; dot?: boolean }) {
  const m = chipMeta(status);
  return <span style={{ fontFamily: MONO, fontSize: 10.5, fontWeight: 700, color: m.c, background: `${m.c}1A`, border: `1px solid ${m.c}40`, borderRadius: 6, padding: "2px 8px", whiteSpace: "nowrap", display: "inline-flex", alignItems: "center" }}>{dot ? <span aria-hidden="true" style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: m.c, marginRight: 6, flexShrink: 0 }} /> : null}{m.label}</span>;
}

function Overline({ children }: { children: ReactNode }) {
  return <div style={{ fontFamily: MONO, fontSize: 8.5, color: "var(--text-muted)", letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 600, marginBottom: 10 }}>{children}</div>;
}
const HR = <div style={{ height: 1, background: "rgba(61,58,48,0.4)", margin: "20px 0" }} />;

const inputStyle: React.CSSProperties = { width: "100%", background: "var(--surface-base)", border: "1px solid var(--border-default)", borderRadius: 8, padding: "10px 12px", color: "var(--text-primary)", fontSize: 13, outline: "none", boxSizing: "border-box" };

// Data da venda: 'YYYY-MM-DD' → 'dd/mm/aaaa' sem shift de fuso; null → texto explícito.
function fmtSaleDate(s: string | null): string {
  if (!s) return "data não informada";
  const [y, m, d] = s.split("-");
  if (!y || !m) return "data não informada";
  return d ? `${d}/${m}/${y}` : `${m}/${y}`;
}

export default function UnitFichaModal({
  unit, negotiation, lblGrupo, lblUnidade, totalUnits, canManageStatus, useMock, queueSection, isMobile,
  createdByProfileId, onClose, onOpenNegotiation, onStatusChanged,
}: {
  unit: Unidade;
  negotiation: LinkedNegotiation;
  lblGrupo: string; lblUnidade: string;
  totalUnits: number;
  canManageStatus: boolean;
  useMock: boolean;
  queueSection?: ReactNode;
  isMobile: boolean;
  createdByProfileId: string | null;
  onClose: () => void;
  onOpenNegotiation: (negId: string) => void;
  onStatusChanged: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [detail, setDetail] = useState<UnitDetail | null>(null);
  const [detailLoaded, setDetailLoaded] = useState(false);
  const [detailNonce, setDetailNonce] = useState(0);
  const [clientName, setClientName] = useState<string | null>(null);
  const timeline = useUnitTimeline(useMock ? null : unit.id);

  // Estágio interno: ficha | status | sale. `enter` anima a troca (slide+fade).
  type Stage = "ficha" | "status" | "sale";
  const [stage, setStage] = useState<Stage>("ficha");
  const [entering, setEntering] = useState(false);
  const goStage = (next: Stage) => {
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
      .map((s) => ({ value: s, label: CHIP[s].label, color: CHIP[s].c })),
    [unit.status],
  );

  // Animação de abertura (fade+scale) + a11y (foco + Esc/Voltar).
  const [shown, setShown] = useState(false);
  useEffect(() => {
    setShown(true);
    const panel = panelRef.current;
    panel?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { if (stage === "status" || stage === "sale") goStage("ficha"); else onClose(); return; }
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
    if (useMock) { setDetailLoaded(true); return; }
    let alive = true;
    getUnitDetail(unit.id)
      .then((d) => { if (alive) { setDetail(d); setDetailLoaded(true); } })
      .catch(() => { if (alive) { setDetail(null); setDetailLoaded(true); } });
    return () => { alive = false; };
  }, [unit.id, useMock, detailNonce]);

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

  // ── Registrar venda (Modelo B) — estágio interno "sale" ──────────────
  const saleForm = useRegisterSale(() => { onStatusChanged(); void timeline.refetch(); });
  const [buyerId, setBuyerId] = useState("");
  const [clientOpts, setClientOpts] = useState<{ value: string; label: string }[]>([]);
  const [clientsLoaded, setClientsLoaded] = useState(false);
  const [newMode, setNewMode] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [creatingContact, setCreatingContact] = useState(false);
  const [contactErr, setContactErr] = useState<string | null>(null);
  const [amountStr, setAmountStr] = useState("");
  const [dateMode, setDateMode] = useState<"exact" | "month" | "none">("none");
  const [dateExact, setDateExact] = useState("");
  const [dateMonth, setDateMonth] = useState("");

  const buyerName = clientOpts.find((c) => c.value === buyerId)?.label ?? null;
  const amountNum = amountStr === "" ? NaN : Number(amountStr);
  const amountOk = Number.isFinite(amountNum) && amountNum >= 0;
  function computedSaleDate(): string | null {
    if (dateMode === "exact") return dateExact || null;
    if (dateMode === "month") return dateMonth ? `${dateMonth}-01` : null;
    return null;
  }
  const dateResumo = dateMode === "exact" ? (dateExact ? fmtSaleDate(dateExact) : "data —") : dateMode === "month" ? (dateMonth ? fmtSaleDate(`${dateMonth}-01`) : "mês —") : "não informada";

  function openSale() {
    saleForm.reset(); setContactErr(null); setNewMode(false); setNewName(""); setNewPhone("");
    setBuyerId(""); setAmountStr(unit.valor ? String(unit.valor) : "");
    setDateMode("none"); setDateExact(""); setDateMonth("");
    goStage("sale");
    if (!clientsLoaded && !useMock) {
      getClients(unit.accountId)
        .then((list) => { setClientOpts(list.map((c) => ({ value: c.id, label: c.name }))); setClientsLoaded(true); })
        .catch(() => setClientsLoaded(true));
    }
  }

  async function createContact() {
    const name = newName.trim();
    if (name.length < 2) { setContactErr("Informe o nome do contato."); return; }
    setCreatingContact(true); setContactErr(null);
    try {
      const c = await createClient({ accountId: unit.accountId, name, phone: newPhone.trim() || undefined, origin: "manual", qualificationStatus: "converted", createdBy: createdByProfileId ?? undefined });
      setClientOpts((prev) => [{ value: c.id, label: c.name }, ...prev.filter((x) => x.value !== c.id)]);
      setBuyerId(c.id); setNewMode(false); setNewName(""); setNewPhone("");
    } catch (e) {
      setContactErr(e instanceof Error ? e.message : "Falha ao criar contato.");
    } finally { setCreatingContact(false); }
  }

  async function confirmSale() {
    if (!buyerId || !amountOk) return;
    const r = await saleForm.submit(unit.id, buyerId, amountNum, computedSaleDate());
    setDetailNonce((n) => n + 1); // recarrega a seção do banco (comprador incluso)
    if (!r) return; // erro inline (inclui sale_already_registered)
    goStage("ficha");
  }

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

  const saleInfo = detail?.sale ?? null;
  // Venda sem registro: unidade Vendida, sem negociação e sem venda registrada.
  const vendaSemRegistro = unit.status === UnidadeStatus.VENDIDO && !negotiation && !saleInfo && detailLoaded;
  const compradorLabel = saleInfo?.buyerName ?? clientName ?? "Comprador —";

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
                {lblGrupo} {unit.quadra} · {lblUnidade} {unit.lote}{stage === "status" ? <span style={{ color: "var(--text-muted)" }}> · Alterar status</span> : stage === "sale" ? <span style={{ color: "var(--text-muted)" }}> · Registrar venda</span> : null}
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
              <StatusChip status={unit.status} dot />
              <span style={{ color: "var(--text-muted)", fontSize: 14 }}>→</span>
              {destino ? <StatusChip status={destino} dot /> : <span style={{ fontFamily: MONO, fontSize: 10.5, color: "var(--text-disabled)", border: "1px dashed var(--border-default)", borderRadius: 6, padding: "2px 8px" }}>destino</span>}
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
        ) : stage === "sale" ? (
          /* ══ ESTÁGIO INTERNO: REGISTRAR VENDA (Modelo B) ══ */
          <div style={bodyAnim}>
            <button type="button" onClick={() => goStage("ficha")} style={{ background: "transparent", border: "none", color: "var(--text-secondary)", fontSize: 12, cursor: "pointer", padding: "6px 0", marginBottom: 8 }}>← Voltar</button>

            {/* COMPRADOR */}
            <div style={{ marginBottom: 16 }}>
              <Overline>Comprador</Overline>
              {!newMode ? (
                <>
                  <NexaSelect value={buyerId} onChange={(v) => setBuyerId(v)} options={clientOpts} placeholder={clientsLoaded ? "Buscar contato..." : "Carregando contatos..."} searchable ariaLabel="Comprador" />
                  <button type="button" onClick={() => { setNewMode(true); setContactErr(null); }} style={{ background: "transparent", border: "none", color: "var(--color-sprout)", fontSize: 12, fontWeight: 600, cursor: "pointer", padding: "8px 0 0" }}>+ Criar novo contato</button>
                </>
              ) : (
                <div style={{ border: "1px solid var(--border-default)", borderRadius: 8, padding: 12 }}>
                  <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nome do comprador" style={inputStyle} />
                  <input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="Telefone (opcional)" style={{ ...inputStyle, marginTop: 8 }} />
                  {contactErr && <div style={{ fontSize: 12, color: "#F87171", marginTop: 8 }}>{contactErr}</div>}
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 10 }}>
                    <button type="button" onClick={() => { setNewMode(false); setContactErr(null); }} style={{ minHeight: 34, padding: "0 14px", borderRadius: 7, border: "1px solid var(--border-default)", background: "transparent", color: "var(--text-secondary)", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>Cancelar</button>
                    <button type="button" disabled={creatingContact || newName.trim().length < 2} onClick={() => void createContact()} style={{ minHeight: 34, padding: "0 16px", borderRadius: 7, border: "none", background: "var(--color-sprout)", color: "var(--interactive-on-primary, #16150F)", fontSize: 12.5, fontWeight: 700, cursor: creatingContact || newName.trim().length < 2 ? "not-allowed" : "pointer", opacity: creatingContact || newName.trim().length < 2 ? 0.5 : 1 }}>{creatingContact ? "Criando..." : "Criar contato"}</button>
                  </div>
                </div>
              )}
            </div>

            {/* VALOR */}
            <div style={{ marginBottom: 16 }}>
              <Overline>Valor da venda</Overline>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontFamily: MONO, fontSize: 13, color: "var(--text-muted)" }}>R$</span>
                <input type="number" min={0} inputMode="numeric" value={amountStr} onChange={(e) => setAmountStr(e.target.value)} placeholder="0"
                  style={{ ...inputStyle, paddingLeft: 34, fontFamily: MONO }} />
              </div>
            </div>

            {/* DATA DA VENDA — mês/ano OU exata OU não informada */}
            <div style={{ marginBottom: 16 }}>
              <Overline>Data da venda (opcional)</Overline>
              <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
                {([["none", "Não informada"], ["month", "Mês/ano"], ["exact", "Data exata"]] as const).map(([m, lbl]) => (
                  <button key={m} type="button" onClick={() => setDateMode(m)} style={{ minHeight: 32, padding: "0 12px", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer", border: `1px solid ${dateMode === m ? "var(--color-sprout)" : "var(--border-default)"}`, background: dateMode === m ? "rgba(139,157,107,0.12)" : "transparent", color: dateMode === m ? "var(--color-sprout)" : "var(--text-secondary)" }}>{lbl}</button>
                ))}
              </div>
              {dateMode === "month" && <input type="month" value={dateMonth} onChange={(e) => setDateMonth(e.target.value)} style={{ ...inputStyle, fontFamily: MONO }} />}
              {dateMode === "exact" && <input type="date" value={dateExact} onChange={(e) => setDateExact(e.target.value)} style={{ ...inputStyle, fontFamily: MONO }} />}
            </div>

            {/* RESUMO da transição */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", background: "var(--surface-base)", border: "1px solid var(--border-default)", borderRadius: 8, padding: "10px 12px", marginBottom: 16, fontSize: 12.5, color: "var(--text-secondary)" }}>
              <span style={{ fontFamily: MONO, color: "var(--text-muted)" }}>{lblGrupo} {unit.quadra}·{lblUnidade} {unit.lote}</span>
              <StatusChip status={UnidadeStatus.VENDIDO} />
              <span>· {newMode ? (newName.trim() || "novo comprador") : (buyerName ?? "comprador —")}</span>
              <span style={{ fontFamily: MONO }}>· {amountOk ? compactBRL(amountNum) : "—"}</span>
              <span>· {dateResumo}</span>
            </div>

            {saleForm.errorMessage && <div style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: 8, padding: "10px 12px", fontSize: 12.5, color: "#F87171", marginBottom: 14 }}>{saleForm.errorMessage}</div>}

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
              <button type="button" onClick={() => goStage("ficha")} style={{ minHeight: 40, padding: "0 18px", borderRadius: 8, border: "1px solid var(--border-default)", background: "transparent", color: "var(--text-secondary)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancelar</button>
              <button type="button" disabled={saleForm.isSubmitting || !buyerId || !amountOk} onClick={() => void confirmSale()} style={{ minHeight: 40, padding: "0 22px", borderRadius: 8, border: "none", background: "var(--color-sprout)", color: "var(--interactive-on-primary, #16150F)", fontSize: 13, fontWeight: 700, cursor: saleForm.isSubmitting || !buyerId || !amountOk ? "not-allowed" : "pointer", opacity: saleForm.isSubmitting || !buyerId || !amountOk ? 0.5 : 1 }}>{saleForm.isSubmitting ? "Registrando..." : "Confirmar venda"}</button>
            </div>
          </div>
        ) : (
          /* ══ ESTÁGIO FICHA ══ */
          <div style={bodyAnim}>
            {HR}
            {/* NEGOCIAÇÃO / VENDA */}
            <Overline>{!negotiation && saleInfo ? "Venda" : "Negociação"}</Overline>
            {negotiation ? (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  {negotiation.clientId ? (
                    <EntityLink entity="contact" id={negotiation.clientId} style={{ display: "inline-block", maxWidth: 180, fontSize: 14, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", verticalAlign: "bottom" }}>{clientName ?? "Cliente —"}</EntityLink>
                  ) : (
                    <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{clientName ?? "Cliente —"}</span>
                  )}
                  <span style={{ fontFamily: MONO, fontSize: 10.5, fontWeight: 700, color: "var(--text-secondary)", background: "var(--surface-base)", border: "1px solid var(--border-default)", borderRadius: 6, padding: "2px 8px", whiteSpace: "nowrap" }}>{getNegotiationStatusLabel(negotiation.status) ?? negotiation.status}</span>
                </div>
                <button type="button" onClick={() => onOpenNegotiation(negotiation.id)} style={{ background: "transparent", border: "none", color: "var(--color-sprout)", fontSize: 13, fontWeight: 600, cursor: "pointer", padding: 4 }}>{openActionLabel("negotiation")} →</button>
              </div>
            ) : saleInfo ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    {saleInfo.clientId ? (
                      <EntityLink entity="contact" id={saleInfo.clientId} style={{ display: "inline-block", maxWidth: 180, fontSize: 14, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", verticalAlign: "bottom" }}>{compradorLabel}</EntityLink>
                    ) : (
                      <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{compradorLabel}</span>
                    )}
                    {saleInfo.origin === "historical" && <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: "var(--text-muted)", background: "var(--surface-base)", border: "1px solid var(--border-default)", borderRadius: 6, padding: "2px 7px" }}>histórica</span>}
                  </div>
                  {saleInfo.origin === "flow" && saleInfo.negotiationId && (
                    <button type="button" onClick={() => onOpenNegotiation(saleInfo.negotiationId!)} style={{ background: "transparent", border: "none", color: "var(--color-sprout)", fontSize: 13, fontWeight: 600, cursor: "pointer", padding: 4 }}>{openActionLabel("negotiation")} →</button>
                  )}
                </div>
                <div style={{ fontFamily: MONO, fontSize: 11, color: "var(--text-muted)", letterSpacing: "0.03em" }}>{vgvOrDash(saleInfo.amount)} · {fmtSaleDate(saleInfo.saleDate)}</div>
              </div>
            ) : vendaSemRegistro ? (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", border: "1px solid rgba(232,180,90,0.3)", borderRadius: 8, padding: "10px 12px" }}>
                <span style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>Venda sem registro</span>
                {canManageStatus && <button type="button" onClick={openSale} style={{ background: "transparent", border: "none", color: "#E8B45A", fontSize: 12.5, fontWeight: 600, cursor: "pointer", padding: 4 }}>Registrar venda →</button>}
              </div>
            ) : !detailLoaded && unit.status === UnidadeStatus.VENDIDO ? (
              <div className="nexa-skeleton" style={{ height: 14, width: 160, borderRadius: 4 }} />
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
