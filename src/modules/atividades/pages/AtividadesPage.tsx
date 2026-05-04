import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { createPortal } from "react-dom";
import { useAccount } from "../../../app/contexts/AccountContext";
import { useDevelopment } from "../../../app/contexts/DevelopmentContext";
import { useAuth } from "../../../app/contexts/AuthContext";
import { supabase } from "../../../infra/supabase/supabaseClient";
import { useIsMobile } from "../../../shared/hooks/useIsMobile";
import { IcVisita, IcClientes, IcEmpreendimentos, IcTreinamento, IcLigacao, IcFollowUp, IcReuniao, IcImobiliarias, IcOutro } from "../../../shared/components/icons/NexaIcons";
import ParticipantInput, { type Participant } from "../../../shared/components/ParticipantInput";
import ActivityDetailModal from "../../../shared/components/ActivityDetailModal";
import PhotoUpload from "../../../shared/components/PhotoUpload";
import WeeklyCalendar from "../components/WeeklyCalendar";
import DailyCalendarMobile from "../components/DailyCalendarMobile";
import FilterChips, { type FilterChip } from "../components/FilterChips";
import { isCommercialInternalRole } from "../constants/teamScope";
import { useActivityPeriod, type Period } from "../hooks/useActivityPeriod";
import { formatDateBRT, formatDateTimeBRT, formatDateLongBRT, formatWeekdayDateLongBRT } from "../../../shared/utils/dateUtils";
import { toActivityMomentBRT, decideInitialActivityStatus } from "../../../domain/atividade/ActivityScheduling";

// ── Tokens ──

const T = {
  ink: "var(--surface-base)", carbon: "var(--surface-raised)", stone: "var(--border-default)", sandstone: "var(--surface-hover)",
  sprout: "var(--interactive-primary)", sproutDim: "var(--interactive-hover)", chalk: "var(--text-primary)", bone: "var(--text-secondary)",
  fog: "var(--text-muted)", slate: "var(--text-disabled)", blue: "#60A5FA", purple: "#A78BFA",
  amber: "#FBBF24", orange: "#F97316", red: "#F87171",
};

// ── Types ──

type ActivityType = "visit_broker" | "visit_client" | "visit_development" | "training" | "phone_call" | "follow_up" | "meeting_internal" | "meeting_external" | "other";

type ActivityStatus = "completed" | "scheduled" | "skipped" | "expired";

interface Activity {
  id: string; account_id: string; development_id: string; profile_id: string;
  type: ActivityType; title: string; status: ActivityStatus;
  client_id: string | null; broker_id: string | null;
  contact_name: string | null; contact_company: string | null;
  activity_date: string; start_time: string | null; duration_minutes: number;
  outcome: string | null; next_action: string | null; next_action_date: string | null;
  description: string | null; skip_reason: string | null; created_at: string; updated_at?: string | null;
  clients?: { name: string } | null; brokers?: { name: string } | null;
  profiles?: { name: string; role: string } | null;
  activity_photos?: { id: string; photo_url: string }[] | null;
  activity_participants?: { participant_name: string; participant_type: string }[] | null;
  third_party_property?: { id: string; titulo: string } | null;
}

interface RankedMember {
  id: string; name: string; role: string; roleLabel: string;
  count: number; totalMinutes: number; avg: string; hours: string;
  alert?: string; streak: number; trendDelta: number;
}

// ── Config ──

const badgeColors: Record<string, string> = {
  visit_broker: T.blue, visit_client: T.sprout, visit_development: T.purple,
  training: T.purple, phone_call: T.sprout, follow_up: T.orange,
  meeting_internal: T.amber, meeting_external: T.amber, other: T.fog,
};
const badgeLabels: Record<string, string> = {
  visit_broker: "Visita corretor", visit_client: "Visita cliente", visit_development: "Visita empreend.",
  training: "Treinamento", phone_call: "Ligação", follow_up: "Follow-up",
  meeting_internal: "Reunião interna", meeting_external: "Reunião externa", other: "Outro",
};
const typeIcons: Record<string, React.ReactNode> = {
  visit_broker: <IcVisita size={20} color="#F87171" sw={2} />, visit_client: <IcClientes size={20} color="#A78BFA" sw={2} />, visit_development: <IcEmpreendimentos size={20} color="#FBBF24" sw={2} />, training: <IcTreinamento size={20} color="#60A5FA" sw={2} />,
  phone_call: <IcLigacao size={20} color="#F87171" sw={2} />, follow_up: <IcFollowUp size={20} color="#4ADE80" sw={2} />, meeting_internal: <IcReuniao size={20} color="#FBBF24" sw={2} />, meeting_external: <IcImobiliarias size={20} color="#60A5FA" sw={2} />, other: <IcOutro size={20} color="#9C9686" sw={2} />,
};
const typePlaceholders: Record<string, string> = {
  visit_broker: "Ex: Visita Imobiliária Casa Nova", visit_client: "Ex: Visita ao cliente André",
  visit_development: "Ex: Visita ao empreendimento Parque", training: "Ex: Treinamento equipe Imob. Horizonte",
  phone_call: "Ex: Retorno cliente André", follow_up: "Ex: Follow-up proposta Maria",
  meeting_internal: "Ex: Alinhamento semanal equipe", meeting_external: "Ex: Reunião com parceiro XYZ", other: "Atividade...",
};
const DURATIONS = [
  { label: "15min", value: 15 }, { label: "30min", value: 30 }, { label: "1h", value: 60 },
  { label: "1h30", value: 90 }, { label: "2h", value: 120 }, { label: "3h+", value: 180 },
];
const ROLE_LABELS: Record<string, string> = { director: "Diretor", manager: "Gestor", commercial_consultant: "Consultor", broker: "Corretor", administrative: "Administrativo" };

// ── Helpers ──

function todayStr() { return new Date().toISOString().slice(0, 10); }
function yesterdayStr() { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); }
function startOfWeek() { const d = new Date(); const diff = d.getDay() === 0 ? -6 : 1 - d.getDay(); const m = new Date(d); m.setDate(d.getDate() + diff); return m.toISOString().slice(0, 10); }
function startOfMonth() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`; }
function daysDiff(dateStr: string) { return Math.floor((Date.now() - new Date(dateStr + "T12:00:00").getTime()) / 864e5); }
function daysSinceMonthStart() { return new Date().getDate(); }
function fmtDuration(m: number) { if (m < 60) return `${m}min`; const h = Math.floor(m / 60); const r = m % 60; return r > 0 ? `${h}h${r.toString().padStart(2, "0")}` : `${h}h`; }
function initials(name: string) { return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase(); }
function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const label = formatDateLongBRT(d).replace(/ de \d{4}$/, "");
  if (dateStr === todayStr()) return `Hoje — ${label}`;
  if (dateStr === yesterdayStr()) return `Ontem — ${label}`;
  return label;
}
function calculateStreak(acts: Activity[], pid: string): number {
  const dates = [...new Set(acts.filter((a) => a.profile_id === pid).map((a) => a.activity_date))].sort().reverse();
  if (!dates.length) return 0;
  const today = todayStr();
  const yesterday = yesterdayStr();
  if (dates[0] !== today && dates[0] !== yesterday) return 0;
  let streak = 0;
  const check = new Date(dates[0] + "T12:00:00");
  for (const d of dates) {
    if (d === check.toISOString().slice(0, 10)) { streak++; check.setDate(check.getDate() - 1); }
    else break;
  }
  return streak;
}

// ── Sub-components ──

function KpiCard({ label, value, delta, warn, icon, accent, deltaPct, progressPct, compact, tooltip }: { label: string; value: string | number; delta?: string; warn?: boolean; icon?: string; accent?: string; deltaPct?: number; progressPct?: number; compact?: boolean; tooltip?: string }) {
  const color = accent || (warn ? T.amber : T.sprout);
  const glyph = icon || (label[0] || "·").toUpperCase();
  const positive = deltaPct !== undefined && deltaPct >= 0;
  // Onda 2.1: variante compact = fita única, label + valor numa linha,
  // sem progress bar nem bloco de delta vertical (delta vira inline).
  // Onda 3.2: tooltip explica o cálculo subjacente do KPI.
  if (compact) {
    return (
      <div title={tooltip} style={{
        position: "relative",
        background: "var(--surface-raised)",
        borderRadius: 8, padding: "8px 12px",
        border: "1px solid var(--border-default)",
        flex: 1, minWidth: 120,
        display: "flex", flexDirection: "column", gap: 2,
        cursor: tooltip ? "help" : "default",
      }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: T.fog, letterSpacing: "0.08em", textTransform: "uppercase" }}>{label}</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 700, color: warn ? T.amber : T.chalk, lineHeight: 1.1 }}>{value}</span>
          {deltaPct !== undefined && (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: positive ? T.sprout : T.red, fontWeight: 600 }}>
              {positive ? "+" : ""}{deltaPct}%
            </span>
          )}
        </div>
      </div>
    );
  }
  return (
    <div style={{
      position: "relative", overflow: "hidden",
      background: "linear-gradient(145deg, var(--surface-raised), var(--surface-base))",
      borderRadius: 10, padding: "14px 16px",
      border: "1px solid var(--border-default)", flex: 1, minWidth: 120,
    }}>
      <div aria-hidden style={{
        position: "absolute", top: -15, right: -15, width: 60, height: 60,
        borderRadius: "50%", background: color + "15", filter: "blur(15px)", pointerEvents: "none",
      }} />
      <div style={{ position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: T.fog, letterSpacing: "0.1em", textTransform: "uppercase" }}>{label}</span>
          <span style={{
            width: 22, height: 22, borderRadius: 5, background: color + "18",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, color,
          }}>{glyph}</span>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 6 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 24, fontWeight: 700, color: T.chalk }}>{value}</span>
          {delta && <span style={{ fontSize: 11, color: warn ? T.amber : T.sprout, fontFamily: "var(--font-mono)", fontWeight: 600 }}>{delta}</span>}
        </div>
        {deltaPct !== undefined && (
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: positive ? T.sprout : T.red, marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
            <span>{positive ? "+" : ""}{deltaPct}%</span>
            <span style={{ color: T.slate }}>vs anterior</span>
          </div>
        )}
        {progressPct !== undefined && (
          <div style={{ height: 3, borderRadius: 2, marginTop: 6, background: "rgba(42,40,34,0.3)", overflow: "hidden" }}>
            <div style={{ height: "100%", borderRadius: 2, width: `${Math.min(Math.max(progressPct, 0), 100)}%`, background: `linear-gradient(90deg, ${color}80, ${color})`, transition: "width 0.5s" }} />
          </div>
        )}
      </div>
    </div>
  );
}

function TodayCard({ activity, variant, onClick }: { activity: Activity; variant: "overdue" | "today" | "upcoming"; onClick: () => void }) {
  const palette = variant === "overdue"
    ? { border: "rgba(248,113,113,0.25)", glow: "rgba(248,113,113,0.06)", accent: "#F87171" }
    : variant === "today"
    ? { border: "rgba(74,222,128,0.25)", glow: "rgba(74,222,128,0.05)", accent: "#4ADE80" }
    : { border: "var(--border-default)", glow: "transparent", accent: "#9C9686" };

  const daysLate = variant === "overdue" ? Math.max(1, daysDiff(activity.activity_date)) : 0;
  const dateLabel = variant === "overdue"
    ? `${daysLate} dia${daysLate > 1 ? "s" : ""} de atraso`
    : variant === "today"
    ? "Hoje"
    : (() => { const d = new Date(activity.activity_date + "T12:00:00"); return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }); })();

  const participantName = activity.activity_participants?.length
    ? activity.activity_participants[0].participant_name
    : activity.contact_name;

  return (
    <div
      onClick={onClick}
      onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.borderColor = "rgba(74,222,128,0.3)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.borderColor = palette.border; }}
      style={{
        display: "flex", alignItems: "center", gap: 14,
        padding: "14px 16px", marginBottom: 4, cursor: "pointer",
        background: `linear-gradient(145deg, ${palette.glow}, var(--surface-base))`,
        border: `1px solid ${palette.border}`,
        borderRadius: 10, transition: "transform 0.15s, border-color 0.15s",
      }}
    >
      <div style={{
        fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 700,
        color: palette.accent, minWidth: 56, textAlign: "center",
      }}>
        {activity.start_time ? activity.start_time.substring(0, 5) : "—"}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: T.chalk, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {activity.title}
        </div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: T.fog, marginTop: 3, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {activity.profiles?.name && <span>{activity.profiles.name}</span>}
          {participantName && <>
            <span style={{ color: "#3D3A30" }}>·</span>
            <span>Com: {participantName}</span>
          </>}
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: palette.accent, fontWeight: 600 }}>
          {dateLabel}
        </div>
        {activity.duration_minutes > 0 && (
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: T.slate, marginTop: 2 }}>
            {fmtDuration(activity.duration_minutes)}
          </div>
        )}
      </div>
    </div>
  );
}

function TodayBlock({ overdue, today, upcoming, onClickActivity }: { overdue: Activity[]; today: Activity[]; upcoming: Activity[]; onClickActivity: (a: Activity) => void }) {
  const hasOverdue = overdue.length > 0;
  const hasToday = today.length > 0;
  const hasUpcoming = upcoming.length > 0;
  const isEmpty = !hasOverdue && !hasToday && !hasUpcoming;

  if (isEmpty) {
    return (
      <div style={{
        padding: "20px", marginBottom: 16,
        background: "linear-gradient(145deg, var(--surface-raised), var(--surface-base))",
        border: "1px solid var(--border-default)", borderRadius: 12, textAlign: "center",
      }}>
        <div style={{ fontSize: 13, color: T.bone, marginBottom: 4 }}>Nenhuma atividade pendente</div>
        <div style={{ fontSize: 11, color: T.fog, fontFamily: "var(--font-mono)" }}>Registre uma visita ou agende um follow-up</div>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 16 }}>
      {hasOverdue && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#F87171", letterSpacing: "0.1em", marginBottom: 8, display: "flex", alignItems: "center", gap: 6, fontWeight: 700 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#F87171" }} />
            {overdue.length} ATRASADA{overdue.length > 1 ? "S" : ""}
          </div>
          {overdue.map((a) => <TodayCard key={a.id} activity={a} variant="overdue" onClick={() => onClickActivity(a)} />)}
        </div>
      )}

      <div style={{ marginBottom: hasUpcoming ? 12 : 0 }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: hasToday ? "#4ADE80" : "#706B5F", letterSpacing: "0.1em", marginBottom: 8, display: "flex", alignItems: "center", gap: 6, fontWeight: 700 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: hasToday ? "#4ADE80" : "#3D3A30" }} />
          HOJE
          {!hasToday && <span style={{ color: T.slate, fontStyle: "italic", fontWeight: 400, letterSpacing: 0 }}>— nenhuma atividade</span>}
        </div>
        {today.map((a) => <TodayCard key={a.id} activity={a} variant="today" onClick={() => onClickActivity(a)} />)}
      </div>

      {hasUpcoming && (
        <div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: T.fog, letterSpacing: "0.1em", marginBottom: 8, fontWeight: 700 }}>
            PRÓXIMOS DIAS
          </div>
          {upcoming.map((a) => <TodayCard key={a.id} activity={a} variant="upcoming" onClick={() => onClickActivity(a)} />)}
        </div>
      )}
    </div>
  );
}

function ActivityCard({ activity, showAuthor, isOwner, canManage, onDelete, onEdit, onComplete, onSkip, onClick }: { activity: Activity; showAuthor?: boolean; isOwner?: boolean; canManage?: boolean; onDelete?: (id: string) => void; onEdit?: (activity: Activity) => void; onComplete?: (activity: Activity) => void; onSkip?: (activity: Activity) => void; onClick?: (activity: Activity) => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const canEditCard = isOwner || canManage;
  const wasEdited = activity.updated_at && activity.created_at && new Date(activity.updated_at).getTime() - new Date(activity.created_at).getTime() > 5000;
  const st = activity.status || "completed";
  const isScheduled = st === "scheduled";
  const isExpired = st === "expired";
  const isSkipped = st === "skipped";
  const isFinal = isSkipped; // skipped = final state, no actions
  const isOverdue = isScheduled && activity.activity_date < todayStr();
  const isToday = activity.activity_date === todayStr();
  const isCompleted = st === "completed";
  const typeColor = badgeColors[activity.type] || T.fog;
  const sideBorderColor = isOverdue ? T.red : isCompleted ? "#3D3A30" : isExpired ? T.slate : typeColor;

  async function handleDelete() {
    if (!supabase || !onDelete) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from("activities").delete().eq("id", activity.id);
      if (!error) onDelete(activity.id);
    } catch (err) { console.error("Erro ao excluir:", err); }
    finally { setDeleting(false); setConfirmOpen(false); setMenuOpen(false); }
  }

  return (
    <div
      onClick={() => onClick?.(activity)}
      onMouseEnter={(e) => {
        if (isSkipped || isExpired) return;
        e.currentTarget.style.borderColor = "rgba(74,222,128,0.25)";
        e.currentTarget.style.transform = "translateY(-1px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = isOverdue ? T.red + "40" : "var(--border-default)";
        e.currentTarget.style.transform = "none";
      }}
      style={{
        display: "flex", gap: 12, padding: "12px 16px",
        borderRadius: "2px 10px 10px 2px",
        border: `1px solid ${isOverdue ? T.red + "40" : "var(--border-default)"}`,
        borderLeft: `3px solid ${sideBorderColor}`,
        marginBottom: 4,
        background: isOverdue
          ? "linear-gradient(145deg, rgba(248,113,113,0.04), var(--surface-base))"
          : isScheduled && isToday
          ? "linear-gradient(145deg, rgba(74,222,128,0.03), var(--surface-base))"
          : "linear-gradient(145deg, var(--surface-raised), var(--surface-base))",
        position: "relative", opacity: isSkipped ? 0.5 : isCompleted ? 0.75 : 1,
        cursor: "pointer", transition: "border-color 0.15s, transform 0.1s",
      }}>
      <div style={{ paddingTop: 2 }}>
        <span style={{
          padding: "3px 8px", borderRadius: 4, fontSize: 8, fontWeight: 600,
          textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap",
          fontFamily: "var(--font-mono)",
          background: isCompleted ? "rgba(112,107,95,0.1)" : typeColor + "15",
          color: isCompleted ? T.slate : typeColor,
          minWidth: 84, textAlign: "center", display: "inline-block",
        }}>{badgeLabels[activity.type] || activity.type}</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: isCompleted ? T.fog : T.chalk, textDecoration: isSkipped || isCompleted ? "line-through" : "none", textDecorationColor: "#3D3A30" }}>{activity.title}</div>
        {activity.third_party_property && <div style={{ marginTop: 3 }}><span onClick={(e) => { e.stopPropagation(); window.location.href = `/imoveis/${activity.third_party_property!.id}`; }} style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", color: "#D97706", background: "rgba(217,119,6,0.08)", padding: "2px 7px", borderRadius: 4, fontFamily: "var(--font-mono)", cursor: "pointer" }}>IMÓVEL</span> <span style={{ fontSize: 11, color: T.fog, cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); window.location.href = `/imoveis/${activity.third_party_property!.id}`; }}>{activity.third_party_property.titulo}</span></div>}
        <div style={{ fontSize: 12, color: T.fog, display: "flex", gap: 10, marginTop: 3, flexWrap: "wrap" }}>
          {(() => { const names = activity.activity_participants?.length ? activity.activity_participants.map(p => p.participant_name).join(", ") : activity.contact_name; return names ? <span>Com: {names}</span> : null; })()}
          {activity.clients?.name && <span>Cliente: {activity.clients.name}</span>}
          {activity.brokers?.name && <span>Corretor: {activity.brokers.name}</span>}
          {activity.contact_company && <span>{activity.contact_company}</span>}
        </div>
        {activity.outcome && (
          <div style={{ fontSize: 12, color: T.fog, marginTop: 6, paddingTop: 6, borderTop: `1px dashed ${T.stone}` }}>
            <span style={{ color: T.sprout, fontWeight: 500 }}>Resultado: </span>{activity.outcome}
          </div>
        )}
        {activity.next_action && (
          <div style={{ fontSize: 12, color: T.fog, marginTop: 3 }}>
            <span style={{ color: T.orange, fontWeight: 500 }}>Próximo: </span>{activity.next_action}
            {activity.next_action_date && ` (${formatDateBRT(activity.next_action_date + "T12:00:00")})`}
          </div>
        )}
        {isSkipped && activity.skip_reason && <div style={{ fontSize: 12, color: T.slate, marginTop: 4 }}>Motivo: {activity.skip_reason}</div>}
        {showAuthor && activity.profiles?.name && <div style={{ fontSize: 11, color: T.slate, marginTop: 4 }}>{activity.profiles.name}</div>}
        {wasEdited && !isSkipped && <div style={{ fontSize: 10, color: T.slate, marginTop: 4, fontStyle: "italic" }} title={activity.updated_at ? `Editado em ${formatDateTimeBRT(activity.updated_at)}` : ""}>editado ✎</div>}
        {isSkipped && <div style={{ fontSize: 10, color: T.slate, marginTop: 4, fontStyle: "italic" }}>pulada ⊘</div>}
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", flexShrink: 0, gap: 2 }}>
        {canEditCard && !isFinal && (
          <div style={{ position: "relative" }}>
            <button type="button" onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }} style={{ background: "transparent", border: "none", color: T.fog, fontSize: 16, cursor: "pointer", padding: "2px 6px", lineHeight: 1 }}>⋮</button>
            {menuOpen && (
              <>
                <div style={{ position: "fixed", inset: 0, zIndex: 99 }} onClick={() => setMenuOpen(false)} />
                <div style={{ position: "absolute", right: 0, top: 24, background: T.carbon, border: `1px solid ${T.stone}`, borderRadius: 8, zIndex: 100, minWidth: 160, boxShadow: "0 4px 12px rgba(0,0,0,0.3)" }}>
                  {(isScheduled || isExpired) && onComplete && <button type="button" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onComplete(activity); }} onMouseEnter={(e) => { e.currentTarget.style.background = T.stone; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }} style={{ display: "block", width: "100%", textAlign: "left", background: "transparent", border: "none", color: T.sprout, fontSize: 13, fontWeight: 600, padding: "8px 16px", cursor: "pointer", borderRadius: "8px 8px 0 0" }}>{isExpired ? "✓ Concluir mesmo assim" : "✓ Concluir"}</button>}
                  {!isExpired && onEdit && <button type="button" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onEdit(activity); }} onMouseEnter={(e) => { e.currentTarget.style.background = T.stone; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }} style={{ display: "block", width: "100%", textAlign: "left", background: "transparent", border: "none", color: T.bone, fontSize: 13, padding: "8px 16px", cursor: "pointer" }}>✎ Editar</button>}
                  {(isScheduled || isExpired) && onSkip && <button type="button" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onSkip(activity); }} onMouseEnter={(e) => { e.currentTarget.style.background = T.stone; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }} style={{ display: "block", width: "100%", textAlign: "left", background: "transparent", border: "none", color: T.amber, fontSize: 13, padding: "8px 16px", cursor: "pointer" }}>⊘ Pular</button>}
                  <button type="button" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); setConfirmOpen(true); }} onMouseEnter={(e) => { e.currentTarget.style.background = T.stone; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }} style={{ display: "block", width: "100%", textAlign: "left", background: "transparent", border: "none", color: T.red, fontSize: 13, padding: "8px 16px", cursor: "pointer", borderRadius: "0 0 8px 8px" }}>Excluir</button>
                </div>
              </>
            )}
          </div>
        )}
        {activity.activity_photos && activity.activity_photos.length > 0 && (
          <div style={{ position: "relative", flexShrink: 0 }}>
            <img src={activity.activity_photos[0].photo_url} alt="" style={{ width: 40, height: 40, borderRadius: 6, objectFit: "cover" }} />
            {activity.activity_photos.length > 1 && <span style={{ position: "absolute", bottom: -2, right: -2, fontSize: 9, fontWeight: 700, padding: "1px 4px", borderRadius: 4, background: "rgba(0,0,0,0.7)", color: "#fff" }}>📷{activity.activity_photos.length}</span>}
          </div>
        )}
        <div style={{ fontSize: 13, color: isOverdue ? T.red : isCompleted ? T.slate : T.bone, fontFamily: "var(--font-mono)", fontWeight: 600 }}>{activity.start_time?.substring(0, 5) || ""}</div>
        <div style={{ fontSize: 9, color: T.slate, fontFamily: "var(--font-mono)" }}>{activity.duration_minutes ? fmtDuration(activity.duration_minutes) : ""}</div>
        {isOverdue && <div style={{ fontSize: 8, color: T.red, fontFamily: "var(--font-mono)", marginTop: 2, letterSpacing: "0.05em" }}>atrasada</div>}
      </div>
      {confirmOpen && createPortal(
        <div style={{ position: "fixed", inset: 0, zIndex: 9000 }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)" }} onClick={() => setConfirmOpen(false)} />
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", background: T.ink, border: `1px solid ${T.stone}`, borderRadius: 14, padding: 24, width: 360, maxWidth: "90vw", zIndex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: T.chalk, marginBottom: 8 }}>Excluir atividade</div>
            <div style={{ fontSize: 13, color: T.fog, marginBottom: 20 }}>Tem certeza que deseja excluir esta atividade? Esta ação não pode ser desfeita.</div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setConfirmOpen(false)} style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${T.stone}`, background: "transparent", color: T.bone, fontSize: 13, cursor: "pointer" }}>Cancelar</button>
              <button type="button" onClick={handleDelete} disabled={deleting} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: T.red, color: T.ink, fontSize: 13, fontWeight: 600, cursor: deleting ? "not-allowed" : "pointer", opacity: deleting ? 0.6 : 1 }}>{deleting ? "Excluindo..." : "Excluir"}</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

function RankingRow({ member, position, selected, maxCount }: { member: RankedMember; position: number; selected?: boolean; maxCount: number }) {
  const isMobile = useIsMobile();
  const isZero = member.count === 0;
  const pct = maxCount > 0 ? (member.count / maxCount) * 100 : 0;
  // Onda 3.1: cor única para todas as barras — variação só em comprimento.
  const barColor = T.sprout;
  const trend = member.trendDelta;
  const trendTooltip =
    trend > 0
      ? `+${trend} atividades nos últimos 7 dias vs 7 dias anteriores`
      : `${trend} atividades nos últimos 7 dias vs 7 dias anteriores`;
  // Onda 1.5: zerados em opacidade reduzida, sem barra, com legenda discreta.
  return (
    <div style={{
      padding: "12px 16px", borderRadius: 10,
      border: selected
        ? `1px solid ${T.sprout}60`
        : `1px solid ${isZero ? "var(--border-default)" : member.alert ? T.amber + "40" : "var(--border-default)"}`,
      marginBottom: 4,
      opacity: isZero ? 0.6 : 1,
      background: selected
        ? "linear-gradient(145deg, rgba(74,222,128,0.08), var(--surface-base))"
        : "linear-gradient(145deg, var(--surface-raised), var(--surface-base))",
      transition: "border-color 0.15s, background 0.15s, opacity 0.15s",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        {/* Onda 3.1: posição com ordinal explícito. */}
        <div style={{ fontSize: 13, fontWeight: 700, color: T.slate, minWidth: 28, textAlign: "center", fontFamily: "var(--font-mono)" }}>{position}º</div>
        <div style={{ width: 36, height: 36, borderRadius: "50%", background: (isZero ? T.fog : member.alert ? T.amber : T.sprout) + "20", color: isZero ? T.fog : member.alert ? T.amber : T.sprout, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{initials(member.name)}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: T.chalk }}>
            {member.name}
            {!isZero && member.streak > 0 && <span style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 8px", borderRadius: 12, background: member.streak >= 5 ? T.orange + "20" : T.sprout + "20", color: member.streak >= 5 ? T.orange : T.sprout, fontSize: 10, fontWeight: 600, marginLeft: 8 }}>● {member.streak}</span>}
            {!isZero && trend !== 0 && (
              <span title={trendTooltip} style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: trend > 0 ? T.sprout : T.red, marginLeft: 6, fontWeight: 600, cursor: "help" }}>
                {trend > 0 ? "↑ +" : "↓ "}{trend}
              </span>
            )}
            {!isZero && member.alert && <span style={{ fontSize: 10, color: T.amber, marginLeft: 8, fontWeight: 400 }}>! {member.alert}</span>}
          </div>
          <div style={{ fontSize: 11, color: T.fog }}>
            {member.roleLabel}
            {isZero && <span style={{ marginLeft: 8, fontStyle: "italic" }}>· Sem atividades neste período</span>}
          </div>
        </div>
        {!isMobile && (
          /* Onda 3.2: tooltips explicam o cálculo de cada métrica do ranking. */
          <div style={{ display: "flex", gap: 20 }}>
            <div title="Atividades registradas no período filtrado" style={{ textAlign: "right", cursor: "help" }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: member.alert && !isZero ? T.amber : T.chalk }}>{member.count}</div>
              <div style={{ fontSize: 9, color: T.fog, textTransform: "uppercase", letterSpacing: "0.05em" }}>Atividades</div>
            </div>
            <div title="Média de atividades por dia corrido do mês corrente" style={{ textAlign: "right", cursor: "help" }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: T.chalk }}>{isZero ? "—" : member.avg}</div>
              <div style={{ fontSize: 9, color: T.fog, textTransform: "uppercase", letterSpacing: "0.05em" }}>Média/dia</div>
            </div>
            <div title="Tempo total em atividades de campo (visitas e reuniões externas)" style={{ textAlign: "right", cursor: "help" }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: T.chalk }}>{isZero ? "—" : member.hours}</div>
              <div style={{ fontSize: 9, color: T.fog, textTransform: "uppercase", letterSpacing: "0.05em" }}>Em campo</div>
            </div>
          </div>
        )}
      </div>
      {!isZero && (
        <div style={{ height: 3, borderRadius: 2, marginTop: 8, background: "rgba(42,40,34,0.3)", overflow: "hidden" }}>
          <div style={{ height: "100%", borderRadius: 2, width: `${pct}%`, background: barColor, transition: "width 0.5s" }} />
        </div>
      )}
    </div>
  );
}

function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 3000); return () => clearTimeout(t); }, [onDone]);
  return createPortal(<div style={{ position: "fixed", bottom: 32, left: "50%", transform: "translateX(-50%)", background: T.sprout, color: T.ink, padding: "10px 24px", borderRadius: 8, fontSize: 13, fontWeight: 700, zIndex: 10000, boxShadow: "0 4px 16px rgba(0,0,0,0.4)" }}>{message}</div>, document.body);
}

// ── Date & Time Pickers (v7) ──
const PICKER_MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const PICKER_DAYS = ["D", "S", "T", "Q", "Q", "S", "S"];

function DatePickerField({ value, onChange, disabled, align = "left" }: { value: string; onChange: (v: string) => void; disabled?: boolean; align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => {
    const d = value ? new Date(value + "T12:00:00") : new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onClick); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const todayIso = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const firstDay = new Date(view.year, view.month, 1);
  const lastDay = new Date(view.year, view.month + 1, 0);
  const startOffset = firstDay.getDay();
  const totalDays = lastDay.getDate();
  const fmt = (v: string) => { if (!v) return "Selecionar data"; const [y, m, d] = v.split("-"); return `${d}/${m}/${y}`; };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button type="button" disabled={disabled} onClick={() => !disabled && setOpen((o) => !o)} style={{
        width: "100%", padding: "10px 14px", borderRadius: 10,
        background: "linear-gradient(145deg, var(--surface-raised), var(--surface-base))",
        border: open ? "1px solid rgba(74,222,128,0.25)" : "1px solid rgba(42,40,34,0.5)",
        color: value ? T.chalk : T.fog,
        fontFamily: "var(--font-mono)", fontSize: 13, textAlign: "left",
        cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1,
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        {fmt(value)}
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <rect x="1" y="2" width="12" height="11" rx="2" stroke="#706B5F" strokeWidth="1.2" fill="none" />
          <line x1="1" y1="5" x2="13" y2="5" stroke="#706B5F" strokeWidth="1" />
          <line x1="4.5" y1="1" x2="4.5" y2="3" stroke="#706B5F" strokeWidth="1.2" strokeLinecap="round" />
          <line x1="9.5" y1="1" x2="9.5" y2="3" stroke="#706B5F" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)",
          ...(align === "right" ? { right: 0 } : { left: 0 }),
          background: "#1C1B18", border: "1px solid rgba(42,40,34,0.6)",
          borderRadius: 10, padding: 12, zIndex: 9999, width: 260,
          minWidth: 260, maxWidth: "calc(100vw - 20px)",
          boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <button type="button" onClick={() => setView((p) => p.month === 0 ? { year: p.year - 1, month: 11 } : { ...p, month: p.month - 1 })} style={{ background: "none", border: "none", color: T.fog, cursor: "pointer", fontSize: 16, padding: "2px 8px" }}>‹</button>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: T.bone, fontWeight: 600 }}>{PICKER_MONTHS[view.month]} {view.year}</span>
            <button type="button" onClick={() => setView((p) => p.month === 11 ? { year: p.year + 1, month: 0 } : { ...p, month: p.month + 1 })} style={{ background: "none", border: "none", color: T.fog, cursor: "pointer", fontSize: 16, padding: "2px 8px" }}>›</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 4 }}>
            {PICKER_DAYS.map((d, i) => <div key={i} style={{ textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 9, color: T.fog, padding: "4px 0" }}>{d}</div>)}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
            {Array.from({ length: startOffset }).map((_, i) => <div key={`e-${i}`} />)}
            {Array.from({ length: totalDays }).map((_, i) => {
              const day = i + 1;
              const iso = `${view.year}-${String(view.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const isToday = iso === todayIso;
              const isSel = iso === value;
              return (
                <button type="button" key={day} onClick={() => { onChange(iso); setOpen(false); }} style={{
                  width: 32, height: 32, borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: isSel ? T.sprout : isToday ? "rgba(74,222,128,0.1)" : "transparent",
                  color: isSel ? T.ink : isToday ? T.sprout : T.bone,
                  border: isToday && !isSel ? "1px solid rgba(74,222,128,0.3)" : "none",
                  fontFamily: "var(--font-mono)", fontSize: 11,
                  fontWeight: isSel || isToday ? 700 : 400,
                  cursor: "pointer", margin: "0 auto",
                }}>{day}</button>
              );
            })}
          </div>
          <button type="button" onClick={() => {
            onChange(todayIso);
            const n = new Date();
            setView({ year: n.getFullYear(), month: n.getMonth() });
            setOpen(false);
          }} style={{
            width: "100%", marginTop: 8, padding: 6,
            background: "transparent", border: "1px solid rgba(74,222,128,0.2)",
            borderRadius: 6, color: T.sprout,
            fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600, cursor: "pointer",
          }}>Hoje</button>
        </div>
      )}
    </div>
  );
}

function TimePickerField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onClick); document.removeEventListener("keydown", onKey); };
  }, [open]);

  useEffect(() => {
    if (open && listRef.current && value) {
      const el = listRef.current.querySelector<HTMLDivElement>(`[data-slot="${value}"]`);
      if (el) el.scrollIntoView({ block: "center" });
    }
  }, [open, value]);

  const slots: string[] = [];
  for (let h = 6; h <= 21; h++) for (let m = 0; m < 60; m += 15) slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);

  const now = new Date();
  const nowSlot = `${String(now.getHours()).padStart(2, "0")}:${String(Math.floor(now.getMinutes() / 15) * 15).padStart(2, "0")}`;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button type="button" onClick={() => setOpen((o) => !o)} style={{
        width: "100%", padding: "10px 14px", borderRadius: 10,
        background: "linear-gradient(145deg, var(--surface-raised), var(--surface-base))",
        border: open ? "1px solid rgba(74,222,128,0.25)" : "1px solid rgba(42,40,34,0.5)",
        color: value ? T.chalk : T.fog,
        fontFamily: "var(--font-mono)", fontSize: 13, textAlign: "left", cursor: "pointer",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        {value || "--:--"}
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="7" cy="7" r="6" stroke="#706B5F" strokeWidth="1.2" fill="none" />
          <line x1="7" y1="4" x2="7" y2="7" stroke="#706B5F" strokeWidth="1.2" strokeLinecap="round" />
          <line x1="7" y1="7" x2="9.5" y2="8.5" stroke="#706B5F" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <div ref={listRef} style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
          background: "#1C1B18", border: "1px solid rgba(42,40,34,0.6)",
          borderRadius: 10, zIndex: 9999, maxHeight: 240, overflowY: "auto",
          boxShadow: "0 8px 24px rgba(0,0,0,0.5)", padding: "4px 0",
        }}>
          {slots.map((slot) => {
            const isSel = slot === value;
            const isNow = slot === nowSlot;
            return (
              <div key={slot} data-slot={slot} onClick={() => { onChange(slot); setOpen(false); }} style={{
                padding: "8px 14px", cursor: "pointer",
                background: isSel ? "rgba(74,222,128,0.08)" : "transparent",
                color: isSel ? T.sprout : isNow ? T.blue : T.bone,
                fontFamily: "var(--font-mono)", fontSize: 12,
                fontWeight: isSel || isNow ? 600 : 400,
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}
                onMouseEnter={(e) => { if (!isSel) (e.currentTarget as HTMLDivElement).style.background = "rgba(42,40,34,0.3)"; }}
                onMouseLeave={(e) => { if (!isSel) (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
              >
                <span>{slot}</span>
                {isNow && !isSel && <span style={{ fontSize: 9, color: T.blue }}>agora</span>}
                {isSel && <span style={{ color: T.sprout }}>✓</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Registration Modal ──

export function RegistrationModal({ accountId, developmentId, profileId, initialType, initialTitle, initialDate, initialStartTime, editActivity, canManageDate, onClose, onSaved, thirdPartyPropertyId, thirdPartyPropertyTitle, negotiationId, clientId: propClientId }: { accountId: string; developmentId: string; profileId: string; initialType?: ActivityType; initialTitle?: string; initialDate?: string; initialStartTime?: string; editActivity?: Activity | null; canManageDate?: boolean; onClose: () => void; onSaved: () => void; thirdPartyPropertyId?: string; thirdPartyPropertyTitle?: string; negotiationId?: string; clientId?: string }) {
  const isEdit = !!editActivity;
  const [type, setType] = useState<ActivityType | null>(editActivity?.type ?? initialType ?? null);
  const [title, setTitle] = useState(editActivity?.title ?? initialTitle ?? "");
  const contactName = editActivity?.contact_name ?? "";
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [photos, setPhotos] = useState<{ file: File; preview: string }[]>([]);
  const [photoCaption, setPhotoCaption] = useState("");
  const [activityDate, setActivityDate] = useState(editActivity?.activity_date ?? initialDate ?? todayStr());
  const [startTime, setStartTime] = useState(editActivity?.start_time?.substring(0, 5) ?? initialStartTime ?? "");

  useEffect(() => {
    if (editActivity || initialStartTime || startTime) return;
    const n = new Date();
    const rounded = Math.ceil(n.getMinutes() / 15) * 15;
    const h = rounded >= 60 ? n.getHours() + 1 : n.getHours();
    const m = rounded % 60;
    setStartTime(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [duration, setDuration] = useState(editActivity?.duration_minutes ?? 60);
  const [outcome, setOutcome] = useState(editActivity?.outcome ?? "");
  const [nextAction, setNextAction] = useState(editActivity?.next_action ?? "");
  const [nextActionDate, setNextActionDate] = useState(editActivity?.next_action_date ?? "");
  const [description, setDescription] = useState(editActivity?.description ?? "");
  // Date editing: within 24h or manager/director
  const dateEditable = !isEdit || canManageDate || (editActivity?.created_at ? (Date.now() - new Date(editActivity.created_at).getTime()) < 24 * 60 * 60 * 1000 : true);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [followUpType, setFollowUpType] = useState<ActivityType>("follow_up");
  const [followUpNote, setFollowUpNote] = useState("");
  const [followUpPick, setFollowUpPick] = useState<"1" | "2" | "7">("1");
  const [savingFollowUp, setSavingFollowUp] = useState(false);
  const isMobile = useIsMobile();
  const isFuture = activityDate > todayStr();
  const canSave = type !== null && title.trim().length > 0;

  function addDays(d: number): string { const dt = new Date(); dt.setDate(dt.getDate() + d); return dt.toISOString().slice(0, 10); }

  async function handleSave() {
    if (!canSave || !supabase) return;
    setSaving(true);
    try {
      if (isEdit && editActivity) {
        // Update mode
        const updateData: Record<string, unknown> = {
          type, title: title.trim(), contact_name: contactName.trim() || null,
          duration_minutes: duration, outcome: outcome.trim() || null,
          next_action: nextAction.trim() || null, next_action_date: nextActionDate || null,
          description: description.trim() || null, updated_at: new Date().toISOString(),
        };
        if (dateEditable) {
          updateData.activity_date = activityDate;
          updateData.start_time = startTime || null;
        }
        const { error } = await supabase.from("activities").update(updateData).eq("id", editActivity.id);
        if (error) throw error;
        onSaved(); onClose();
      } else {
        // Insert mode — delega decisão scheduled/completed ao domínio
        // (activity_date + start_time no fuso BRT vs now).
        const moment = toActivityMomentBRT(activityDate, startTime || null);
        const actStatus = decideInitialActivityStatus(moment);
        const isFuture = actStatus === "scheduled";
        const contactStr = participants.length > 0 ? participants.map((p) => p.name).join(", ") : contactName.trim() || null;
        const insertPayload: Record<string, unknown> = {
          account_id: accountId, development_id: developmentId, profile_id: profileId,
          type, title: title.trim(), contact_name: contactStr,
          activity_date: activityDate, start_time: startTime || null,
          duration_minutes: isFuture ? 0 : duration,
          outcome: isFuture ? null : (outcome.trim() || null),
          next_action: isFuture ? null : (nextAction.trim() || null),
          next_action_date: isFuture ? null : (nextActionDate || null),
          description: description.trim() || null,
          status: actStatus,
        };
        if (thirdPartyPropertyId) insertPayload.third_party_property_id = thirdPartyPropertyId;
        if (negotiationId) insertPayload.negotiation_id = negotiationId;
        if (propClientId) insertPayload.client_id = propClientId;
        const { data: inserted, error } = await supabase.from("activities").insert(insertPayload).select("id").single();
        if (error) throw error;
        // Save participants
        if (inserted?.id && participants.length > 0) {
          await supabase.from("activity_participants").insert(participants.map((p) => ({ activity_id: inserted.id, participant_type: p.type, participant_id: p.id, participant_name: p.name, participant_detail: p.detail || null })));
        }
        // Upload photos
        if (inserted?.id && photos.length > 0) {
          for (const photo of photos) {
            const ext = photo.file.name.split(".").pop() || "jpg";
            const path = `${inserted.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
            const { error: upErr } = await supabase.storage.from("activity-photos").upload(path, photo.file, { contentType: "image/jpeg" });
            if (!upErr) {
              const { data: signedData } = await supabase.storage.from("activity-photos").createSignedUrl(path, 604800); // 7 days
              const photoUrl = signedData?.signedUrl || path;
              await supabase.from("activity_photos").insert({ activity_id: inserted.id, photo_url: photoUrl, storage_path: path, caption: photoCaption.trim() || null, uploaded_by: profileId });
            }
          }
        }
        onSaved();
        if (isFuture || (nextAction.trim() && nextActionDate)) { onClose(); return; }
        setStep(2);
      }
    } catch (err: unknown) {
      console.error("Erro ao salvar atividade:", err);
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      if (msg.includes("row-level security")) alert("Sem permissão para registrar atividades.");
      else if (msg.includes("foreign key")) alert("Participante inválido. Tente novamente.");
      else alert("Erro ao salvar: " + msg);
    }
    finally { setSaving(false); }
  }

  async function handleScheduleFollowUp() {
    if (!supabase) return;
    setSavingFollowUp(true);
    const days = followUpPick === "1" ? 1 : followUpPick === "2" ? 2 : 7;
    const followDate = addDays(days);
    // Follow-up sem start_time = 00:00 do dia. Em dia futuro => scheduled;
    // se por algum motivo days <= 0 e cair no passado, completed.
    const moment = toActivityMomentBRT(followDate, null);
    const status = decideInitialActivityStatus(moment);
    try {
      await supabase.from("activities").insert({
        account_id: accountId, development_id: developmentId, profile_id: profileId,
        type: followUpType, title: `Follow-up: ${badgeLabels[followUpType]}`,
        activity_date: followDate, duration_minutes: 30,
        next_action: followUpNote.trim() || null,
        description: `Agendado após: ${title}`,
        status,
      });
      onClose();
    } catch (err) { console.error("Erro ao agendar follow-up:", err); onClose(); }
    finally { setSavingFollowUp(false); }
  }

  const IS: React.CSSProperties = { background: "linear-gradient(145deg, var(--surface-raised), var(--surface-base))", border: "1px solid rgba(42,40,34,0.5)", borderRadius: 10, padding: "10px 14px", color: T.chalk, fontSize: 13, width: "100%", outline: "none", boxSizing: "border-box", fontFamily: "'DM Sans', sans-serif", transition: "border-color 0.15s" };
  const LBL: React.CSSProperties = { fontSize: 9, color: T.fog, textTransform: "uppercase", letterSpacing: "0.12em", fontFamily: "var(--font-mono)", display: "block", marginBottom: 6, fontWeight: 600 };
  const allTypes = Object.keys(badgeLabels) as ActivityType[];
  const focusIn = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => { e.currentTarget.style.borderColor = "rgba(74,222,128,0.25)"; };
  const focusOut = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => { e.currentTarget.style.borderColor = "rgba(42,40,34,0.5)"; };

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 9000 }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.7)" }} onClick={onClose} />
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", background: T.ink, border: `1px solid ${T.stone}`, borderRadius: 14, width: isMobile ? "95vw" : 520, maxHeight: "90vh", overflowY: "auto", zIndex: 1, padding: 24 }}>
        {step === 2 ? (
          /* ── Step 2: Próximo passo ── */
          <>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>✓</div>
              <h2 style={{ color: T.sprout, fontSize: 16, fontWeight: 700, margin: "0 0 4px" }}>Atividade registrada</h2>
              <p style={{ fontSize: 13, color: T.fog, margin: 0 }}>Qual o próximo passo?</p>
            </div>
            <label style={LBL}>Tipo</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginBottom: 16 }}>
              {(["phone_call", "visit_client", "follow_up", "meeting_external", "visit_development"] as ActivityType[]).map((k) => (
                <button key={k} type="button" onClick={() => setFollowUpType(k)} style={{ background: followUpType === k ? T.sprout + "15" : T.carbon, border: followUpType === k ? `2px solid ${T.sprout}` : `1px solid ${T.stone}`, borderRadius: 8, padding: "8px 4px", cursor: "pointer", textAlign: "center" }}>
                  <div style={{ fontSize: 16 }}>{typeIcons[k]}</div>
                  <div style={{ fontSize: 10, color: followUpType === k ? T.sprout : T.bone, fontWeight: 600, marginTop: 2 }}>{badgeLabels[k]}</div>
                </button>
              ))}
            </div>
            <label style={LBL}>Quando</label>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {([["1", "Amanhã"], ["2", "Em 2 dias"], ["7", "Próx. semana"]] as const).map(([k, l]) => (
                <button key={k} type="button" onClick={() => setFollowUpPick(k as "1" | "2" | "7")} style={{ flex: 1, padding: "10px 8px", borderRadius: 8, border: followUpPick === k ? `2px solid ${T.sprout}` : `1px solid ${T.stone}`, background: followUpPick === k ? T.sprout + "10" : T.carbon, cursor: "pointer" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: followUpPick === k ? T.sprout : T.bone }}>{l}</div>
                </button>
              ))}
            </div>
            <label style={LBL}>Nota (opcional)</label>
            <input style={{ ...IS, marginBottom: 20 }} value={followUpNote} onChange={(e) => setFollowUpNote(e.target.value)} placeholder="Ex: Confirmar interesse na Q3-L14" maxLength={200} />
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" onClick={onClose} style={{ flex: 1, padding: "12px", borderRadius: 8, border: `1px solid ${T.stone}`, background: "transparent", color: T.fog, fontSize: 13, cursor: "pointer" }}>Pular</button>
              <button type="button" onClick={handleScheduleFollowUp} disabled={savingFollowUp} style={{ flex: 2, padding: "12px", borderRadius: 8, border: "none", background: T.sprout, color: T.ink, fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: savingFollowUp ? 0.6 : 1 }}>{savingFollowUp ? "Agendando..." : "Agendar"}</button>
            </div>
          </>
        ) : (
        /* ── Step 1: Registro normal ── */
        <>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontStyle: "italic", fontSize: 22, color: T.chalk, fontWeight: 400, margin: 0 }}>{isEdit ? "Editar atividade" : "Registrar atividade"}</h2>
          {thirdPartyPropertyTitle && <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}><span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", color: "#D97706", background: "rgba(217,119,6,0.08)", padding: "2px 6px", borderRadius: 4, fontFamily: "var(--font-mono)" }}>IMÓVEL</span><span style={{ fontSize: 12, color: T.fog }}>{thirdPartyPropertyTitle}</span></div>}
          <button type="button" onClick={onClose} style={{ background: "none", border: "none", color: T.fog, fontSize: 20, cursor: "pointer" }}>&times;</button>
        </div>
        <label style={LBL}>Tipo de atividade</label>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, minmax(0, 1fr))" : "repeat(3, minmax(0, 1fr))", gap: 8, marginBottom: 18 }}>
          {allTypes.map((k) => {
            const isSel = type === k;
            const c = badgeColors[k] || T.sprout;
            return (
              <button key={k} type="button" onClick={() => setType(k)} style={{
                background: isSel
                  ? `linear-gradient(145deg, ${c}1F, ${c}0A)`
                  : "linear-gradient(145deg, var(--surface-raised), var(--surface-base))",
                border: isSel ? `2px solid ${c}66` : "1px solid rgba(42,40,34,0.5)",
                borderRadius: 10, padding: "12px 6px", cursor: "pointer",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                transform: isSel ? "scale(1.02)" : "none",
                transition: "all 0.15s",
                boxShadow: isSel ? `0 0 16px ${c}20` : "none",
              }}>
                <span style={{ fontSize: 20, color: isSel ? c : T.fog, transition: "color 0.15s" }}>{typeIcons[k]}</span>
                <span style={{ fontSize: 11, color: isSel ? c : T.bone, fontWeight: 600, transition: "color 0.15s" }}>{badgeLabels[k]}</span>
              </button>
            );
          })}
        </div>
        <label style={LBL}>Título *</label>
        <input id="activity-title" style={{ ...IS, marginBottom: 14 }} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={type ? typePlaceholders[type] : "Selecione o tipo primeiro"} onFocus={focusIn} onBlur={focusOut} />
        <label style={LBL}>Com quem</label>
        <div style={{ marginBottom: 14 }}>
          <ParticipantInput accountId={accountId} value={participants} onChange={setParticipants} />
        </div>
        <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <label style={LBL}>Data *{!dateEditable && isEdit ? <span style={{ fontSize: 9, color: T.red, marginLeft: 4 }}>(bloqueado após 24h)</span> : ""}</label>
            <DatePickerField value={activityDate} onChange={setActivityDate} disabled={!dateEditable} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={LBL}>Horário</label>
            <TimePickerField value={startTime} onChange={setStartTime} />
          </div>
        </div>
        {isFuture && !isEdit && <div style={{ padding: "10px 14px", borderRadius: 8, background: T.blue + "10", border: `1px solid ${T.blue}30`, fontSize: 12, color: T.blue, marginBottom: 14 }}>📅 Atividade será agendada para {formatWeekdayDateLongBRT(activityDate + "T12:00:00").replace(/ de \d{4}$/, "")}</div>}
        {!isFuture && (<>
        <label style={LBL}>Duração</label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
          {DURATIONS.map((d) => {
            const act = duration === d.value;
            return (
              <button key={d.value} type="button" onClick={() => setDuration(d.value)} style={{
                padding: "8px 14px", borderRadius: 8,
                background: act ? "rgba(74,222,128,0.1)" : "transparent",
                border: act ? "1px solid rgba(74,222,128,0.3)" : "1px solid rgba(42,40,34,0.5)",
                color: act ? T.sprout : T.bone,
                fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600,
                cursor: "pointer",
                boxShadow: act ? "0 0 12px rgba(74,222,128,0.1)" : "none",
                transition: "all 0.15s",
              }}>{d.label}</button>
            );
          })}
        </div>
        <label style={LBL}>Resultado</label>
        <input style={{ ...IS, marginBottom: 14 }} value={outcome} onChange={(e) => setOutcome(e.target.value)} placeholder="O que aconteceu?" onFocus={focusIn} onBlur={focusOut} />
        </>)}
        {!isFuture && (<>
        <label style={LBL}>Próxima ação</label>
        <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
          <input style={{ ...IS, flex: 2 }} value={nextAction} onChange={(e) => setNextAction(e.target.value)} placeholder="O que fazer em seguida?" onFocus={focusIn} onBlur={focusOut} />
          <div style={{ flex: 1 }}>
            <DatePickerField value={nextActionDate} onChange={setNextActionDate} align="right" />
          </div>
        </div>
        </>)}
        <label style={LBL}>Observações</label>
        <textarea rows={2} style={{ ...IS, resize: "vertical", marginBottom: 14 }} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Anotações adicionais..." onFocus={focusIn} onBlur={focusOut as unknown as React.FocusEventHandler<HTMLTextAreaElement>} />
        {!isEdit && (
          <>
            <label style={LBL}>Fotos (opcional)</label>
            <div style={{ marginBottom: photos.length > 0 ? 8 : 14 }}>
              <PhotoUpload photos={photos} onChange={setPhotos} />
            </div>
            {photos.length > 0 && <input style={{ ...IS, marginBottom: 14 }} value={photoCaption} onChange={(e) => setPhotoCaption(e.target.value)} placeholder="Legenda da foto (opcional)" />}
          </>
        )}
        <button type="button" onClick={handleSave} disabled={!canSave || saving} style={{ width: "100%", height: 40, background: T.sprout, color: T.ink, border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: canSave && !saving ? "pointer" : "not-allowed", opacity: canSave && !saving ? 1 : 0.5 }}>
          {saving ? "Salvando..." : isEdit ? "Salvar alterações" : isFuture ? "📅 Agendar atividade" : "Registrar atividade"}
        </button>
        </>
        )}
      </div>
    </div>,
    document.body,
  );
}

// ── Main Page ──

export default function AtividadesPage() {
  const { authenticatedProfile } = useAuth();
  const { account } = useAccount();
  const { development } = useDevelopment();
  const isMobile = useIsMobile();

  const accountId = account?.accountId ?? null;
  const developmentId = development?.developmentId ?? null;
  const profileId = authenticatedProfile?.id ?? null;
  const role = account?.role ?? authenticatedProfile?.role ?? null;
  const isConsultant = role === "commercial_consultant";
  const isManager = role === "manager";
  const isDirector = role === "director";

  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<ActivityType | undefined>(undefined);
  const [modalTitle, setModalTitle] = useState<string | undefined>(undefined);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const canManage = isDirector || isManager || (role as string) === "owner";
  const [statusFilter, setStatusFilter] = useState<"pending" | "completed" | "all">("pending");
  const [completingActivity, setCompletingActivity] = useState<Activity | null>(null);
  const [completeOutcome, setCompleteOutcome] = useState("");
  const [completeDuration, setCompleteDuration] = useState(60);
  const [completing, setCompleting] = useState(false);
  const [skippingActivity, setSkippingActivity] = useState<Activity | null>(null);
  const [skipReason, setSkipReason] = useState("");
  const [skipping, setSkipping] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [selectedParticipants, setSelectedParticipants] = useState<{ participant_type: string; participant_name: string; participant_detail: string | null }[]>([]);
  // Onda 1.6: período e modo de data centralizados em hook persistido (localStorage).
  const periodCfg = useActivityPeriod({ period: "month", dateMode: "activity_date" });
  const periodFilter = periodCfg.period;
  const setPeriodFilter = (p: string) => periodCfg.setPeriod(p as Period);
  const [typeFilter, setTypeFilter] = useState("all");
  const [memberFilter, setMemberFilter] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"mine" | "team">("team");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [consultantFilter, setConsultantFilter] = useState("all");
  // Onda 3.3: ordenação da lista de atividades.
  const [listSort, setListSort] = useState<"date_desc" | "date_asc" | "type" | "profile">("date_desc");
  const [teamProfiles, setTeamProfiles] = useState<{ id: string; name: string; role: string }[]>([]);
  const [pendingFollowups, setPendingFollowups] = useState<{ id: string; clientName: string; quadra: string; lote: string; dias: number }[]>([]);
  const [searchParams] = useSearchParams();
  const initialView = searchParams.get("view") === "calendar" ? "calendar" : "list";
  const [displayMode, setDisplayMode] = useState<"list" | "calendar">(initialView);
  const [slotDate, setSlotDate] = useState<string | undefined>(undefined);
  const [slotTime, setSlotTime] = useState<string | undefined>(undefined);

  // Handle ?date=YYYY-MM-DD from Central "+ Agendar" link
  useEffect(() => {
    const urlDate = searchParams.get("date");
    if (urlDate && displayMode === "calendar") {
      setSlotDate(urlDate);
      setSlotTime("09:00");
      setEditingActivity(null);
      setModalType(undefined);
      setModalTitle(undefined);
      setModalOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Fetch activities ──

  const fetchActivities = useCallback(async () => {
    if (!supabase || !accountId || !developmentId) { setLoading(false); return; }
    setLoading(true);
    try {
      let query = supabase.from("activities").select("*, clients(name), brokers(name), profiles!activities_profile_id_fkey(name, role), activity_photos(id, photo_url), activity_participants(participant_name, participant_type), third_party_property:third_party_properties!third_party_property_id(id, titulo)").eq("account_id", accountId).order("activity_date", { ascending: false }).order("start_time", { ascending: false });
      if (isConsultant && profileId) query = query.eq("profile_id", profileId);
      if (isManager && viewMode === "mine" && profileId) query = query.eq("profile_id", profileId);
      if (isManager && viewMode === "team" && consultantFilter !== "all") query = query.eq("profile_id", consultantFilter);
      const { data, error } = await query;
      if (error) throw error;
      setActivities((data ?? []) as Activity[]);
    } catch (err) { console.error("Erro ao buscar atividades:", err); setActivities([]); }
    finally { setLoading(false); }
  }, [accountId, developmentId, profileId, isConsultant, isManager, viewMode, consultantFilter]);

  useEffect(() => {
    // Expirar atividades atrasadas 7+ dias antes de carregar
    if (supabase && accountId) supabase.rpc("expire_overdue_activities", { p_account_id: accountId }).then(() => {}, () => {});
    fetchActivities();
  }, [fetchActivities, accountId]);

  // ── Fetch team profiles (manager/director) ──

  useEffect(() => {
    if (!supabase || !accountId || isConsultant) return;
    let cancelled = false;
    (async () => {
      // Onda 1.1: a FK real é user_account_access.user_id → profiles.id.
      // Antes usava-se profiles:profile_id(...) que retornava sempre null.
      const { data } = await supabase!
        .from("user_account_access")
        .select("role, user_id, profiles:user_id(id, name, role)")
        .eq("account_id", accountId);
      if (!data || cancelled) return;

      // Onda 1.2: aplicar escopo Equipe Comercial Interna.
      const scoped: { id: string; name: string; role: string }[] = [];
      for (const row of data as Record<string, unknown>[]) {
        const p = row.profiles as Record<string, unknown> | null;
        if (!p) continue;
        const r = ((row.role as string) || (p.role as string) || "").trim();
        if (!isCommercialInternalRole(r)) continue;
        scoped.push({ id: p.id as string, name: (p.name as string) ?? "Sem nome", role: r });
      }

      // Onda 1.3: saneamento de owner — oculta owners zerados de sempre.
      const ownerIds = scoped.filter((m) => m.role === "owner").map((m) => m.id);
      let ownerActivityCount: Map<string, number> = new Map();
      if (ownerIds.length > 0) {
        const { data: ownerActs } = await supabase!
          .from("activities")
          .select("profile_id")
          .eq("account_id", accountId)
          .in("profile_id", ownerIds);
        if (cancelled) return;
        ownerActivityCount = new Map();
        for (const row of (ownerActs ?? []) as { profile_id: string }[]) {
          ownerActivityCount.set(row.profile_id, (ownerActivityCount.get(row.profile_id) ?? 0) + 1);
        }
      }
      const filtered = scoped.filter((m) => {
        if (m.role !== "owner") return true;
        return (ownerActivityCount.get(m.id) ?? 0) > 0;
      });

      if (!cancelled) setTeamProfiles(filtered);
    })();
    return () => { cancelled = true; };
  }, [accountId, isConsultant]);

  // ── Fetch follow-up suggestions (ENTREGA 2) ──

  useEffect(() => {
    if (!supabase || !accountId) return;
    (async () => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
      const { data: negs } = await supabase.from("negotiations").select("id, status, client_id, updated_at, clients(name), units(quadra, lote)").eq("account_id", accountId).in("status", ["IN_PROGRESS", "OPEN"]);
      const { data: recentActs } = await supabase.from("activities").select("client_id").eq("account_id", accountId).gte("activity_date", sevenDaysAgo);
      const recentClientIds = new Set((recentActs ?? []).map((a: Record<string, unknown>) => a.client_id).filter(Boolean));
      const pending = (negs ?? []).filter((n: Record<string, unknown>) => n.client_id && !recentClientIds.has(n.client_id as string)).map((n: Record<string, unknown>) => {
        const cl = (Array.isArray(n.clients) ? n.clients[0] : n.clients) as Record<string, unknown> | null;
        const un = (Array.isArray(n.units) ? n.units[0] : n.units) as Record<string, unknown> | null;
        return { id: n.id as string, clientName: (cl?.name as string) ?? "?", quadra: (un?.quadra as string) ?? "?", lote: (un?.lote as string) ?? "?", dias: Math.floor((Date.now() - new Date(n.updated_at as string).getTime()) / 864e5) };
      });
      setPendingFollowups(pending);
    })();
  }, [accountId, activities.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Computed ──

  const today = todayStr();
  const yesterday = yesterdayStr();
  const weekStart = startOfWeek();
  const monthStart = startOfMonth();

  // Onda 1.6: filtro de período honra dateMode (activity_date | created_at).
  const dateColumnFor = useCallback(
    (a: Activity) =>
      periodCfg.dateColumn === "activity_date" ? a.activity_date : (a.created_at ?? "").slice(0, 10),
    [periodCfg.dateColumn],
  );
  const periodStart = periodCfg.startDate;

  // Base filtered by status + period + member (but NOT type) — used for type pill counts
  const filteredBeforeType = useMemo(() => {
    let f = activities;
    if (statusFilter === "pending") {
      f = f.filter((a) => a.status === "scheduled" || a.status === "expired");
      f = [...f].sort((a, b) => a.activity_date.localeCompare(b.activity_date));
    } else if (statusFilter === "completed") {
      f = f.filter((a) => (a.status || "completed") === "completed");
      if (periodFilter === "today") f = f.filter((a) => dateColumnFor(a) === periodStart);
      else if (periodFilter !== "all") f = f.filter((a) => dateColumnFor(a) >= periodStart);
    } else {
      f = f.filter((a) => a.status !== "skipped");
      if (periodFilter === "today") f = f.filter((a) => dateColumnFor(a) === periodStart);
      else if (periodFilter !== "all") f = f.filter((a) => dateColumnFor(a) >= periodStart);
    }
    if (memberFilter) f = f.filter((a) => a.profile_id === memberFilter);
    return f;
  }, [activities, statusFilter, periodFilter, memberFilter, periodStart, dateColumnFor]);

  const filteredActivities = useMemo(() => {
    let f = filteredBeforeType;
    if (typeFilter !== "all") f = f.filter((a) => a.type === typeFilter);
    return f;
  }, [filteredBeforeType, typeFilter]);

  // Onda 3.3: grouping muda conforme ordenação escolhida.
  const grouped = useMemo(() => {
    if (listSort === "type" || listSort === "profile") {
      const groups: Record<string, Activity[]> = {};
      for (const a of filteredActivities) {
        const key = listSort === "type" ? a.type : (a.profiles?.name ?? "Desconhecido");
        if (!groups[key]) groups[key] = [];
        groups[key].push(a);
      }
      // Items dentro do grupo sempre por data desc.
      Object.values(groups).forEach((arr) => arr.sort((a, b) => b.activity_date.localeCompare(a.activity_date) || (b.start_time || "").localeCompare(a.start_time || "")));
      return Object.entries(groups).sort(([a], [b]) => {
        const labelA = listSort === "type" ? (badgeLabels[a] ?? a) : a;
        const labelB = listSort === "type" ? (badgeLabels[b] ?? b) : b;
        return labelA.localeCompare(labelB);
      });
    }
    const groups: Record<string, Activity[]> = {};
    for (const a of filteredActivities) {
      if (!groups[a.activity_date]) groups[a.activity_date] = [];
      groups[a.activity_date].push(a);
    }
    return Object.entries(groups).sort(([a], [b]) =>
      listSort === "date_asc" ? a.localeCompare(b) : b.localeCompare(a),
    );
  }, [filteredActivities, listSort]);

  const groupHeaderLabel = useCallback(
    (key: string) => {
      if (listSort === "type") return badgeLabels[key] ?? key;
      if (listSort === "profile") return key;
      return formatDateLabel(key);
    },
    [listSort],
  );

  const overdueActivities = useMemo(() => {
    const base = memberFilter ? activities.filter((a) => a.profile_id === memberFilter) : activities;
    return base.filter((a) => a.status === "scheduled" && a.activity_date && a.activity_date < today)
      .sort((a, b) => a.activity_date.localeCompare(b.activity_date));
  }, [activities, today, memberFilter]);

  const todayActivities = useMemo(() => {
    const base = memberFilter ? activities.filter((a) => a.profile_id === memberFilter) : activities;
    return base.filter((a) => a.activity_date === today && a.status !== "skipped")
      .sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""));
  }, [activities, today, memberFilter]);

  const upcomingActivities = useMemo(() => {
    const base = memberFilter ? activities.filter((a) => a.profile_id === memberFilter) : activities;
    const d = new Date(); d.setDate(d.getDate() + 3);
    const futureStr = d.toISOString().slice(0, 10);
    return base.filter((a) => a.status === "scheduled" && a.activity_date > today && a.activity_date <= futureStr)
      .sort((a, b) => a.activity_date.localeCompare(b.activity_date) || (a.start_time || "").localeCompare(b.start_time || ""));
  }, [activities, today, memberFilter]);

  const kpis = useMemo(() => {
    const base = memberFilter ? activities.filter((a) => a.profile_id === memberFilter) : activities;
    const todayCount = base.filter((a) => a.activity_date === today).length;
    const weekCount = base.filter((a) => a.activity_date >= weekStart).length;
    const monthActs = base.filter((a) => a.activity_date >= monthStart);
    const monthCount = monthActs.length;
    const monthMinutes = monthActs.reduce((s, a) => s + a.duration_minutes, 0);
    const hoursInField = (monthMinutes / 60).toFixed(1);
    const daysIn = daysSinceMonthStart();
    const avgPerDay = daysIn > 0 ? (monthCount / daysIn).toFixed(1) : "0";
    const followUpCount = monthActs.filter((a) => a.type === "follow_up").length;
    const followUpRate = monthCount > 0 ? Math.round((followUpCount / monthCount) * 100) : 0;

    // Previous month (same base)
    const now = new Date();
    const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
    const prevEnd = monthStart; // exclusive
    const prevActs = base.filter((a) => a.activity_date >= prevStart && a.activity_date < prevEnd);
    const prevCount = prevActs.length;
    const prevMinutes = prevActs.reduce((s, a) => s + a.duration_minutes, 0);
    const prevHours = prevMinutes / 60;
    const prevDays = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
    const prevAvg = prevDays > 0 ? prevCount / prevDays : 0;
    const prevFollowUp = prevActs.filter((a) => a.type === "follow_up").length;
    const prevFollowUpRate = prevCount > 0 ? Math.round((prevFollowUp / prevCount) * 100) : 0;

    const pct = (cur: number, prev: number) => {
      if (prev === 0) return cur > 0 ? 100 : 0;
      return Math.round(((cur - prev) / prev) * 100);
    };
    const progressVs = (cur: number, prev: number) => {
      if (prev <= 0) return cur > 0 ? 100 : 0;
      return Math.round((cur / prev) * 100);
    };

    return {
      todayCount, weekCount, monthCount, hoursInField, avgPerDay, followUpRate,
      monthDeltaPct: pct(monthCount, prevCount),
      monthProgressPct: progressVs(monthCount, prevCount),
      avgDeltaPct: pct(parseFloat(avgPerDay), prevAvg),
      avgProgressPct: progressVs(parseFloat(avgPerDay), prevAvg),
      hoursDeltaPct: pct(parseFloat(hoursInField), prevHours),
      hoursProgressPct: progressVs(parseFloat(hoursInField), prevHours),
      followUpDeltaPct: pct(followUpRate, prevFollowUpRate),
    };
  }, [activities, today, weekStart, monthStart, memberFilter]);

  // Streak (ENTREGA 3)
  const streak = useMemo(() => profileId ? calculateStreak(activities, profileId) : 0, [activities, profileId]);

  // Onda 1.4: ranking faz LEFT JOIN — todos os membros do escopo aparecem,
  // mesmo zerados. Director continua visível para todos nesta onda;
  // configurabilidade entra na Onda 2.5 via account_settings.
  // Onda 1.6: período + dateMode vêm do hook (toggle persistido).
  const ranking = useMemo((): RankedMember[] => {
    if (isConsultant) return [];
    const periodActs = activities.filter((a) => dateColumnFor(a) >= periodStart);
    const map: Record<string, { name: string; role: string; count: number; totalMinutes: number; lastDate: string }> = {};
    // Seed com TODOS os membros do escopo (Equipe Comercial Interna).
    for (const p of teamProfiles) {
      map[p.id] = { name: p.name, role: p.role, count: 0, totalMinutes: 0, lastDate: "" };
    }
    // Sobrescreve com dados reais do período.
    for (const a of periodActs) {
      if (!map[a.profile_id]) {
        map[a.profile_id] = { name: a.profiles?.name ?? "Desconhecido", role: a.profiles?.role ?? "", count: 0, totalMinutes: 0, lastDate: "" };
      }
      map[a.profile_id].count++;
      map[a.profile_id].totalMinutes += a.duration_minutes;
      if (a.activity_date > map[a.profile_id].lastDate) map[a.profile_id].lastDate = a.activity_date;
    }
    // lastDate considera histórico inteiro pra alerta de inatividade.
    for (const a of activities) {
      if (map[a.profile_id] && a.activity_date > (map[a.profile_id].lastDate || "")) {
        map[a.profile_id].lastDate = a.activity_date;
      }
    }
    const days = daysSinceMonthStart();
    const now = new Date();
    const d7 = new Date(now); d7.setDate(d7.getDate() - 7);
    const d14 = new Date(now); d14.setDate(d14.getDate() - 14);
    const s7 = d7.toISOString().slice(0, 10);
    const s14 = d14.toISOString().slice(0, 10);
    return Object.entries(map).map(([id, d]) => {
      const inactive = d.role !== "director" && (!d.lastDate || daysDiff(d.lastDate) >= 3);
      const last7 = activities.filter((a) => a.profile_id === id && a.activity_date > s7).length;
      const prev7 = activities.filter((a) => a.profile_id === id && a.activity_date > s14 && a.activity_date <= s7).length;
      return {
        id,
        name: d.name,
        role: d.role,
        roleLabel: ROLE_LABELS[d.role] || d.role,
        count: d.count,
        totalMinutes: d.totalMinutes,
        avg: days > 0 ? (d.count / days).toFixed(1) : "0",
        hours: (d.totalMinutes / 60).toFixed(1) + "h",
        alert: inactive ? (!d.lastDate ? "Sem atividades" : daysDiff(d.lastDate) + " dias inativo") : undefined,
        streak: calculateStreak(activities, id),
        trendDelta: last7 - prev7,
      };
    }).sort((a, b) => b.count - a.count);
  }, [activities, teamProfiles, isConsultant, periodStart, dateColumnFor]);

  const inactiveMembers = useMemo(() => ranking.filter((r) => r.alert), [ranking]);

  // Daily brief (ENTREGA 4)
  const todayActs = useMemo(() => profileId ? activities.filter((a) => a.activity_date === today && a.profile_id === profileId) : [], [activities, today, profileId]);
  const yesterdayActs = useMemo(() => profileId ? activities.filter((a) => a.activity_date === yesterday && a.profile_id === profileId) : [], [activities, yesterday, profileId]);
  const yesterdayHours = useMemo(() => yesterdayActs.reduce((s, a) => s + a.duration_minutes, 0) / 60, [yesterdayActs]);
  const pendingActions = useMemo(() => profileId ? activities.filter((a) => a.profile_id === profileId && a.next_action && a.next_action_date && a.next_action_date <= today) : [], [activities, profileId, today]);
  const showBrief = (isConsultant || isManager) && todayActs.length === 0 && (yesterdayActs.length > 0 || pendingActions.length > 0);

  // Bar chart (director)
  const chartData = useMemo(() => {
    if (!isDirector) return [];
    const base = memberFilter ? activities.filter((a) => a.profile_id === memberFilter) : activities;
    const days: Record<string, number> = {};
    for (let i = 29; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); days[d.toISOString().slice(0, 10)] = 0; }
    for (const a of base) { if (a.activity_date in days) days[a.activity_date]++; }
    return Object.entries(days).map(([date, count]) => ({ date, count }));
  }, [activities, isDirector, memberFilter]);
  const chartMax = useMemo(() => Math.max(1, ...chartData.map((d) => d.count)), [chartData]);

  function openModal(type?: ActivityType, title?: string) { setEditingActivity(null); setModalType(type); setModalTitle(title); setSlotDate(undefined); setSlotTime(undefined); setModalOpen(true); if (type) setTimeout(() => document.getElementById("activity-title")?.focus(), 200); }
  function openScheduleModal(date: string, time: string) { setEditingActivity(null); setModalType(undefined); setModalTitle(undefined); setSlotDate(date); setSlotTime(time); setModalOpen(true); }
  function openEditModal(activity: Activity) { setEditingActivity(activity); setModalType(undefined); setModalTitle(undefined); setModalOpen(true); }
  function handleSaved() { setToast(editingActivity ? "Atividade atualizada!" : "Atividade registrada!"); fetchActivities(); }

  async function handleCompleteActivity() {
    if (!completingActivity || !supabase) return;
    setCompleting(true);
    try {
      await supabase.from("activities").update({ status: "completed", duration_minutes: completeDuration, outcome: completeOutcome.trim() || null, updated_at: new Date().toISOString() }).eq("id", completingActivity.id);
      setToast("Atividade concluída!"); setCompletingActivity(null); setCompleteOutcome(""); setCompleteDuration(60); fetchActivities();
    } catch { setToast("Erro ao concluir"); }
    finally { setCompleting(false); }
  }

  async function handleSkipActivity() {
    if (!skippingActivity || !supabase || !skipReason) return;
    setSkipping(true);
    try {
      await supabase.from("activities").update({ status: "skipped", skip_reason: skipReason, updated_at: new Date().toISOString() }).eq("id", skippingActivity.id);
      setToast("Atividade pulada"); setSkippingActivity(null); setSkipReason(""); fetchActivities();
    } catch { setToast("Erro ao pular"); }
    finally { setSkipping(false); }
  }

  const showRegister = isConsultant || isManager;
  const showAuthor = !isConsultant;

  if (!accountId || !developmentId) return <div style={{ color: T.fog, padding: 40, textAlign: "center" }}>Selecione uma conta e empreendimento.</div>;

  return (
    <div style={{ maxWidth: 960, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          {/* Onda 2.4: H1 alinhado ao Brand Book v7 — serif 24/400. */}
          <h1 style={{
            fontFamily: "'Instrument Serif', Georgia, serif",
            fontStyle: "italic", fontSize: 24, color: T.chalk,
            fontWeight: 400, margin: 0, lineHeight: 1.15,
          }}>{isConsultant || (isManager && viewMode === "mine") ? "Minhas Atividades" : isDirector ? "Atividades da Operação" : "Atividades da Equipe"}</h1>
          {isConsultant && authenticatedProfile ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
              <span style={{ color: T.bone, fontSize: 13 }}>{authenticatedProfile.fullName}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", background: T.sprout + "15", color: T.sprout, padding: "2px 8px", borderRadius: 4 }}>Consultor</span>
              {streak > 0 && <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 12, background: streak >= 5 ? T.orange + "20" : T.sprout + "20", color: streak >= 5 ? T.orange : T.sprout, fontSize: 12, fontWeight: 600 }}>● {streak} {streak === 1 ? "dia" : "dias"}</span>}
            </div>
          ) : (
            <div style={{ fontSize: 13, color: T.fog, marginTop: 4 }}>{memberFilter ? `Atividades de ${ranking.find((r) => r.id === memberFilter)?.name ?? "membro"}` : `Visão gerencial · ${development?.developmentName}`}</div>
          )}
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {/* View toggle */}
          <div style={{ display: "flex", gap: 0, border: "1px solid rgba(61,58,48,0.15)", borderRadius: 8, overflow: "hidden" }}>
            {(["list", "calendar"] as const).map((mode, i) => (
              <button key={mode} type="button" onClick={() => setDisplayMode(mode)} style={{
                padding: "7px 16px", fontSize: 11, fontWeight: 600, cursor: "pointer",
                border: "none",
                borderRight: i === 0 ? "1px solid rgba(61,58,48,0.1)" : "none",
                color: displayMode === mode ? "#4ADE80" : "#5C5647",
                background: displayMode === mode ? "rgba(74,222,128,0.06)" : "transparent",
                transition: "all 100ms ease",
              }}>
                {mode === "list" ? "Lista" : "Agenda"}
              </button>
            ))}
          </div>
          {showRegister && <button type="button" onClick={() => openModal()} style={{ background: T.sprout, color: T.ink, border: "none", borderRadius: 8, padding: "0 16px", height: 36, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>+ Registrar atividade</button>}
        </div>
      </div>

      {/* ═══ CALENDAR VIEW ═══ */}
      {displayMode === "calendar" && (isMobile
        ? <DailyCalendarMobile activities={activities} onSlotClick={openScheduleModal} onEventClick={(id) => { const found = activities.find((a) => a.id === id); if (found) setSelectedActivity(found); }} />
        : <WeeklyCalendar activities={activities} accountId={accountId} onSlotClick={openScheduleModal} onEventClick={(id) => { const found = activities.find((a) => a.id === id); if (found) setSelectedActivity(found); }} />)}

      {/* ═══ LIST VIEW (existing content) ═══ */}
      {displayMode === "list" && (<>
      {/* HOJE — atrasadas + hoje + próximos dias */}
      <TodayBlock
        overdue={overdueActivities}
        today={todayActivities}
        upcoming={upcomingActivities}
        onClickActivity={async (a) => {
          setSelectedActivity(a);
          if (supabase) {
            const { data } = await supabase.from("activity_participants").select("participant_type, participant_name, participant_detail").eq("activity_id", a.id);
            setSelectedParticipants((data ?? []) as typeof selectedParticipants);
          }
        }}
      />

      {/* AÇÃO RÁPIDA — 4 cards grandes */}
      {showRegister && (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: 8, marginBottom: 16 }}>
          {([
            { type: "visit_broker" as ActivityType, label: "Visita", sublabel: "cliente ou corretor", color: T.sprout, icon: "→" },
            { type: "phone_call" as ActivityType, label: "Ligação", sublabel: "registro rápido", color: T.blue, icon: "↗" },
            { type: "follow_up" as ActivityType, label: "Follow-up", sublabel: "acompanhamento", color: T.orange, icon: "↻" },
            { type: "training" as ActivityType, label: "Treinamento", sublabel: "capacitação", color: T.purple, icon: "◆" },
          ]).map((action) => (
            <button
              key={action.type}
              type="button"
              onClick={() => openModal(action.type)}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = action.color + "40"; e.currentTarget.style.transform = "translateY(-1px)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border-default)"; e.currentTarget.style.transform = "none"; }}
              style={{
                padding: "16px 14px", borderRadius: 10, cursor: "pointer",
                background: "linear-gradient(145deg, var(--surface-raised), var(--surface-base))",
                border: "1px solid var(--border-default)",
                textAlign: "left", display: "flex", flexDirection: "column", gap: 4,
                transition: "border-color 0.15s, transform 0.1s",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: action.color }}>
                  + {action.label}
                </span>
                <span style={{ fontSize: 14, color: action.color, opacity: 0.5 }}>{action.icon}</span>
              </div>
              <span style={{ fontSize: 11, color: T.fog }}>{action.sublabel}</span>
            </button>
          ))}
        </div>
      )}

      {/* KPIs — Onda 2.1: fita única compacta, libera viewport para a lista. */}
      {(() => {
        const isPersonal = isConsultant || (isManager && viewMode === "mine");
        if (isPersonal) {
          const personalCompletedMonth = activities.filter((a) => a.status === "completed" && a.activity_date >= monthStart).length;
          const personalPending = activities.filter((a) => a.status === "scheduled").length;
          const personalOverdue = overdueActivities.length;
          const dayOfMonth = new Date().getDate();
          const avgDay = dayOfMonth > 0 ? (personalCompletedMonth / dayOfMonth).toFixed(1) : "0";
          return (
            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: isMobile ? "wrap" : "nowrap" }}>
              <KpiCard compact label="Este mês" value={personalCompletedMonth} accent={T.sprout} tooltip="Atividades concluídas neste mês" />
              <KpiCard compact label="Média / dia" value={avgDay} accent={T.blue} tooltip="Média de atividades concluídas por dia corrido do mês" />
              <KpiCard
                compact
                label="Pendentes"
                value={personalPending}
                accent={personalPending > 0 ? T.orange : T.fog}
                warn={personalPending > 0}
                tooltip="Atividades agendadas que ainda não foram concluídas"
              />
              <KpiCard
                compact
                label="Atrasadas"
                value={personalOverdue}
                accent={personalOverdue > 0 ? T.red : T.fog}
                warn={personalOverdue > 0}
                tooltip="Atividades agendadas com data anterior a hoje"
              />
            </div>
          );
        }
        return (
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: isMobile ? "wrap" : "nowrap" }}>
            <KpiCard compact label="Total este mês" value={kpis.monthCount} accent={T.sprout} deltaPct={kpis.monthDeltaPct} tooltip="Atividades registradas no período filtrado" />
            <KpiCard compact label="Média / dia" value={kpis.avgPerDay} accent={T.blue} deltaPct={kpis.avgDeltaPct} tooltip="Média de atividades por dia corrido do mês" />
            <KpiCard compact label="Horas em campo" value={kpis.hoursInField + "h"} accent={T.purple} deltaPct={kpis.hoursDeltaPct} tooltip="Tempo total em atividades de campo (visitas, reuniões externas)" />
            <KpiCard compact label="Taxa follow-up" value={kpis.followUpRate + "%"} warn={kpis.followUpRate < 20} accent={kpis.followUpRate < 20 ? T.red : T.sprout} deltaPct={kpis.followUpDeltaPct} tooltip="Percentual de atividades do tipo follow-up sobre o total do período" />
          </div>
        );
      })()}

      {/*
        Onda 2.2: as duas caixas têm regras de negócio genuinamente distintas
        (Fase 1 confirmou). Caixa verde = compromissos pessoais registrados em
        atividades anteriores via campo `next_action`. Caixa laranja =
        sugestões automáticas a partir de negociações ativas sem contato há
        7+ dias. Os títulos+subtítulos foram introduzidos para deixar a
        diferença explícita ao usuário, em vez de depender só de cor.
      */}
      {showBrief && (
        <div style={{ background: T.carbon, border: `1px solid ${T.stone}`, borderLeft: `3px solid ${T.sprout}`, borderRadius: 10, padding: 20, marginBottom: 20 }}>
          <div style={{ marginBottom: 14 }}>
            <h2 style={{ fontFamily: "var(--font-sans)", fontSize: 16, fontWeight: 500, color: T.chalk, margin: 0, lineHeight: 1.2 }}>
              Compromissos pendentes
            </h2>
            <div style={{ fontSize: 12, color: T.fog, marginTop: 2 }}>
              Próximos passos que você prometeu durante atividades anteriores
            </div>
          </div>
          {yesterdayActs.length > 0 && (
            <div style={{ fontSize: 13, color: T.fog, marginBottom: 8 }}>
              Ontem você realizou <span style={{ color: T.sprout, fontWeight: 600 }}>{yesterdayActs.length} {yesterdayActs.length === 1 ? "atividade" : "atividades"}</span>
              {yesterdayHours > 0 && <>, totalizando <span style={{ color: T.sprout, fontWeight: 600 }}>{yesterdayHours.toFixed(1)}h</span> em campo</>}.
            </div>
          )}
          {pendingActions.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 12, color: T.sprout, fontWeight: 500, marginBottom: 6 }}>● {pendingActions.length} {pendingActions.length === 1 ? "compromisso para hoje" : "compromissos para hoje"}</div>
              {pendingActions.slice(0, 3).map((a) => (
                <div key={a.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 12px", borderRadius: 6, background: T.stone, marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: T.bone }}>{a.next_action}</span>
                  <button type="button" onClick={() => openModal("follow_up", a.next_action || "")} style={{ padding: "4px 12px", borderRadius: 6, background: T.sprout, color: T.ink, fontSize: 11, fontWeight: 600, border: "none", cursor: "pointer" }}>Registrar</button>
                </div>
              ))}
            </div>
          )}
          {todayActs.length === 0 && pendingActions.length === 0 && (
            <div style={{ fontSize: 13, color: T.fog }}>Nenhuma atividade registrada hoje. <span style={{ color: T.sprout, cursor: "pointer" }} onClick={() => openModal()}>Registrar agora →</span></div>
          )}
        </div>
      )}

      {/* Sugestões da inteligência — ver comentário na caixa anterior. */}
      {pendingFollowups.length > 0 && (
        <div style={{ background: T.orange + "10", border: `1px solid ${T.orange}30`, borderLeft: `3px solid ${T.orange}`, borderRadius: 10, padding: 16, marginBottom: 20 }}>
          <div style={{ marginBottom: 12 }}>
            <h2 style={{ fontFamily: "var(--font-sans)", fontSize: 16, fontWeight: 500, color: T.chalk, margin: 0, lineHeight: 1.2 }}>
              Sugestões da inteligência
            </h2>
            <div style={{ fontSize: 12, color: T.fog, marginTop: 2 }}>
              Clientes em negociação sem contato há mais de 7 dias
            </div>
          </div>
          {pendingFollowups.slice(0, 3).map((n) => (
            <div key={n.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderRadius: 8, background: T.carbon, border: `1px solid ${T.stone}`, marginBottom: 6 }}>
              <div>
                <span style={{ fontSize: 13, color: T.chalk, fontWeight: 500 }}>{n.clientName}</span>
                <span style={{ fontSize: 11, color: T.fog, marginLeft: 8 }}>Q{n.quadra} L{n.lote} · sem contato há {n.dias} dias</span>
              </div>
              <button type="button" onClick={() => openModal("follow_up", `Follow-up ${n.clientName} — Q${n.quadra} L${n.lote}`)} style={{ padding: "6px 14px", borderRadius: 6, background: T.orange, color: T.ink, fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer" }}>Registrar</button>
            </div>
          ))}
        </div>
      )}

      {/* Inactivity alert */}
      {inactiveMembers.length > 0 && (isManager || isDirector) && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", background: T.amber + "10", border: `1px solid ${T.amber}30`, borderRadius: 8, fontSize: 13, color: T.amber, marginBottom: 20 }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>!</span>
          <span>{inactiveMembers.map((m) => m.name).join(", ")} não registrou atividades nos últimos 3 dias.</span>
        </div>
      )}

      {/* Director bar chart */}
      {isDirector && chartData.length > 0 && (
        <div style={{ background: T.carbon, border: `1px solid ${T.stone}`, borderRadius: 10, padding: 16, marginBottom: 24 }}>
          <div style={{ fontSize: 10, color: T.fog, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "var(--font-mono)", marginBottom: 12 }}>Atividades / dia — últimos 30 dias</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 80 }}>
            {chartData.map((d) => (<div key={d.date} title={`${formatDateBRT(d.date + "T12:00:00")}: ${d.count}`} style={{ flex: 1, background: d.count > 4 ? T.sprout : d.count > 0 ? T.blue : T.stone, height: d.count > 0 ? `${(d.count / chartMax) * 100}%` : 2, borderRadius: 2, minHeight: 2, opacity: d.count > 0 ? 1 : 0.3 }} />))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
            <span style={{ fontSize: 9, color: T.slate, fontFamily: "var(--font-mono)" }}>{chartData[0]?.date.slice(5).replace("-", "/")}</span>
            <span style={{ fontSize: 9, color: T.slate, fontFamily: "var(--font-mono)" }}>{chartData[Math.floor(chartData.length / 2)]?.date.slice(5).replace("-", "/")}</span>
            <span style={{ fontSize: 9, color: T.slate, fontFamily: "var(--font-mono)" }}>{chartData[chartData.length - 1]?.date.slice(5).replace("-", "/")}</span>
          </div>
        </div>
      )}

      {/* Filtros — linha única + Filtros avançados colapsável */}
      {(() => {
        const memberActs = memberFilter ? activities.filter((a) => a.profile_id === memberFilter) : activities;
        const pendingCount = memberActs.filter((a) => a.status === "scheduled" || a.status === "expired").length;
        const completedCount = memberActs.filter((a) => (a.status || "completed") === "completed").length;
        const activeFilterCount =
          (typeFilter && typeFilter !== "all" ? 1 : 0) +
          (periodFilter && periodFilter !== "month" ? 1 : 0) +
          (memberFilter ? 1 : 0) +
          (consultantFilter && consultantFilter !== "all" ? 1 : 0);
        const clearAllFilters = () => {
          setTypeFilter("all");
          setPeriodFilter("month");
          setMemberFilter(null);
          setConsultantFilter("all");
        };
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
            {isManager && (
              <div style={{ display: "flex", borderRadius: 10, overflow: "hidden", border: "1px solid rgba(42,40,34,0.5)" }}>
                {(["mine", "team"] as const).map((m) => (
                  <button key={m} type="button" onClick={() => setViewMode(m)} style={{
                    padding: "8px 20px",
                    background: viewMode === m ? "rgba(74,222,128,0.1)" : "transparent",
                    color: viewMode === m ? T.sprout : T.fog,
                    border: "none", fontFamily: "var(--font-mono)", fontSize: 12,
                    fontWeight: 700, cursor: "pointer", letterSpacing: "0.04em",
                    transition: "background 0.15s, color 0.15s",
                  }}>{m === "mine" ? "Minhas" : "Equipe"}</button>
                ))}
              </div>
            )}

            {/* Onda 2.3: rótulo "Agendadas" deixa explícito o escopo da tab
                (atividades com status scheduled/expired) — diferente de
                "Compromissos pendentes" e "Sugestões da inteligência" acima. */}
            {([
              ["pending", `Agendadas${pendingCount ? ` (${pendingCount})` : ""}`, "Atividades com status agendada ou expirada"],
              ["completed", `Concluídas (${completedCount})`, "Atividades já realizadas"],
              ["all", "Todas", "Todas as atividades exceto puladas"],
            ] as const).map(([k, l, tip]) => (
              <button
                key={k}
                type="button"
                title={tip}
                onClick={() => setStatusFilter(k as "pending" | "completed" | "all")}
                style={{
                  padding: "6px 12px", borderRadius: 8,
                  border: statusFilter === k ? "1px solid rgba(74,222,128,0.25)" : "1px solid rgba(42,40,34,0.4)",
                  background: statusFilter === k ? "rgba(74,222,128,0.06)" : "transparent",
                  color: statusFilter === k ? T.sprout : T.fog,
                  fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600, cursor: "pointer",
                }}
              >{l}</button>
            ))}

            <div style={{ flex: 1, minWidth: 0 }} />

            {/* Onda 2.5: filtros como ação secundária — peso visual menor
                que tabs, ícone de funil + label + badge contador. */}
            <button
              type="button"
              title="Filtros adicionais (período, modo de data, tipo, membro)"
              onClick={() => setShowAdvancedFilters((p) => !p)}
              style={{
                padding: "5px 10px", borderRadius: 8,
                border: "1px solid var(--border-default)",
                background: "transparent",
                color: activeFilterCount > 0 || showAdvancedFilters ? T.bone : T.fog,
                fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 500, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 6,
                opacity: 0.85,
              }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
              </svg>
              Filtros
              {activeFilterCount > 0 && (
                <span style={{
                  fontFamily: "var(--font-mono)", fontSize: 8,
                  background: "var(--surface-hover)", color: T.bone,
                  minWidth: 14, height: 14, padding: "0 4px", borderRadius: 7,
                  display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700,
                }}>{activeFilterCount}</span>
              )}
              <svg width="8" height="5" viewBox="0 0 8 5" fill="none" style={{ transform: showAdvancedFilters ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
                <path d="M1 1L4 4L7 1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            </button>

            {activeFilterCount > 0 && (
              <button type="button" onClick={clearAllFilters} style={{
                padding: "6px 10px", borderRadius: 8,
                border: "1px solid rgba(248,113,113,0.2)",
                background: "transparent",
                color: T.red, fontFamily: "var(--font-mono)",
                fontSize: 9, fontWeight: 600, cursor: "pointer",
              }}>Limpar</button>
            )}
          </div>
        );
      })()}

      {showAdvancedFilters && (
        <div style={{
          display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center",
          padding: "10px 14px",
          background: "linear-gradient(145deg, var(--surface-raised), var(--surface-base))",
          border: "1px solid var(--border-default)", borderRadius: 10,
        }}>
          <select value={periodFilter} onChange={(e) => setPeriodFilter(e.target.value)} style={{
            padding: "6px 28px 6px 10px", borderRadius: 6,
            background: "var(--surface-base)", border: "1px solid rgba(42,40,34,0.4)",
            color: T.bone, fontFamily: "var(--font-mono)", fontSize: 10, cursor: "pointer",
            appearance: "none",
            backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='8' height='5' viewBox='0 0 8 5' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L4 4L7 1' stroke='%239C9686' stroke-width='1.2' stroke-linecap='round'/%3E%3C/svg%3E\")",
            backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center",
          }}>
            <option value="today">Hoje</option>
            <option value="week">Esta semana</option>
            <option value="month">Este mês</option>
            <option value="quarter">Este trimestre</option>
            <option value="all">Todo período</option>
          </select>

          {/* Onda 1.6: toggle de modo de data (activity_date | created_at) */}
          <select
            value={periodCfg.dateMode}
            onChange={(e) => periodCfg.setDateMode(e.target.value as typeof periodCfg.dateMode)}
            title="Considerar período pela data da atividade ou pela data do registro"
            style={{
              padding: "6px 28px 6px 10px", borderRadius: 6,
              background: "var(--surface-base)", border: "1px solid rgba(42,40,34,0.4)",
              color: T.bone, fontFamily: "var(--font-mono)", fontSize: 10, cursor: "pointer",
              appearance: "none",
              backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='8' height='5' viewBox='0 0 8 5' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L4 4L7 1' stroke='%239C9686' stroke-width='1.2' stroke-linecap='round'/%3E%3C/svg%3E\")",
              backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center",
            }}
          >
            <option value="activity_date">Por data da atividade</option>
            <option value="created_at">Por data do registro</option>
          </select>

          {(isManager && viewMode === "team" || isDirector) && teamProfiles.length > 0 && (
            <select value={consultantFilter} onChange={(e) => setConsultantFilter(e.target.value)} style={{
              padding: "6px 28px 6px 10px", borderRadius: 6,
              background: "var(--surface-base)", border: "1px solid rgba(42,40,34,0.4)",
              color: T.bone, fontFamily: "var(--font-mono)", fontSize: 10, cursor: "pointer",
              appearance: "none",
              backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='8' height='5' viewBox='0 0 8 5' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L4 4L7 1' stroke='%239C9686' stroke-width='1.2' stroke-linecap='round'/%3E%3C/svg%3E\")",
              backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center",
            }}>
              <option value="all">Todos os membros</option>
              {teamProfiles.filter((p) => p.role !== "director" || isDirector).map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}

          <div style={{ width: 1, height: 20, background: "rgba(42,40,34,0.3)" }} />

          {typeFilter && typeFilter !== "all" && (
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              padding: "3px 8px", borderRadius: 6,
              background: "rgba(96,165,250,0.1)",
              border: "1px solid rgba(96,165,250,0.2)",
              fontFamily: "var(--font-mono)", fontSize: 9,
              color: T.blue,
            }}>
              {badgeLabels[typeFilter] || typeFilter}
              <span onClick={() => setTypeFilter("all")} style={{ cursor: "pointer", opacity: 0.7, fontSize: 12, marginLeft: 2, lineHeight: 1 }}>×</span>
            </div>
          )}

          {[["all", "Todos"], ...Object.entries(badgeLabels)].map(([k, l]) => {
            const count = k === "all" ? filteredBeforeType.length : filteredBeforeType.filter((a) => a.type === k).length;
            const isActive = typeFilter === k;
            return (
              <button key={k} type="button" onClick={() => setTypeFilter(k)} style={{
                padding: "4px 8px", borderRadius: 5,
                border: isActive ? "1px solid rgba(96,165,250,0.25)" : "1px solid rgba(42,40,34,0.3)",
                background: isActive ? "rgba(96,165,250,0.06)" : "transparent",
                color: isActive ? T.blue : T.fog,
                fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 500,
                cursor: "pointer", whiteSpace: "nowrap",
              }}>{l}{count > 0 ? ` ·${count}` : ""}</button>
            );
          })}
        </div>
      )}

      {/* Ranking (manager/director) */}
      {(isDirector || (isManager && viewMode === "team")) && ranking.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          {/*
            Onda 2.4: H3 alinhado ao Brand Book v7 — sans 11 caps tracking 4.
            Onda 3.1: cabeçalho declara escopo (Equipe Comercial Interna)
            e período corrente, eliminando ambiguidade de "quem está sendo
            comparado" e "em qual janela de tempo".
          */}
          <h3 style={{ fontFamily: "var(--font-sans)", fontSize: 11, color: T.fog, letterSpacing: "0.18em", margin: 0, marginBottom: 10, fontWeight: 600, textTransform: "uppercase" }}>
            Produtividade
            <span style={{ color: T.slate, margin: "0 6px" }}>·</span>
            Equipe Comercial Interna
            <span style={{ color: T.slate, margin: "0 6px" }}>·</span>
            {periodCfg.periodLabel}
          </h3>
          {(() => {
            const maxCount = ranking.reduce((m, r) => Math.max(m, r.count), 0);
            return ranking.map((r, idx) => (
              <div key={r.id} onClick={() => setMemberFilter(memberFilter === r.id ? null : r.id)} style={{ cursor: "pointer" }}>
                <RankingRow member={r} position={idx + 1} selected={memberFilter === r.id} maxCount={maxCount} />
              </div>
            ));
          })()}
          {memberFilter && (() => {
            const sel = ranking.find((r) => r.id === memberFilter);
            if (!sel) return null;
            return (
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "4px 10px", borderRadius: 6, marginTop: 8,
                background: "rgba(74,222,128,0.06)",
                border: "1px solid rgba(74,222,128,0.15)",
                fontFamily: "var(--font-mono)", fontSize: 10, color: T.sprout,
              }}>
                Filtrando: {sel.name}
                <span onClick={() => setMemberFilter(null)} style={{ cursor: "pointer", opacity: 0.7, fontSize: 12, lineHeight: 1 }}>×</span>
              </div>
            );
          })()}
        </div>
      )}

      {/* Section label — activities list (Onda 2.4: H3 sans 11 caps tracking 4). */}
      {(isDirector || (isManager && viewMode === "team")) && ranking.length > 0 && (
        <h3 style={{
          fontFamily: "var(--font-sans)", fontSize: 11, color: T.fog,
          letterSpacing: "0.18em", marginTop: 16, marginBottom: 10, paddingTop: 12,
          borderTop: "1px solid rgba(42,40,34,0.3)", fontWeight: 600,
          textTransform: "uppercase", margin: "16px 0 10px",
        }}>Atividades</h3>
      )}

      {/* Member filter badge */}
      {memberFilter && (() => { const m = ranking.find((r) => r.id === memberFilter); return m ? <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 14px", borderRadius: 8, background: T.sprout + "15", border: `1px solid ${T.sprout}30`, marginBottom: 12, fontSize: 13, color: T.sprout }}>Filtrado por: <strong>{m.name}</strong><button type="button" onClick={() => setMemberFilter(null)} style={{ background: "none", border: "none", color: T.sprout, fontSize: 16, cursor: "pointer", padding: 0, lineHeight: 1 }}>×</button></div> : null; })()}

      {/* Onda 1.7: chips de filtros ativos sempre visíveis */}
      {(() => {
        const chips: FilterChip[] = [
          { id: "period", label: `Período: ${periodCfg.periodLabel}`, removable: false },
          { id: "dateMode", label: `Por: ${periodCfg.dateModeLabel}`, removable: false },
        ];
        if (typeFilter !== "all") {
          chips.push({ id: "type", label: `Tipo: ${badgeLabels[typeFilter] ?? typeFilter}`, removable: true });
        }
        if (memberFilter) {
          const m = ranking.find((r) => r.id === memberFilter);
          chips.push({ id: "member", label: `Membro: ${m?.name ?? "—"}`, removable: true });
        }
        if (consultantFilter && consultantFilter !== "all") {
          const cm = teamProfiles.find((p) => p.id === consultantFilter);
          chips.push({ id: "consultant", label: `Consultor: ${cm?.name ?? "—"}`, removable: true });
        }
        const handleRemove = (id: string) => {
          if (id === "type") setTypeFilter("all");
          else if (id === "member") setMemberFilter(null);
          else if (id === "consultant") setConsultantFilter("all");
        };
        return <FilterChips chips={chips} onRemove={handleRemove} />;
      })()}

      {/* Onda 3.3: header da lista com contagem + dropdown de ordenação. */}
      {!loading && filteredActivities.length > 0 && (() => {
        const sortLabels: Record<typeof listSort, string> = {
          date_desc: "data (mais recentes)",
          date_asc: "data (mais antigas)",
          type: "tipo",
          profile: "responsável",
        };
        return (
          <div style={{
            display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap",
            fontFamily: "var(--font-mono)", fontSize: 10, color: T.fog,
            marginBottom: 10,
          }}>
            <span>Mostrando <strong style={{ color: T.bone }}>{filteredActivities.length}</strong> {filteredActivities.length === 1 ? "atividade" : "atividades"}</span>
            <span style={{ color: T.slate }}>·</span>
            <span>ordenadas por {sortLabels[listSort]}</span>
            <div style={{ flex: 1 }} />
            <select
              value={listSort}
              onChange={(e) => setListSort(e.target.value as typeof listSort)}
              title="Ordenação da lista"
              style={{
                padding: "5px 26px 5px 10px", borderRadius: 6,
                background: "var(--surface-base)", border: "1px solid var(--border-default)",
                color: T.bone, fontFamily: "var(--font-mono)", fontSize: 10, cursor: "pointer",
                appearance: "none",
                backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='8' height='5' viewBox='0 0 8 5' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L4 4L7 1' stroke='%239C9686' stroke-width='1.2' stroke-linecap='round'/%3E%3C/svg%3E\")",
                backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center",
              }}
            >
              <option value="date_desc">Data (mais recentes)</option>
              <option value="date_asc">Data (mais antigas)</option>
              <option value="type">Tipo</option>
              <option value="profile">Responsável</option>
            </select>
          </div>
        );
      })()}

      {/* Activity list */}
      {loading ? (
        <div style={{ color: T.fog, textAlign: "center", padding: 40, fontFamily: "var(--font-mono)", fontSize: 13 }}>Carregando atividades...</div>
      ) : filteredActivities.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40 }}>
          <div style={{ marginBottom: 8, opacity: 0.4 }}><IcOutro size={36} color="#706B5F" /></div>
          <div style={{ color: T.fog, fontSize: 14 }}>Nenhuma atividade encontrada</div>
          {showRegister && <button type="button" onClick={() => openModal()} style={{ marginTop: 16, background: T.sprout, color: T.ink, border: "none", borderRadius: 8, padding: "0 16px", height: 36, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Registrar primeira atividade</button>}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {grouped.map(([key, acts]) => (
            <div key={key}>
              <div style={{ fontSize: 11, fontWeight: 600, color: T.fog, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8, paddingBottom: 6, borderBottom: `1px solid ${T.stone}` }}>{groupHeaderLabel(key)}</div>
              {acts.map((a) => <ActivityCard key={a.id} activity={a} showAuthor={showAuthor} isOwner={a.profile_id === profileId} canManage={canManage} onDelete={async () => { await fetchActivities(); setToast("Atividade excluída"); }} onEdit={openEditModal} onComplete={(act) => { setCompletingActivity(act); setCompleteOutcome(""); setCompleteDuration(60); }} onSkip={(act) => { setSkippingActivity(act); setSkipReason(""); }} onClick={async (act) => { setSelectedActivity(act); if (supabase) { const { data } = await supabase.from("activity_participants").select("participant_type, participant_name, participant_detail").eq("activity_id", act.id); setSelectedParticipants((data ?? []) as typeof selectedParticipants); } }} />)}
            </div>
          ))}
        </div>
      )}
      </>)}

      {modalOpen && profileId && accountId && developmentId && (
        <RegistrationModal accountId={accountId} developmentId={developmentId} profileId={profileId} initialType={modalType} initialTitle={modalTitle} initialDate={slotDate} initialStartTime={slotTime} editActivity={editingActivity} canManageDate={canManage} onClose={() => { setModalOpen(false); setModalType(undefined); setModalTitle(undefined); setSlotDate(undefined); setSlotTime(undefined); setEditingActivity(null); }} onSaved={handleSaved} />
      )}
      {/* Skip activity modal */}
      {skippingActivity && createPortal(
        <div style={{ position: "fixed", inset: 0, zIndex: 9000 }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)" }} onClick={() => setSkippingActivity(null)} />
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", background: T.ink, border: `1px solid ${T.stone}`, borderRadius: 14, padding: 24, width: 400, maxWidth: "90vw", zIndex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: T.chalk, margin: 0 }}>Pular atividade</h3>
              <button type="button" onClick={() => setSkippingActivity(null)} style={{ background: "none", border: "none", color: T.fog, fontSize: 20, cursor: "pointer" }}>×</button>
            </div>
            <div style={{ fontSize: 13, color: T.fog, marginBottom: 16, padding: "10px 14px", background: T.carbon, borderRadius: 8, border: `1px solid ${T.stone}` }}>
              <div style={{ fontWeight: 500, color: T.chalk }}>{skippingActivity.title}</div>
              <div style={{ fontSize: 11, marginTop: 2 }}>{badgeLabels[skippingActivity.type]} · {formatDateBRT(skippingActivity.activity_date + "T12:00:00")}</div>
            </div>
            <label style={{ fontSize: 10, color: T.fog, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "var(--font-mono)", display: "block", marginBottom: 10 }}>Por que esta atividade não será realizada?</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
              {["Cliente desistiu", "Reagendada para outra data", "Negociação encerrada", "Não foi possível contato"].map((r) => (
                <button key={r} type="button" onClick={() => setSkipReason(r)} style={{ padding: "10px 14px", borderRadius: 8, border: skipReason === r ? `2px solid ${T.amber}` : `1px solid ${T.stone}`, background: skipReason === r ? T.amber + "10" : T.carbon, color: skipReason === r ? T.amber : T.bone, fontSize: 13, textAlign: "left", cursor: "pointer" }}>{r}</button>
              ))}
              <input placeholder="Outro motivo..." value={skipReason.startsWith("Outro:") ? skipReason.slice(7) : (!["Cliente desistiu", "Reagendada para outra data", "Negociação encerrada", "Não foi possível contato"].includes(skipReason) && skipReason) ? skipReason : ""} onChange={(e) => setSkipReason(e.target.value || "")} style={{ padding: "10px 14px", borderRadius: 8, border: `1px solid ${T.stone}`, background: T.carbon, color: T.chalk, fontSize: 13, outline: "none" }} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={() => setSkippingActivity(null)} style={{ flex: 1, padding: "10px", borderRadius: 8, border: `1px solid ${T.stone}`, background: "transparent", color: T.bone, fontSize: 13, cursor: "pointer" }}>Cancelar</button>
              <button type="button" onClick={handleSkipActivity} disabled={!skipReason || skipping} style={{ flex: 2, padding: "10px", borderRadius: 8, border: "none", background: T.amber, color: T.ink, fontSize: 13, fontWeight: 700, cursor: !skipReason || skipping ? "not-allowed" : "pointer", opacity: !skipReason || skipping ? 0.6 : 1 }}>{skipping ? "Salvando..." : "⊘ Pular atividade"}</button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* Complete activity modal */}
      {completingActivity && createPortal(
        <div style={{ position: "fixed", inset: 0, zIndex: 9000 }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)" }} onClick={() => setCompletingActivity(null)} />
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", background: T.ink, border: `1px solid ${T.stone}`, borderRadius: 14, padding: 24, width: 400, maxWidth: "90vw", zIndex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: T.chalk, margin: 0 }}>Concluir atividade</h3>
              <button type="button" onClick={() => setCompletingActivity(null)} style={{ background: "none", border: "none", color: T.fog, fontSize: 20, cursor: "pointer" }}>×</button>
            </div>
            <div style={{ fontSize: 13, color: T.fog, marginBottom: 16, padding: "10px 14px", background: T.carbon, borderRadius: 8, border: `1px solid ${T.stone}` }}>
              <div style={{ fontWeight: 500, color: T.chalk }}>{completingActivity.title}</div>
              <div style={{ fontSize: 11, marginTop: 2 }}>{badgeLabels[completingActivity.type]} · {formatDateBRT(completingActivity.activity_date + "T12:00:00")}</div>
            </div>
            <label style={{ fontSize: 10, color: T.fog, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "var(--font-mono)", display: "block", marginBottom: 6 }}>Duração</label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
              {DURATIONS.map((d) => (
                <button key={d.value} type="button" onClick={() => setCompleteDuration(d.value)} style={{ background: completeDuration === d.value ? T.sprout : T.carbon, border: completeDuration === d.value ? `1px solid ${T.sprout}` : `1px solid ${T.stone}`, borderRadius: 20, padding: "5px 12px", fontSize: 12, fontWeight: 600, color: completeDuration === d.value ? T.ink : T.bone, cursor: "pointer" }}>{d.label}</button>
              ))}
            </div>
            <label style={{ fontSize: 10, color: T.fog, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "var(--font-mono)", display: "block", marginBottom: 6 }}>Resultado</label>
            <input value={completeOutcome} onChange={(e) => setCompleteOutcome(e.target.value)} placeholder="O que aconteceu?" style={{ width: "100%", background: T.carbon, border: `1px solid ${T.stone}`, borderRadius: 8, padding: "11px 14px", color: T.chalk, fontSize: 13, outline: "none", boxSizing: "border-box", marginBottom: 20 }} />
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={() => setCompletingActivity(null)} style={{ flex: 1, padding: "10px", borderRadius: 8, border: `1px solid ${T.stone}`, background: "transparent", color: T.bone, fontSize: 13, cursor: "pointer" }}>Cancelar</button>
              <button type="button" onClick={handleCompleteActivity} disabled={completing} style={{ flex: 2, padding: "10px", borderRadius: 8, border: "none", background: T.sprout, color: T.ink, fontSize: 13, fontWeight: 700, cursor: completing ? "not-allowed" : "pointer", opacity: completing ? 0.6 : 1 }}>{completing ? "Salvando..." : "✓ Concluir atividade"}</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
      {/* Activity detail modal */}
      {selectedActivity && (
        <ActivityDetailModal
          activity={selectedActivity}
          participants={selectedParticipants}
          onClose={() => setSelectedActivity(null)}
          canEdit={selectedActivity.profile_id === profileId || canManage}
          onEdit={() => { const a = selectedActivity; setSelectedActivity(null); openEditModal(a); }}
          onComplete={() => { const a = selectedActivity; setSelectedActivity(null); setCompletingActivity(a); setCompleteOutcome(""); setCompleteDuration(60); }}
          onSkip={() => { const a = selectedActivity; setSelectedActivity(null); setSkippingActivity(a); setSkipReason(""); }}
          onDelete={async () => { if (!supabase) return; await supabase.from("activities").delete().eq("id", selectedActivity.id); await fetchActivities(); setSelectedActivity(null); setToast("Atividade excluída"); }}
        />
      )}
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  );
}
