import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../app/contexts/AuthContext";
import { useAccount } from "../../../app/contexts/AccountContext";
import { useDevelopment } from "../../../app/contexts/DevelopmentContext";
import { useScreen } from "../../../shared/hooks/useIsMobile";
import { useMyDay, type ScheduledActivity, type TeamMember, type PendingAction } from "../hooks/useMyDay";
import { timeAgo } from "../../../shared/utils/timeAgo";
import Avatar from "../../../shared/components/Avatar";
import TeamMemberPanel from "../../../shared/components/TeamMemberPanel";
import { useNotifications } from "../../../shared/hooks/useNotifications";

// ── Helpers ──

function greeting() { const h = new Date().getHours(); return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite"; }
function weekday() { return new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" }); }
function fmtDate(d: string) { return new Date(d + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" }); }
function todayStr() { return new Date().toISOString().slice(0, 10); }

const ROLE_LABELS: Record<string, string> = { owner: "Dono", director: "Diretor", manager: "Gestor", commercial_consultant: "Consultora", broker: "Corretor", administrative: "Administrativo" };
const STATUS_COLORS = { active: "#4ADE80", warning: "#FBBF24", inactive: "#F87171" };

// ── Sub-components ──

function SectionLabel({ children, count }: { children: React.ReactNode; count?: number }) {
  return (
    <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, color: "var(--text-disabled)", letterSpacing: "0.12em", textTransform: "uppercase", marginTop: 24, marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
      {children}
      {count != null && count > 0 && <span style={{ background: "var(--surface-hover)", borderRadius: 10, padding: "1px 7px", fontSize: 10, fontWeight: 600, color: "var(--text-muted)" }}>{count}</span>}
    </div>
  );
}

function StatCard({ label, value, alert, sub, onClick }: { label: string; value: string | number; alert?: string | null; sub?: string; onClick?: () => void }) {
  return (
    <div onClick={onClick} style={{ background: "var(--surface-raised)", border: "1px solid var(--border-default)", borderRadius: 10, padding: "14px 16px", cursor: onClick ? "pointer" : "default" }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-disabled)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>{value}</div>
      {alert && <div style={{ fontSize: 10, color: "#FBBF24", marginTop: 4 }}>{alert}</div>}
      {sub && <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

const TYPE_BADGE_COLORS: Record<string, string> = { visit_broker: "#60A5FA", visit_client: "#A78BFA", visit_development: "#FBBF24", training: "#60A5FA", phone_call: "#F87171", follow_up: "#4ADE80", meeting_internal: "#FBBF24", meeting_external: "#60A5FA", other: "#9C9686" };
const TYPE_BADGE_LABELS: Record<string, string> = { visit_broker: "VISITA", visit_client: "VISITA CLIENTE", visit_development: "VISITA EMPR.", training: "TREINAMENTO", phone_call: "LIGAÇÃO", follow_up: "FOLLOW-UP", meeting_internal: "REUNIÃO", meeting_external: "REUNIÃO EXT.", other: "OUTRO" };

function AgendaCard({ a, navigate, showDate }: { a: ScheduledActivity; navigate: (p: string) => void; showDate?: boolean }) {
  const today = todayStr();
  const isOverdue = a.activity_date < today;
  const isToday = a.activity_date === today;
  const isExpired = a.status === "expired";
  const borderColor = isOverdue || isExpired ? "#F87171" : isToday ? "#60A5FA" : "var(--border-default)";
  const typeColor = TYPE_BADGE_COLORS[a.type] || "#9C9686";
  const typeLabel = TYPE_BADGE_LABELS[a.type] || a.type.toUpperCase();
  const timeStr = a.start_time ? a.start_time.substring(0, 5) : null;

  // Date label for grouped display
  let dateLabel = "";
  if (showDate) {
    const tmrw = new Date(); tmrw.setDate(tmrw.getDate() + 1);
    const tmrwStr = tmrw.toISOString().slice(0, 10);
    dateLabel = isOverdue ? `atrasada ${Math.abs(Math.floor((Date.now() - new Date(a.activity_date + "T12:00:00").getTime()) / 864e5))}d` : a.activity_date === tmrwStr ? "amanhã" : fmtDate(a.activity_date);
  }

  return (
    <div onClick={() => navigate("/atividades")} style={{ display: "flex", gap: 12, padding: "12px 14px", background: isOverdue || isExpired ? "rgba(248,113,113,0.04)" : isToday ? "rgba(96,165,250,0.04)" : "var(--surface-raised)", borderLeft: `3px solid ${borderColor}`, border: `1px solid var(--border-default)`, borderLeftWidth: 3, borderLeftColor: borderColor, borderRadius: "0 10px 10px 0", cursor: "pointer" }}>
      {/* Time */}
      <div style={{ minWidth: 44, flexShrink: 0, textAlign: "right" }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: isOverdue ? "#F87171" : isToday ? "#60A5FA" : "var(--text-secondary)", fontFamily: "var(--font-mono)", lineHeight: 1.2 }}>{timeStr || "—"}</div>
        {showDate && dateLabel && <div style={{ fontSize: 10, color: isOverdue ? "#F87171" : "var(--text-disabled)", marginTop: 2 }}>{dateLabel}</div>}
        {!showDate && !timeStr && <div style={{ fontSize: 10, color: "var(--text-disabled)" }}>o dia todo</div>}
      </div>
      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
          <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 4, background: typeColor + "15", color: typeColor, letterSpacing: "0.04em", whiteSpace: "nowrap" }}>{typeLabel}</span>
          {(isOverdue || isExpired) && <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 4, background: "rgba(248,113,113,0.15)", color: "#F87171" }}>{isExpired ? "EXPIRADA" : "ATRASADA"}</span>}
        </div>
        <div style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.title}</div>
        {a.contact_name && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>{a.contact_name}</div>}
      </div>
    </div>
  );
}

function TeamRow({ m }: { m: TeamMember }) {
  const color = STATUS_COLORS[m.status];
  const statText = m.activitiesToday > 0 ? `${m.activitiesToday} atividade${m.activitiesToday > 1 ? "s" : ""} hoje` : m.lastActivityDaysAgo === 0 ? "ativo hoje" : m.lastActivityDaysAgo < 999 ? `sem atividade há ${m.lastActivityDaysAgo}d` : "sem atividades";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "var(--surface-raised)", border: "1px solid var(--border-default)", borderRadius: 10, marginBottom: 6 }}>
      <Avatar name={m.name} avatarUrl={m.avatarUrl} size={36} color={color} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)" }}>{m.name}</div>
        <div style={{ fontSize: 11, color: "var(--text-disabled)" }}>{ROLE_LABELS[m.role] || m.role}{m.activeNegotiations > 0 ? ` · ${m.activeNegotiations} neg.` : ""}</div>
      </div>
      <div style={{ fontSize: 11, color, fontFamily: "var(--font-mono)", textAlign: "right", flexShrink: 0 }}>{statText}</div>
    </div>
  );
}

function PendingCard({ a, navigate }: { a: PendingAction; navigate: (p: string) => void }) {
  const colors: Record<string, string> = { reservation_request: "#A78BFA", expiring_reservation: "#F87171", proposal: "#FBBF24" };
  const c = colors[a.type] || "#9C9686";
  return (
    <div onClick={() => navigate(`/negociacoes/${a.entityId}`)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderLeft: `3px solid ${c}`, background: "var(--surface-raised)", border: "1px solid var(--border-default)", borderRadius: "0 10px 10px 0", cursor: "pointer", marginBottom: 6 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)" }}>{a.label}</div>
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{a.detail}</div>
      </div>
      <span style={{ fontSize: 11, color: c, fontWeight: 600 }}>→</span>
    </div>
  );
}

function FunnelBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>{value}</span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: "var(--surface-hover)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 3, transition: "width 300ms" }} />
      </div>
    </div>
  );
}

function AgendaSection({ agenda, navigate, compact }: { agenda: { overdue: ScheduledActivity[]; today: ScheduledActivity[]; upcoming: ScheduledActivity[] }; navigate: (p: string) => void; compact?: boolean }) {
  const hasContent = agenda.overdue.length > 0 || agenda.today.length > 0 || agenda.upcoming.length > 0;
  if (!hasContent) return (
    <div style={{ padding: "20px 16px", background: "var(--surface-raised)", border: "1px solid var(--border-default)", borderRadius: 10, textAlign: "center" }}>
      <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Nenhuma atividade agendada.</div>
      <button type="button" onClick={() => navigate("/atividades")} style={{ marginTop: 10, background: "var(--interactive-primary)", color: "var(--interactive-on-primary)", border: "none", borderRadius: 8, padding: "8px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Agendar atividade</button>
    </div>
  );

  // Group upcoming by date
  const upcomingByDate: Record<string, ScheduledActivity[]> = {};
  for (const a of agenda.upcoming) {
    if (!upcomingByDate[a.activity_date]) upcomingByDate[a.activity_date] = [];
    upcomingByDate[a.activity_date].push(a);
  }
  const tmrw = new Date(); tmrw.setDate(tmrw.getDate() + 1);
  const tmrwStr = tmrw.toISOString().slice(0, 10);
  function dayGroupLabel(dateStr: string): string {
    if (dateStr === tmrwStr) return "AMANHÃ";
    return new Date(dateStr + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" }).toUpperCase();
  }

  return (
    <div style={{ display: "grid", gap: 6 }}>
      {/* Overdue */}
      {agenda.overdue.length > 0 && (
        <>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#F87171", fontFamily: "var(--font-mono)", letterSpacing: "0.1em", marginBottom: -2 }}>ATRASADAS</div>
          {agenda.overdue.map((a) => <AgendaCard key={a.id} a={a} navigate={navigate} showDate />)}
        </>
      )}
      {/* Today */}
      {agenda.today.length > 0 && (
        <>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#60A5FA", fontFamily: "var(--font-mono)", letterSpacing: "0.1em", marginTop: agenda.overdue.length > 0 ? 8 : 0, marginBottom: -2 }}>HOJE</div>
          {agenda.today.map((a) => <AgendaCard key={a.id} a={a} navigate={navigate} />)}
        </>
      )}
      {/* Upcoming grouped by day */}
      {!compact && Object.entries(upcomingByDate).slice(0, 5).map(([date, acts]) => (
        <div key={date}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-disabled)", fontFamily: "var(--font-mono)", letterSpacing: "0.1em", marginTop: 8, marginBottom: 2 }}>{dayGroupLabel(date)}</div>
          {acts.map((a) => <AgendaCard key={a.id} a={a} navigate={navigate} />)}
        </div>
      ))}
      {!compact && agenda.upcoming.length > 10 && <div style={{ textAlign: "center", padding: 6 }}><span onClick={() => navigate("/atividades")} style={{ fontSize: 12, color: "var(--interactive-primary)", cursor: "pointer" }}>Ver agenda completa →</span></div>}
    </div>
  );
}

// ══════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════

export default function MeuDiaPage() {
  const navigate = useNavigate();
  const { authenticatedProfile } = useAuth();
  const { account } = useAccount();
  const { development } = useDevelopment();
  const screen = useScreen();
  const isMobile = screen.isMobile;

  const accountId = account?.accountId ?? null;
  const developmentId = development?.developmentId ?? null;
  const userId = authenticatedProfile?.id ?? null;
  const role = account?.role ?? authenticatedProfile?.role ?? null;
  const firstName = (authenticatedProfile?.fullName || "").split(" ")[0] || "você";

  const isOwnerRole = (role as string) === "owner" || ((): boolean => { try { return role === "director" && typeof localStorage !== "undefined" && localStorage.getItem("nexa-owner-hint") === "1"; } catch { return false; } })();
  const baseView = (() => {
    if (role === "director") return "director";
    if (role === "manager") return "manager";
    if (role === "commercial_consultant") return "consultant";
    if (role === "broker") return "broker";
    return "manager";
  })();
  // Owner toggle: stored preference, default to "manager" (minha operação)
  const [ownerView, setOwnerView] = useState<"manager" | "director">(() => {
    if (!isOwnerRole) return "director";
    try { return (localStorage.getItem("nexa-meudia-view") as "manager" | "director") || "manager"; } catch { return "manager"; }
  });
  const effectiveView = isOwnerRole ? ownerView : baseView;

  const { data, loading } = useMyDay(userId, accountId, developmentId, role as string);
  const { notifications, markAsRead, sendUpdateRequest } = useNotifications(userId, accountId);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [sentUpdates, setSentUpdates] = useState<Set<string>>(new Set());

  async function handleRequestUpdate(memberId: string, memberName: string) {
    const ok = await sendUpdateRequest(memberId, memberName, firstName);
    if (ok) setSentUpdates((prev) => new Set(prev).add(memberId));
  }

  if (loading) return <div style={{ padding: isMobile ? 16 : 32 }}><div style={{ fontSize: 13, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>Carregando seu dia...</div></div>;

  const colGrid = isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)";

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: isMobile ? "16px 12px" : "24px 0" }}>
      {/* Greeting */}
      <div style={{ marginBottom: isOwnerRole ? 12 : 24 }}>
        <h1 style={{ fontSize: isMobile ? 22 : 26, fontWeight: 700, color: "var(--text-primary)", margin: 0, fontFamily: "var(--font-display)", fontStyle: "italic" }}>{greeting()}, {firstName}</h1>
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4, textTransform: "capitalize" }}>{weekday()}{development?.developmentName ? ` · ${development.developmentName}` : ""}</div>
      </div>

      {/* Notifications / AVISOS */}
      {notifications.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          {notifications.map((n) => (
            <div key={n.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.25)", borderRadius: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>⚠</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)" }}>{n.title}</div>
                {n.message && <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{n.message}</div>}
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                {n.action_url && <button type="button" onClick={() => navigate(n.action_url!)} style={{ padding: "6px 12px", borderRadius: 6, border: "none", background: "var(--interactive-primary)", color: "var(--interactive-on-primary)", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Registrar</button>}
                <button type="button" onClick={() => markAsRead(n.id)} style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid var(--border-default)", background: "transparent", color: "var(--text-muted)", fontSize: 11, cursor: "pointer" }}>Lida</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Owner toggle */}
      {isOwnerRole && (
        <div style={{ display: "inline-flex", border: "1px solid var(--border-default)", borderRadius: 8, overflow: "hidden", marginBottom: 20 }}>
          {([["manager", "Minha operação"], ["director", "Visão gerencial"]] as const).map(([k, l]) => (
            <button key={k} type="button" onClick={() => { setOwnerView(k); try { localStorage.setItem("nexa-meudia-view", k); } catch {} }} style={{ background: ownerView === k ? "var(--surface-overlay)" : "transparent", color: ownerView === k ? "var(--text-secondary)" : "var(--text-muted)", border: "none", padding: "7px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{l}</button>
          ))}
        </div>
      )}

      {/* ═══ DIRECTOR VIEW ═══ */}
      {effectiveView === "director" && (
        <>
          <SectionLabel>Saúde da operação</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: colGrid, gap: 8, marginBottom: 4 }}>
            <StatCard label="Negociações" value={data.stats.activeNegotiations} onClick={() => navigate("/negociacoes")} />
            <StatCard label="Reservas" value={data.stats.activeReservations} alert={data.stats.expiringReservationsCount > 0 ? `${data.stats.expiringReservationsCount} vencem em 48h` : null} onClick={() => navigate("/pipeline")} />
            <StatCard label="Vendas mês" value={data.stats.salesThisMonth} onClick={() => navigate("/pipeline")} />
            <StatCard label="Unid. disponíveis" value={`${data.stats.availableUnits}/${data.stats.totalUnits}`} onClick={() => navigate("/unidades")} />
          </div>

          <SectionLabel count={data.pendingActions.length || undefined}>Precisa da sua ação</SectionLabel>
          {data.pendingActions.length > 0
            ? data.pendingActions.map((a) => <PendingCard key={a.id} a={a} navigate={navigate} />)
            : <div style={{ padding: "14px 16px", background: "var(--surface-raised)", border: "1px solid var(--border-default)", borderRadius: 10, fontSize: 13, color: "var(--text-muted)" }}>Nenhuma ação pendente — operação fluindo.</div>
          }

          <SectionLabel count={data.team.members.length}>Equipe</SectionLabel>
          {data.team.members.length > 0 ? data.team.members.map((m) => <div key={m.id} onClick={() => setSelectedMember(m)} style={{ cursor: "pointer" }}><TeamRow m={m} /></div>) : <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Nenhum membro encontrado.</div>}

          <SectionLabel>Funil</SectionLabel>
          <div style={{ background: "var(--surface-raised)", border: "1px solid var(--border-default)", borderRadius: 10, padding: 16 }}>
            {(() => { const max = Math.max(data.funnel.negotiation, data.funnel.proposal, data.funnel.reservation, data.funnel.sale, 1); return (<>
              <FunnelBar label="Negociação" value={data.funnel.negotiation} max={max} color="#4ADE80" />
              <FunnelBar label="Proposta" value={data.funnel.proposal} max={max} color="#60A5FA" />
              <FunnelBar label="Reserva" value={data.funnel.reservation} max={max} color="#A78BFA" />
              <FunnelBar label="Venda" value={data.funnel.sale} max={max} color="#FBBF24" />
            </>); })()}
          </div>
        </>
      )}

      {/* ═══ MANAGER VIEW ═══ */}
      {effectiveView === "manager" && (
        <>
          <SectionLabel count={data.agenda.overdue.length + data.agenda.today.length}>Minha agenda</SectionLabel>
          <AgendaSection agenda={data.agenda} navigate={navigate} />

          {data.newLeads.length > 0 && (<>
            <SectionLabel count={data.newLeads.length}>Novos leads</SectionLabel>
            <div style={{ display: "grid", gap: 6 }}>
              {data.newLeads.slice(0, 5).map((l) => {
                const originEmoji = l.origin === "facebook" ? "📱" : l.origin === "instagram" ? "📸" : l.origin === "google" ? "🔍" : "📋";
                return (
                  <div key={l.id} onClick={() => navigate(`/clientes/${l.id}`)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "var(--surface-raised)", border: "1px solid rgba(96,165,250,0.2)", borderLeft: "3px solid #60A5FA", borderRadius: "0 10px 10px 0", cursor: "pointer" }}>
                    <span style={{ fontSize: 16 }}>{originEmoji}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)" }}>{l.name}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{l.origin_detail || l.origin} · {timeAgo(l.created_at)}</div>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: "rgba(96,165,250,0.15)", color: "#60A5FA" }}>LEAD</span>
                  </div>
                );
              })}
              {data.newLeads.length > 5 && <div style={{ textAlign: "center", padding: 6 }}><span onClick={() => navigate("/clientes")} style={{ fontSize: 12, color: "var(--interactive-primary)", cursor: "pointer" }}>Ver todos os leads →</span></div>}
            </div>
          </>)}

          <SectionLabel count={data.team.members.length}>Equipe</SectionLabel>
          {data.team.members.length > 0 ? data.team.members.map((m) => <div key={m.id} onClick={() => setSelectedMember(m)} style={{ cursor: "pointer" }}><TeamRow m={m} /></div>) : <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Nenhum membro encontrado.</div>}

          <SectionLabel>Operação</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: colGrid, gap: 8 }}>
            <StatCard label="Negociações" value={data.stats.activeNegotiations} onClick={() => navigate("/negociacoes")} />
            <StatCard label="Reservas" value={data.stats.activeReservations} onClick={() => navigate("/pipeline")} />
            <StatCard label="Vendas mês" value={data.stats.salesThisMonth} onClick={() => navigate("/pipeline")} />
            <StatCard label="Unid. disponíveis" value={`${data.stats.availableUnits}/${data.stats.totalUnits}`} onClick={() => navigate("/unidades")} />
          </div>
        </>
      )}

      {/* ═══ CONSULTANT VIEW ═══ */}
      {effectiveView === "consultant" && (
        <>
          <SectionLabel count={data.agenda.overdue.length + data.agenda.today.length}>Minha agenda</SectionLabel>
          <AgendaSection agenda={data.agenda} navigate={navigate} />

          <SectionLabel count={data.team.members.filter((m) => m.role === "broker").length}>Meus corretores</SectionLabel>
          {(() => { const brokers = data.team.members.filter((m) => m.role === "broker"); return brokers.length > 0 ? brokers.map((m) => <TeamRow key={m.id} m={m} />) : <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Nenhum corretor vinculado.</div>; })()}

          <SectionLabel>Minhas negociações</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            <StatCard label="Ativas" value={data.myNegotiations.active} />
            <StatCard label="Propostas" value={data.myNegotiations.pendingProposals} />
            <StatCard label="Reservas" value={data.myNegotiations.reservations} />
          </div>
        </>
      )}

      {/* ═══ BROKER VIEW ═══ */}
      {effectiveView === "broker" && (
        <>
          <SectionLabel count={data.agenda.overdue.length + data.agenda.today.length}>Minha agenda</SectionLabel>
          <AgendaSection agenda={data.agenda} navigate={navigate} compact />

          <SectionLabel>Meu pipeline</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            <StatCard label="Negociações" value={data.myNegotiations.active} />
            <StatCard label="Propostas" value={data.myNegotiations.pendingProposals} />
            <StatCard label="Simulações" value={data.myNegotiations.simulations} />
          </div>

          <SectionLabel>Ações rápidas</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 8 }}>
            {[
              { label: "Nova simulação", path: "/simulador", icon: "📊" },
              { label: "Registrar atividade", path: "/atividades", icon: "📝" },
              { label: "Ver mapa", path: "/unidades", icon: "🗺" },
            ].map((btn) => (
              <button key={btn.path} type="button" onClick={() => navigate(btn.path)} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "14px 20px", borderRadius: 10, border: "1px solid var(--border-default)", background: "var(--surface-raised)", color: "var(--text-secondary)", fontSize: 14, fontWeight: 500, cursor: "pointer", minHeight: 48 }}>
                <span>{btn.icon}</span> {btn.label}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Team member panel */}
      <TeamMemberPanel
        member={selectedMember ? { id: selectedMember.id, name: selectedMember.name, role: selectedMember.role, avatarUrl: selectedMember.avatarUrl, activitiesToday: selectedMember.activitiesToday, lastActivityDaysAgo: selectedMember.lastActivityDaysAgo, activeNegotiations: selectedMember.activeNegotiations } : null}
        open={!!selectedMember}
        onClose={() => setSelectedMember(null)}
        onRequestUpdate={handleRequestUpdate}
        updateSent={selectedMember ? sentUpdates.has(selectedMember.id) : false}
      />
    </div>
  );
}
