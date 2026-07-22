// L1.8 — LeadCard COMPARTILHADO entre a tela /leads e as colunas de lead do Kanban.
// Presentacional (zero lógica de dados): 3 linhas + ações. Toda a orquestração
// (busy, toast, modais, patch otimista) fica no pai, que alimenta via useLeads —
// por isso as contagens são idênticas em /leads e no Kanban por construção.
import type { LeadView } from "./useLeads";
import { LEAD_STAGE_META, SEMAPHORE_COLOR } from "./leadDisplay";
import { LeadQualificationStatus as S, isLeadActive } from "../../domain/status/leadQualification";
import { CLIENT_SOURCE_LABELS } from "../../shared/types/client";
import { useScreen } from "../../shared/hooks/useIsMobile";
import { MOBILE_SMALL_BP } from "../../shared/mobile";
import { EntityLink } from "../../shared/navigation/EntityLink";

const MONO = "var(--font-mono)";

function fmtNext(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) + " " +
    d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export type LeadCardActions = {
  onAssign: () => void;
  onStart: () => void;
  onQualify: () => void;
  onConvert: () => void;
  onDiscard: () => void;
};

export default function LeadCard({ lead, canAssign, busy, movedNote, campaignLabel, actions }: {
  lead: LeadView;
  canAssign: boolean;
  busy: boolean;
  movedNote?: string;
  campaignLabel?: string;
  actions: LeadCardActions;
}) {
  const isNarrow = useScreen().width < MOBILE_SMALL_BP; // < 400: ações em grid 2×2
  const c = lead.client;
  const meta = LEAD_STAGE_META[lead.qualification];
  const originLabel = c.origin ? (CLIENT_SOURCE_LABELS[c.origin] ?? c.origin) : "—";
  const canConvertOrWork = lead.canWork && isLeadActive(lead.qualification);
  const nextAction = c.nextFollowUpAt;

  return (
    <div style={{ background: movedNote ? "rgba(74,222,128,0.05)" : "linear-gradient(145deg, var(--surface-raised), var(--surface-base))", border: `1px solid ${movedNote ? "var(--color-sprout)" : "var(--border-default)"}`, boxShadow: movedNote ? "0 0 0 1px var(--color-sprout) inset" : undefined, borderRadius: 10, padding: 11, transition: "border-color 240ms ease, box-shadow 240ms ease" }}>
      {/* Corpo do card (exceto botões) → casa do Contato (Lei 2). Bloco: sem
          sublinhado, só cursor; no toque navega, os botões abaixo agem. */}
      <EntityLink entity="contact" id={c.id} underline={false} title="Abrir contato" style={{ display: "block", color: "inherit" }}>
      {/* Linha 1: nome + origem/campanha (+ nota "movido") */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>{c.name || <span style={{ color: "#706B5F", fontStyle: "italic" }}>Sem nome</span>}</span>
        <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: meta.color, background: meta.soft, padding: "2px 6px", borderRadius: 4, textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>{meta.label}</span>
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 3, flexWrap: "wrap" }}>
        <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: "#7DA7F4", background: "rgba(125,167,244,0.1)", padding: "2px 6px", borderRadius: 4, textTransform: "uppercase" }}>{originLabel}</span>
        {campaignLabel ? <span title="Campanha" style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: "#4ADE80", background: "rgba(74,222,128,0.12)", padding: "2px 6px", borderRadius: 4, maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{campaignLabel}</span> : null}
        {c.utmCampaign ? <span style={{ fontFamily: MONO, fontSize: 10, color: "var(--color-slate)" }}>{c.utmCampaign}</span> : null}
        {movedNote ? <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: "var(--color-sprout)", background: "rgba(74,222,128,0.12)", padding: "2px 6px", borderRadius: 4 }}>✓ {movedNote}</span> : null}
      </div>
      {/* Linha 2: responsável */}
      <div style={{ fontFamily: MONO, fontSize: 11, color: "var(--text-muted)", marginTop: 5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.assignedToName ?? <span style={{ fontStyle: "italic", color: "#5C5647" }}>sem responsável</span>}</div>
      {/* Linha 3: próxima ação agendada OU semáforo de 1ª resposta */}
      {nextAction ? (
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 4 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#7DA7F4", flexShrink: 0 }} />
          <span style={{ fontFamily: MONO, fontSize: 10, color: "#7DA7F4", whiteSpace: "nowrap" }}>Próx: {fmtNext(nextAction)}</span>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 4 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: SEMAPHORE_COLOR[lead.semaphore.level], flexShrink: 0, animation: lead.semaphore.level === "red" ? "cardpulse 2s infinite" : undefined }} />
          <span style={{ fontFamily: MONO, fontSize: 10, color: SEMAPHORE_COLOR[lead.semaphore.level], whiteSpace: "nowrap" }}>{lead.semaphore.label}</span>
        </div>
      )}
      </EntityLink>
      {/* Ações — <400px: grid 2×2 (botões full-width, alvo ≥44px) */}
      <div style={{ display: isNarrow ? "grid" : "flex", gridTemplateColumns: isNarrow ? "1fr 1fr" : undefined, gap: 6, flexWrap: isNarrow ? undefined : "wrap", marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(61,58,48,0.12)" }}>
        {canAssign ? <Btn label="Atribuir" busy={busy} full={isNarrow} onClick={actions.onAssign} /> : null}
        {lead.canWork && lead.qualification === S.NEW ? <Btn label="Iniciar" cor="#E8B45A" busy={busy} full={isNarrow} onClick={actions.onStart} /> : null}
        {lead.canWork && lead.qualification === S.IN_SERVICE ? <Btn label="Qualificar" cor="#4ADE80" busy={busy} full={isNarrow} onClick={actions.onQualify} /> : null}
        {canConvertOrWork ? <Btn label="Converter" cor="#34D399" busy={busy} full={isNarrow} onClick={actions.onConvert} /> : null}
        {canConvertOrWork ? <Btn label="Descartar" cor="#F87171" busy={busy} full={isNarrow} onClick={actions.onDiscard} /> : null}
      </div>
      {/* Ação explícita (paridade com "abrir ficha →" das negociações) */}
      <div style={{ marginTop: 6, textAlign: "right" }}>
        <EntityLink entity="contact" id={c.id} style={{ fontFamily: MONO, fontSize: 11, fontWeight: 600, color: "var(--color-sprout)" }}>abrir contato →</EntityLink>
      </div>
    </div>
  );
}

function Btn({ label, cor, onClick, busy, full }: { label: string; cor?: string; onClick: () => void; busy?: boolean; full?: boolean }) {
  const col = cor ?? "#9C9686";
  return <button type="button" disabled={busy} onClick={onClick} style={{ fontSize: 12, padding: "0 12px", minHeight: 44, width: full ? "100%" : undefined, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 8, border: `1px solid ${col}40`, background: `${col}15`, color: col, cursor: busy ? "default" : "pointer", opacity: busy ? 0.5 : 1, whiteSpace: "nowrap" }}>{label}</button>;
}
