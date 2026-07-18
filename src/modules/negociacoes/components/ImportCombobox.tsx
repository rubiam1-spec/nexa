// Combobox de busca reutilizável do importador (apresentação pura).
// Recebe `options` já ranqueadas pelo service (com group/confidence) e emite onChange(id).
// Usado para corretor, unidade e cliente. Dropdown em portal, clamp à viewport,
// nunca vaza do painel. Teclado: ↑↓ navega, Enter confirma, Esc fecha.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface ComboOption {
  id: string;
  label: string;
  secondary?: string;
  group?: string;
  confidence?: number; // 0..1
  isCreateNew?: boolean;
}

export interface ComboFilter {
  label: string;
  value: string;
}

interface Props {
  options: ComboOption[];
  value: string | null;
  onChange: (id: string) => void;
  placeholder?: string;
  closedLabel?: React.ReactNode; // conteúdo do campo fechado
  filters?: ComboFilter[]; // chips opcionais (ex.: imobiliária) — estado interno
  ariaLabel?: string;
}

const T = {
  layer1: "#0F0E0C",
  carbon: "#1C1B18",
  bone: "#E8E5DE",
  dust: "#C4BFB3",
  fog: "#9C9686",
  slate: "#706B5F",
  sprout: "#4ADE80",
  sproutMuted: "rgba(74,222,128,0.12)",
  blue: "#60A5FA",
  border: "rgba(232,229,222,0.08)",
  borderStrong: "rgba(232,229,222,0.14)",
  mono: "var(--font-mono, 'JetBrains Mono', monospace)",
  ui: "var(--font-ui, 'Outfit', sans-serif)",
};

const DROPDOWN_MAX = 340;
const CARD_BG = "linear-gradient(160deg, #1C1B18 0%, #131210 100%)";
const CHEVRON =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path d='M1 1l4 4 4-4' stroke='%239C9686' stroke-width='1.5' fill='none' stroke-linecap='round'/></svg>\")";

function Highlight({ text, q }: { text: string; q: string }) {
  if (!q) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: T.sproutMuted, color: T.sprout, borderRadius: 3, padding: "0 1px" }}>
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </>
  );
}

export default function ImportCombobox({
  options,
  value,
  onChange,
  placeholder = "Buscar…",
  closedLabel,
  filters,
  ariaLabel,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [dq, setDq] = useState(""); // query com debounce
  const [active, setActive] = useState(0);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const activeRef = useRef<HTMLDivElement>(null);

  // debounce 200ms
  useEffect(() => {
    const id = setTimeout(() => setDq(query.trim()), 200);
    return () => clearTimeout(id);
  }, [query]);

  // separa create-new (sempre visível) do resto (filtrável)
  const createOpts = useMemo(() => options.filter((o) => o.isCreateNew), [options]);
  const normalOpts = useMemo(() => options.filter((o) => !o.isCreateNew), [options]);

  const filtered = useMemo(() => {
    const q = dq.toLowerCase();
    let list = normalOpts;
    if (activeFilter) {
      list = list.filter((o) => (o.secondary ?? "") === activeFilter);
    }
    if (q) {
      list = list.filter(
        (o) => o.label.toLowerCase().includes(q) || (o.secondary ?? "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [normalOpts, dq, activeFilter]);

  // agrupa preservando ordem; create-new sempre por último
  const groups = useMemo(() => {
    const map = new Map<string, ComboOption[]>();
    for (const o of filtered) {
      const g = o.group ?? "Resultados";
      (map.get(g) ?? map.set(g, []).get(g)!).push(o);
    }
    const entries = [...map.entries()];
    if (createOpts.length) entries.push(["Outra ação", createOpts]);
    return entries;
  }, [filtered, createOpts]);

  // lista achatada (para navegação por teclado)
  const flat = useMemo(() => groups.flatMap(([, opts]) => opts), [groups]);

  useEffect(() => {
    if (active >= flat.length) setActive(flat.length ? flat.length - 1 : 0);
  }, [flat.length, active]);

  const updatePosition = () => {
    if (!containerRef.current) return;
    const r = containerRef.current.getBoundingClientRect();
    const below = window.innerHeight - r.bottom;
    const above = r.top;
    const openUp = below < DROPDOWN_MAX && above > below;
    const h = Math.min(DROPDOWN_MAX, openUp ? above - 8 : below - 8);
    setPos({
      top: openUp ? r.top - h - 4 : r.bottom + 4,
      left: Math.max(8, Math.min(r.left, window.innerWidth - r.width - 8)),
      width: r.width,
    });
  };

  useLayoutEffect(() => {
    if (open) updatePosition();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (containerRef.current?.contains(t) || dropdownRef.current?.contains(t)) return;
      setOpen(false);
      setQuery("");
    };
    const reflow = () => updatePosition();
    document.addEventListener("mousedown", onDown);
    window.addEventListener("resize", reflow);
    window.addEventListener("scroll", reflow, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("resize", reflow);
      window.removeEventListener("scroll", reflow, true);
    };
  }, [open]);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const choose = (opt: ComboOption) => {
    onChange(opt.id);
    setOpen(false);
    setQuery("");
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(flat.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (flat[active]) choose(flat[active]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      setQuery("");
    }
  };

  let flatIndex = -1;

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%" }}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((p) => !p)}
        style={{
          width: "100%",
          minHeight: 40,
          padding: "8px 32px 8px 12px",
          background: T.layer1,
          border: `1px solid ${open ? "rgba(74,222,128,0.3)" : T.borderStrong}`,
          borderRadius: 8,
          color: T.bone,
          fontFamily: T.ui,
          fontSize: 13,
          textAlign: "left",
          cursor: "pointer",
          position: "relative",
          boxSizing: "border-box",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {closedLabel ?? <span style={{ color: T.fog }}>{placeholder}</span>}
        <svg
          width="10"
          height="6"
          viewBox="0 0 10 6"
          fill="none"
          style={{
            position: "absolute",
            right: 12,
            top: "50%",
            transform: `translateY(-50%) ${open ? "rotate(180deg)" : ""}`,
          }}
        >
          <path d="M1 1L5 5L9 1" stroke={T.fog} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      {open &&
        createPortal(
          <div
            ref={dropdownRef}
            role="listbox"
            style={{
              position: "fixed",
              top: pos.top,
              left: pos.left,
              width: pos.width,
              maxHeight: DROPDOWN_MAX,
              display: "flex",
              flexDirection: "column",
              background: CARD_BG,
              border: `1px solid ${T.borderStrong}`,
              borderRadius: 10,
              overflow: "hidden",
              zIndex: 9100,
              boxShadow: "0 12px 40px rgba(0,0,0,0.55)",
              fontFamily: T.ui,
            }}
          >
            <div style={{ padding: 10, borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                onKeyDown={onKeyDown}
                placeholder={placeholder}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: 8,
                  background: T.layer1,
                  border: `1px solid ${T.borderStrong}`,
                  color: T.bone,
                  fontSize: 13,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
              {filters && filters.length > 0 && (
                <select
                  value={activeFilter ?? ""}
                  onChange={(e) => setActiveFilter(e.target.value || null)}
                  aria-label="Filtrar por imobiliária"
                  style={{
                    marginTop: 8,
                    width: "100%",
                    minHeight: 34,
                    padding: "6px 28px 6px 10px",
                    borderRadius: 8,
                    background: T.layer1,
                    border: `1px solid ${activeFilter ? "rgba(74,222,128,0.3)" : T.borderStrong}`,
                    color: activeFilter ? T.sprout : T.dust,
                    fontSize: 12,
                    fontFamily: T.mono,
                    outline: "none",
                    boxSizing: "border-box",
                    appearance: "none",
                    WebkitAppearance: "none",
                    MozAppearance: "none",
                    backgroundImage: CHEVRON,
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "right 10px center",
                  }}
                >
                  <option value="">Imobiliária: Todas</option>
                  {filters.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div style={{ overflowY: "auto", flex: 1, minHeight: 0, WebkitOverflowScrolling: "touch" }}>
              {flat.length === 0 && (
                <div style={{ padding: "18px 14px", color: T.fog, fontSize: 12, textAlign: "center" }}>
                  Nenhum resultado{dq ? ` para "${dq}"` : ""}
                </div>
              )}
              {groups.map(([group, opts]) => (
                <div key={group}>
                  <div
                    style={{
                      padding: "6px 14px 4px",
                      fontFamily: T.mono,
                      fontSize: 9,
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                      color: T.slate,
                    }}
                  >
                    {group}
                  </div>
                  {opts.map((opt) => {
                    flatIndex += 1;
                    const idx = flatIndex;
                    const isActive = idx === active;
                    const isSelected = value === opt.id;
                    return (
                      <div
                        key={opt.id}
                        ref={isActive ? activeRef : undefined}
                        role="option"
                        aria-selected={isSelected}
                        onMouseEnter={() => setActive(idx)}
                        onClick={() => choose(opt)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 10,
                          minHeight: 44,
                          padding: "8px 14px",
                          cursor: "pointer",
                          background: isActive ? "rgba(74,222,128,0.08)" : "transparent",
                        }}
                      >
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div
                            style={{
                              fontSize: 13,
                              color: opt.isCreateNew ? T.sprout : T.bone,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {opt.isCreateNew ? opt.label : <Highlight text={opt.label} q={dq} />}
                          </div>
                          {opt.secondary && (
                            <div
                              style={{
                                fontSize: 10,
                                color: T.fog,
                                fontFamily: T.mono,
                                marginTop: 2,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              <Highlight text={opt.secondary} q={dq} />
                            </div>
                          )}
                        </div>
                        {opt.confidence != null && (
                          <span
                            style={{
                              fontFamily: T.mono,
                              fontSize: 10,
                              color: T.sprout,
                              background: T.sproutMuted,
                              border: `1px solid ${T.border}`,
                              borderRadius: 5,
                              padding: "1px 6px",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {Math.round(opt.confidence * 100)}%
                          </span>
                        )}
                        {isSelected && <span style={{ color: T.sprout, fontSize: 13 }}>✓</span>}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
