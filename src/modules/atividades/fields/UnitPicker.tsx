import { useEffect, useMemo, useRef, useState } from "react";
import { fetchUnitsLite, type UnitOption } from "../../../infra/repositories/activityFieldsRepository";

export type UnitValue = { id: string; label: string } | null;

function unitLabel(quadra: string | null, lote: string | null): string {
  const q = quadra ? `Q${quadra}` : "";
  const l = lote ? `L${lote}` : "";
  return [q, l].filter(Boolean).join(" · ") || "Unidade";
}

// Ordenação NUMÉRICA (quadra/lote são texto: L2 antes de L10).
function numCmp(a: string | null, b: string | null): number {
  const na = Number(a), nb = Number(b);
  if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
  return (a ?? "").localeCompare(b ?? "", "pt-BR", { numeric: true });
}

const STATUS: Record<string, { dot: string; suffix: string }> = {
  available: { dot: "#4ADE80", suffix: "" },
  in_negotiation: { dot: "#60A5FA", suffix: " · em negociação" },
  reserved: { dot: "#E0A23C", suffix: " · reservado" },
  sold: { dot: "var(--text-disabled)", suffix: " · vendido" },
};

export default function UnitPicker({
  accountId,
  developmentId,
  value,
  onChange,
  suggested,
}: {
  accountId: string;
  developmentId: string | null;
  value: UnitValue;
  onChange: (v: UnitValue) => void;
  suggested?: { id: string; quadra: string | null; lote: string | null } | null;
}) {
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [quadraFilter, setQuadraFilter] = useState<string>("all");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetchUnitsLite(accountId, developmentId).then((u) => { if (!cancelled) setUnits(u); }, () => {});
    return () => { cancelled = true; };
  }, [accountId, developmentId]);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const quadras = useMemo(() => {
    const set = new Set<string>();
    for (const u of units) if (u.quadra) set.add(u.quadra);
    return Array.from(set).sort(numCmp);
  }, [units]);

  // Agrupado por quadra (ordem numérica) + filtro por busca/quadra.
  const groups = useMemo(() => {
    const n = q.trim().toLowerCase();
    const filtered = units.filter((u) => {
      if (quadraFilter !== "all" && u.quadra !== quadraFilter) return false;
      if (n) return unitLabel(u.quadra, u.lote).toLowerCase().includes(n) || (u.lote ?? "").toLowerCase().includes(n) || (u.quadra ?? "").toLowerCase().includes(n);
      return true;
    });
    const byQ = new Map<string, UnitOption[]>();
    for (const u of filtered) {
      const key = u.quadra ?? "—";
      if (!byQ.has(key)) byQ.set(key, []);
      byQ.get(key)!.push(u);
    }
    const ordered = Array.from(byQ.entries()).sort(([a], [b]) => numCmp(a, b));
    for (const [, list] of ordered) list.sort((a, b) => numCmp(a.lote, b.lote));
    return ordered;
  }, [units, q, quadraFilter]);

  const T = { stone: "var(--border-default)", chalk: "var(--text-primary)", bone: "var(--text-secondary)", fog: "var(--text-muted)", sprout: "var(--interactive-primary)", carbon: "var(--surface-raised)", ink: "var(--surface-base)" };
  const MONO = "var(--font-mono)";

  const pick = (u: { id: string; quadra: string | null; lote: string | null }) => {
    onChange({ id: u.id, label: unitLabel(u.quadra, u.lote) });
    setOpen(false);
  };

  const dot = (status: string | null) => {
    const s = STATUS[status ?? ""] ?? STATUS.available;
    return s;
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      {value ? (
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 8, background: "rgba(74,222,128,0.08)", border: `1px solid ${T.sprout}40`, minHeight: 44 }}>
          <span style={{ fontSize: 13, color: T.chalk, fontWeight: 600 }}>{value.label}</span>
          <button type="button" onClick={() => onChange(null)} style={{ background: "none", border: "none", color: T.fog, fontSize: 16, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>
      ) : (
        <button type="button" onClick={() => setOpen((o) => !o)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", boxSizing: "border-box", padding: "10px 14px", borderRadius: 8, border: `1px solid ${T.stone}`, background: "var(--surface-base)", color: T.fog, fontSize: 13, cursor: "pointer", minHeight: 44 }}>
          Selecionar quadra/lote
          <span style={{ fontSize: 11 }}>▾</span>
        </button>
      )}

      {open && !value && (
        <div style={{ position: "absolute", left: 0, right: 0, top: "calc(100% + 4px)", zIndex: 60, background: T.ink, border: `1px solid ${T.stone}`, borderRadius: 10, boxShadow: "0 10px 28px rgba(0,0,0,0.5)", padding: 10, maxHeight: 280, overflowY: "auto" }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} autoFocus placeholder="Buscar lote…" style={{ width: "100%", boxSizing: "border-box", background: "var(--surface-base)", border: `1px solid ${T.stone}`, borderRadius: 8, padding: "8px 10px", color: T.chalk, fontSize: 13, outline: "none", marginBottom: 8 }} />

          {/* Filtro de quadra */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
            {["all", ...quadras].map((qd) => {
              const active = quadraFilter === qd;
              return (
                <button key={qd} type="button" onClick={() => setQuadraFilter(qd)} style={{ padding: "4px 10px", borderRadius: 14, minHeight: 30, border: `1px solid ${active ? T.sprout : T.stone}`, background: active ? "rgba(74,222,128,0.12)" : "transparent", color: active ? T.sprout : T.fog, fontSize: 11, fontFamily: MONO, fontWeight: 600, cursor: "pointer" }}>
                  {qd === "all" ? "Todas" : `Q${qd}`}
                </button>
              );
            })}
          </div>

          {/* Sugestão da negociação */}
          {suggested?.id && (
            <button type="button" onClick={() => pick(suggested)} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${T.sprout}40`, background: "rgba(74,222,128,0.08)", color: T.chalk, fontSize: 13, cursor: "pointer", marginBottom: 8, minHeight: 40, textAlign: "left" }}>
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", color: T.sprout, fontFamily: MONO }}>DA NEGOCIAÇÃO</span>
              {unitLabel(suggested.quadra, suggested.lote)}
            </button>
          )}

          {/* Lista agrupada por quadra (ordem numérica) */}
          {groups.map(([quadra, list]) => (
            <div key={quadra} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 9, color: T.fog, textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: MONO, fontWeight: 600, margin: "2px 2px 6px" }}>Quadra {quadra}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {list.map((u) => {
                  const s = dot(u.status);
                  return (
                    <button key={u.id} type="button" onClick={() => pick(u)} title={`L${u.lote}${s.suffix}`} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 8, border: `1px solid ${T.stone}`, background: T.carbon, color: T.bone, fontSize: 12, fontFamily: MONO, cursor: "pointer", minHeight: 36 }}>
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: s.dot, flexShrink: 0 }} />
                      L{u.lote}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {groups.length === 0 && <div style={{ fontSize: 12, color: T.fog, fontStyle: "italic", padding: 8 }}>Nenhum lote encontrado</div>}

          <button type="button" onClick={() => { onChange(null); setOpen(false); }} style={{ width: "100%", marginTop: 4, padding: "8px", borderRadius: 8, border: `1px dashed ${T.stone}`, background: "transparent", color: T.fog, fontSize: 12, cursor: "pointer", minHeight: 40 }}>Sem lote</button>
        </div>
      )}
    </div>
  );
}
