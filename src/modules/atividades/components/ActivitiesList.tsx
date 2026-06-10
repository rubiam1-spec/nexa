import { useEffect, useMemo, useRef, useState } from "react";
import { ACTIVITY_COLORS } from "../../../shared/utils/activityColors";
import { useIsMobile } from "../../../shared/hooks/useIsMobile";
import ParticipantAvatar from "./ParticipantAvatar";
import KindIcon from "./KindIcon";

export interface ListActivity {
  id: string;
  type: string;
  title: string;
  status?: string | null;
  activity_date: string;
  start_time: string | null;
  outcome_category?: string | null;
  column_id: string | null;
  archived_at?: string | null;
  activity_kinds?: { label?: string | null; icon?: string | null; base_type?: string | null } | null;
  activity_participants?: { participant_name: string; participant_type: string }[] | null;
}

interface ColumnInfo { id: string; name: string; color: string }

interface Props {
  activities: ListActivity[];
  columns: ColumnInfo[];
  onRowClick: (a: ListActivity) => void;
  onComplete: (a: ListActivity) => void;
  onEdit: (a: ListActivity) => void;
  onArchive: (id: string) => void;
  canManage: boolean;
  profileId: string | null;
}

const T = {
  stone: "var(--border-default)", chalk: "var(--text-primary)", bone: "var(--text-secondary)",
  fog: "var(--text-muted)", slate: "var(--text-disabled)", sprout: "var(--interactive-primary)",
  carbon: "var(--surface-raised)", red: "#F87171", blue: "#60A5FA", amber: "#E0A23C",
};
const MONO = "var(--font-mono)";

const TYPE_LABELS: Record<string, string> = {
  visit_broker: "Visita corretor", visit_client: "Visita cliente", visit_development: "Visita empreend.",
  phone_call: "Ligação", follow_up: "Follow-up", meeting_internal: "Reunião interna",
  meeting_external: "Reunião externa", training: "Treinamento", operational: "Operacional", other: "Outro",
};
const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  scheduled: { label: "Agendada", color: T.blue },
  in_progress: { label: "Em andamento", color: T.amber },
  completed: { label: "Concluída", color: T.sprout },
  skipped: { label: "Pulada", color: T.slate },
  expired: { label: "Atrasada", color: T.red },
};
const OUTCOME_BADGE: Record<string, { label: string; color: string }> = {
  avancou: { label: "Avançou", color: "#4ADE80" },
  neutro: { label: "Neutro", color: "#9C9686" },
  sem_sucesso: { label: "Sem sucesso", color: "#C2613A" },
  remarcou: { label: "Remarcou", color: "#E0A23C" },
};

function fmtDay(date: string): string {
  const d = new Date(date + "T12:00:00");
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const t = new Date(date + "T00:00:00");
  const diff = Math.round((t.getTime() - today.getTime()) / 86400000);
  const base = d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" });
  if (diff === 0) return `Hoje · ${base}`;
  if (diff === -1) return `Ontem · ${base}`;
  if (diff === 1) return `Amanhã · ${base}`;
  return base;
}

type SortKey = "date" | "type" | "status";
type GroupKey = "date" | "column" | "none";

export default function ActivitiesList({ activities, columns, onRowClick, onComplete, onEdit, onArchive }: Props) {
  const mobile = useIsMobile();
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [groupKey, setGroupKey] = useState<GroupKey>("date");
  const [hovered, setHovered] = useState<string | null>(null);
  const colMap = useMemo(() => { const m = new Map<string, ColumnInfo>(); for (const c of columns) m.set(c.id, c); return m; }, [columns]);

  const sorted = useMemo(() => {
    const arr = [...activities];
    arr.sort((a, b) => {
      if (sortKey === "type") return (a.type).localeCompare(b.type) || b.activity_date.localeCompare(a.activity_date);
      if (sortKey === "status") return (a.status || "").localeCompare(b.status || "") || b.activity_date.localeCompare(a.activity_date);
      return b.activity_date.localeCompare(a.activity_date) || (b.start_time || "").localeCompare(a.start_time || "");
    });
    return arr;
  }, [activities, sortKey]);

  const groups = useMemo(() => {
    if (groupKey === "none") return [["", sorted] as [string, ListActivity[]]];
    const map = new Map<string, ListActivity[]>();
    for (const a of sorted) {
      const key = groupKey === "date" ? a.activity_date : (a.column_id ?? "—");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    }
    const entries = Array.from(map.entries());
    if (groupKey === "date") entries.sort(([a], [b]) => b.localeCompare(a));
    return entries;
  }, [sorted, groupKey]);

  const groupLabel = (key: string) => groupKey === "date" ? fmtDay(key) : (colMap.get(key)?.name ?? "Sem coluna");

  return (
    <div style={{ marginTop: 8 }}>
      {/* Toolbar slim — contagem + pílulas Ordenar/Agrupar (sem <select> nativo) */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <span style={{ fontSize: 12, color: T.fog, fontFamily: MONO }}>{activities.length} atividade{activities.length === 1 ? "" : "s"}</span>
        <div style={{ flex: 1 }} />
        <PillDropdown label="Ordenar" value={sortKey} onChange={(v) => setSortKey(v as SortKey)} options={[{ value: "date", label: "Data" }, { value: "type", label: "Tipo" }, { value: "status", label: "Status" }]} />
        <PillDropdown label="Agrupar" value={groupKey} onChange={(v) => setGroupKey(v as GroupKey)} options={[{ value: "date", label: "Por dia" }, { value: "column", label: "Por coluna" }, { value: "none", label: "Nenhum" }]} />
      </div>

      {groups.map(([gkey, items]) => (
        <div key={gkey || "all"} style={{ marginBottom: 14 }}>
          {groupKey !== "none" && (
            <div style={{ fontFamily: MONO, fontSize: 10, color: T.fog, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, padding: "4px 2px", marginBottom: 2 }}>
              {groupLabel(gkey)} <span style={{ color: T.slate }}>· {items.length}</span>
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column" }}>
            {items.map((a) => {
              const color = (ACTIVITY_COLORS[a.type] || ACTIVITY_COLORS.other).color;
              const kindLabel = a.activity_kinds?.label || TYPE_LABELS[a.type] || a.type;
              const st = STATUS_BADGE[a.status || "scheduled"] ?? STATUS_BADGE.scheduled;
              const oc = a.outcome_category ? OUTCOME_BADGE[a.outcome_category] : null;
              const team = (a.activity_participants ?? []).filter((p) => p.participant_type === "user");
              const archived = !!a.archived_at;
              const isHover = hovered === a.id;
              return (
                <div key={a.id}
                  onMouseEnter={() => setHovered(a.id)} onMouseLeave={() => setHovered(null)}
                  onClick={() => onRowClick(a)}
                  style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 44, padding: "6px 10px 6px 0", borderBottom: `1px solid ${T.stone}`, cursor: "pointer", opacity: archived ? 0.55 : 1, background: isHover ? "var(--surface-hover)" : "transparent", borderRadius: 6 }}>
                  <div style={{ width: 4, alignSelf: "stretch", borderRadius: 2, background: color, flexShrink: 0, marginRight: 4 }} />
                  {!mobile && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, minWidth: 130, color, fontSize: 11, fontWeight: 600, fontFamily: MONO }}>
                      <KindIcon name={a.activity_kinds?.icon ?? a.type} size={13} color={color} sw={1.8} />
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{kindLabel}</span>
                    </span>
                  )}
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: T.chalk, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {a.title}
                    {archived && <span style={{ marginLeft: 8, fontSize: 9, fontFamily: MONO, color: T.slate, border: `1px solid ${T.stone}`, borderRadius: 4, padding: "1px 5px" }}>ARQUIVADA</span>}
                  </span>
                  {/* Participantes */}
                  <span style={{ display: "inline-flex", alignItems: "center", width: mobile ? "auto" : 70, justifyContent: "flex-start" }}>
                    {team.slice(0, 3).map((p, i) => <span key={i} style={{ marginLeft: i === 0 ? 0 : -8 }}><ParticipantAvatar name={p.participant_name} size={22} /></span>)}
                  </span>
                  <span style={{ fontFamily: MONO, fontSize: 11, color: T.bone, minWidth: 96, textAlign: "right" }}>
                    {new Date(a.activity_date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}{a.start_time ? ` ${a.start_time.slice(0, 5)}` : ""}
                  </span>
                  <span style={{ minWidth: 110 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, fontFamily: MONO, color: st.color, background: st.color + "1A", border: `1px solid ${st.color}33`, borderRadius: 12, padding: "2px 8px" }}>{st.label}</span>
                  </span>
                  {!mobile && <span style={{ minWidth: 84 }}>{oc && <span style={{ fontSize: 10, fontWeight: 600, fontFamily: MONO, color: oc.color }}>{oc.label}</span>}</span>}
                  {/* Ações no hover */}
                  <span style={{ display: "flex", gap: 2, width: mobile ? "auto" : 96, justifyContent: "flex-end", visibility: isHover || mobile ? "visible" : "hidden" }} onClick={(e) => e.stopPropagation()}>
                    {a.status !== "completed" && <RowBtn title="Concluir" onClick={() => onComplete(a)}>✓</RowBtn>}
                    <RowBtn title="Editar" onClick={() => onEdit(a)}>✎</RowBtn>
                    <RowBtn title="Arquivar" onClick={() => onArchive(a.id)}>📥</RowBtn>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      {activities.length === 0 && <div style={{ padding: 40, textAlign: "center", color: T.slate, fontSize: 13, fontStyle: "italic" }}>Nenhuma atividade no período.</div>}
    </div>
  );
}

// Pílula-dropdown no mesmo idioma dos filtros (sem <select> nativo).
function PillDropdown({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onClick); document.removeEventListener("keydown", onKey); };
  }, [open]);
  const current = options.find((o) => o.value === value)?.label ?? value;
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button type="button" onClick={() => setOpen((v) => !v)} style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 34, padding: "0 12px", borderRadius: 8, background: "var(--surface-raised)", border: `1px solid ${T.stone}`, color: T.bone, fontSize: 12, fontFamily: MONO, cursor: "pointer" }}>
        <span style={{ color: T.fog }}>{label}:</span> {current} <span style={{ fontSize: 9, color: T.fog }}>▾</span>
      </button>
      {open && (
        <div style={{ position: "absolute", top: 38, right: 0, zIndex: 200, background: T.carbon, border: `1px solid ${T.stone}`, borderRadius: 10, padding: 6, minWidth: 160, boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}>
          {options.map((o) => {
            const on = o.value === value;
            return (
              <button key={o.value} type="button" onClick={() => { onChange(o.value); setOpen(false); }} style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 10px", borderRadius: 6, border: "none", background: on ? "rgba(74,222,128,0.1)" : "transparent", color: on ? T.sprout : T.bone, fontSize: 13, cursor: "pointer", minHeight: 36 }}>{o.label}</button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RowBtn({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" title={title} onClick={onClick} style={{ width: 28, height: 28, borderRadius: 6, border: "none", background: "transparent", color: "var(--text-secondary)", fontSize: 12, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(112,107,95,0.18)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
      {children}
    </button>
  );
}
