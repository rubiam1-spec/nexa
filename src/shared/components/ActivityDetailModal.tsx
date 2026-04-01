import { createPortal } from "react-dom";

interface Activity {
  id: string; type: string; title: string; status: string;
  activity_date: string; start_time: string | null; duration_minutes: number;
  outcome: string | null; description: string | null; skip_reason: string | null;
  contact_name: string | null; created_at: string; updated_at?: string | null;
  profiles?: { name: string; role: string } | null;
}

interface ActivityParticipant {
  participant_type: string; participant_name: string; participant_detail: string | null;
}

const T = {
  ink: "var(--surface-base)", carbon: "var(--surface-raised)", stone: "var(--border-default)",
  chalk: "var(--text-primary)", bone: "var(--text-secondary)", fog: "var(--text-muted)",
  slate: "var(--text-disabled)", sprout: "var(--interactive-primary)", blue: "#60A5FA",
  red: "#F87171", amber: "#FBBF24", purple: "#A78BFA",
};

const TYPE_LABELS: Record<string, string> = {
  visit_broker: "Visita corretor", visit_client: "Visita cliente", visit_development: "Visita empreend.",
  training: "Treinamento", phone_call: "Ligação", follow_up: "Follow-up",
  meeting_internal: "Reunião interna", meeting_external: "Reunião externa", other: "Outro",
};

const PCOLORS: Record<string, string> = { broker: "#4ADE80", client: "#60A5FA", user: "#A78BFA", external: "#9C9686" };

function fmtDuration(m: number) { if (!m) return "—"; if (m < 60) return `${m}min`; const h = Math.floor(m / 60); const r = m % 60; return r > 0 ? `${h}h${r}min` : `${h}h`; }
function todayStr() { return new Date().toISOString().slice(0, 10); }

export default function ActivityDetailModal({ activity, participants, onClose, onEdit, onComplete, onSkip, onDelete, canEdit }: {
  activity: Activity; participants: ActivityParticipant[]; onClose: () => void;
  onEdit?: () => void; onComplete?: () => void; onSkip?: () => void; onDelete?: () => void;
  canEdit?: boolean;
}) {
  const mobile = typeof window !== "undefined" && window.innerWidth < 768;
  const st = activity.status || "completed";
  const isScheduled = st === "scheduled";
  const isExpired = st === "expired";
  const isSkipped = st === "skipped";
  const isCompleted = st === "completed";
  const isOverdue = isScheduled && activity.activity_date < todayStr();
  const isToday = activity.activity_date === todayStr();
  const daysUntil = Math.ceil((new Date(activity.activity_date + "T12:00:00").getTime() - Date.now()) / 864e5);
  const wasEdited = activity.updated_at && activity.created_at && new Date(activity.updated_at).getTime() - new Date(activity.created_at).getTime() > 5000;

  const dateLabel = new Date(activity.activity_date + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const statusLabel = isOverdue ? `Atrasada — há ${Math.abs(daysUntil)} dias` : isExpired ? `Expirada — ${Math.abs(daysUntil)} dias sem ação` : isToday && isScheduled ? "Hoje" : isScheduled ? `Agendada — em ${daysUntil} dias` : isSkipped ? "Pulada" : "";
  const statusColor = isOverdue || isExpired ? T.red : isToday && isScheduled ? T.blue : isScheduled ? T.blue : isSkipped ? T.slate : T.sprout;

  return createPortal(
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 9998 }} />
      <div style={mobile
        ? { position: "fixed", inset: 0, zIndex: 9999, overflowY: "auto", background: T.ink }
        : { position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 9999, width: 480, maxWidth: "95vw", maxHeight: "90vh", overflowY: "auto", background: T.ink, border: `1px solid ${T.stone}`, borderRadius: 16, boxShadow: "0 24px 64px rgba(0,0,0,0.5)" }
      }>
        {/* Header */}
        <div style={{ padding: "20px 24px 16px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <span style={{ padding: "4px 12px", borderRadius: 6, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", background: isScheduled || isExpired ? "transparent" : statusColor + "20", border: isScheduled || isExpired ? `1px solid ${statusColor}` : "none", color: statusColor }}>{TYPE_LABELS[activity.type] || activity.type}</span>
          <button type="button" onClick={onClose} style={{ background: "none", border: "none", color: T.fog, fontSize: 22, cursor: "pointer", padding: "0 4px", lineHeight: 1 }}>×</button>
        </div>

        {/* Title */}
        <div style={{ padding: "0 24px 16px" }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: T.chalk, margin: 0, textDecoration: isSkipped ? "line-through" : "none" }}>{activity.title}</h2>
        </div>

        {/* Info rows */}
        <div style={{ padding: "0 24px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: T.bone }}>
            <span>📅</span> <span style={{ textTransform: "capitalize" }}>{dateLabel}{activity.start_time ? ` às ${activity.start_time.substring(0, 5)}` : ""}</span>
          </div>
          {isCompleted && <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: T.bone }}><span>⏱</span> <span>{fmtDuration(activity.duration_minutes)}</span></div>}
        </div>

        {/* Participants */}
        {(participants.length > 0 || activity.contact_name) && (
          <div style={{ padding: "0 24px 16px" }}>
            <div style={{ fontSize: 10, color: T.fog, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "var(--font-mono)", marginBottom: 8 }}>PARTICIPANTES</div>
            <div style={{ background: T.carbon, borderRadius: 10, border: `1px solid ${T.stone}`, overflow: "hidden" }}>
              {participants.length > 0 ? participants.map((p, i) => (
                <div key={i} style={{ padding: "10px 14px", borderBottom: i < participants.length - 1 ? `1px solid ${T.stone}` : "none", display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: PCOLORS[p.participant_type] || T.slate, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 13, color: T.bone }}>{p.participant_name}</div>
                    {p.participant_detail && <div style={{ fontSize: 11, color: T.slate }}>{p.participant_detail}</div>}
                  </div>
                </div>
              )) : activity.contact_name && (
                <div style={{ padding: "10px 14px", fontSize: 13, color: T.bone }}>{activity.contact_name}</div>
              )}
            </div>
          </div>
        )}

        {/* Status badge */}
        {statusLabel && (
          <div style={{ padding: "0 24px 16px" }}>
            <div style={{ fontSize: 10, color: T.fog, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "var(--font-mono)", marginBottom: 8 }}>STATUS</div>
            <div style={{ padding: "10px 14px", borderRadius: 8, background: statusColor + "10", border: `1px solid ${statusColor}30`, fontSize: 13, color: statusColor, fontWeight: 500 }}>{statusLabel}</div>
          </div>
        )}

        {/* Description */}
        {activity.description && (
          <div style={{ padding: "0 24px 16px" }}>
            <div style={{ fontSize: 10, color: T.fog, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "var(--font-mono)", marginBottom: 8 }}>OBSERVAÇÕES</div>
            <div style={{ fontSize: 13, color: T.bone, lineHeight: 1.6 }}>{activity.description}</div>
          </div>
        )}

        {/* Result */}
        {isCompleted && (
          <div style={{ padding: "0 24px 16px" }}>
            <div style={{ fontSize: 10, color: T.fog, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "var(--font-mono)", marginBottom: 8 }}>RESULTADO</div>
            <div style={{ fontSize: 13, color: activity.outcome ? T.bone : T.slate, lineHeight: 1.6 }}>{activity.outcome || "Não registrado"}</div>
          </div>
        )}

        {/* Skip reason */}
        {isSkipped && activity.skip_reason && (
          <div style={{ padding: "0 24px 16px" }}>
            <div style={{ fontSize: 10, color: T.fog, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "var(--font-mono)", marginBottom: 8 }}>MOTIVO</div>
            <div style={{ fontSize: 13, color: T.amber, lineHeight: 1.6 }}>{activity.skip_reason}</div>
          </div>
        )}

        {/* Footer */}
        <div style={{ padding: "12px 24px 8px", borderTop: `1px solid ${T.stone}` }}>
          <div style={{ fontSize: 11, color: T.slate }}>
            Criada por {activity.profiles?.name || "—"} em {new Date(activity.created_at).toLocaleDateString("pt-BR")}
            {wasEdited && <span style={{ fontStyle: "italic" }}> · editada ✎</span>}
          </div>
        </div>

        {/* Action buttons */}
        {canEdit && (
          <div style={{ padding: "12px 24px 20px", display: "flex", gap: 8, flexWrap: "wrap" }}>
            {(isScheduled || isExpired) && onComplete && <button type="button" onClick={onComplete} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", background: T.sprout, color: "var(--interactive-on-primary)", fontSize: 13, fontWeight: 700, cursor: "pointer", minWidth: 100 }}>{isExpired ? "✓ Concluir mesmo assim" : "✓ Concluir"}</button>}
            {!isSkipped && onEdit && <button type="button" onClick={onEdit} style={{ flex: 1, padding: "10px", borderRadius: 8, border: `1px solid ${T.stone}`, background: "transparent", color: T.bone, fontSize: 13, cursor: "pointer", minWidth: 80 }}>✎ Editar</button>}
            {(isScheduled || isExpired) && onSkip && <button type="button" onClick={onSkip} style={{ flex: 1, padding: "10px", borderRadius: 8, border: `1px solid ${T.amber}30`, background: T.amber + "10", color: T.amber, fontSize: 13, cursor: "pointer", minWidth: 80 }}>⊘ Pular</button>}
            {onDelete && <button type="button" onClick={onDelete} style={{ padding: "10px 16px", borderRadius: 8, border: `1px solid ${T.red}30`, background: T.red + "10", color: T.red, fontSize: 13, cursor: "pointer" }}>Excluir</button>}
          </div>
        )}
      </div>
    </>,
    document.body,
  );
}
