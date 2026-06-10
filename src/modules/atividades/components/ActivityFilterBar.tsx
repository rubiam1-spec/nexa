import { useEffect, useRef, useState } from "react";
import ParticipantAvatar from "./ParticipantAvatar";

export type TypeOption = { key: string; label: string; color: string };

const T = {
  stone: "var(--border-default)", chalk: "var(--text-primary)", bone: "var(--text-secondary)",
  fog: "var(--text-muted)", slate: "var(--text-disabled)", sprout: "var(--interactive-primary)",
  carbon: "var(--surface-raised)", ink: "var(--surface-base)",
};
const MONO = "var(--font-mono)";
const PERIOD_LABELS: Record<string, string> = { today: "Hoje", week: "Esta semana", month: "Este mês", all: "Tudo", custom: "Personalizado" };

interface Props {
  view: "kanban" | "list";
  isMobile: boolean;
  // busca (separada do filtro)
  search: string;
  setSearch: (v: string) => void;
  searchRef: React.RefObject<HTMLInputElement | null>;
  // tipo (multi)
  typeOptions: TypeOption[];
  typeFilter: string[];
  setTypeFilter: (fn: (p: string[]) => string[]) => void;
  // responsável (single — preserva a lógica atual)
  owners: { id: string; name: string }[];
  ownerFilter: string;
  setOwnerFilter: (v: string) => void;
  showOwner: boolean;
  // período
  preset: string;
  setPreset: (p: "today" | "week" | "month" | "all" | "custom") => void;
  customStart: string;
  setCustomStart: (v: string) => void;
  customEnd: string;
  setCustomEnd: (v: string) => void;
  // painel controlado (atalho F)
  open: boolean;
  setOpen: (v: boolean) => void;
}

export default function ActivityFilterBar(p: Props) {
  const isKanban = p.view === "kanban";
  const [ownerSearch, setOwnerSearch] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!p.open) return;
    const onClick = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) p.setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") p.setOpen(false); };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onClick); document.removeEventListener("keydown", onKey); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.open]);

  const searchActive = p.search.trim().length > 0;
  const typeCount = isKanban ? p.typeFilter.length : 0;
  const ownerActive = isKanban && p.ownerFilter !== "all";
  const periodActive = p.preset !== "month";
  const count = typeCount + (ownerActive ? 1 : 0) + (periodActive ? 1 : 0);
  const ownerName = p.owners.find((o) => o.id === p.ownerFilter)?.name;

  const clearAll = () => { p.setTypeFilter(() => []); p.setOwnerFilter("all"); p.setPreset("month"); };
  const toggleType = (k: string) => p.setTypeFilter((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));
  const toggleOwner = (id: string) => p.setOwnerFilter(p.ownerFilter === id ? "all" : id);

  const ownersFiltered = ownerSearch.trim()
    ? p.owners.filter((o) => o.name.toLowerCase().includes(ownerSearch.trim().toLowerCase()))
    : p.owners;

  const sectionLabel: React.CSSProperties = { fontSize: 9, color: T.fog, textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: MONO, fontWeight: 600, marginBottom: 8 };

  const chip = (label: string, onRemove: () => void, dot?: string) => (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 30, padding: "0 6px 0 10px", borderRadius: 16, background: "rgba(74,222,128,0.1)", border: `1px solid ${T.sprout}40`, color: T.sprout, fontSize: 12, fontWeight: 600 }}>
      {dot && <span style={{ width: 7, height: 7, borderRadius: "50%", background: dot }} />}
      {label}
      <button type="button" onClick={onRemove} style={{ background: "none", border: "none", color: T.sprout, fontSize: 14, cursor: "pointer", lineHeight: 1, padding: "0 2px" }}>×</button>
    </span>
  );

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      {/* Busca (separada) */}
      {isKanban && (
        <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={searchActive ? T.sprout : T.fog} strokeWidth="2" strokeLinecap="round" style={{ position: "absolute", left: 10, pointerEvents: "none" }}><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.5" y2="16.5" /></svg>
          <input ref={p.searchRef} value={p.search} onChange={(e) => p.setSearch(e.target.value)} placeholder="Buscar  /" style={{ background: "var(--surface-raised)", border: `1px solid ${searchActive ? T.sprout : T.stone}`, borderRadius: 8, color: T.chalk, fontSize: 13, padding: "0 12px 0 30px", height: 34, width: p.isMobile ? 150 : 210, outline: "none" }} />
        </div>
      )}

      {/* Botão Filtrar + painel */}
      <div ref={wrapRef} style={{ position: "relative" }}>
        <button type="button" onClick={() => p.setOpen(!p.open)} style={{ display: "inline-flex", alignItems: "center", gap: 7, height: 34, padding: "0 12px", borderRadius: 8, background: count > 0 ? "rgba(74,222,128,0.1)" : "var(--surface-raised)", border: `1px solid ${count > 0 ? T.sprout : T.stone}`, color: count > 0 ? T.sprout : T.bone, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.5 10 19 14 21 14 12.5 22 3" /></svg>
          Filtrar
          {count > 0 && <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, background: T.sprout, color: T.ink, borderRadius: 10, minWidth: 16, height: 16, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 4px" }}>{count}</span>}
        </button>

        {p.open && (
          <div style={{ position: "absolute", top: 40, left: 0, zIndex: 200, width: 300, maxWidth: "92vw", background: T.ink, border: `1px solid ${T.stone}`, borderRadius: 12, boxShadow: "0 12px 32px rgba(0,0,0,0.5)", padding: 14 }}>
            {/* Tipo */}
            {isKanban && p.typeOptions.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={sectionLabel}>Tipo</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {p.typeOptions.map((t) => {
                    const on = p.typeFilter.includes(t.key);
                    return (
                      <button key={t.key} type="button" onClick={() => toggleType(t.key)} style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 30, padding: "0 10px", borderRadius: 16, border: `1px solid ${on ? t.color : T.stone}`, background: on ? t.color + "1F" : "transparent", color: on ? t.color : T.bone, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                        <span style={{ width: 7, height: 7, borderRadius: "50%", background: t.color }} />
                        {t.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Responsável */}
            {isKanban && p.showOwner && (
              <div style={{ marginBottom: 16 }}>
                <div style={sectionLabel}>Responsável</div>
                <input value={ownerSearch} onChange={(e) => setOwnerSearch(e.target.value)} placeholder="Buscar pessoa…" style={{ width: "100%", boxSizing: "border-box", background: T.carbon, border: `1px solid ${T.stone}`, borderRadius: 8, color: T.chalk, fontSize: 12, padding: "7px 10px", outline: "none", marginBottom: 8 }} />
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxHeight: 140, overflowY: "auto" }}>
                  {ownersFiltered.map((o) => {
                    const on = p.ownerFilter === o.id;
                    return (
                      <button key={o.id} type="button" onClick={() => toggleOwner(o.id)} style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 32, padding: "0 10px 0 4px", borderRadius: 18, border: `1px solid ${on ? T.sprout : T.stone}`, background: on ? "rgba(74,222,128,0.12)" : "transparent", color: on ? T.sprout : T.bone, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                        <ParticipantAvatar name={o.name} size={24} ring={on ? "rgba(74,222,128,0.12)" : "transparent"} />
                        {o.name.split(" ")[0]}
                        {on && <span>✓</span>}
                      </button>
                    );
                  })}
                  {ownersFiltered.length === 0 && <span style={{ fontSize: 12, color: T.slate, fontStyle: "italic" }}>Ninguém encontrado</span>}
                </div>
              </div>
            )}

            {/* Período */}
            <div style={{ marginBottom: 14 }}>
              <div style={sectionLabel}>Período</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {(["today", "week", "month", "all", "custom"] as const).map((k) => {
                  const on = p.preset === k;
                  return (
                    <button key={k} type="button" onClick={() => p.setPreset(k)} style={{ height: 30, padding: "0 12px", borderRadius: 16, border: `1px solid ${on ? T.sprout : T.stone}`, background: on ? "rgba(74,222,128,0.12)" : "transparent", color: on ? T.sprout : T.bone, fontSize: 12, fontWeight: 600, fontFamily: MONO, cursor: "pointer" }}>{PERIOD_LABELS[k]}</button>
                  );
                })}
              </div>
              {p.preset === "custom" && (
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <input type="date" value={p.customStart} onChange={(e) => p.setCustomStart(e.target.value)} style={{ flex: 1, background: T.carbon, border: `1px solid ${T.stone}`, borderRadius: 8, color: T.bone, fontSize: 12, height: 32, padding: "0 8px" }} />
                  <input type="date" value={p.customEnd} onChange={(e) => p.setCustomEnd(e.target.value)} style={{ flex: 1, background: T.carbon, border: `1px solid ${T.stone}`, borderRadius: 8, color: T.bone, fontSize: 12, height: 32, padding: "0 8px" }} />
                </div>
              )}
            </div>

            <div style={{ borderTop: `1px solid ${T.stone}`, paddingTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button type="button" onClick={clearAll} disabled={count === 0} style={{ background: "none", border: "none", color: count === 0 ? T.slate : T.fog, fontSize: 12, fontFamily: MONO, cursor: count === 0 ? "default" : "pointer" }}>Limpar filtros</button>
              <button type="button" onClick={() => p.setOpen(false)} style={{ background: "none", border: "none", color: T.bone, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Fechar</button>
            </div>
          </div>
        )}
      </div>

      {/* Chips ativos */}
      {isKanban && p.typeFilter.map((t) => {
        const opt = p.typeOptions.find((o) => o.key === t);
        return <span key={t}>{chip(`Tipo: ${opt?.label ?? t}`, () => toggleType(t), opt?.color)}</span>;
      })}
      {ownerActive && chip(`Resp.: ${ownerName?.split(" ")[0] ?? "—"}`, () => p.setOwnerFilter("all"))}
      {periodActive && chip(PERIOD_LABELS[p.preset], () => p.setPreset("month"))}
      {count > 1 && <button type="button" onClick={clearAll} style={{ background: "none", border: "none", color: T.fog, fontSize: 11, fontFamily: MONO, cursor: "pointer", height: 30, padding: "0 4px" }}>Limpar tudo</button>}
    </div>
  );
}
