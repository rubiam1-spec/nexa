import { useState, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { useAccount } from "../../../app/contexts/AccountContext";
import { useDevelopment } from "../../../app/contexts/DevelopmentContext";
import { useAuth } from "../../../app/contexts/AuthContext";
import { supabase } from "../../../infra/supabase/supabaseClient";
import { useIsMobile } from "../../../shared/hooks/useIsMobile";
import { IcVisita, IcClientes, IcEmpreendimentos, IcTreinamento, IcLigacao, IcFollowUp, IcReuniao, IcImobiliarias, IcOutro } from "../../../shared/components/icons/NexaIcons";

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
}

interface RankedMember {
  id: string; name: string; role: string; roleLabel: string;
  count: number; totalMinutes: number; avg: string; hours: string;
  alert?: string; streak: number;
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
  const label = d.toLocaleDateString("pt-BR", { day: "numeric", month: "long" });
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
function greetingText() { const h = new Date().getHours(); return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite"; }

// ── Sub-components ──

function KpiCard({ label, value, delta, warn }: { label: string; value: string | number; delta?: string; warn?: boolean }) {
  return (
    <div style={{ background: T.carbon, borderRadius: 10, padding: "16px 18px", border: `1px solid ${T.stone}`, flex: 1, minWidth: 120 }}>
      <div style={{ fontSize: 10, color: T.fog, textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "var(--font-mono)" }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 6 }}>
        <span style={{ fontSize: 26, fontWeight: 700, color: T.chalk }}>{value}</span>
        {delta && <span style={{ fontSize: 11, color: warn ? T.amber : T.sprout, fontFamily: "var(--font-mono)" }}>{delta}</span>}
      </div>
    </div>
  );
}

function TypeBadge({ type }: { type: string }) {
  const color = badgeColors[type] || T.fog;
  return <span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap", background: color + "20", color }}>{badgeLabels[type] || type}</span>;
}

function ActivityCard({ activity, showAuthor, isOwner, canManage, onDelete, onEdit, onComplete, onSkip }: { activity: Activity; showAuthor?: boolean; isOwner?: boolean; canManage?: boolean; onDelete?: (id: string) => void; onEdit?: (activity: Activity) => void; onComplete?: (activity: Activity) => void; onSkip?: (activity: Activity) => void }) {
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
    <div style={{ display: "flex", gap: 12, padding: "14px 16px", borderRadius: 10, border: `1px solid ${isOverdue ? T.red + "50" : isScheduled ? T.blue + "40" : isExpired ? T.slate + "40" : T.stone}`, marginBottom: 8, background: isOverdue ? T.red + "08" : isScheduled && isToday ? T.blue + "08" : T.carbon, position: "relative", opacity: isSkipped ? 0.5 : isExpired ? 0.7 : 1 }}>
      <div style={{ paddingTop: 2 }}>
        {isScheduled || isExpired ? <span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap", background: "transparent", border: `1px solid ${isOverdue ? T.red : isExpired ? T.slate : T.blue}`, color: isOverdue ? T.red : isExpired ? T.slate : T.blue }}>{isExpired ? "EXPIRADA" : isOverdue ? "ATRASADA" : isToday ? "HOJE" : "AGENDADA"}</span> : <TypeBadge type={activity.type} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: T.chalk, textDecoration: isSkipped ? "line-through" : "none" }}>{activity.title}</div>
        <div style={{ fontSize: 12, color: T.fog, display: "flex", gap: 10, marginTop: 3, flexWrap: "wrap" }}>
          {activity.contact_name && <span>Com: {activity.contact_name}</span>}
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
            {activity.next_action_date && ` (${new Date(activity.next_action_date + "T12:00:00").toLocaleDateString("pt-BR")})`}
          </div>
        )}
        {isSkipped && activity.skip_reason && <div style={{ fontSize: 12, color: T.slate, marginTop: 4 }}>Motivo: {activity.skip_reason}</div>}
        {showAuthor && activity.profiles?.name && <div style={{ fontSize: 11, color: T.slate, marginTop: 4 }}>{activity.profiles.name}</div>}
        {wasEdited && !isSkipped && <div style={{ fontSize: 10, color: T.slate, marginTop: 4, fontStyle: "italic" }} title={activity.updated_at ? `Editado em ${new Date(activity.updated_at).toLocaleString("pt-BR")}` : ""}>editado ✎</div>}
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
        <div style={{ fontSize: 13, color: T.bone, fontFamily: "var(--font-mono)" }}>{activity.start_time?.substring(0, 5) || ""}</div>
        <div style={{ fontSize: 11, color: T.slate }}>{activity.duration_minutes ? fmtDuration(activity.duration_minutes) : ""}</div>
      </div>
      {confirmOpen && createPortal(
        <>
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 9000 }} onClick={() => setConfirmOpen(false)} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", background: T.ink, border: `1px solid ${T.stone}`, borderRadius: 14, padding: 24, width: 360, maxWidth: "90vw", zIndex: 9001 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: T.chalk, marginBottom: 8 }}>Excluir atividade</div>
            <div style={{ fontSize: 13, color: T.fog, marginBottom: 20 }}>Tem certeza que deseja excluir esta atividade? Esta ação não pode ser desfeita.</div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setConfirmOpen(false)} style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${T.stone}`, background: "transparent", color: T.bone, fontSize: 13, cursor: "pointer" }}>Cancelar</button>
              <button type="button" onClick={handleDelete} disabled={deleting} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: T.red, color: T.ink, fontSize: 13, fontWeight: 600, cursor: deleting ? "not-allowed" : "pointer", opacity: deleting ? 0.6 : 1 }}>{deleting ? "Excluindo..." : "Excluir"}</button>
            </div>
          </div>
        </>,
        document.body,
      )}
    </div>
  );
}

function RankingRow({ member, position }: { member: RankedMember; position: number }) {
  const isMobile = useIsMobile();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", borderRadius: 10, border: `1px solid ${member.alert ? T.amber + "40" : T.stone}`, marginBottom: 6, background: T.carbon }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: T.slate, minWidth: 20, textAlign: "center", fontFamily: "var(--font-mono)" }}>{position}</div>
      <div style={{ width: 36, height: 36, borderRadius: "50%", background: (member.alert ? T.amber : T.sprout) + "20", color: member.alert ? T.amber : T.sprout, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{initials(member.name)}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: T.chalk }}>
          {member.name}
          {member.streak > 0 && <span style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 8px", borderRadius: 12, background: member.streak >= 5 ? T.orange + "20" : T.sprout + "20", color: member.streak >= 5 ? T.orange : T.sprout, fontSize: 10, fontWeight: 600, marginLeft: 8 }}>● {member.streak}</span>}
          {member.alert && <span style={{ fontSize: 10, color: T.amber, marginLeft: 8, fontWeight: 400 }}>! {member.alert}</span>}
        </div>
        <div style={{ fontSize: 11, color: T.fog }}>{member.roleLabel}</div>
      </div>
      {!isMobile && (
        <div style={{ display: "flex", gap: 20 }}>
          <div style={{ textAlign: "right" }}><div style={{ fontSize: 16, fontWeight: 600, color: member.alert ? T.amber : T.chalk }}>{member.count}</div><div style={{ fontSize: 9, color: T.fog, textTransform: "uppercase", letterSpacing: "0.05em" }}>Atividades</div></div>
          <div style={{ textAlign: "right" }}><div style={{ fontSize: 16, fontWeight: 600, color: T.chalk }}>{member.avg}</div><div style={{ fontSize: 9, color: T.fog, textTransform: "uppercase", letterSpacing: "0.05em" }}>Média/dia</div></div>
          <div style={{ textAlign: "right" }}><div style={{ fontSize: 16, fontWeight: 600, color: T.chalk }}>{member.hours}</div><div style={{ fontSize: 9, color: T.fog, textTransform: "uppercase", letterSpacing: "0.05em" }}>Em campo</div></div>
        </div>
      )}
    </div>
  );
}

function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 3000); return () => clearTimeout(t); }, [onDone]);
  return createPortal(<div style={{ position: "fixed", bottom: 32, left: "50%", transform: "translateX(-50%)", background: T.sprout, color: T.ink, padding: "10px 24px", borderRadius: 8, fontSize: 13, fontWeight: 700, zIndex: 10000, boxShadow: "0 4px 16px rgba(0,0,0,0.4)" }}>{message}</div>, document.body);
}

// ── Registration Modal ──

function RegistrationModal({ accountId, developmentId, profileId, initialType, initialTitle, editActivity, canManageDate, onClose, onSaved }: { accountId: string; developmentId: string; profileId: string; initialType?: ActivityType; initialTitle?: string; editActivity?: Activity | null; canManageDate?: boolean; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!editActivity;
  const [type, setType] = useState<ActivityType | null>(editActivity?.type ?? initialType ?? null);
  const [title, setTitle] = useState(editActivity?.title ?? initialTitle ?? "");
  const [contactName, setContactName] = useState(editActivity?.contact_name ?? "");
  const [activityDate, setActivityDate] = useState(editActivity?.activity_date ?? todayStr());
  const [startTime, setStartTime] = useState(editActivity?.start_time?.substring(0, 5) ?? "");
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
        // Insert mode — detect scheduled vs completed
        const isFutureDate = activityDate > todayStr();
        const actStatus = isFutureDate ? "scheduled" : "completed";
        const { error } = await supabase.from("activities").insert({
          account_id: accountId, development_id: developmentId, profile_id: profileId,
          type, title: title.trim(), contact_name: contactName.trim() || null,
          activity_date: activityDate, start_time: startTime || null,
          duration_minutes: isFutureDate ? 0 : duration,
          outcome: isFutureDate ? null : (outcome.trim() || null),
          next_action: nextAction.trim() || null,
          next_action_date: nextActionDate || null, description: description.trim() || null,
          status: actStatus,
        });
        if (error) throw error;
        onSaved();
        // Skip step 2 for scheduled activities or if next action already set
        if (isFutureDate || (nextAction.trim() && nextActionDate)) { onClose(); return; }
        setStep(2);
      }
    } catch (err) { console.error("Erro ao salvar atividade:", err); }
    finally { setSaving(false); }
  }

  async function handleScheduleFollowUp() {
    if (!supabase) return;
    setSavingFollowUp(true);
    const days = followUpPick === "1" ? 1 : followUpPick === "2" ? 2 : 7;
    const followDate = addDays(days);
    try {
      await supabase.from("activities").insert({
        account_id: accountId, development_id: developmentId, profile_id: profileId,
        type: followUpType, title: `Follow-up: ${badgeLabels[followUpType]}`,
        activity_date: followDate, duration_minutes: 30,
        next_action: followUpNote.trim() || null,
        description: `Agendado após: ${title}`,
      });
      onClose();
    } catch (err) { console.error("Erro ao agendar follow-up:", err); onClose(); }
    finally { setSavingFollowUp(false); }
  }

  const IS: React.CSSProperties = { background: T.carbon, border: `1px solid ${T.stone}`, borderRadius: 8, padding: "11px 14px", color: T.chalk, fontSize: 13, width: "100%", outline: "none", boxSizing: "border-box" };
  const LBL: React.CSSProperties = { fontSize: 10, color: T.fog, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "var(--font-mono)", display: "block", marginBottom: 6 };
  const allTypes = Object.keys(badgeLabels) as ActivityType[];
  const focusIn = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => { e.currentTarget.style.borderColor = T.sprout; };
  const focusOut = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => { e.currentTarget.style.borderColor = T.stone; };

  return createPortal(
    <>
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 9000 }} onClick={onClose} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", background: T.ink, border: `1px solid ${T.stone}`, borderRadius: 14, width: isMobile ? "95vw" : 520, maxHeight: "90vh", overflowY: "auto", zIndex: 9001, padding: 24 }}>
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
          <h2 style={{ color: T.chalk, fontSize: 18, fontWeight: 700, margin: 0 }}>{isEdit ? "Editar atividade" : "Registrar atividade"}</h2>
          <button type="button" onClick={onClose} style={{ background: "none", border: "none", color: T.fog, fontSize: 20, cursor: "pointer" }}>&times;</button>
        </div>
        <label style={LBL}>Tipo de atividade</label>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, minmax(0, 1fr))" : "repeat(3, minmax(0, 1fr))", gap: 8, marginBottom: 18 }}>
          {allTypes.map((k) => (
            <button key={k} type="button" onClick={() => setType(k)} style={{ background: type === k ? T.sprout + "10" : T.carbon, border: type === k ? `2px solid ${T.sprout}` : `1px solid ${T.stone}`, borderRadius: 10, padding: "10px 6px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 18 }}>{typeIcons[k]}</span>
              <span style={{ fontSize: 11, color: type === k ? T.sprout : T.bone, fontWeight: 600 }}>{badgeLabels[k]}</span>
            </button>
          ))}
        </div>
        <label style={LBL}>Título *</label>
        <input id="activity-title" style={{ ...IS, marginBottom: 14 }} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={type ? typePlaceholders[type] : "Selecione o tipo primeiro"} onFocus={focusIn} onBlur={focusOut} />
        <label style={LBL}>Com quem</label>
        <input style={{ ...IS, marginBottom: 14 }} value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Nome do contato" onFocus={focusIn} onBlur={focusOut} />
        <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
          <div style={{ flex: 1 }}><label style={LBL}>Data *{!dateEditable && isEdit ? <span style={{ fontSize: 9, color: T.red, marginLeft: 4 }}>(bloqueado após 24h)</span> : ""}</label><input type="date" style={{ ...IS, opacity: dateEditable ? 1 : 0.5 }} value={activityDate} onChange={(e) => dateEditable && setActivityDate(e.target.value)} disabled={!dateEditable} onFocus={focusIn} onBlur={focusOut} /></div>
          <div style={{ flex: 1 }}><label style={LBL}>Horário</label><input type="time" style={IS} value={startTime} onChange={(e) => setStartTime(e.target.value)} onFocus={focusIn} onBlur={focusOut} /></div>
        </div>
        {isFuture && !isEdit && <div style={{ padding: "10px 14px", borderRadius: 8, background: T.blue + "10", border: `1px solid ${T.blue}30`, fontSize: 12, color: T.blue, marginBottom: 14 }}>📅 Atividade será agendada para {new Date(activityDate + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}</div>}
        {!isFuture && (<>
        <label style={LBL}>Duração</label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
          {DURATIONS.map((d) => (
            <button key={d.value} type="button" onClick={() => setDuration(d.value)} style={{ background: duration === d.value ? T.sprout : T.carbon, border: duration === d.value ? `1px solid ${T.sprout}` : `1px solid ${T.stone}`, borderRadius: 20, padding: "6px 14px", fontSize: 12, fontWeight: 600, color: duration === d.value ? T.ink : T.bone, cursor: "pointer" }}>{d.label}</button>
          ))}
        </div>
        <label style={LBL}>Resultado</label>
        <input style={{ ...IS, marginBottom: 14 }} value={outcome} onChange={(e) => setOutcome(e.target.value)} placeholder="O que aconteceu?" onFocus={focusIn} onBlur={focusOut} />
        </>)}
        <label style={LBL}>Próxima ação</label>
        <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
          <input style={{ ...IS, flex: 2 }} value={nextAction} onChange={(e) => setNextAction(e.target.value)} placeholder="O que fazer em seguida?" onFocus={focusIn} onBlur={focusOut} />
          <input type="date" style={{ ...IS, flex: 1 }} value={nextActionDate} onChange={(e) => setNextActionDate(e.target.value)} onFocus={focusIn} onBlur={focusOut} />
        </div>
        <label style={LBL}>Observações</label>
        <textarea rows={2} style={{ ...IS, resize: "vertical", marginBottom: 20 }} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Anotações adicionais..." onFocus={focusIn} onBlur={focusOut as unknown as React.FocusEventHandler<HTMLTextAreaElement>} />
        <button type="button" onClick={handleSave} disabled={!canSave || saving} style={{ width: "100%", height: 40, background: T.sprout, color: T.ink, border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: canSave && !saving ? "pointer" : "not-allowed", opacity: canSave && !saving ? 1 : 0.5 }}>
          {saving ? "Salvando..." : isEdit ? "Salvar alterações" : "Registrar atividade"}
        </button>
        </>
        )}
      </div>
    </>,
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
  const [periodFilter, setPeriodFilter] = useState("month");
  const [typeFilter, setTypeFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"mine" | "team">("team");
  const [consultantFilter, setConsultantFilter] = useState("all");
  const [teamProfiles, setTeamProfiles] = useState<{ id: string; name: string; role: string }[]>([]);
  const [pendingFollowups, setPendingFollowups] = useState<{ id: string; clientName: string; quadra: string; lote: string; dias: number }[]>([]);

  // ── Fetch activities ──

  const fetchActivities = useCallback(async () => {
    if (!supabase || !accountId || !developmentId) { setLoading(false); return; }
    setLoading(true);
    try {
      let query = supabase.from("activities").select("*, clients(name), brokers(name), profiles!activities_profile_id_fkey(name, role)").eq("account_id", accountId).order("activity_date", { ascending: false }).order("start_time", { ascending: false });
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
    supabase.from("user_account_access").select("role, profiles:profile_id(id, name, role)").eq("account_id", accountId).then(({ data }) => {
      if (!data) return;
      const members: { id: string; name: string; role: string }[] = [];
      for (const row of data as Record<string, unknown>[]) {
        const p = row.profiles as Record<string, unknown> | null;
        if (!p) continue;
        const r = (row.role as string) || (p.role as string) || "";
        if (r === "broker") continue;
        members.push({ id: p.id as string, name: p.name as string, role: r });
      }
      setTeamProfiles(members);
    });
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

  const filteredActivities = useMemo(() => {
    let f = activities;
    if (statusFilter === "pending") {
      // Pending = scheduled + expired (atrasadas/expiradas), ordered by date asc
      f = f.filter((a) => a.status === "scheduled" || a.status === "expired");
      f = [...f].sort((a, b) => a.activity_date.localeCompare(b.activity_date));
    } else if (statusFilter === "completed") {
      f = f.filter((a) => (a.status || "completed") === "completed");
      if (periodFilter === "today") f = f.filter((a) => a.activity_date === today);
      else if (periodFilter === "week") f = f.filter((a) => a.activity_date >= weekStart);
      else if (periodFilter === "month") f = f.filter((a) => a.activity_date >= monthStart);
    } else {
      // all — show everything except skipped by default
      f = f.filter((a) => a.status !== "skipped");
      if (periodFilter === "today") f = f.filter((a) => a.activity_date === today);
      else if (periodFilter === "week") f = f.filter((a) => a.activity_date >= weekStart);
      else if (periodFilter === "month") f = f.filter((a) => a.activity_date >= monthStart);
    }
    if (typeFilter !== "all") f = f.filter((a) => a.type === typeFilter);
    return f;
  }, [activities, statusFilter, periodFilter, typeFilter, today, weekStart, monthStart]);

  const groupedByDate = useMemo(() => {
    const groups: Record<string, Activity[]> = {};
    for (const a of filteredActivities) { if (!groups[a.activity_date]) groups[a.activity_date] = []; groups[a.activity_date].push(a); }
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [filteredActivities]);

  const kpis = useMemo(() => {
    const todayCount = activities.filter((a) => a.activity_date === today).length;
    const weekCount = activities.filter((a) => a.activity_date >= weekStart).length;
    const monthActs = activities.filter((a) => a.activity_date >= monthStart);
    const monthCount = monthActs.length;
    const monthMinutes = monthActs.reduce((s, a) => s + a.duration_minutes, 0);
    const hoursInField = (monthMinutes / 60).toFixed(1);
    const avgPerDay = daysSinceMonthStart() > 0 ? (monthCount / daysSinceMonthStart()).toFixed(1) : "0";
    const followUpCount = monthActs.filter((a) => a.type === "follow_up").length;
    const followUpRate = monthCount > 0 ? Math.round((followUpCount / monthCount) * 100) : 0;
    return { todayCount, weekCount, monthCount, hoursInField, avgPerDay, followUpRate };
  }, [activities, today, weekStart, monthStart]);

  // Streak (ENTREGA 3)
  const streak = useMemo(() => profileId ? calculateStreak(activities, profileId) : 0, [activities, profileId]);

  // Ranking with streak
  const ranking = useMemo((): RankedMember[] => {
    if (isConsultant) return [];
    const monthActs = activities.filter((a) => a.activity_date >= monthStart);
    const map: Record<string, { name: string; role: string; count: number; totalMinutes: number; lastDate: string }> = {};
    for (const p of teamProfiles) { if (p.role === "director" && !isDirector) continue; map[p.id] = { name: p.name, role: p.role, count: 0, totalMinutes: 0, lastDate: "" }; }
    for (const a of monthActs) {
      if (!map[a.profile_id]) map[a.profile_id] = { name: a.profiles?.name ?? "Desconhecido", role: a.profiles?.role ?? "", count: 0, totalMinutes: 0, lastDate: "" };
      map[a.profile_id].count++; map[a.profile_id].totalMinutes += a.duration_minutes;
      if (a.activity_date > map[a.profile_id].lastDate) map[a.profile_id].lastDate = a.activity_date;
    }
    for (const a of activities) { if (map[a.profile_id] && a.activity_date > (map[a.profile_id].lastDate || "")) map[a.profile_id].lastDate = a.activity_date; }
    const days = daysSinceMonthStart();
    return Object.entries(map).map(([id, d]) => {
      const inactive = d.role !== "director" && (!d.lastDate || daysDiff(d.lastDate) >= 3);
      return { id, name: d.name, role: d.role, roleLabel: ROLE_LABELS[d.role] || d.role, count: d.count, totalMinutes: d.totalMinutes, avg: days > 0 ? (d.count / days).toFixed(1) : "0", hours: (d.totalMinutes / 60).toFixed(1) + "h", alert: inactive ? (!d.lastDate ? "Sem atividades" : daysDiff(d.lastDate) + " dias inativo") : undefined, streak: calculateStreak(activities, id) };
    }).sort((a, b) => b.count - a.count);
  }, [activities, teamProfiles, isConsultant, isDirector, monthStart]);

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
    const days: Record<string, number> = {};
    for (let i = 29; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); days[d.toISOString().slice(0, 10)] = 0; }
    for (const a of activities) { if (a.activity_date in days) days[a.activity_date]++; }
    return Object.entries(days).map(([date, count]) => ({ date, count }));
  }, [activities, isDirector]);
  const chartMax = useMemo(() => Math.max(1, ...chartData.map((d) => d.count)), [chartData]);

  function openModal(type?: ActivityType, title?: string) { setEditingActivity(null); setModalType(type); setModalTitle(title); setModalOpen(true); if (type) setTimeout(() => document.getElementById("activity-title")?.focus(), 200); }
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
          <h1 style={{ color: T.chalk, fontSize: 22, fontWeight: 600, margin: 0 }}>{isConsultant ? "Minhas Atividades" : isManager ? "Atividades da Equipe" : "Atividades da Operação"}</h1>
          {isConsultant && authenticatedProfile ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
              <span style={{ color: T.bone, fontSize: 13 }}>{authenticatedProfile.fullName}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", background: T.sprout + "15", color: T.sprout, padding: "2px 8px", borderRadius: 4 }}>Consultor</span>
              {streak > 0 && <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 12, background: streak >= 5 ? T.orange + "20" : T.sprout + "20", color: streak >= 5 ? T.orange : T.sprout, fontSize: 12, fontWeight: 600 }}>● {streak} {streak === 1 ? "dia" : "dias"}</span>}
            </div>
          ) : (
            <div style={{ fontSize: 13, color: T.fog, marginTop: 4 }}>Visão gerencial · {development?.developmentName}</div>
          )}
        </div>
        {showRegister && <button type="button" onClick={() => openModal()} style={{ background: T.sprout, color: T.ink, border: "none", borderRadius: 8, padding: "0 16px", height: 36, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>+ Registrar atividade</button>}
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, minmax(0, 1fr))" : "repeat(4, minmax(0, 1fr))", gap: 12, marginBottom: 24 }}>
        {isConsultant ? (<><KpiCard label="Hoje" value={kpis.todayCount} /><KpiCard label="Esta semana" value={kpis.weekCount} /><KpiCard label="Este mês" value={kpis.monthCount} /><KpiCard label="Horas em campo" value={kpis.hoursInField + "h"} /></>) : (<><KpiCard label="Total este mês" value={kpis.monthCount} /><KpiCard label="Média diária" value={kpis.avgPerDay} /><KpiCard label="Horas em campo" value={kpis.hoursInField + "h"} /><KpiCard label="Taxa follow-up" value={kpis.followUpRate + "%"} delta={kpis.followUpRate < 20 ? "baixa" : undefined} warn={kpis.followUpRate < 20} /></>)}
      </div>

      {/* Daily brief (ENTREGA 4) */}
      {showBrief && (
        <div style={{ background: T.carbon, border: `1px solid ${T.stone}`, borderRadius: 10, padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: T.chalk, marginBottom: 12 }}>{greetingText()}! Resumo da sua operação</div>
          {yesterdayActs.length > 0 && (
            <div style={{ fontSize: 13, color: T.fog, marginBottom: 8 }}>
              Ontem você realizou <span style={{ color: T.sprout, fontWeight: 600 }}>{yesterdayActs.length} {yesterdayActs.length === 1 ? "atividade" : "atividades"}</span>
              {yesterdayHours > 0 && <>, totalizando <span style={{ color: T.sprout, fontWeight: 600 }}>{yesterdayHours.toFixed(1)}h</span> em campo</>}.
            </div>
          )}
          {pendingActions.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 12, color: T.orange, fontWeight: 500, marginBottom: 6 }}>● {pendingActions.length} {pendingActions.length === 1 ? "ação pendente" : "ações pendentes"} para hoje:</div>
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

      {/* Quick Actions (ENTREGA 1) */}
      {showRegister && (
        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
          {([{ type: "visit_broker" as ActivityType, label: "Visita", color: T.blue }, { type: "phone_call" as ActivityType, label: "Ligação", color: T.sprout }, { type: "follow_up" as ActivityType, label: "Follow-up", color: T.orange }, { type: "training" as ActivityType, label: "Treinamento", color: T.purple }]).map((qa) => (
            <button key={qa.type} type="button" onClick={() => openModal(qa.type)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, background: qa.color + "15", border: `1px solid ${qa.color}30`, color: qa.color, fontSize: 13, fontWeight: 500, cursor: "pointer" }}>{qa.label}</button>
          ))}
        </div>
      )}

      {/* Follow-up suggestions (ENTREGA 2) */}
      {pendingFollowups.length > 0 && (
        <div style={{ background: T.orange + "10", border: `1px solid ${T.orange}30`, borderRadius: 10, padding: 16, marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: T.orange, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Sugestões de follow-up</div>
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
            {chartData.map((d) => (<div key={d.date} title={`${new Date(d.date + "T12:00:00").toLocaleDateString("pt-BR")}: ${d.count}`} style={{ flex: 1, background: d.count > 4 ? T.sprout : d.count > 0 ? T.blue : T.stone, height: d.count > 0 ? `${(d.count / chartMax) * 100}%` : 2, borderRadius: 2, minHeight: 2, opacity: d.count > 0 ? 1 : 0.3 }} />))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
            <span style={{ fontSize: 9, color: T.slate, fontFamily: "var(--font-mono)" }}>{chartData[0]?.date.slice(5).replace("-", "/")}</span>
            <span style={{ fontSize: 9, color: T.slate, fontFamily: "var(--font-mono)" }}>{chartData[Math.floor(chartData.length / 2)]?.date.slice(5).replace("-", "/")}</span>
            <span style={{ fontSize: 9, color: T.slate, fontFamily: "var(--font-mono)" }}>{chartData[chartData.length - 1]?.date.slice(5).replace("-", "/")}</span>
          </div>
        </div>
      )}

      {/* Status tabs with counts */}
      {(() => {
        const pendingCount = activities.filter((a) => a.status === "scheduled" || a.status === "expired").length;
        const completedCount = activities.filter((a) => (a.status || "completed") === "completed").length;
        return (
          <div style={{ display: "inline-flex", border: `1px solid ${T.stone}`, borderRadius: 8, overflow: "hidden", marginBottom: 16 }}>
            {([["pending", `Pendentes${pendingCount ? ` (${pendingCount})` : ""}`], ["completed", `Concluídas (${completedCount})`], ["all", "Todas"]] as const).map(([k, l]) => (
              <button key={k} type="button" onClick={() => setStatusFilter(k as "pending" | "completed" | "all")} style={{ background: statusFilter === k ? T.sprout : "transparent", color: statusFilter === k ? T.ink : T.fog, border: "none", padding: "7px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{l}</button>
            ))}
          </div>
        );
      })()}

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        {isManager && (
          <div style={{ display: "inline-flex", border: `1px solid ${T.stone}`, borderRadius: 8, overflow: "hidden" }}>
            {(["mine", "team"] as const).map((m) => (<button key={m} type="button" onClick={() => setViewMode(m)} style={{ background: viewMode === m ? T.sprout : "transparent", color: viewMode === m ? T.ink : T.fog, border: "none", padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{m === "mine" ? "Minhas" : "Equipe"}</button>))}
          </div>
        )}
        {(isManager && viewMode === "team" || isDirector) && teamProfiles.length > 0 && (
          <select value={consultantFilter} onChange={(e) => setConsultantFilter(e.target.value)} style={{ background: T.carbon, border: `1px solid ${T.stone}`, borderRadius: 8, padding: "6px 12px", color: T.chalk, fontSize: 12, outline: "none" }}>
            <option value="all">Todos os membros</option>
            {teamProfiles.filter((p) => p.role !== "director" || isDirector).map((p) => (<option key={p.id} value={p.id}>{p.name} ({ROLE_LABELS[p.role] || p.role})</option>))}
          </select>
        )}
        <select value={periodFilter} onChange={(e) => setPeriodFilter(e.target.value)} style={{ background: T.carbon, border: `1px solid ${T.stone}`, borderRadius: 8, padding: "6px 12px", color: T.chalk, fontSize: 12, outline: "none" }}>
          <option value="today">Hoje</option><option value="week">Esta semana</option><option value="month">Este mês</option><option value="all">Tudo</option>
        </select>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={{ background: T.carbon, border: `1px solid ${T.stone}`, borderRadius: 8, padding: "6px 12px", color: T.chalk, fontSize: 12, outline: "none" }}>
          <option value="all">Todos os tipos</option>
          {Object.entries(badgeLabels).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </div>

      {/* Ranking (manager/director) */}
      {(isManager || isDirector) && ranking.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, color: T.fog, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "var(--font-mono)", marginBottom: 10 }}>Produtividade por membro</div>
          {ranking.map((r, idx) => <RankingRow key={r.id} member={r} position={idx + 1} />)}
        </div>
      )}

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
          {groupedByDate.map(([date, acts]) => (
            <div key={date}>
              <div style={{ fontSize: 11, fontWeight: 600, color: T.fog, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8, paddingBottom: 6, borderBottom: `1px solid ${T.stone}` }}>{formatDateLabel(date)}</div>
              {acts.map((a) => <ActivityCard key={a.id} activity={a} showAuthor={showAuthor} isOwner={a.profile_id === profileId} canManage={canManage} onDelete={(id) => { setActivities((prev) => prev.filter((x) => x.id !== id)); setToast("Atividade excluída"); }} onEdit={openEditModal} onComplete={(act) => { setCompletingActivity(act); setCompleteOutcome(""); setCompleteDuration(60); }} onSkip={(act) => { setSkippingActivity(act); setSkipReason(""); }} />)}
            </div>
          ))}
        </div>
      )}

      {modalOpen && profileId && accountId && developmentId && (
        <RegistrationModal accountId={accountId} developmentId={developmentId} profileId={profileId} initialType={modalType} initialTitle={modalTitle} editActivity={editingActivity} canManageDate={canManage} onClose={() => { setModalOpen(false); setModalType(undefined); setModalTitle(undefined); setEditingActivity(null); }} onSaved={handleSaved} />
      )}
      {/* Skip activity modal */}
      {skippingActivity && createPortal(
        <>
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 9000 }} onClick={() => setSkippingActivity(null)} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", background: T.ink, border: `1px solid ${T.stone}`, borderRadius: 14, padding: 24, width: 400, maxWidth: "90vw", zIndex: 9001 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: T.chalk, margin: 0 }}>Pular atividade</h3>
              <button type="button" onClick={() => setSkippingActivity(null)} style={{ background: "none", border: "none", color: T.fog, fontSize: 20, cursor: "pointer" }}>×</button>
            </div>
            <div style={{ fontSize: 13, color: T.fog, marginBottom: 16, padding: "10px 14px", background: T.carbon, borderRadius: 8, border: `1px solid ${T.stone}` }}>
              <div style={{ fontWeight: 500, color: T.chalk }}>{skippingActivity.title}</div>
              <div style={{ fontSize: 11, marginTop: 2 }}>{badgeLabels[skippingActivity.type]} · {new Date(skippingActivity.activity_date + "T12:00:00").toLocaleDateString("pt-BR")}</div>
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
        </>,
        document.body,
      )}

      {/* Complete activity modal */}
      {completingActivity && createPortal(
        <>
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 9000 }} onClick={() => setCompletingActivity(null)} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", background: T.ink, border: `1px solid ${T.stone}`, borderRadius: 14, padding: 24, width: 400, maxWidth: "90vw", zIndex: 9001 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: T.chalk, margin: 0 }}>Concluir atividade</h3>
              <button type="button" onClick={() => setCompletingActivity(null)} style={{ background: "none", border: "none", color: T.fog, fontSize: 20, cursor: "pointer" }}>×</button>
            </div>
            <div style={{ fontSize: 13, color: T.fog, marginBottom: 16, padding: "10px 14px", background: T.carbon, borderRadius: 8, border: `1px solid ${T.stone}` }}>
              <div style={{ fontWeight: 500, color: T.chalk }}>{completingActivity.title}</div>
              <div style={{ fontSize: 11, marginTop: 2 }}>{badgeLabels[completingActivity.type]} · {new Date(completingActivity.activity_date + "T12:00:00").toLocaleDateString("pt-BR")}</div>
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
        </>,
        document.body,
      )}
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  );
}
