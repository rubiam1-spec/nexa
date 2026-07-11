// NexaSelect — o componente de seleção CANÔNICO do NEXA (Brand Book v7).
// Governança: PROIBIDO <select> nativo novo fora daqui. Overlay SEMPRE em portal
// com wrapper position:fixed (nunca cortado por overflow de modal). Zero regra de
// negócio: os dados chegam prontos (options) do hook; aqui só há apresentação.
//
// Anatomia: trigger nos tokens (Carbon/line/foco anel Sprout sutil, chevron SVG)
// + painel de opções em createPortal, posicionado respeitando o viewport (abre
// para cima quando falta espaço embaixo; largura mínima = trigger).
// Enterprise: teclado completo (setas, Enter/Espaço, Esc, Home/End, typeahead),
// busca automática > 8 opções, grupos com cabeçalho, item desabilitado NUNCA mudo
// (hint à direita), estados vazio/carregando/erro, aria listbox/option.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface NexaSelectOption {
  value: string;
  label: string;
  /** Dica à direita (ex.: motivo do disabled: "sem corretores ativos"). */
  hint?: string;
  /** Linha secundária discreta (mono). */
  sublabel?: string;
  disabled?: boolean;
  /** Cabeçalho de grupo; opções com o mesmo group ficam juntas. */
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
  /** true | false | "auto" (auto = busca quando > SEARCH_THRESHOLD opções). */
  searchable?: boolean | "auto";
  ariaLabel?: string;
  id?: string;
  maxHeight?: number;
}

const PANEL_MAX_HEIGHT = 320;
const SEARCH_THRESHOLD = 8;
const SPROUT = "#4ADE80";
const SPROUT_SOFT = "rgba(74,222,128,0.06)";
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

/** Ordem visual estável: agrupa preservando a primeira aparição de cada grupo. */
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
}: NexaSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeIdx, setActiveIdx] = useState(-1);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0, openUp: false, height: maxHeight });
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const typeahead = useRef<{ str: string; at: number }>({ str: "", at: 0 });

  const safe = useMemo(
    () => (options ?? []).filter((o) => o && o.value != null && o.label != null),
    [options],
  );
  const ordered = useMemo(() => orderByGroup(safe), [safe]);
  const showSearch = searchable === "auto" ? safe.length > SEARCH_THRESHOLD : !!searchable;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return ordered;
    return ordered.filter((o) =>
      String(o.label).toLowerCase().includes(q) || String(o.sublabel ?? "").toLowerCase().includes(q) || String(o.hint ?? "").toLowerCase().includes(q));
  }, [ordered, search]);

  const selectedLabel = useMemo(() => {
    if (value == null || value === "") return null;
    return safe.find((o) => o.value === value)?.label ?? null;
  }, [safe, value]);

  const updatePosition = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openUp = spaceBelow < maxHeight && spaceAbove > spaceBelow;
    const height = Math.min(maxHeight, (openUp ? spaceAbove : spaceBelow) - 8);
    setPos({ top: openUp ? rect.top - height - 4 : rect.bottom + 4, left: rect.left, width: rect.width, openUp, height });
  }, [maxHeight]);

  useLayoutEffect(() => { if (open) updatePosition(); }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (containerRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false); setSearch("");
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
  }, [open, updatePosition]);

  useEffect(() => {
    if (open && showSearch) inputRef.current?.focus();
  }, [open, showSearch]);

  // Índice do primeiro item selecionável a partir de `from` na direção `dir`.
  const nextEnabled = useCallback((from: number, dir: 1 | -1): number => {
    const n = filtered.length;
    for (let step = 1; step <= n; step++) {
      const i = (from + dir * step + n * step) % n;
      if (!filtered[i]?.disabled) return i;
    }
    return -1;
  }, [filtered]);

  const openPanel = () => {
    if (disabled || loading) return;
    setOpen(true);
    const sel = filtered.findIndex((o) => o.value === value && !o.disabled);
    setActiveIdx(sel >= 0 ? sel : nextEnabled(-1, 1));
  };

  const commit = (idx: number) => {
    const opt = filtered[idx];
    if (!opt || opt.disabled) return;
    onChange(opt.value);
    setOpen(false); setSearch("");
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) { e.preventDefault(); openPanel(); }
      return;
    }
    switch (e.key) {
      case "Escape": e.preventDefault(); setOpen(false); setSearch(""); break;
      case "ArrowDown": e.preventDefault(); setActiveIdx((i) => nextEnabled(i, 1)); break;
      case "ArrowUp": e.preventDefault(); setActiveIdx((i) => nextEnabled(i, -1)); break;
      case "Home": e.preventDefault(); setActiveIdx(nextEnabled(-1, 1)); break;
      case "End": e.preventDefault(); setActiveIdx(nextEnabled(0, -1)); break;
      case "Enter":
      case " ":
        // Espaço digita na busca; fora dela, seleciona.
        if (e.key === " " && showSearch) return;
        e.preventDefault(); commit(activeIdx); break;
      default:
        // Typeahead quando não há campo de busca.
        if (!showSearch && e.key.length === 1) {
          const now = Date.now();
          typeahead.current.str = now - typeahead.current.at > 700 ? e.key : typeahead.current.str + e.key;
          typeahead.current.at = now;
          const q = typeahead.current.str.toLowerCase();
          const hit = filtered.findIndex((o) => !o.disabled && String(o.label).toLowerCase().startsWith(q));
          if (hit >= 0) setActiveIdx(hit);
        }
    }
  };

  // Mantém o item ativo visível.
  useEffect(() => {
    if (!open || activeIdx < 0) return;
    panelRef.current?.querySelector<HTMLElement>(`[data-idx="${activeIdx}"]`)?.scrollIntoView?.({ block: "nearest" });
  }, [activeIdx, open]);

  const hasValue = value != null && value !== "";
  const listboxId = id ? `${id}-listbox` : undefined;

  return (
    <div ref={containerRef} data-nexa-select="root" style={{ position: "relative", width: "100%" }}>
      <button
        type="button"
        id={id}
        data-nexa-select="trigger"
        disabled={disabled || loading}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-label={ariaLabel}
        onClick={() => (open ? setOpen(false) : openPanel())}
        onKeyDown={onKeyDown}
        style={{
          width: "100%", padding: `10px ${allowClear && hasValue ? 54 : 36}px 10px 14px`,
          background: "linear-gradient(145deg, var(--surface-raised), var(--surface-base))",
          border: `1px solid ${open ? SPROUT_RING : "var(--border-default)"}`,
          boxShadow: open ? `0 0 0 3px ${SPROUT_SOFT}` : "none",
          borderRadius: 10, minHeight: 40,
          color: hasValue ? "var(--text-primary)" : "var(--text-muted)",
          fontFamily: "var(--font-sans)", fontSize: 13, textAlign: "left",
          cursor: disabled || loading ? "not-allowed" : "pointer", position: "relative",
          transition: "border-color 0.15s, box-shadow 0.15s", opacity: disabled ? 0.6 : 1,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}
      >
        {loading ? "Carregando..." : (selectedLabel ?? placeholder)}
        <Chevron open={open} />
      </button>

      {allowClear && hasValue && !disabled && !loading && (
        <span role="button" aria-label="Limpar seleção" tabIndex={0}
          onClick={(e) => { e.stopPropagation(); onChange(""); setSearch(""); setOpen(false); }}
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
              <div style={{ padding: "18px 14px", color: "#F87171", fontSize: 12, textAlign: "center", fontFamily: "var(--font-sans)" }}>{error}</div>
            ) : loading ? (
              [0, 1, 2].map((i) => (
                <div key={i} data-nexa-select="skeleton" style={{ height: 40, margin: "8px 12px", borderRadius: 6, background: "linear-gradient(90deg, var(--surface-base), var(--surface-overlay), var(--surface-base))", opacity: 0.6 }} />
              ))
            ) : filtered.length === 0 ? (
              <div style={{ padding: "18px 14px", color: "var(--text-muted)", fontSize: 12, textAlign: "center" }}>
                {search.trim() ? `Nenhum resultado para "${search}"` : emptyLabel}
              </div>
            ) : (
              filtered.map((opt, idx) => {
                const isSelected = value === opt.value;
                const isActive = idx === activeIdx;
                const prevGroup = idx > 0 ? filtered[idx - 1].group : undefined;
                const showHeader = opt.group && opt.group !== prevGroup;
                return (
                  <div key={`${opt.group ?? ""}:${opt.value}`}>
                    {showHeader && (
                      <div style={{ padding: "8px 14px 4px", fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-fog, var(--text-muted))" }}>
                        {opt.group}
                      </div>
                    )}
                    <div
                      data-idx={idx}
                      role="option"
                      aria-selected={isSelected}
                      aria-disabled={opt.disabled || undefined}
                      onClick={() => commit(idx)}
                      onMouseEnter={() => !opt.disabled && setActiveIdx(idx)}
                      title={opt.disabled && opt.hint ? opt.hint : undefined}
                      style={{
                        padding: "9px 14px", minHeight: 40, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
                        cursor: opt.disabled ? "not-allowed" : "pointer",
                        background: isActive && !opt.disabled ? "var(--surface-overlay)" : isSelected ? SPROUT_SOFT : "transparent",
                        opacity: opt.disabled ? 0.45 : 1,
                        transition: "background 0.1s",
                      }}
                    >
                      <span style={{ minWidth: 0, flex: 1 }}>
                        <span style={{ display: "block", fontSize: 13, color: "var(--text-primary)", fontFamily: "var(--font-sans)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{opt.label}</span>
                        {opt.sublabel && (
                          <span style={{ display: "block", fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{opt.sublabel}</span>
                        )}
                      </span>
                      {/* Item desabilitado NUNCA é mudo: o hint explica o porquê. */}
                      {opt.hint && (
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-muted)", whiteSpace: "nowrap", flexShrink: 0 }}>{opt.hint}</span>
                      )}
                      {isSelected && !opt.hint && <Check />}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

export default NexaSelect;
