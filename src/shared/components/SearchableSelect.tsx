import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface SearchableOption {
  value: string;
  label: string;
  sublabel?: string;
}

export interface SearchableSelectProps {
  options: SearchableOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  emptyLabel?: string;
  allowEmpty?: boolean;
  emptyOptionLabel?: string;
  disabled?: boolean;
  allowClear?: boolean;
}

const DROPDOWN_MAX_HEIGHT = 340;

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Buscar...",
  emptyLabel = "Nenhum resultado",
  allowEmpty = true,
  emptyOptionLabel = "Nenhum",
  disabled = false,
  allowClear = true,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [pos, setPos] = useState<{ top: number; left: number; width: number; openUp: boolean }>({
    top: 0, left: 0, width: 0, openUp: false,
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const safeOptions = useMemo(
    () => (options ?? []).filter((o) => o && o.value != null && o.label != null && String(o.label).trim() !== ""),
    [options],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return safeOptions;
    return safeOptions.filter((o) => {
      const label = String(o.label ?? "").toLowerCase();
      const sub = String(o.sublabel ?? "").toLowerCase();
      return label.includes(q) || sub.includes(q);
    });
  }, [safeOptions, search]);

  const selectedLabel = useMemo(() => {
    if (!value) return emptyOptionLabel;
    return safeOptions.find((o) => o.value === value)?.label ?? emptyOptionLabel;
  }, [value, safeOptions, emptyOptionLabel]);

  const updatePosition = () => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openUp = spaceBelow < DROPDOWN_MAX_HEIGHT && spaceAbove > spaceBelow;
    const h = Math.min(DROPDOWN_MAX_HEIGHT, openUp ? spaceAbove - 8 : spaceBelow - 8);
    setPos({
      top: openUp ? rect.top - h - 4 : rect.bottom + 4,
      left: rect.left,
      width: rect.width,
      openUp,
    });
  };

  useLayoutEffect(() => {
    if (isOpen) updatePosition();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onMouseDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (containerRef.current?.contains(t)) return;
      if (dropdownRef.current?.contains(t)) return;
      setIsOpen(false);
      setSearch("");
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setIsOpen(false); setSearch(""); }
    };
    const onReflow = () => updatePosition();
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onReflow);
    window.addEventListener("scroll", onReflow, true);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onReflow);
      window.removeEventListener("scroll", onReflow, true);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  const hasValue = Boolean(value);
  const showClear = allowClear && hasValue && !disabled;

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%" }}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((p) => !p)}
        style={{
          width: "100%", padding: `10px ${showClear ? 54 : 36}px 10px 14px`,
          background: "linear-gradient(145deg, var(--surface-raised), var(--surface-base))",
          border: `1px solid ${isOpen ? "rgba(74,222,128,0.25)" : "var(--border-default)"}`,
          borderRadius: 10,
          color: hasValue ? "var(--text-primary)" : "var(--text-muted)",
          fontFamily: "var(--font-sans)", fontSize: 13, textAlign: "left",
          cursor: disabled ? "not-allowed" : "pointer", position: "relative",
          transition: "border-color 0.15s", opacity: disabled ? 0.6 : 1,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}
      >
        {selectedLabel}
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none"
          style={{ position: "absolute", right: 14, top: "50%", transform: `translateY(-50%) ${isOpen ? "rotate(180deg)" : ""}`, transition: "transform 0.15s" }}>
          <path d="M1 1L5 5L9 1" stroke="#9C9686" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
      {showClear && (
        <span
          role="button"
          aria-label="Limpar seleção"
          onClick={(e) => { e.stopPropagation(); onChange(""); setSearch(""); setIsOpen(false); }}
          style={{
            position: "absolute", right: 32, top: "50%", transform: "translateY(-50%)",
            color: "var(--text-muted)", cursor: "pointer", fontSize: 16, lineHeight: 1,
            padding: "2px 6px", borderRadius: 6, userSelect: "none",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-overlay)"; e.currentTarget.style.color = "var(--text-primary)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-muted)"; }}
        >
          ×
        </span>
      )}

      {isOpen && createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: "fixed",
            top: pos.top, left: pos.left, width: pos.width,
            background: "var(--surface-raised)", border: "1px solid var(--border-default)",
            borderRadius: 10, zIndex: 99999, overflow: "hidden",
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            display: "flex", flexDirection: "column",
            maxHeight: DROPDOWN_MAX_HEIGHT,
          }}
        >
          <div style={{
            padding: "10px 12px", borderBottom: "1px solid var(--border-default)", flexShrink: 0,
            background: "var(--surface-raised)",
          }}>
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={placeholder}
              style={{
                width: "100%", padding: "8px 12px", borderRadius: 8,
                background: "var(--surface-base)", border: "1px solid var(--border-default)",
                color: "var(--text-primary)", fontFamily: "var(--font-sans)", fontSize: 13,
                outline: "none", boxSizing: "border-box",
              }}
            />
          </div>

          {search.trim() && (
            <div style={{
              padding: "4px 14px", fontSize: 10, color: "var(--text-muted)",
              fontFamily: "var(--font-mono)", letterSpacing: "0.06em",
              borderBottom: "1px solid var(--border-default)", background: "var(--surface-base)",
              flexShrink: 0,
            }}>
              {filtered.length} resultado{filtered.length !== 1 ? "s" : ""}
            </div>
          )}

          <div style={{
            overflowY: "auto", flex: 1, minHeight: 0,
            WebkitOverflowScrolling: "touch",
          }}>
            {allowEmpty && (
              <div
                onClick={() => { onChange(""); setIsOpen(false); setSearch(""); }}
                style={{
                  padding: "10px 14px", cursor: "pointer", minHeight: 44,
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
                  background: !value ? "rgba(74,222,128,0.06)" : "transparent",
                  color: "var(--text-muted)", fontSize: 13, fontFamily: "var(--font-sans)",
                  borderBottom: "1px solid rgba(42,40,34,0.3)",
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) => { if (value) e.currentTarget.style.background = "var(--surface-overlay)"; }}
                onMouseLeave={(e) => { if (value) e.currentTarget.style.background = "transparent"; }}
              >
                <span>{emptyOptionLabel}</span>
                {!value && <span style={{ color: "#4ADE80", fontSize: 14, flexShrink: 0 }}>✓</span>}
              </div>
            )}

            {filtered.length > 0 ? filtered.map((opt, idx) => {
              const isSelected = value === opt.value;
              const isLast = idx === filtered.length - 1;
              return (
                <div
                  key={opt.value}
                  onClick={() => { onChange(opt.value); setIsOpen(false); setSearch(""); }}
                  style={{
                    padding: "10px 14px", cursor: "pointer", minHeight: 44,
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
                    background: isSelected ? "rgba(74,222,128,0.06)" : "transparent",
                    borderBottom: isLast ? "none" : "1px solid rgba(42,40,34,0.15)",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = "var(--surface-overlay)"; }}
                  onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13, color: "var(--text-primary)", fontFamily: "var(--font-sans)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {opt.label}
                    </div>
                    {opt.sublabel && (
                      <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {opt.sublabel}
                      </div>
                    )}
                  </div>
                  {isSelected && <span style={{ color: "#4ADE80", fontSize: 14, flexShrink: 0 }}>✓</span>}
                </div>
              );
            }) : (
              <div style={{ padding: "20px 14px", color: "var(--text-muted)", fontSize: 12, textAlign: "center" }}>
                {search.trim() ? `Nenhum resultado para "${search}"` : emptyLabel}
              </div>
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
