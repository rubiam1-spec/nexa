import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../../infra/supabase/supabaseClient";

export interface Participant {
  type: "broker" | "client" | "user" | "external";
  id: string | null;
  name: string;
  detail?: string;
}

const COLORS: Record<string, string> = { broker: "#4ADE80", client: "#60A5FA", user: "#A78BFA", external: "#9C9686" };
const LABELS: Record<string, string> = { broker: "Corretor", client: "Cliente", user: "Equipe", external: "Externo" };

export default function ParticipantInput({ accountId, value, onChange }: { accountId: string; value: Participant[]; onChange: (v: Participant[]) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Participant[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const search = useCallback(async (q: string) => {
    if (!supabase || !accountId || q.length < 2) { setResults([]); return; }
    setLoading(true);
    try {
      const [bRes, cRes, uRes] = await Promise.all([
        supabase.from("brokers").select("id, name").eq("account_id", accountId).eq("status", "active").ilike("name", `%${q}%`).limit(4),
        supabase.from("clients").select("id, name").eq("account_id", accountId).ilike("name", `%${q}%`).limit(4),
        supabase.from("user_account_access").select("user_id, role, profiles!inner(id, name)").eq("account_id", accountId).limit(10),
      ]);
      const r: Participant[] = [];
      for (const b of (bRes.data ?? []) as Record<string, unknown>[]) r.push({ type: "broker", id: b.id as string, name: b.name as string, detail: "Corretor" });
      for (const c of (cRes.data ?? []) as Record<string, unknown>[]) r.push({ type: "client", id: c.id as string, name: c.name as string, detail: "Cliente" });
      for (const u of (uRes.data ?? []) as Record<string, unknown>[]) {
        const p = (Array.isArray(u.profiles) ? u.profiles[0] : u.profiles) as Record<string, unknown> | null;
        if (p && (p.name as string).toLowerCase().includes(q.toLowerCase())) r.push({ type: "user", id: p.id as string, name: p.name as string, detail: LABELS.user });
      }
      // Filter out already selected
      const selectedIds = new Set(value.map((v) => v.id).filter(Boolean));
      setResults(r.filter((x) => !x.id || !selectedIds.has(x.id)));
    } catch { setResults([]); }
    finally { setLoading(false); }
  }, [accountId, value]);

  useEffect(() => {
    if (query.length < 2) { setResults([]); return; }
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => search(query), 300);
    return () => clearTimeout(timerRef.current);
  }, [query, search]);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  function add(p: Participant) { onChange([...value, p]); setQuery(""); setResults([]); setOpen(false); }
  function remove(idx: number) { onChange(value.filter((_, i) => i !== idx)); }
  function addExternal() { if (query.trim()) { add({ type: "external", id: null, name: query.trim() }); } }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      {/* Chips */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: value.length > 0 ? 8 : 0 }}>
        {value.map((p, i) => (
          <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 6, background: COLORS[p.type] + "15", border: `1px solid ${COLORS[p.type]}30`, fontSize: 12, color: COLORS[p.type] }}>
            {p.name}
            <button type="button" onClick={() => remove(i)} style={{ background: "none", border: "none", color: COLORS[p.type], fontSize: 14, cursor: "pointer", padding: 0, lineHeight: 1 }}>×</button>
          </span>
        ))}
      </div>
      {/* Input */}
      <input
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => { if (query.length >= 2) setOpen(true); }}
        onKeyDown={(e) => { if (e.key === "Enter" && query.trim() && results.length === 0) { e.preventDefault(); addExternal(); } }}
        placeholder={value.length > 0 ? "Adicionar participante..." : "Buscar corretor, cliente, equipe..."}
        style={{ width: "100%", background: "var(--surface-base)", border: "1px solid var(--border-default)", borderRadius: 8, padding: "11px 14px", color: "var(--text-primary)", fontSize: 13, outline: "none", boxSizing: "border-box" }}
      />
      {/* Dropdown */}
      {open && (query.length >= 2 || results.length > 0) && (
        <div style={{ position: "absolute", left: 0, right: 0, top: "100%", marginTop: 4, background: "var(--surface-raised)", border: "1px solid var(--border-default)", borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.4)", zIndex: 50, maxHeight: 240, overflowY: "auto" }}>
          {loading && <div style={{ padding: "10px 14px", fontSize: 12, color: "var(--text-disabled)" }}>Buscando...</div>}
          {!loading && results.length === 0 && query.length >= 2 && (
            <button type="button" onClick={addExternal} style={{ display: "block", width: "100%", padding: "10px 14px", background: "transparent", border: "none", textAlign: "left", color: "var(--text-muted)", fontSize: 13, cursor: "pointer" }} onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-hover)"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
              + Adicionar &quot;{query}&quot; como participante externo
            </button>
          )}
          {results.map((r, i) => (
            <button key={i} type="button" onClick={() => add(r)} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 14px", background: "transparent", border: "none", textAlign: "left", cursor: "pointer" }} onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-hover)"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: COLORS[r.type], flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{r.name}</div>
                <div style={{ fontSize: 10, color: "var(--text-disabled)" }}>{r.detail || LABELS[r.type]}</div>
              </div>
            </button>
          ))}
          {results.length > 0 && query.trim() && (
            <button type="button" onClick={addExternal} style={{ display: "block", width: "100%", padding: "8px 14px", background: "transparent", border: "none", borderTop: "1px solid var(--border-default)", textAlign: "left", color: "var(--text-disabled)", fontSize: 12, cursor: "pointer" }} onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-hover)"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
              + Adicionar &quot;{query}&quot; como externo
            </button>
          )}
        </div>
      )}
    </div>
  );
}
