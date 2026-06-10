import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ACTIVITY_COLORS } from "../../../shared/utils/activityColors";

export interface ArchivedActivity {
  id: string;
  type: string;
  title: string;
  archived_at?: string | null;
  activity_date: string;
  activity_kinds?: { label?: string | null } | null;
}

const T = {
  stone: "var(--border-default)", chalk: "var(--text-primary)", bone: "var(--text-secondary)",
  fog: "var(--text-muted)", slate: "var(--text-disabled)", sprout: "var(--interactive-primary)",
  carbon: "var(--surface-raised)", ink: "var(--surface-base)", red: "#F87171",
};
const MONO = "var(--font-mono)";
const TYPE_LABELS: Record<string, string> = {
  visit_broker: "Visita corretor", visit_client: "Visita cliente", visit_development: "Visita empreend.",
  phone_call: "Ligação", follow_up: "Follow-up", meeting_internal: "Reunião interna",
  meeting_external: "Reunião externa", training: "Treinamento", operational: "Operacional", other: "Outro",
};

function fmtArchived(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export default function ArchivedPanel({
  activities,
  canManage,
  onRestore,
  onDelete,
  onClose,
}: {
  activities: ArchivedActivity[];
  canManage: boolean;
  onRestore: (id: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ArchivedActivity | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const arr = activities.filter((a) => !q || a.title.toLowerCase().includes(q));
    return arr.sort((a, b) => (b.archived_at ?? "").localeCompare(a.archived_at ?? ""));
  }, [activities, search]);

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 9000 }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)" }} onClick={onClose} />
      <div style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: 560, maxWidth: "96vw", background: T.ink, borderLeft: `1px solid ${T.stone}`, boxShadow: "-12px 0 40px rgba(0,0,0,0.5)", display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px", borderBottom: `1px solid ${T.stone}`, flexShrink: 0 }}>
          <div>
            <h2 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontStyle: "italic", fontSize: 22, color: T.chalk, fontWeight: 400, margin: 0 }}>Arquivados</h2>
            <div style={{ fontSize: 12, color: T.fog, marginTop: 2 }}>{activities.length} no período · status preservado</div>
          </div>
          <button type="button" onClick={onClose} style={{ background: "none", border: "none", color: T.fog, fontSize: 22, cursor: "pointer" }}>×</button>
        </div>

        {/* Busca */}
        <div style={{ padding: "12px 22px", flexShrink: 0 }}>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por título…" style={{ width: "100%", boxSizing: "border-box", background: T.carbon, border: `1px solid ${T.stone}`, borderRadius: 8, color: T.chalk, fontSize: 13, padding: "9px 12px", outline: "none" }} />
        </div>

        {/* Lista */}
        <div style={{ flex: 1, overflowY: "auto", padding: "0 22px 22px" }}>
          {filtered.length === 0 && <div style={{ padding: 40, textAlign: "center", color: T.slate, fontSize: 13, fontStyle: "italic" }}>Nada arquivado no período.</div>}
          {filtered.map((a) => {
            const color = (ACTIVITY_COLORS[a.type] || ACTIVITY_COLORS.other).color;
            const label = a.activity_kinds?.label || TYPE_LABELS[a.type] || a.type;
            return (
              <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 52, padding: "8px 0", borderBottom: `1px solid ${T.stone}`, opacity: 0.62 }}>
                <div style={{ width: 4, alignSelf: "stretch", borderRadius: 2, background: color, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: T.chalk, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.title}</div>
                  <div style={{ fontSize: 11, color: T.fog, fontFamily: MONO, marginTop: 2 }}>{label} · arquivada em {fmtArchived(a.archived_at)}</div>
                </div>
                <button type="button" onClick={() => onRestore(a.id)} style={{ background: "transparent", border: `1px solid ${T.sprout}40`, color: T.sprout, borderRadius: 8, padding: "7px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>↩ Restaurar</button>
                {canManage && (
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    <button type="button" onClick={() => setMenuFor(menuFor === a.id ? null : a.id)} style={{ background: "none", border: "none", color: T.fog, fontSize: 16, cursor: "pointer", padding: "0 4px" }}>⋮</button>
                    {menuFor === a.id && (
                      <>
                        <div style={{ position: "fixed", inset: 0, zIndex: 1 }} onClick={() => setMenuFor(null)} />
                        <div style={{ position: "absolute", top: 24, right: 0, zIndex: 2, background: T.carbon, border: `1px solid ${T.stone}`, borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.4)", minWidth: 180 }}>
                          <button type="button" onClick={() => { setMenuFor(null); setConfirmDelete(a); }} style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 14px", background: "transparent", border: "none", color: T.red, fontSize: 13, cursor: "pointer" }}>Excluir definitivamente</button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Confirmação de exclusão definitiva */}
      {confirmDelete && (
        <div style={{ position: "absolute", inset: 0, zIndex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)" }} onClick={() => setConfirmDelete(null)} />
          <div style={{ position: "relative", background: T.ink, border: `1px solid ${T.stone}`, borderRadius: 14, padding: 24, width: 380, maxWidth: "90vw" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: T.chalk, marginBottom: 8 }}>Excluir definitivamente</div>
            <div style={{ fontSize: 13, color: T.fog, marginBottom: 20 }}>"{confirmDelete.title}" será removida para sempre. Esta ação não pode ser desfeita.</div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setConfirmDelete(null)} style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${T.stone}`, background: "transparent", color: T.bone, fontSize: 13, cursor: "pointer" }}>Cancelar</button>
              <button type="button" onClick={() => { const id = confirmDelete.id; setConfirmDelete(null); onDelete(id); }} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: T.red, color: T.ink, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
