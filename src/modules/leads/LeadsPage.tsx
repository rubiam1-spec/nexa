import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useLeads, type LeadView } from "./useLeads";
import LeadCard from "./LeadCard";
import { LEAD_STAGE_META } from "./leadDisplay";
import {
  LeadQualificationStatus as S,
  isLeadActive,
  type LeadQualificationStatus as SType,
} from "../../domain/status/leadQualification";
import { AssignModal, DiscardModal } from "./LeadActionModals";
import { NexaSelect } from "../../shared/ui/NexaSelect";
import { useCelebration, CelebrationToasts } from "../../shared/components/Celebration";

const MONO = "var(--font-mono)";
type Filter = "active" | SType;

export default function LeadsPage() {
  const navigate = useNavigate();
  const [qp] = useSearchParams();
  const { leads, counts, members, campaigns, brokerageDirectory, pendingBrokers, loading, error, canAssign, actions } = useLeads();
  const { toasts, celebrate, celebrateError } = useCelebration();

  const [filter, setFilterState] = useState<Filter>("active");
  const [campaignFilter, setCampaignFilter] = useState<string>(""); // "" = todas
  const campaignName = useMemo(() => new Map(campaigns.map((c) => [c.id, c.name])), [campaigns]);
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
    const inCampaign = (l: LeadView) => !campaignFilter || l.client.campaignId === campaignFilter;
    const base = leads.filter((l) => inChip(l) && inCampaign(l) && (!q || matchesSearch(l, q)));
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
  }, [leads, filter, search, campaignFilter, recentNote]);

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

      {/* Busca + filtro de campanha + chips */}
      <div style={{ marginBottom: 12, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome, origem, campanha ou responsável..."
          style={{ flex: 1, minWidth: 220, maxWidth: 420, background: "var(--surface-raised)", border: "1px solid var(--border-default)", borderRadius: 8, padding: "10px 14px", color: "var(--text-primary)", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
        {campaigns.length > 0 && (
          <div style={{ width: 220 }}>
            <NexaSelect
              ariaLabel="Filtrar por campanha"
              value={campaignFilter}
              onChange={(v) => setCampaignFilter(v)}
              placeholder="Todas as campanhas"
              options={[{ value: "", label: "Todas as campanhas" }, ...campaigns.map((c) => ({ value: c.id, label: c.name }))]}
            />
          </div>
        )}
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
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {filtered.map((l) => {
            const c = l.client;
            return (
              <LeadCard key={c.id} lead={l} canAssign={canAssign} busy={!!busy && busy.endsWith(c.id)} movedNote={recentNote[c.id]} campaignLabel={l.client.campaignId ? campaignName.get(l.client.campaignId) : undefined}
                actions={{
                  onAssign: () => setAssignTarget(l),
                  onStart: () => run(`svc-${c.id}`, () => actions.startService(l), "Atendimento iniciado ✓", { id: c.id, note: "movido para Em atendimento" }),
                  onQualify: () => run(`qua-${c.id}`, () => actions.qualify(l), "Lead qualificado ✓", { id: c.id, note: "movido para Qualificados" }),
                  onConvert: () => doConvert(l),
                  onDiscard: () => setDiscardTarget(l),
                }} />
            );
          })}
        </div>
      )}

      <CelebrationToasts toasts={toasts} />
      {assignTarget ? (
        <AssignModal lead={assignTarget} members={members} brokerageDirectory={brokerageDirectory} pendingBrokers={pendingBrokers} onClose={() => setAssignTarget(null)}
          onInvite={() => navigate("/corretores")}
          onPick={async (id, name) => { const t = assignTarget; setAssignTarget(null); await run(`assign-${t.client.id}`, () => actions.assign(t, id, name), `Lead atribuído a ${name} ✓`, { id: t.client.id, note: `Atribuído a ${name}` }); }} />
      ) : null}
      {discardTarget ? (
        <DiscardModal lead={discardTarget} onClose={() => setDiscardTarget(null)}
          onConfirm={async (reason) => { const t = discardTarget; setDiscardTarget(null); await run(`disc-${t.client.id}`, () => actions.discard(t, reason), "Descartado — ver em Descartados", { id: t.client.id, note: "Descartado — ver em Descartados" }); }} />
      ) : null}
    </div>
  );
}

