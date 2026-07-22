// NexaSelect — componente de seleção CANÔNICO do NEXA (Brand Book v7).
// MOTOR: primitivos battle-tested — @radix-ui/react-popover (posicionamento com
// detecção de colisão: abre p/ cima/baixo sozinho, nunca corta, funciona em modal)
// + cmdk (lista/busca/teclado acessíveis) + match-sorter (fuzzy) sob
// useDeferredValue (digitação nunca trava). API pública, 8 leis e pele NEXA
// inalteradas — as telas migradas não mudam uma linha.
// Governança: PROIBIDO <select> nativo novo fora daqui.
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Command } from "cmdk";
import { matchSorter } from "match-sorter";
import "./NexaSelect.css";

export interface NexaSelectOption {
  value: string;
  label: string;
  /** disabled → MOTIVO (agrupa o colapso, L2). enabled → dica curta opcional. */
  hint?: string;
  sublabel?: string;
  disabled?: boolean;
  group?: string;
  /** Dot de cor à esquerda (ex.: cor canônica do status de unidade). */
  color?: string;
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
  /** Persiste as 3 últimas escolhas (localStorage) numa seção "Recentes". Pessoas/filtros — NÃO dado de formulário. */
  recentKey?: string;
  /** Rodapé acionável do painel (ex: "Convidar corretores →"), exibido quando há desabilitadas (L8). */
  footer?: React.ReactNode;
  minPanelWidth?: number;
}

const SEARCH_THRESHOLD = 8;
const MATCH_KEYS = ["label", "hint", "sublabel"];

function Chevron() {
  return (
    <svg width="10" height="6" viewBox="0 0 10 6" fill="none" aria-hidden="true"
      style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
      <path d="M1 1L5 5L9 1" stroke="#9C9686" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
function Check() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M2.5 6.5L5 9L9.5 3.5" stroke="#4ADE80" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
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
function Highlight({ text, q }: { text: string; q: string }) {
  if (!q) return <>{text}</>;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return <>{text}</>;
  return (<>{text.slice(0, i)}<mark>{text.slice(i, i + q.length)}</mark>{text.slice(i + q.length)}</>);
}

function orderByGroup(options: NexaSelectOption[]): NexaSelectOption[] {
  if (!options.some((o) => o.group)) return options;
  const groups: string[] = []; const byGroup = new Map<string, NexaSelectOption[]>();
  for (const o of options) { const g = o.group ?? ""; if (!byGroup.has(g)) { byGroup.set(g, []); groups.push(g); } byGroup.get(g)!.push(o); }
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
  options, value, onChange,
  placeholder = "Selecionar...", searchPlaceholder = "Buscar...",
  disabled = false, loading = false, error = null, emptyLabel = "Nenhuma opção",
  allowClear = false, searchable = "auto", ariaLabel, id, maxHeight = 340, autoFocus = false,
  noun, recentKey, footer, minPanelWidth = 320,
}: NexaSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [expandedReasons, setExpandedReasons] = useState<Set<string>>(new Set());
  const [recents, setRecents] = useState<string[]>(() => (recentKey ? recentsStore.load(recentKey) : []));
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const safe = useMemo(() => (options ?? []).filter((o) => o && o.value != null && o.label != null), [options]);
  // L5: filtragem fuzzy não-bloqueante (match-sorter sob useDeferredValue).
  const deferred = useDeferredValue(search);
  const q = deferred.trim();
  const searching = q.length > 0;

  const enabledAll = useMemo(() => safe.filter((o) => !o.disabled), [safe]);
  const disabledAll = useMemo(() => safe.filter((o) => o.disabled), [safe]);
  // L1: acionáveis primeiro (ordem natural; rank fuzzy quando buscando).
  const enabled = useMemo(
    () => (searching ? matchSorter(enabledAll, q, { keys: MATCH_KEYS }) : orderByGroup(enabledAll)),
    [enabledAll, q, searching],
  );
  // L2: desabilitadas agrupadas por MOTIVO (hint).
  const disabledGroups = useMemo(() => {
    const items = searching ? matchSorter(disabledAll, q, { keys: MATCH_KEYS }) : disabledAll;
    const order: string[] = []; const map = new Map<string, NexaSelectOption[]>();
    for (const o of items) { const r = o.hint ?? ""; if (!map.has(r)) { map.set(r, []); order.push(r); } map.get(r)!.push(o); }
    return order.map((reason) => ({ reason, items: map.get(reason)! }));
  }, [disabledAll, q, searching]);

  // L6: recentes (só sem busca).
  const recentOpts = useMemo(() => {
    if (!recentKey || searching) return [];
    const byVal = new Map(safe.map((o) => [o.value, o] as const));
    const out: NexaSelectOption[] = [];
    for (const v of recents) { const o = byVal.get(v); if (o && !o.disabled && !out.includes(o)) out.push(o); if (out.length >= 3) break; }
    return out;
  }, [recentKey, searching, safe, recents]);

  // L4: gatilho mostra o valor atual.
  const selectedOpt = useMemo(() => safe.find((o) => o.value === value), [safe, value]);
  const showSearch = searchable === "auto" ? safe.length > SEARCH_THRESHOLD : !!searchable;

  useEffect(() => { if (autoFocus) triggerRef.current?.focus(); }, [autoFocus]);

  const onOpenChange = (o: boolean) => {
    if (disabled || loading) return;
    setOpen(o);
    if (o) { setSearch(""); setExpandedReasons(new Set()); if (recentKey) setRecents(recentsStore.load(recentKey)); }
  };

  const commit = (v: string) => {
    onChange(v);
    if (recentKey) { recentsStore.push(recentKey, v); setRecents(recentsStore.load(recentKey)); }
    setOpen(false);
  };

  const toggleReason = (r: string) => setExpandedReasons((s) => { const n = new Set(s); n.has(r) ? n.delete(r) : n.add(r); return n; });
  const reasonOpen = (r: string) => searching || expandedReasons.has(r);

  const hasValue = value != null && value !== "";
  const nothing = enabled.length === 0 && disabledGroups.length === 0;

  const renderItem = (o: NexaSelectOption, keyPrefix: string) => {
    const isCurrent = o.value === value;
    return (
      <Command.Item
        key={`${keyPrefix}:${o.value}`}
        value={`${keyPrefix}:${o.value}`}
        keywords={[o.label, o.hint ?? "", o.sublabel ?? ""]}
        onSelect={() => commit(o.value)}
        className={`nexa-select-item${isCurrent ? " is-current" : ""}`}
        title={o.label}
      >
        <span className="nexa-select-item-main">
          <span className="nexa-select-item-label">
            {o.color ? <span aria-hidden="true" style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: o.color, marginRight: 8, verticalAlign: "middle", flexShrink: 0 }} /> : null}
            <Highlight text={o.label} q={q} />
          </span>
          {o.sublabel && <span className="nexa-select-item-sub">{o.sublabel}</span>}
        </span>
        {o.hint && <span className="nexa-select-item-hint">{o.hint}</span>}
        {isCurrent && !o.hint && <Check />}
      </Command.Item>
    );
  };

  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <div data-nexa-select="root" style={{ position: "relative", width: "100%" }}>
        <Popover.Trigger asChild disabled={disabled || loading}>
          <button
            ref={triggerRef}
            type="button"
            id={id}
            data-nexa-select="trigger"
            aria-label={ariaLabel}
            className={`nexa-select-trigger${selectedOpt ? "" : " is-placeholder"}`}
            style={{ paddingRight: allowClear && hasValue ? 54 : 34 }}
          >
            <span className="nexa-select-value">{loading ? "Carregando..." : selectedOpt ? (<>{selectedOpt.color ? <span aria-hidden="true" style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: selectedOpt.color, marginRight: 8, verticalAlign: "middle" }} /> : null}{selectedOpt.label}</>) : placeholder}</span>
            <Chevron />
          </button>
        </Popover.Trigger>

        {allowClear && hasValue && !disabled && !loading && (
          <span role="button" aria-label="Limpar seleção" tabIndex={0}
            onClick={(e) => { e.stopPropagation(); onChange(""); }}
            style={{ position: "absolute", right: 30, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", cursor: "pointer", fontSize: 16, lineHeight: 1, padding: "2px 6px", borderRadius: 6, userSelect: "none", zIndex: 1 }}>
            ×
          </span>
        )}
      </div>

      <Popover.Portal>
        <Popover.Content
          data-nexa-select="panel"
          className="nexa-select-content"
          align="start"
          sideOffset={4}
          avoidCollisions
          collisionPadding={8}
          style={{ minWidth: `max(${minPanelWidth}px, var(--radix-popover-trigger-width))` }}
          onOpenAutoFocus={(e) => { if (showSearch) { e.preventDefault(); inputRef.current?.focus(); } }}
        >
          <Command shouldFilter={false} loop label={ariaLabel}>
            <div className={showSearch ? "nexa-select-searchbar" : undefined}>
              {/* L5: busca com foco automático; oculta (mas funcional p/ typeahead) quando poucas opções. */}
              <Command.Input
                ref={inputRef}
                value={search}
                onValueChange={setSearch}
                placeholder={searchPlaceholder}
                className={showSearch ? "nexa-select-input" : "nexa-select-input-hidden"}
                aria-label={showSearch ? undefined : "Buscar"}
              />
            </div>

            <Command.List className="nexa-select-list" style={{ maxHeight }}>
              {loading ? (
                [0, 1, 2].map((i) => <div key={i} data-nexa-select="skeleton" className="nexa-select-skeleton" />)
              ) : error ? (
                <div className="nexa-select-empty" style={{ color: "#F87171" }}>{error}</div>
              ) : (
                <>
                  {/* L6 — Recentes */}
                  {recentOpts.length > 0 && (
                    <Command.Group heading="Recentes" className="nexa-select-group">
                      {recentOpts.map((o) => renderItem(o, "r"))}
                    </Command.Group>
                  )}

                  {/* L1 — Acionáveis (com cabeçalho de grupo quando houver) */}
                  {enabled.map((o, i) => {
                    const prev = i > 0 ? enabled[i - 1].group : undefined;
                    return (
                      <div key={`w:${o.value}`}>
                        {o.group && o.group !== prev && <div className="nexa-select-heading">{o.group}</div>}
                        {renderItem(o, "o")}
                      </div>
                    );
                  })}

                  {/* L2 — Desabilitadas RECOLHIDAS sob cabeçalho por motivo */}
                  {disabledGroups.map(({ reason, items }) => {
                    const openR = reasonOpen(reason);
                    const head = `${items.length}${noun ? ` ${noun}` : ""}${reason ? ` ${reason}` : ""}`;
                    return (
                      <div key={`dg:${reason}`}>
                        <button type="button" data-nexa-select="disabled-toggle" className="nexa-select-disabled-toggle"
                          onClick={() => toggleReason(reason)} aria-expanded={openR}>
                          <Disclosure open={openR} />
                          <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{head}</span>
                        </button>
                        {openR && items.map((o) => (
                          <Command.Item key={`d:${o.value}`} value={`d:${o.value}`} disabled className="nexa-select-disabled-item" title={o.label}>
                            <Highlight text={o.label} q={q} />
                          </Command.Item>
                        ))}
                      </div>
                    );
                  })}

                  {/* L5 — zero-resultado honesto */}
                  {nothing && (
                    <div className="nexa-select-empty">
                      {searching
                        ? <>Nenhum resultado{noun ? ` em ${noun}` : ""} para “{search}”.<br /><span style={{ fontSize: 11, opacity: 0.8 }}>Tente outro termo.</span></>
                        : emptyLabel}
                    </div>
                  )}
                </>
              )}
            </Command.List>

            {/* L8 — o conjunto se explica */}
            {footer && disabledAll.length > 0 && !error && !loading && (
              <div className="nexa-select-footer">{footer}</div>
            )}
          </Command>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export default NexaSelect;
