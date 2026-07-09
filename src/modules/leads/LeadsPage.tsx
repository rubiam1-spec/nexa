import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLeads, type LeadView } from "./useLeads";
import { LEAD_STAGE_META, SEMAPHORE_COLOR } from "./leadDisplay";
import {
  LeadQualificationStatus as S,
  isLeadActive,
  type LeadQualificationStatus as SType,
} from "../../domain/status/leadQualification";
import { CLIENT_SOURCE_LABELS } from "../../shared/types/client";
import { useCelebration, CelebrationToasts } from "../../shared/components/Celebration";

const MONO = "var(--font-mono)";
type Filter = "active" | SType;

export default function LeadsPage() {
  const navigate = useNavigate();
  const { leads, counts, members, loading, error, canAssign, actions } = useLeads();
  const { toasts, celebrate, celebrateError } = useCelebration();

  const [filter, setFilter] = useState<Filter>("active");
  const [search, setSearch] = useState("");
  const [assignTarget, setAssignTarget] = useState<LeadView | null>(null);
  const [discardTarget, setDiscardTarget] = useState<LeadView | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = leads.filter((l) =>
      filter === "active" ? isLeadActive(l.qualification) : l.qualification === filter,
    );
    if (q) list = list.filter((l) =>
      l.client.name.toLowerCase().includes(q) ||
      (l.client.origin ?? "").toLowerCase().includes(q) ||
      (l.client.utmCampaign ?? "").toLowerCase().includes(q) ||
      (l.client.assignedToName ?? "").toLowerCase().includes(q),
    );
    // Não-atendidos no topo; dentro de cada grupo, mais novo primeiro.
    return [...list].sort((a, b) => {
      const aa = a.semaphore.level === "attended" ? 1 : 0;
      const bb = b.semaphore.level === "attended" ? 1 : 0;
      if (aa !== bb) return aa - bb;
      return new Date(b.client.createdAt).getTime() - new Date(a.client.createdAt).getTime();
    });
  }, [leads, filter, search]);

  const chips: { id: Filter; label: string; count: number }[] = [
    { id: "active", label: "Ativos", count: counts.all_active ?? 0 },
    { id: S.NEW, label: "Novos", count: counts[S.NEW] ?? 0 },
    { id: S.IN_SERVICE, label: "Em atendimento", count: counts[S.IN_SERVICE] ?? 0 },
    { id: S.QUALIFIED, label: "Qualificados", count: counts[S.QUALIFIED] ?? 0 },
    { id: S.CONVERTED, label: "Convertidos", count: counts[S.CONVERTED] ?? 0 },
    { id: S.DISCARDED, label: "Descartados", count: counts[S.DISCARDED] ?? 0 },
  ];

  async function run(key: string, fn: () => Promise<unknown>, okMsg: string) {
    setBusy(key);
    try { await fn(); celebrate(okMsg); }
    catch (e) { celebrateError("Falha na ação", e instanceof Error ? e.message : undefined); }
    finally { setBusy(null); }
  }

  async function doConvert(l: LeadView) {
    setBusy(`convert-${l.client.id}`);
    try {
      const negId = await actions.convert(l);
      if (negId) { celebrate("Lead convertido em negociação"); navigate(`/negociacoes/${negId}`); }
      else celebrateError("Não foi possível criar a negociação");
    } catch (e) { celebrateError("Falha ao converter", e instanceof Error ? e.message : undefined); }
    finally { setBusy(null); }
  }

  if (loading) return <div style={{ padding: 24, color: "var(--color-slate)", fontFamily: MONO, fontSize: 12 }}>Carregando leads…</div>;
  if (error) return <div style={{ padding: 24, color: "#F87171", fontSize: 14 }}>Erro: {error}</div>;

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 14 }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 28, fontWeight: 400, color: "var(--color-bone)", margin: 0, lineHeight: 1.1 }}>Leads</h1>
        <p style={{ fontSize: 10.5, color: "var(--color-slate)", margin: "6px 0 0", fontFamily: MONO, letterSpacing: "0.05em" }}>
          {counts.all_active ?? 0} {counts.all_active === 1 ? "lead ativo" : "leads ativos"} · distribuição manual
        </p>
      </div>

      {/* Busca + chips */}
      <div style={{ marginBottom: 12 }}>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome, origem, campanha ou responsável..."
          style={{ width: "100%", maxWidth: 420, background: "var(--surface-raised)", border: "1px solid var(--border-default)", borderRadius: 8, padding: "10px 14px", color: "var(--text-primary)", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
      </div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 16 }}>
        {chips.map((chip) => {
          const active = filter === chip.id;
          const color = chip.id === "active" ? "#9C9686" : LEAD_STAGE_META[chip.id as SType].color;
          return (
            <button key={chip.id} type="button" onClick={() => setFilter(chip.id)}
              style={{ padding: "6px 12px", borderRadius: 8,
                border: active ? `1px solid ${color}55` : "1px solid rgba(42,40,34,0.5)",
                background: active ? `${color}14` : "transparent",
                color: active ? color : "var(--color-fog)",
                fontFamily: MONO, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
              {chip.label} · {chip.count}
            </button>
          );
        })}
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <div style={{ border: "1px dashed var(--border-default)", borderRadius: 12, padding: 28, textAlign: "center", color: "var(--color-clay)", fontSize: 13, fontStyle: "italic" }}>Nenhum lead neste filtro.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {filtered.map((l) => {
            const c = l.client;
            const meta = LEAD_STAGE_META[l.qualification];
            const originLabel = c.origin ? (CLIENT_SOURCE_LABELS[c.origin] ?? c.origin) : "—";
            const canConvertOrWork = l.canWork && isLeadActive(l.qualification);
            return (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "linear-gradient(145deg, var(--surface-raised), var(--surface-base))", border: "1px solid var(--border-default)", borderRadius: 10, flexWrap: "wrap" }}>
                {/* Nome + origem/campanha */}
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name || <span style={{ color: "#706B5F", fontStyle: "italic" }}>Sem nome</span>}</div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 3, flexWrap: "wrap" }}>
                    <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: "#7DA7F4", background: "rgba(125,167,244,0.1)", padding: "2px 6px", borderRadius: 4, textTransform: "uppercase", letterSpacing: "0.04em" }}>{originLabel}</span>
                    {c.utmCampaign ? <span style={{ fontFamily: MONO, fontSize: 10, color: "var(--color-slate)" }}>{c.utmCampaign}</span> : null}
                  </div>
                </div>
                {/* Atribuído */}
                <div style={{ fontFamily: MONO, fontSize: 11, color: "var(--text-muted)", minWidth: 90, maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.assignedToName ?? <span style={{ fontStyle: "italic", color: "#5C5647" }}>sem responsável</span>}</div>
                {/* Semáforo de primeira resposta */}
                <div style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 130 }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: SEMAPHORE_COLOR[l.semaphore.level], flexShrink: 0, animation: l.semaphore.level === "red" ? "cardpulse 2s infinite" : undefined }} />
                  <span style={{ fontFamily: MONO, fontSize: 10, color: SEMAPHORE_COLOR[l.semaphore.level], whiteSpace: "nowrap" }}>{l.semaphore.label}</span>
                </div>
                {/* Estado */}
                <div style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: meta.color, background: meta.soft, padding: "3px 8px", borderRadius: 4, letterSpacing: "0.05em", whiteSpace: "nowrap", textTransform: "uppercase", minWidth: 96, textAlign: "center" }}>{meta.label}</div>
                {/* Ações */}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {canAssign ? <Btn label="Atribuir" onClick={() => setAssignTarget(l)} /> : null}
                  {l.canWork && l.qualification === S.NEW ? <Btn label="Iniciar" cor="#E8B45A" busy={busy === `svc-${c.id}`} onClick={() => run(`svc-${c.id}`, () => actions.startService(l), "Atendimento iniciado")} /> : null}
                  {l.canWork && l.qualification === S.IN_SERVICE ? <Btn label="Qualificar" cor="#4ADE80" busy={busy === `qua-${c.id}`} onClick={() => run(`qua-${c.id}`, () => actions.qualify(l), "Lead qualificado")} /> : null}
                  {canConvertOrWork ? <Btn label="Converter" cor="#34D399" busy={busy === `convert-${c.id}`} onClick={() => doConvert(l)} /> : null}
                  {canConvertOrWork ? <Btn label="Descartar" cor="#F87171" onClick={() => setDiscardTarget(l)} /> : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <CelebrationToasts toasts={toasts} />
      {assignTarget ? (
        <AssignModal lead={assignTarget} members={members} onClose={() => setAssignTarget(null)}
          onPick={async (id, name) => { await run(`assign-${assignTarget.client.id}`, () => actions.assign(assignTarget, id, name), `Atribuído para ${name}`); setAssignTarget(null); }} />
      ) : null}
      {discardTarget ? (
        <DiscardModal lead={discardTarget} onClose={() => setDiscardTarget(null)}
          onConfirm={async (reason) => { await run(`disc-${discardTarget.client.id}`, () => actions.discard(discardTarget, reason), "Lead descartado"); setDiscardTarget(null); }} />
      ) : null}
    </div>
  );
}

function Btn({ label, cor, onClick, busy }: { label: string; cor?: string; onClick: () => void; busy?: boolean }) {
  const c = cor ?? "#9C9686";
  return <button type="button" disabled={busy} onClick={onClick} style={{ fontSize: 11, padding: "6px 10px", minHeight: 32, borderRadius: 6, border: `1px solid ${c}40`, background: `${c}15`, color: c, cursor: busy ? "default" : "pointer", opacity: busy ? 0.5 : 1, whiteSpace: "nowrap" }}>{busy ? "..." : label}</button>;
}

function AssignModal({ lead, members, onClose, onPick }: { lead: LeadView; members: { id: string; name: string; role: string }[]; onClose: () => void; onPick: (id: string, name: string) => void }) {
  const [q, setQ] = useState("");
  const list = members.filter((m) => m.name.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }} onClick={onClose}>
      <div style={{ background: "var(--color-carbon)", border: "1px solid var(--color-stone)", borderRadius: 16, padding: 24, width: "100%", maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--color-bone)", margin: "0 0 4px" }}>Atribuir lead</h2>
        <div style={{ fontSize: 11, color: "var(--color-fog)", marginBottom: 12 }}>{lead.client.name}</div>
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar membro..." style={{ width: "100%", background: "var(--surface-base)", border: "1px solid var(--border-default)", borderRadius: 8, padding: "9px 12px", color: "var(--text-primary)", fontSize: 13, outline: "none", boxSizing: "border-box", marginBottom: 10 }} />
        <div style={{ maxHeight: 260, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
          {list.length === 0 ? <div style={{ fontSize: 12, color: "var(--color-clay)", fontStyle: "italic", padding: 8 }}>Nenhum membro.</div> :
            list.map((m) => (
              <button key={m.id} type="button" onClick={() => onPick(m.id, m.name)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", textAlign: "left", background: "var(--surface-base)", border: "1px solid var(--border-default)", borderRadius: 8, padding: "9px 12px", cursor: "pointer", color: "var(--text-primary)", fontSize: 13 }}>
                <span>{m.name}</span><span style={{ fontFamily: MONO, fontSize: 9, color: "var(--color-slate)", textTransform: "uppercase" }}>{m.role}</span>
              </button>
            ))}
        </div>
        <button type="button" onClick={onClose} style={{ marginTop: 12, width: "100%", padding: 10, borderRadius: 8, border: "1px solid var(--color-stone)", background: "transparent", color: "var(--color-bone)", fontSize: 13, cursor: "pointer" }}>Cancelar</button>
      </div>
    </div>
  );
}

function DiscardModal({ lead, onClose, onConfirm }: { lead: LeadView; onClose: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }} onClick={onClose}>
      <div style={{ background: "var(--color-carbon)", border: "1px solid var(--color-stone)", borderRadius: 16, padding: 24, width: "100%", maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--color-bone)", margin: "0 0 4px" }}>Descartar lead</h2>
        <div style={{ fontSize: 11, color: "var(--color-fog)", marginBottom: 12 }}>{lead.client.name} · o motivo fica na trilha do contato</div>
        <textarea autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motivo do descarte (obrigatório)" rows={3}
          style={{ width: "100%", background: "var(--surface-base)", border: "1px solid var(--border-default)", borderRadius: 8, padding: "9px 12px", color: "var(--text-primary)", fontSize: 13, outline: "none", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit" }} />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
          <button type="button" onClick={onClose} style={{ padding: "9px 16px", borderRadius: 8, border: "1px solid var(--color-stone)", background: "transparent", color: "var(--color-bone)", fontSize: 13, cursor: "pointer" }}>Cancelar</button>
          <button type="button" disabled={!reason.trim()} onClick={() => onConfirm(reason)} style={{ padding: "9px 16px", borderRadius: 8, border: "none", background: reason.trim() ? "#F87171" : "rgba(248,113,113,0.3)", color: "#0F0E0C", fontSize: 13, fontWeight: 700, cursor: reason.trim() ? "pointer" : "default" }}>Descartar</button>
        </div>
      </div>
    </div>
  );
}
