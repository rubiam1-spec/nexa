// NexaSelect — componente de seleção CANÔNICO do NEXA (Brand Book v7).
// Governança: PROIBIDO <select> nativo novo fora daqui. Overlay SEMPRE em portal
// com wrapper position:fixed (nunca cortado por overflow de modal). Zero regra de
// negócio: os dados chegam prontos (options) do hook.
//
// LEIS DE UX (design system — valem para TODAS as telas):
//  L1 acionável primeiro (selecionáveis acima; desabilitadas depois).
//  L2 ruído se agrupa, não se repete (desabilitadas RECOLHIDAS sob cabeçalho por
//     motivo, com contagem; sem repetir a frase em cada item).
//  L3 o nome nunca trunca por metadado (label tem prioridade; painel largo; tooltip).
//  L4 o gatilho conta a verdade (fechado mostra o valor atual, não "Selecionar").
//  L5 busca instantânea e honesta (filtra acionáveis E desabilitadas; realce;
//     zero-resultado com dica; foco automático ao abrir).
//  L6 recentes no topo (pessoas/filtros; localStorage; via prop recentKey).
//  L7 teclado impecável (setas pulam disabled; Enter; Esc devolve foco ao gatilho; typeahead).
//  L8 o conjunto se explica (rodapé acionável quando houver desabilitadas).
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface NexaSelectOption {
  value: string;
  label: string;
  /** disabled → MOTIVO (agrupa o colapso, L2). enabled → dica curta opcional. */
  hint?: string;
  sublabel?: string;
  disabled?: boolean;
  group?: string;
}

export interface NexaSelectProps {
  options: NexaSelectOption[];
  value: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  loading?: boolean;
  error?: string | null;
  emptyLabel?: string;
  allowClear?: boolean;
  searchable?: boolean | "auto";
  ariaLabel?: string;
  id?: string;
  maxHeight?: number;
  autoFocus?: boolean;
  /** Substantivo plural do domínio (ex: "imobiliárias") p/ cabeçalho de colapso e busca vazia. */
  noun?: string;
  /** Persiste as 3 últimas escolhas (localStorage) numa seção "Recentes". Pessoas/filtros — NÃO em dado de formulário. */
  recentKey?: string;
  /** Rodapé acionável do painel (ex: "Convidar corretores →"), exibido quando há desabilitadas (L8). */
  footer?: React.ReactNode;
  minPanelWidth?: number;
}

const PANEL_MAX_HEIGHT = 340;
const SEARCH_THRESHOLD = 8;
const MIN_PANEL_WIDTH = 320;
const SPROUT = "#4ADE80";
const SPROUT_SOFT = "rgba(74,222,128,0.08)";
const SPROUT_RING = "rgba(74,222,128,0.35)";

function Chevron({ open }: { open: boolean }) {
  return (
    <svg width="10" height="6" viewBox="0 0 10 6" fill="none" aria-hidden="true"
      style={{ position: "absolute", right: 14, top: "50%", transform: `translateY(-50%) ${open ? "rotate(180deg)" : ""}`, transition: "transform 0.15s", pointerEvents: "none" }}>
      <path d="M1 1L5 5L9 1" stroke="#9C9686" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function Check() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M2.5 6.5L5 9L9.5 3.5" stroke={SPROUT} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Disclosure({ open }: { open: boolean }) {
  return (
    <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden="true"
      style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform 0.12s", flexShrink: 0 }}>
      <path d="M2 1L6 4L2 7" stroke="#9C9686" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Realça o trecho que casou com a busca (L5). */
function Highlight({ text, q }: { text: string; q: string }) {
  if (!q) return <>{text}</>;
  const i = text.toLowerCase().indexOf(q);
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark style={{ background: "rgba(74,222,128,0.22)", color: "inherit", borderRadius: 3, padding: "0 1px" }}>{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}

function orderByGroup(options: NexaSelectOption[]): NexaSelectOption[] {
  const hasGroup = options.some((o) => o.group);
  if (!hasGroup) return options;
  const groups: string[] = [];
  const byGroup = new Map<string, NexaSelectOption[]>();
  for (const o of options) {
    const g = o.group ?? "";
    if (!byGroup.has(g)) { byGroup.set(g, []); groups.push(g); }
    byGroup.get(g)!.push(o);
  }
  return groups.flatMap((g) => byGroup.get(g)!);
}

const recentsStore = {
  load(key: string): string[] {
    if (typeof localStorage === "undefined") return [];
    try { const r = JSON.parse(localStorage.getItem(`nexa-recents:${key}`) ?? "[]"); return Array.isArray(r) ? r.filter((x) => typeof x === "string") : []; } catch { return []; }
  },
  push(key: string, value: string) {
    if (typeof localStorage === "undefined" || !value) return;
    try { const cur = recentsStore.load(key).filter((v) => v !== value); localStorage.setItem(`nexa-recents:${key}`, JSON.stringify([value, ...cur].slice(0, 3))); } catch { /* ignore */ }
  },
};

export function NexaSelect({
  options,
  value,
  onChange,
  placeholder = "Selecionar...",
  searchPlaceholder = "Buscar...",
  disabled = false,
  loading = false,
  error = null,
  emptyLabel = "Nenhuma opção",
  allowClear = false,
  searchable = "auto",
  ariaLabel,
  id,
  maxHeight = PANEL_MAX_HEIGHT,
  autoFocus = false,
  noun,
  recentKey,
  footer,
  minPanelWidth = MIN_PANEL_WIDTH,
}: NexaSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeIdx, setActiveIdx] = useState(-1);
  const [expandedReasons, setExpandedReasons] = useState<Set<string>>(new Set());
  const [recents, setRecents] = useState<string[]>(() => (recentKey ? recentsStore.load(recentKey) : []));
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0, openUp: false, height: maxHeight });
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const typeahead = useRef<{ str: string; at: number }>({ str: "", at: 0 });

  const safe = useMemo(() => (options ?? []).filter((o) => o && o.value != null && o.label != null), [options]);
  const q = search.trim().toLowerCase();
  const searching = q.length > 0;
  const matchOpt = useCallback((o: NexaSelectOption) => {
    if (!q) return true;
    return String(o.label).toLowerCase().includes(q) || String(o.hint ?? "").toLowerCase().includes(q) || String(o.sublabel ?? "").toLowerCase().includes(q);
  }, [q]);

  // L1: acionáveis (ordem natural) primeiro.
  const enabled = useMemo(() => orderByGroup(safe.filter((o) => !o.disabled && matchOpt(o))), [safe, matchOpt]);
  // L2: desabilitadas agrupadas por MOTIVO (hint), preservando 1ª aparição.
  const disabledGroups = useMemo(() => {
    const items = safe.filter((o) => o.disabled && matchOpt(o));
    const order: string[] = []; const map = new Map<string, NexaSelectOption[]>();
    for (const o of items) { const r = o.hint ?? ""; if (!map.has(r)) { map.set(r, []); order.push(r); } map.get(r)!.push(o); }
    return order.map((reason) => ({ reason, items: map.get(reason)! }));
  }, [safe, matchOpt]);
  const disabledTotal = useMemo(() => safe.filter((o) => o.disabled).length, [safe]);

  // L6: recentes (só quando recentKey e sem busca ativa).
  const recentOpts = useMemo(() => {
    if (!recentKey || searching) return [];
    const byVal = new Map(safe.map((o) => [o.value, o] as const));
    const seen = new Set<string>();
    const out: NexaSelectOption[] = [];
    for (const v of recents) {
      const o = byVal.get(v);
      if (o && !o.disabled && !seen.has(v)) { seen.add(v); out.push(o); }
      if (out.length >= 3) break;
    }
    return out;
  }, [recentKey, searching, safe, recents]);

  // Lista navegável (selecionável): recentes, depois acionáveis.
  const navItems = useMemo(
    () => [...recentOpts.map((o) => ({ o, key: `r:${o.value}` })), ...enabled.map((o) => ({ o, key: `o:${o.value}` }))],
    [recentOpts, enabled],
  );

  // L4: o gatilho conta a verdade.
  const selectedOpt = useMemo(() => safe.find((o) => o.value === value), [safe, value]);
  const triggerLabel = loading ? "Carregando..." : (selectedOpt ? selectedOpt.label : placeholder);
  const showSearch = searchable === "auto" ? safe.length > SEARCH_THRESHOLD : !!searchable;

  const updatePosition = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openUp = spaceBelow < maxHeight && spaceAbove > spaceBelow;
    const height = Math.min(maxHeight, (openUp ? spaceAbove : spaceBelow) - 8);
    const width = Math.max(rect.width, minPanelWidth);
    // Não deixa o painel largo estourar a direita da viewport.
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
    setPos({ top: openUp ? rect.top - height - 4 : rect.bottom + 4, left, width, openUp, height });
  }, [maxHeight, minPanelWidth]);

  useLayoutEffect(() => { if (open) updatePosition(); }, [open, updatePosition]);

  const closePanel = useCallback((refocus: boolean) => {
    setOpen(false); setSearch(""); setExpandedReasons(new Set());
    if (refocus) triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (containerRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      closePanel(false);
    };
    const onReflow = () => updatePosition();
    document.addEventListener("mousedown", onDown);
    window.addEventListener("resize", onReflow);
    window.addEventListener("scroll", onReflow, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("resize", onReflow);
      window.removeEventListener("scroll", onReflow, true);
    };
  }, [open, updatePosition, closePanel]);

  useEffect(() => { if (open && showSearch) inputRef.current?.focus(); }, [open, showSearch]);
  useEffect(() => { if (autoFocus) triggerRef.current?.focus(); }, [autoFocus]);

  const openPanel = () => {
    if (disabled || loading) return;
    if (recentKey) setRecents(recentsStore.load(recentKey));
    setOpen(true); setSearch(""); setExpandedReasons(new Set());
  };

  // Ativo inicial = selecionado (se navegável) ou primeiro.
  useEffect(() => {
    if (!open) { setActiveIdx(-1); return; }
    const sel = navItems.findIndex((n) => n.o.value === value);
    setActiveIdx(sel >= 0 ? sel : navItems.length ? 0 : -1);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const move = (dir: 1 | -1) => {
    const n = navItems.length; if (!n) return;
    setActiveIdx((i) => (i < 0 ? (dir === 1 ? 0 : n - 1) : (i + dir + n) % n));
  };

  const commit = (idx: number) => {
    const item = navItems[idx]; if (!item) return;
    onChange(item.o.value);
    if (recentKey) { recentsStore.push(recentKey, item.o.value); setRecents(recentsStore.load(recentKey)); }
    closePanel(true);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) { e.preventDefault(); openPanel(); }
      return;
    }
    switch (e.key) {
      case "Escape": e.preventDefault(); closePanel(true); break;
      case "ArrowDown": e.preventDefault(); move(1); break;
      case "ArrowUp": e.preventDefault(); move(-1); break;
      case "Home": e.preventDefault(); setActiveIdx(navItems.length ? 0 : -1); break;
      case "End": e.preventDefault(); setActiveIdx(navItems.length - 1); break;
      case "Enter": e.preventDefault(); commit(activeIdx); break;
      case " ":
        if (showSearch) return; // espaço digita na busca
        e.preventDefault(); commit(activeIdx); break;
      default:
        if (!showSearch && e.key.length === 1) { // L7 typeahead
          const now = Date.now();
          typeahead.current.str = now - typeahead.current.at > 700 ? e.key : typeahead.current.str + e.key;
          typeahead.current.at = now;
          const t = typeahead.current.str.toLowerCase();
          const hit = navItems.findIndex((n) => String(n.o.label).toLowerCase().startsWith(t));
          if (hit >= 0) setActiveIdx(hit);
        }
    }
  };

  useEffect(() => {
    if (!open || activeIdx < 0) return;
    panelRef.current?.querySelector<HTMLElement>(`[data-idx="${activeIdx}"]`)?.scrollIntoView?.({ block: "nearest" });
  }, [activeIdx, open]);

  const toggleReason = (r: string) => setExpandedReasons((s) => { const n = new Set(s); if (n.has(r)) n.delete(r); else n.add(r); return n; });
  const reasonOpen = (r: string) => searching || expandedReasons.has(r);

  const hasValue = value != null && value !== "";
  const listboxId = id ? `${id}-listbox` : undefined;
  const nothing = navItems.length === 0 && disabledGroups.length === 0;

  // Índice de render dos navegáveis (para data-idx / activeIdx).
  let navRenderIdx = -1;
  const renderRow = (o: NexaSelectOption, keyPrefix: string) => {
    navRenderIdx += 1;
    const idx = navRenderIdx;
    const isSelected = value === o.value;
    const isActive = idx === activeIdx;
    return (
      <div
        key={`${keyPrefix}:${o.value}`}
        data-idx={idx}
        role="option"
        aria-selected={isSelected}
        onClick={() => commit(idx)}
        onMouseEnter={() => setActiveIdx(idx)}
        title={o.label}
        style={{
          padding: "9px 14px", minHeight: 40, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
          cursor: "pointer", background: isActive ? "var(--surface-overlay)" : isSelected ? SPROUT_SOFT : "transparent",
          transition: "background 0.1s",
        }}
      >
        <span style={{ minWidth: 0, flex: 1 }}>
          <span style={{ display: "block", fontSize: 13, color: "var(--text-primary)", fontFamily: "var(--font-sans)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            <Highlight text={o.label} q={q} />
          </span>
          {o.sublabel && (
            <span style={{ display: "block", fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.sublabel}</span>
          )}
        </span>
        {/* L3: metadado só à direita, sem roubar espaço do nome. */}
        {o.hint && !o.disabled && (
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-muted)", whiteSpace: "nowrap", flexShrink: 0, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis" }}>{o.hint}</span>
        )}
        {isSelected && !o.hint && <Check />}
      </div>
    );
  };

  return (
    <div ref={containerRef} data-nexa-select="root" style={{ position: "relative", width: "100%" }}>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        data-nexa-select="trigger"
        disabled={disabled || loading}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-label={ariaLabel}
        onClick={() => (open ? closePanel(false) : openPanel())}
        onKeyDown={onKeyDown}
        style={{
          width: "100%", padding: `10px ${allowClear && hasValue ? 54 : 36}px 10px 14px`,
          background: "linear-gradient(145deg, var(--surface-raised), var(--surface-base))",
          border: `1px solid ${open ? SPROUT_RING : "var(--border-default)"}`,
          boxShadow: open ? `0 0 0 3px ${SPROUT_SOFT}` : "none",
          borderRadius: 10, minHeight: 40,
          color: selectedOpt ? "var(--text-primary)" : "var(--text-muted)",
          fontFamily: "var(--font-sans)", fontSize: 13, textAlign: "left",
          cursor: disabled || loading ? "not-allowed" : "pointer", position: "relative",
          transition: "border-color 0.15s, box-shadow 0.15s", opacity: disabled ? 0.6 : 1,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}
      >
        {triggerLabel}
        <Chevron open={open} />
      </button>

      {allowClear && hasValue && !disabled && !loading && (
        <span role="button" aria-label="Limpar seleção" tabIndex={0}
          onClick={(e) => { e.stopPropagation(); onChange(""); closePanel(false); }}
          style={{ position: "absolute", right: 34, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", cursor: "pointer", fontSize: 16, lineHeight: 1, padding: "2px 6px", borderRadius: 6, userSelect: "none" }}>
          ×
        </span>
      )}

      {open && createPortal(
        <div ref={panelRef} data-nexa-select="panel" role="listbox" id={listboxId} aria-label={ariaLabel}
          style={{
            position: "fixed", top: pos.top, left: pos.left, minWidth: pos.width, width: pos.width,
            maxHeight: pos.height, background: "var(--surface-raised)", border: "1px solid var(--border-default)",
            borderRadius: 10, zIndex: 99999, overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            display: "flex", flexDirection: "column",
          }}
          onKeyDown={onKeyDown}
        >
          {showSearch && (
            <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--border-default)", flexShrink: 0, background: "var(--surface-raised)" }}>
              <input ref={inputRef} type="text" value={search} onChange={(e) => { setSearch(e.target.value); setActiveIdx(0); }} placeholder={searchPlaceholder}
                style={{ width: "100%", padding: "8px 12px", borderRadius: 8, background: "var(--surface-base)", border: "1px solid var(--border-default)", color: "var(--text-primary)", fontFamily: "var(--font-sans)", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
            </div>
          )}

          <div style={{ overflowY: "auto", flex: 1, minHeight: 0, WebkitOverflowScrolling: "touch" }}>
            {error ? (
              <div style={{ padding: "18px 14px", color: "#F87171", fontSize: 12, textAlign: "center" }}>{error}</div>
            ) : loading ? (
              [0, 1, 2].map((i) => (
                <div key={i} data-nexa-select="skeleton" style={{ height: 40, margin: "8px 12px", borderRadius: 6, background: "linear-gradient(90deg, var(--surface-base), var(--surface-overlay), var(--surface-base))", opacity: 0.6 }} />
              ))
            ) : (
              <>
                {/* L6 — Recentes */}
                {recentOpts.length > 0 && (
                  <>
                    <div style={{ padding: "8px 14px 4px", fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-fog, var(--text-muted))" }}>Recentes</div>
                    {recentOpts.map((o) => renderRow(o, "r"))}
                    {enabled.length > 0 && <div style={{ height: 1, background: "var(--border-default)", margin: "4px 0", opacity: 0.5 }} />}
                  </>
                )}

                {/* L1 — Acionáveis (com cabeçalho de grupo quando houver) */}
                {enabled.map((o, i) => {
                  const prev = i > 0 ? enabled[i - 1].group : undefined;
                  const header = o.group && o.group !== prev ? (
                    <div key={`g:${o.group}`} style={{ padding: "8px 14px 4px", fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-fog, var(--text-muted))" }}>{o.group}</div>
                  ) : null;
                  return (<div key={`ow:${o.value}`}>{header}{renderRow(o, "o")}</div>);
                })}

                {/* L2 — Desabilitadas RECOLHIDAS sob cabeçalho por motivo */}
                {disabledGroups.map(({ reason, items }) => {
                  const openR = reasonOpen(reason);
                  const head = `${items.length}${noun ? ` ${noun}` : ""}${reason ? ` ${reason}` : ""}`;
                  return (
                    <div key={`dg:${reason}`} style={{ borderTop: "1px solid var(--border-default)" }}>
                      <button type="button" data-nexa-select="disabled-toggle" onClick={() => toggleReason(reason)}
                        aria-expanded={openR}
                        style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "9px 14px", background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 11, fontFamily: "var(--font-sans)", textAlign: "left" }}>
                        <Disclosure open={openR} />
                        <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{head}</span>
                      </button>
                      {openR && items.map((o) => (
                        <div key={`d:${o.value}`} role="option" aria-selected={false} aria-disabled title={o.label}
                          style={{ padding: "8px 14px 8px 30px", minHeight: 34, display: "flex", alignItems: "center", cursor: "not-allowed", opacity: 0.4, fontSize: 12, color: "var(--text-primary)", fontFamily: "var(--font-sans)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          <Highlight text={o.label} q={q} />
                        </div>
                      ))}
                    </div>
                  );
                })}

                {/* L5 — zero-resultado honesto */}
                {nothing && (
                  <div style={{ padding: "18px 14px", color: "var(--text-muted)", fontSize: 12, textAlign: "center" }}>
                    {searching
                      ? <>Nenhum resultado{noun ? ` em ${noun}` : ""} para “{search}”.<br /><span style={{ fontSize: 11, opacity: 0.8 }}>Tente outro termo.</span></>
                      : emptyLabel}
                  </div>
                )}
              </>
            )}
          </div>

          {/* L8 — o conjunto se explica */}
          {footer && disabledTotal > 0 && !error && !loading && (
            <div style={{ padding: "8px 12px", borderTop: "1px solid var(--border-default)", flexShrink: 0, background: "var(--surface-raised)", fontSize: 11 }}>{footer}</div>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}

export default NexaSelect;
