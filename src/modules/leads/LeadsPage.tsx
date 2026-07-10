import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useLeads, type LeadView } from "./useLeads";
import { LEAD_STAGE_META, SEMAPHORE_COLOR } from "./leadDisplay";
import {
  LeadQualificationStatus as S,
  isLeadActive,
  type LeadQualificationStatus as SType,
} from "../../domain/status/leadQualification";
import { CLIENT_SOURCE_LABELS } from "../../shared/types/client";
import { groupAssignableMembers, brokerageOptions, type AssignableMember } from "./assignmentGrouping";
import { useCelebration, CelebrationToasts } from "../../shared/components/Celebration";

const MONO = "var(--font-mono)";
type Filter = "active" | SType;

export default function LeadsPage() {
  const navigate = useNavigate();
  const [qp] = useSearchParams();
  const { leads, counts, members, loading, error, canAssign, actions } = useLeads();
  const { toasts, celebrate, celebrateError } = useCelebration();

  const [filter, setFilterState] = useState<Filter>("active");
  // Busca focada quando aberto via atalho de Contatos (/leads?q=Nome).
  const [search, setSearch] = useState(qp.get("q") ?? "");
  const [assignTarget, setAssignTarget] = useState<LeadView | null>(null);
  const [discardTarget, setDiscardTarget] = useState<LeadView | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  // Regra 8: nada some sem explicar. Lead que uma ação acabou de mover é mantido
  // visível com destaque + nota "para onde foi" até a próxima interação (troca de chip).
  const [recentNote, setRecentNote] = useState<Record<string, string>>({});
  const setFilter = (f: Filter) => { setRecentNote({}); setFilterState(f); };
  const markMoved = (clientId: string, note: string) => setRecentNote((r) => ({ ...r, [clientId]: note }));

  const matchesSearch = (l: LeadView, q: string) =>
    l.client.name.toLowerCase().includes(q) ||
    (l.client.origin ?? "").toLowerCase().includes(q) ||
    (l.client.utmCampaign ?? "").toLowerCase().includes(q) ||
    (l.client.assignedToName ?? "").toLowerCase().includes(q);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const inChip = (l: LeadView) => (filter === "active" ? isLeadActive(l.qualification) : l.qualification === filter);
    const base = leads.filter((l) => inChip(l) && (!q || matchesSearch(l, q)));
    // Não-atendidos no topo; dentro de cada grupo, mais novo primeiro.
    base.sort((a, b) => {
      const aa = a.semaphore.level === "attended" ? 1 : 0;
      const bb = b.semaphore.level === "attended" ? 1 : 0;
      if (aa !== bb) return aa - bb;
      return new Date(b.client.createdAt).getTime() - new Date(a.client.createdAt).getTime();
    });
    // Mantidos visíveis: leads que uma ação recém-moveu para FORA deste chip.
    const baseIds = new Set(base.map((l) => l.client.id));
    const kept = leads.filter((l) => recentNote[l.client.id] && !baseIds.has(l.client.id) && (!q || matchesSearch(l, q)));
    return [...kept, ...base];
  }, [leads, filter, search, recentNote]);

  const chips: { id: Filter; label: string; count: number }[] = [
    { id: "active", label: "Ativos", count: counts.all_active ?? 0 },
    { id: S.NEW, label: "Novos", count: counts[S.NEW] ?? 0 },
    { id: S.IN_SERVICE, label: "Em atendimento", count: counts[S.IN_SERVICE] ?? 0 },
    { id: S.QUALIFIED, label: "Qualificados", count: counts[S.QUALIFIED] ?? 0 },
    { id: S.CONVERTED, label: "Convertidos", count: counts[S.CONVERTED] ?? 0 },
    { id: S.DISCARDED, label: "Descartados", count: counts[S.DISCARDED] ?? 0 },
  ];

  async function run(key: string, fn: () => Promise<unknown>, okMsg: string, moved?: { id: string; note: string }) {
    setBusy(key);
    try { await fn(); celebrate(okMsg); if (moved) markMoved(moved.id, moved.note); }
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
            const movedNote = recentNote[c.id];
            return (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "linear-gradient(145deg, var(--surface-raised), var(--surface-base))", border: `1px solid ${movedNote ? "var(--color-sprout)" : "var(--border-default)"}`, boxShadow: movedNote ? "0 0 0 1px var(--color-sprout) inset" : undefined, borderRadius: 10, flexWrap: "wrap", transition: "border-color 240ms ease, box-shadow 240ms ease" }}>
                {/* Nome + origem/campanha */}
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name || <span style={{ color: "#706B5F", fontStyle: "italic" }}>Sem nome</span>}</div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 3, flexWrap: "wrap" }}>
                    <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: "#7DA7F4", background: "rgba(125,167,244,0.1)", padding: "2px 6px", borderRadius: 4, textTransform: "uppercase", letterSpacing: "0.04em" }}>{originLabel}</span>
                    {c.utmCampaign ? <span style={{ fontFamily: MONO, fontSize: 10, color: "var(--color-slate)" }}>{c.utmCampaign}</span> : null}
                    {movedNote ? <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: "var(--color-sprout)", background: "rgba(74,222,128,0.12)", padding: "2px 6px", borderRadius: 4 }}>✓ {movedNote}</span> : null}
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
                  {l.canWork && l.qualification === S.NEW ? <Btn label="Iniciar" cor="#E8B45A" busy={busy === `svc-${c.id}`} onClick={() => run(`svc-${c.id}`, () => actions.startService(l), "Atendimento iniciado ✓", { id: c.id, note: "movido para Em atendimento" })} /> : null}
                  {l.canWork && l.qualification === S.IN_SERVICE ? <Btn label="Qualificar" cor="#4ADE80" busy={busy === `qua-${c.id}`} onClick={() => run(`qua-${c.id}`, () => actions.qualify(l), "Lead qualificado ✓", { id: c.id, note: "movido para Qualificados" })} /> : null}
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
          onPick={async (id, name) => { const t = assignTarget; setAssignTarget(null); await run(`assign-${t.client.id}`, () => actions.assign(t, id, name), `Lead atribuído a ${name} ✓`, { id: t.client.id, note: `Atribuído a ${name}` }); }} />
      ) : null}
      {discardTarget ? (
        <DiscardModal lead={discardTarget} onClose={() => setDiscardTarget(null)}
          onConfirm={async (reason) => { const t = discardTarget; setDiscardTarget(null); await run(`disc-${t.client.id}`, () => actions.discard(t, reason), "Descartado — ver em Descartados", { id: t.client.id, note: "Descartado — ver em Descartados" }); }} />
      ) : null}
    </div>
  );
}

function Btn({ label, cor, onClick, busy }: { label: string; cor?: string; onClick: () => void; busy?: boolean }) {
  const c = cor ?? "#9C9686";
  return <button type="button" disabled={busy} onClick={onClick} style={{ fontSize: 11, padding: "6px 10px", minHeight: 32, borderRadius: 6, border: `1px solid ${c}40`, background: `${c}15`, color: c, cursor: busy ? "default" : "pointer", opacity: busy ? 0.5 : 1, whiteSpace: "nowrap" }}>{busy ? "..." : label}</button>;
}

const ROLE_LABEL: Record<string, string> = {
  manager: "Gestor(a)", commercial_consultant: "Consultor(a)", broker: "Corretor(a)",
  director: "Diretor(a)", concierge: "Concierge", administrative: "Administrativo",
};

function LoadBadge({ n }: { n: number }) {
  const strong = n >= 8;
  return (
    <span title="Leads ativos já atribuídos" style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: n === 0 ? "var(--color-slate)" : strong ? "#F87171" : "#E8B45A", background: n === 0 ? "transparent" : strong ? "rgba(248,113,113,0.12)" : "rgba(232,180,90,0.12)", padding: "2px 7px", borderRadius: 999, whiteSpace: "nowrap", flexShrink: 0 }}>
      {n} ativo{n === 1 ? "" : "s"}
    </span>
  );
}

function MemberRow({ m, subtitle, onPick }: { m: AssignableMember; subtitle: string; onPick: (id: string, name: string) => void }) {
  return (
    <button type="button" onClick={() => onPick(m.id, m.name)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, width: "100%", textAlign: "left", background: "var(--surface-base)", border: "1px solid var(--border-default)", borderRadius: 8, padding: "9px 12px", cursor: "pointer", color: "var(--text-primary)", fontSize: 13 }}>
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</span>
        <span style={{ fontFamily: MONO, fontSize: 9, color: "var(--color-slate)" }}>{subtitle}</span>
      </span>
      <LoadBadge n={m.activeLeads} />
    </button>
  );
}

function GroupTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-fog)", margin: "12px 2px 6px" }}>{children}</div>;
}

function AssignModal({ lead, members, onClose, onPick }: { lead: LeadView; members: AssignableMember[]; onClose: () => void; onPick: (id: string, name: string) => void }) {
  const [q, setQ] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [brokerageFilter, setBrokerageFilter] = useState<string | null>(null); // null = Todas
  const query = q.trim().toLowerCase();

  const grouped = useMemo(() => groupAssignableMembers(members, showAll), [members, showAll]);
  const brokerageOpts = useMemo(() => brokerageOptions(grouped), [grouped]);

  // Busca global: varre TODOS os membros por nome, ignorando grupo/filtro de imobiliária.
  const searchHits = useMemo(
    () => (query ? members.filter((m) => m.name.toLowerCase().includes(query)) : []),
    [members, query],
  );

  const visibleBrokerages = grouped.brokerages.filter(
    (g) => brokerageFilter === null || (g.brokerageId ?? "__independentes__") === brokerageFilter,
  );

  const SUB_INTERNAL = (m: AssignableMember) => ROLE_LABEL[m.role] ?? m.role;
  const SUB_BROKER = (m: AssignableMember) => m.brokerageName ?? "Independente";

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }} onClick={onClose}>
      <div style={{ background: "var(--color-carbon)", border: "1px solid var(--color-stone)", borderRadius: 16, padding: 24, width: "100%", maxWidth: 440, maxHeight: "84vh", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--color-bone)", margin: "0 0 2px" }}>Atribuir lead</h2>
        <div style={{ fontSize: 11, color: "var(--color-fog)", marginBottom: 12 }}>{lead.client.name} · a carga (leads ativos) ajuda a distribuir com justiça</div>
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome (varre todos)..." style={{ width: "100%", background: "var(--surface-base)", border: "1px solid var(--border-default)", borderRadius: 8, padding: "9px 12px", color: "var(--text-primary)", fontSize: 13, outline: "none", boxSizing: "border-box" }} />

        <div style={{ overflowY: "auto", marginTop: 4, flex: 1 }}>
          {query ? (
            // Modo busca: resultados planos por nome, ignorando grupos/filtro.
            <>
              <GroupTitle>Resultados</GroupTitle>
              {searchHits.length === 0 ? <div style={{ fontSize: 12, color: "var(--color-clay)", fontStyle: "italic", padding: 8 }}>Nenhum membro.</div> :
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {searchHits.map((m) => <MemberRow key={m.id} m={m} subtitle={m.role === "broker" ? SUB_BROKER(m) : SUB_INTERNAL(m)} onPick={onPick} />)}
                </div>}
            </>
          ) : (
            <>
              {/* Grupo 1 — Equipe interna */}
              <GroupTitle>Equipe interna</GroupTitle>
              {grouped.internal.length === 0 ? <div style={{ fontSize: 12, color: "var(--color-clay)", fontStyle: "italic", padding: 8 }}>Ninguém elegível.</div> :
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {grouped.internal.map((m) => <MemberRow key={m.id} m={m} subtitle={SUB_INTERNAL(m)} onPick={onPick} />)}
                </div>}
              {grouped.hiddenCount > 0 && (
                <button type="button" onClick={() => setShowAll(true)} style={{ background: "none", border: "none", color: "var(--color-sprout)", fontSize: 11, cursor: "pointer", padding: "6px 2px" }}>
                  mostrar todos os papéis (+{grouped.hiddenCount})
                </button>
              )}

              {/* Grupo 2 — Corretores, com seletor de imobiliária */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, margin: "12px 2px 6px" }}>
                <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-fog)" }}>Corretores</span>
                {grouped.brokerages.length > 0 && (
                  <select value={brokerageFilter ?? ""} onChange={(e) => setBrokerageFilter(e.target.value || null)} style={{ background: "var(--surface-base)", border: "1px solid var(--border-default)", borderRadius: 6, color: "var(--text-primary)", fontSize: 11, padding: "4px 8px", outline: "none", cursor: "pointer", maxWidth: 180 }}>
                    {brokerageOpts.map((o) => <option key={o.id ?? "all"} value={o.id ?? ""}>{o.label}</option>)}
                  </select>
                )}
              </div>
              {grouped.brokerages.length === 0 ? <div style={{ fontSize: 12, color: "var(--color-clay)", fontStyle: "italic", padding: 8 }}>Nenhum corretor com acesso.</div> :
                visibleBrokerages.map((g) => (
                  <div key={g.brokerageId ?? "indep"} style={{ marginBottom: 6 }}>
                    <div style={{ fontFamily: MONO, fontSize: 9, color: "var(--color-slate)", margin: "4px 2px" }}>{g.brokerageName}</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {g.brokers.map((m) => <MemberRow key={m.id} m={m} subtitle={SUB_BROKER(m)} onPick={onPick} />)}
                    </div>
                  </div>
                ))}
            </>
          )}
        </div>

        <button type="button" onClick={onClose} style={{ marginTop: 12, width: "100%", padding: 10, borderRadius: 8, border: "1px solid var(--color-stone)", background: "transparent", color: "var(--color-bone)", fontSize: 13, cursor: "pointer", flexShrink: 0 }}>Cancelar</button>
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
