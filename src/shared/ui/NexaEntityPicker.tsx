// NexaEntityPicker — DS v4, camada de SELEÇÃO DE PESSOAS/ENTIDADES (o Atribuir).
// Comportamento aprovado com o Rubiam em protótipo. Linhas acionáveis são
// <button> NATIVOS (o clique NUNCA passa pelo caminho gated-pelo-cmdk — corrige o
// "clique morto" da v3). Motor: match-sorter (fuzzy) + Radix Popover (menu de
// filtros). ZERO regra de negócio: recebe o modelo pronto (buildPickerModel).
import { useMemo, useRef, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { matchSorter } from "match-sorter";
import type { PickerModel, PickerPerson } from "../../modules/leads/assignmentGrouping";

const MONO = "var(--font-mono)";
const SPROUT = "#4ADE80";

type Filter =
  | { kind: "internal"; label: string }
  | { kind: "brokerage"; id: string; label: string }
  | { kind: "autonomos"; label: string };

export interface NexaEntityPickerProps {
  model: PickerModel;
  onPick: (id: string, name: string) => void;
  pendingLabel?: string | null;
  onInvite?: () => void;
  searchPlaceholder?: string;
  autoFocus?: boolean;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

function Avatar({ name }: { name: string }) {
  return (
    <span aria-hidden="true" style={{ flexShrink: 0, width: 30, height: 30, borderRadius: 999, background: "var(--surface-overlay)", color: "var(--text-secondary)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: MONO, fontSize: 11, fontWeight: 700 }}>
      {initials(name)}
    </span>
  );
}

function LoadBadge({ n }: { n: number }) {
  return (
    <span title="Leads ativos já atribuídos" style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: n === 0 ? "var(--color-slate)" : "#E8B45A", whiteSpace: "nowrap", flexShrink: 0 }}>
      {n} ativo{n === 1 ? "" : "s"}
    </span>
  );
}

function PersonRow({ p, onPick }: { p: PickerPerson; onPick: (id: string, name: string) => void }) {
  return (
    <button type="button" data-nexa-picker="person" onClick={() => onPick(p.id, p.name)}
      style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", minHeight: 44, textAlign: "left", background: "transparent", border: "none", borderRadius: 8, padding: "7px 10px", cursor: "pointer", color: "var(--text-primary)" }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-overlay)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
      <Avatar name={p.name} />
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: "block", fontSize: 14.5, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
        {p.subtitle && <span style={{ display: "block", fontSize: 11.5, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.subtitle}</span>}
      </span>
      <LoadBadge n={p.activeLeads} />
    </button>
  );
}

function GroupHeader({ children }: { children: React.ReactNode }) {
  // T2: cabeçalho é <div> — sem hover/clique/foco. Impossível confundir com item.
  return <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-fog)", margin: "12px 6px 4px" }}>{children}</div>;
}

export function NexaEntityPicker({ model, onPick, pendingLabel, onInvite, searchPlaceholder = "Buscar por nome ou imobiliária...", autoFocus }: NexaEntityPickerProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [subOpen, setSubOpen] = useState(false);
  const [subSearch, setSubSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const q = search.trim();

  const allPeople = useMemo(() => {
    const rows: { p: PickerPerson; kind: Filter["kind"]; brokerageId: string | null; hay: string }[] = [];
    for (const p of model.internal) rows.push({ p, kind: "internal", brokerageId: null, hay: p.name });
    for (const b of model.brokerages) for (const p of b.people) rows.push({ p, kind: "brokerage", brokerageId: b.brokerage.id, hay: `${p.name} ${b.brokerage.name}` });
    for (const p of model.autonomos) rows.push({ p, kind: "autonomos", brokerageId: null, hay: p.name });
    return rows;
  }, [model]);

  // Lei do escopo (d): com filtro, procura só dentro do filtro; sem filtro, em tudo.
  const scoped = useMemo(() => {
    if (!filter) return allPeople;
    if (filter.kind === "internal") return allPeople.filter((r) => r.kind === "internal");
    if (filter.kind === "autonomos") return allPeople.filter((r) => r.kind === "autonomos");
    return allPeople.filter((r) => r.kind === "brokerage" && r.brokerageId === filter.id);
  }, [allPeople, filter]);

  const results = useMemo(() => {
    if (!q) return scoped;
    const keys = filter ? ["p.name"] : ["hay"]; // com filtro, casa só por nome; sem filtro, nome+imobiliária
    return matchSorter(scoped, q, { keys });
  }, [scoped, q, filter]);

  // Sugestão inteligente (e): sem filtro de imobiliária + termo 3+ casa imobiliária ATIVA.
  const suggestion = useMemo(() => {
    if (filter || q.length < 3) return null;
    const hit = matchSorter(model.brokerages, q, { keys: ["brokerage.name"] })[0];
    return hit ? hit.brokerage : null;
  }, [filter, q, model.brokerages]);

  const showGrouped = !filter && !q;

  const applyBrokerageFilter = (id: string, name: string) => { setFilter({ kind: "brokerage", id, label: `Imobiliária: ${name}` }); setSearch(""); setFiltersOpen(false); setSubOpen(false); inputRef.current?.focus(); };
  const removeFilter = () => { setFilter(null); inputRef.current?.focus(); };

  const subBrokerages = useMemo(() => {
    const active = model.brokerages.map((b) => b.brokerage);
    const list = subSearch.trim() ? matchSorter([...active, ...model.inactiveBrokerages], subSearch.trim(), { keys: ["name"] }) : [...active, ...model.inactiveBrokerages].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    return list;
  }, [model.brokerages, model.inactiveBrokerages, subSearch]);

  return (
    <div data-nexa-picker="root"
      onKeyDown={(e) => { if (e.key === "Escape" && filter) { e.preventDefault(); e.stopPropagation(); removeFilter(); } }}
      style={{ display: "flex", flexDirection: "column", minHeight: 0, flex: 1 }}>
      {/* a. Barra: busca + botão Filtros */}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input ref={inputRef} autoFocus={autoFocus} value={search} onChange={(e) => setSearch(e.target.value)} placeholder={searchPlaceholder}
          style={{ flex: 1, minWidth: 0, background: "var(--surface-base)", border: "1px solid var(--border-default)", borderRadius: 8, padding: "9px 12px", color: "var(--text-primary)", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
        <Popover.Root open={filtersOpen} onOpenChange={setFiltersOpen}>
          <Popover.Trigger asChild>
            <button type="button" data-nexa-picker="filters-btn"
              style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, background: filter ? "rgba(74,222,128,0.12)" : "var(--surface-base)", border: `1px solid ${filter ? "rgba(74,222,128,0.4)" : "var(--border-default)"}`, borderRadius: 8, padding: "9px 12px", color: filter ? SPROUT : "var(--text-secondary)", fontSize: 12, cursor: "pointer" }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M1 2h10M3 6h6M5 10h2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
              Filtros
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content align="end" sideOffset={6} className="nexa-select-content" style={{ minWidth: 240, padding: 6 }}>
              <button type="button" onClick={() => { setFilter({ kind: "internal", label: "Equipe interna" }); setFiltersOpen(false); }} style={menuItem}>
                Equipe interna <span style={countStyle}>{model.internal.length}</span>
              </button>
              <button type="button" data-nexa-picker="sub-imob" onClick={() => setSubOpen((s) => !s)} style={menuItem}>
                Imobiliárias <span style={{ marginLeft: "auto", color: "var(--text-muted)" }}>{subOpen ? "▾" : "→"}</span>
              </button>
              {subOpen && (
                <div style={{ maxHeight: 240, overflowY: "auto", borderTop: "1px solid var(--border-default)", borderBottom: "1px solid var(--border-default)", margin: "4px 0", padding: "6px 0" }}>
                  <input value={subSearch} onChange={(e) => setSubSearch(e.target.value)} placeholder="Buscar imobiliária..." autoFocus
                    style={{ width: "calc(100% - 12px)", margin: "0 6px 6px", background: "var(--surface-base)", border: "1px solid var(--border-default)", borderRadius: 6, padding: "6px 10px", color: "var(--text-primary)", fontSize: 12, outline: "none", boxSizing: "border-box" }} />
                  {subBrokerages.map((b) => b.activeCount > 0 ? (
                    <button key={b.id} type="button" onClick={() => applyBrokerageFilter(b.id, b.name)} style={{ ...menuItem, fontSize: 12.5 }}>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.name}</span>
                      <span style={countStyle}>{b.activeCount}</span>
                    </button>
                  ) : (
                    <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 10px", fontSize: 12.5, color: "var(--text-disabled)", opacity: 0.5, cursor: "not-allowed" }}>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.name}</span>
                      <span style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 9 }}>· sem ativos</span>
                    </div>
                  ))}
                </div>
              )}
              <button type="button" onClick={() => { setFilter({ kind: "autonomos", label: "Autônomos" }); setFiltersOpen(false); }} style={menuItem}>
                Autônomos <span style={countStyle}>{model.autonomos.length}</span>
              </button>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      </div>

      {/* c. Token do filtro aplicado */}
      {filter && (
        <div style={{ marginTop: 8 }}>
          <span data-nexa-picker="token" style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(74,222,128,0.12)", border: "1px solid rgba(74,222,128,0.35)", borderRadius: 999, padding: "3px 6px 3px 10px", fontSize: 11.5, color: SPROUT }}>
            {filter.label}
            <button type="button" aria-label="Remover filtro" onClick={removeFilter} style={{ background: "none", border: "none", color: SPROUT, cursor: "pointer", fontSize: 14, lineHeight: 1, padding: "0 2px" }}>×</button>
          </span>
        </div>
      )}

      {/* Lista */}
      <div style={{ overflowY: "auto", marginTop: 8, flex: 1, minHeight: 0 }}>
        {/* e. Sugestão inteligente */}
        {suggestion && (
          <button type="button" data-nexa-picker="suggestion" onClick={() => applyBrokerageFilter(suggestion.id, suggestion.name)}
            style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", background: "transparent", border: "1px dashed rgba(74,222,128,0.5)", borderRadius: 8, padding: "9px 12px", cursor: "pointer", color: SPROUT, fontSize: 12.5, marginBottom: 6 }}>
            <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", opacity: 0.8 }}>FILTRO</span>
            <span>· Filtrar pela imobiliária {suggestion.name}</span>
          </button>
        )}

        {showGrouped ? (
          <>
            {model.internal.length > 0 && <><GroupHeader>Equipe interna</GroupHeader>{model.internal.map((p) => <PersonRow key={p.id} p={p} onPick={onPick} />)}</>}
            {model.brokerages.map((b) => (
              <div key={b.brokerage.id}><GroupHeader>{b.brokerage.name}</GroupHeader>{b.people.map((p) => <PersonRow key={p.id} p={p} onPick={onPick} />)}</div>
            ))}
            {model.autonomos.length > 0 && <><GroupHeader>Autônomos</GroupHeader>{model.autonomos.map((p) => <PersonRow key={p.id} p={p} onPick={onPick} />)}</>}
          </>
        ) : results.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column" }}>{results.map((r) => <PersonRow key={r.p.id} p={r.p} onPick={onPick} />)}</div>
        ) : (
          <div style={{ padding: "18px 10px", color: "var(--text-muted)", fontSize: 12, textAlign: "center" }}>
            Nenhum resultado{q ? ` para “${q}”` : ""}{filter ? ` em ${filter.label}` : ""}.
          </div>
        )}
      </div>

      {/* h. Rodapé */}
      {pendingLabel && (
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--border-default)" }}>
          <span style={{ fontSize: 11, color: "var(--color-fog)", flex: 1, minWidth: 0 }}>{pendingLabel}</span>
          {onInvite && <button type="button" onClick={onInvite} style={{ background: "none", border: "none", color: SPROUT, fontSize: 11, fontWeight: 600, cursor: "pointer", padding: 0, whiteSpace: "nowrap" }}>Convidar →</button>}
        </div>
      )}
    </div>
  );
}

const menuItem: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", background: "transparent", border: "none", borderRadius: 6, padding: "8px 10px", cursor: "pointer", color: "var(--text-primary)", fontSize: 13 };
const countStyle: React.CSSProperties = { marginLeft: "auto", fontFamily: MONO, fontSize: 10, color: "var(--text-muted)" };

export default NexaEntityPicker;
