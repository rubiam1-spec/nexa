import { useEffect, useRef, useState } from "react";
import {
  searchClientsLite,
  searchBrokersLite,
  type PickOption,
} from "../../../infra/repositories/activityFieldsRepository";

// Busca-seleção de uma entidade (cliente ou corretor). Toque-primeiro:
// quando vazio, input com resultados; quando escolhido, chip removível.
export default function EntityPicker({
  accountId,
  entity,
  value,
  onChange,
  placeholder,
}: {
  accountId: string;
  entity: "client" | "broker";
  value: PickOption | null;
  onChange: (v: PickOption | null) => void;
  placeholder?: string;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PickOption[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const fn = entity === "client" ? searchClientsLite : searchBrokersLite;
        const r = await fn(accountId, q);
        if (!cancelled) setResults(r);
      } catch { if (!cancelled) setResults([]); }
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [q, accountId, entity, value]);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const T = { stone: "var(--border-default)", chalk: "var(--text-primary)", bone: "var(--text-secondary)", fog: "var(--text-muted)", sprout: "var(--interactive-primary)" };

  if (value) {
    return (
      <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 8, background: "rgba(74,222,128,0.08)", border: `1px solid ${T.sprout}40`, minHeight: 40 }}>
        <span style={{ fontSize: 13, color: T.chalk, fontWeight: 600 }}>{value.name}</span>
        <button type="button" onClick={() => { onChange(null); setQ(""); }} style={{ background: "none", border: "none", color: T.fog, fontSize: 16, cursor: "pointer", lineHeight: 1 }}>×</button>
      </div>
    );
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <input
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder ?? (entity === "client" ? "Buscar cliente…" : "Buscar corretor…")}
        style={{ width: "100%", boxSizing: "border-box", background: "var(--surface-base)", border: `1px solid ${T.stone}`, borderRadius: 8, padding: "10px 12px", color: T.chalk, fontSize: 13, outline: "none", minHeight: 40 }}
      />
      {open && results.length > 0 && (
        <div style={{ position: "absolute", left: 0, right: 0, top: "calc(100% + 4px)", zIndex: 50, background: "var(--surface-raised)", border: `1px solid ${T.stone}`, borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.4)", maxHeight: 220, overflowY: "auto" }}>
          {results.map((r) => (
            <button key={r.id} type="button" onClick={() => { onChange(r); setOpen(false); setResults([]); }} style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 12px", background: "transparent", border: "none", color: T.bone, fontSize: 13, cursor: "pointer", minHeight: 40 }} onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-hover)"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
              {r.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
