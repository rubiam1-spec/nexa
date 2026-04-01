import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../app/contexts/AuthContext";
import { useAccount } from "../../../app/contexts/AccountContext";
import { useDevelopment } from "../../../app/contexts/DevelopmentContext";
import { useScreen } from "../../../shared/hooks/useIsMobile";
import { useMyDay, type OperationalAlert, type BrokerSummary } from "../hooks/useMyDay";

// ── Helpers ──

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function weekday(): string {
  return new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
}

function formatDaysIdle(hours: number): string {
  const days = Math.floor(hours / 24);
  if (days < 1) return `${Math.round(hours)}h`;
  return `${days} dia${days > 1 ? "s" : ""}`;
}

// ── Severity colors ──

const SEV = {
  red: { bg: "rgba(248,113,113,0.10)", border: "rgba(248,113,113,0.25)", text: "#F87171", icon: "var(--text-primary)" },
  abandoned: { bg: "rgba(248,113,113,0.10)", border: "rgba(248,113,113,0.25)", text: "#F87171", icon: "var(--text-primary)" },
  yellow: { bg: "rgba(251,191,36,0.10)", border: "rgba(251,191,36,0.25)", text: "#FBBF24", icon: "var(--text-primary)" },
  warning: { bg: "rgba(251,191,36,0.08)", border: "rgba(251,191,36,0.15)", text: "#FBBF24", icon: "var(--text-secondary)" },
  upcoming: { bg: "rgba(74,222,128,0.08)", border: "rgba(74,222,128,0.15)", text: "var(--interactive-primary)", icon: "var(--text-secondary)" },
};

// ── Alert card ──

function AlertCard({ alert, onClick }: { alert: OperationalAlert; onClick?: () => void }) {
  const sev = SEV[alert.severity] ?? SEV.warning;
  const label = alert.entity_type === "proposal" ? "Proposta" : "Negociação";
  const idle = formatDaysIdle(alert.hours_idle);

  return (
    <div
      onClick={onClick}
      style={{
        background: sev.bg,
        border: `1px solid ${sev.border}`,
        borderRadius: 10,
        padding: "14px 16px",
        cursor: onClick ? "pointer" : "default",
        transition: "transform 120ms ease",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <span style={{ color: sev.text, fontSize: 16, lineHeight: 1, marginTop: 1, flexShrink: 0 }}>
          {alert.severity === "red" || alert.severity === "abandoned" ? "\u25CF" : alert.severity === "yellow" ? "\u25B2" : "\u25CB"}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: sev.icon, lineHeight: 1.4 }}>
            {alert.alert_message}
            {alert.hours_idle > 0 && alert.alert_type !== "followup_upcoming"
              ? ` — ${idle}`
              : ""}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4, display: "flex", gap: 8, flexWrap: "wrap" }}>
            {alert.client_name && <span>{alert.client_name}</span>}
            {alert.unit_label && <span style={{ color: "var(--text-disabled)" }}>{alert.unit_label}</span>}
            {alert.broker_name && <span style={{ color: "var(--text-disabled)" }}>{label} · {alert.broker_name}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Section header ──

function SectionLabel({ children, count }: { children: string; count?: number }) {
  return (
    <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-disabled)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10, marginTop: 24, display: "flex", alignItems: "center", gap: 8 }}>
      {children}
      {count !== undefined && count > 0 && (
        <span style={{ background: "var(--border-default)", borderRadius: 10, padding: "2px 8px", fontSize: 10, color: "var(--text-muted)" }}>{count}</span>
      )}
    </div>
  );
}

// ── Progress bar ──

function HealthBar({ pct }: { pct: number }) {
  const color = pct >= 80 ? "var(--interactive-primary)" : pct >= 50 ? "#FBBF24" : "#F87171";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ flex: 1, height: 8, background: "var(--border-subtle)", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ width: `${Math.min(pct, 100)}%`, height: "100%", background: color, borderRadius: 4, transition: "width 600ms ease" }} />
      </div>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700, color }}>{pct}%</span>
    </div>
  );
}

// ── Broker card (consultant/director) ──

function BrokerCard({ broker }: { broker: BrokerSummary }) {
  const redAlerts = broker.alerts.filter(a => a.severity === "red" || a.severity === "abandoned").length;
  const yellowAlerts = broker.alerts.filter(a => a.severity === "yellow").length;
  const inactive = broker.daysSinceActivity >= 3;

  return (
    <div style={{
      background: "var(--surface-raised)",
      border: `1px solid ${inactive ? "rgba(248,113,113,0.25)" : "var(--border-default)"}`,
      borderRadius: 10,
      padding: "16px 18px",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{broker.name}</span>
        {inactive && (
          <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "#F87171", background: "rgba(248,113,113,0.10)", padding: "2px 8px", borderRadius: 4, letterSpacing: "0.05em" }}>
            SEM ATIVIDADE {broker.daysSinceActivity}D
          </span>
        )}
      </div>
      <div style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", gap: 12 }}>
        <span>{broker.activeNegotiations} neg. ativa{broker.activeNegotiations !== 1 ? "s" : ""}</span>
        {redAlerts > 0 && <span style={{ color: "#F87171" }}>{redAlerts} alerta{redAlerts !== 1 ? "s" : ""} vermelho{redAlerts !== 1 ? "s" : ""}</span>}
        {yellowAlerts > 0 && <span style={{ color: "#FBBF24" }}>{yellowAlerts} alerta{yellowAlerts !== 1 ? "s" : ""}</span>}
      </div>
    </div>
  );
}

// ── Stat card ──

function Stat({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{ background: "var(--surface-raised)", border: "1px solid var(--border-default)", borderRadius: 10, padding: "16px 18px" }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-disabled)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: color ?? "var(--text-primary)", fontFamily: "var(--font-mono)" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ── Empty state ──

function EmptyState({ role }: { role: string | null }) {
  const isBroker = role === "broker";
  return (
    <div style={{ textAlign: "center", padding: "60px 20px" }}>
      <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--interactive-primary)" }}>
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
      </div>
      <div style={{ fontSize: 18, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8 }}>
        Tudo em dia!
      </div>
      <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6, maxWidth: 360, margin: "0 auto" }}>
        {isBroker
          ? "Nenhuma ação pendente no momento. Continue registrando atividades para manter o ritmo."
          : "Nenhum alerta operacional no momento. A operação está saudável."
        }
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
// MEU DIA — Main Page
// ══════════════════════════════════════════════

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
  const role = account?.role ?? null;
  const firstName = (authenticatedProfile?.fullName ?? "").split(" ")[0] || "Usuário";
  const devName = development?.developmentName ?? "";

  const { data, loading } = useMyDay(accountId, developmentId, userId, role);

  const isBroker = role === "broker";
  const isConsultant = role === "commercial_consultant";
  const isDirector = role === "director" || (role as string) === "owner";
  const isManager = role === "manager";

  function goToNeg(id: string) { navigate(`/negociacoes/${id}`); }

  if (loading) {
    return (
      <div style={{ padding: isMobile ? 16 : 32 }}>
        <div style={{ fontSize: 13, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>Carregando seu dia...</div>
      </div>
    );
  }

  const hasActivities = data.activitiesForToday.length > 0 || data.activitiesOverdue.length > 0 || data.activitiesUpcoming.length > 0;
  const hasAlerts = data.urgent.length > 0 || data.today.length > 0 || data.overdue.length > 0 || hasActivities;
  const totalAlerts = data.alertsByType.red + data.alertsByType.yellow + data.alertsByType.warning;

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: isMobile ? "16px 12px" : "24px 0" }}>

      {/* ── Greeting ── */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: isMobile ? 22 : 26, fontWeight: 700, color: "var(--text-primary)", margin: 0, fontFamily: "var(--font-display)", fontStyle: "italic" }}>
          {greeting()}, {firstName}
        </h1>
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
          {weekday()}{devName ? ` · ${devName}` : ""}
        </div>
      </div>

      {/* ═══════════════════════════════════════ */}
      {/* BROKER VIEW */}
      {/* ═══════════════════════════════════════ */}
      {isBroker && (
        <>
          {!hasAlerts && <EmptyState role={role} />}

          {data.urgent.length > 0 && (
            <>
              <div style={{
                background: "rgba(248,113,113,0.06)",
                border: "1px solid rgba(248,113,113,0.20)",
                borderRadius: 12,
                padding: isMobile ? 14 : 18,
                marginBottom: 8,
              }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: "#F87171", letterSpacing: "0.1em", marginBottom: 12 }}>
                  PARA AGORA
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  {data.urgent.map(a => (
                    <AlertCard key={a.entity_id} alert={a} onClick={() => goToNeg(a.entity_id)} />
                  ))}
                </div>
              </div>
            </>
          )}

          {data.today.length > 0 && (
            <>
              <SectionLabel count={data.today.length}>Para hoje</SectionLabel>
              <div style={{ display: "grid", gap: 8 }}>
                {data.today.map(a => (
                  <AlertCard key={a.entity_id} alert={a} onClick={() => goToNeg(a.entity_id)} />
                ))}
              </div>
            </>
          )}

          {data.overdue.length > 0 && (
            <>
              <SectionLabel count={data.overdue.length}>Atrasados</SectionLabel>
              <div style={{ display: "grid", gap: 8 }}>
                {data.overdue.map(a => (
                  <AlertCard key={a.entity_id} alert={a} onClick={() => goToNeg(a.entity_id)} />
                ))}
              </div>
            </>
          )}

          {/* Atividades atrasadas */}
          {data.activitiesOverdue.length > 0 && (
            <>
              <SectionLabel count={data.activitiesOverdue.length}>Atividades atrasadas</SectionLabel>
              <div style={{ display: "grid", gap: 8 }}>
                {data.activitiesOverdue.map(a => (
                  <div key={a.id} onClick={() => navigate("/atividades")} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: 10, cursor: "pointer" }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6, border: "1px solid #F87171", color: "#F87171" }}>ATRASADA</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 500 }}>{a.title}</div>
                      {a.contact_name && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{a.contact_name}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Atividades para hoje */}
          {data.activitiesForToday.length > 0 && (
            <>
              <SectionLabel count={data.activitiesForToday.length}>Atividades de hoje</SectionLabel>
              <div style={{ display: "grid", gap: 8 }}>
                {data.activitiesForToday.map(a => (
                  <div key={a.id} onClick={() => navigate("/atividades")} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "rgba(96,165,250,0.06)", border: "1px solid rgba(96,165,250,0.2)", borderRadius: 10, cursor: "pointer" }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6, border: "1px solid #60A5FA", color: "#60A5FA" }}>HOJE</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 500 }}>{a.title}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{a.start_time ? `às ${a.start_time.substring(0, 5)}` : ""}{a.contact_name ? ` · ${a.contact_name}` : ""}</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Próximos dias */}
          {data.activitiesUpcoming.length > 0 && (
            <>
              <SectionLabel count={data.activitiesUpcoming.length}>Próximos dias</SectionLabel>
              <div style={{ display: "grid", gap: 6 }}>
                {data.activitiesUpcoming.slice(0, 8).map(a => {
                  const d = new Date(a.activity_date + "T12:00:00");
                  const dayLabel = d.toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" });
                  return (
                    <div key={a.id} onClick={() => navigate("/atividades")} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "var(--surface-raised)", border: "1px solid var(--border-default)", borderRadius: 8, cursor: "pointer" }}>
                      <span style={{ fontSize: 10, color: "#60A5FA", fontFamily: "var(--font-mono)", fontWeight: 600, minWidth: 70 }}>{dayLabel}</span>
                      <div style={{ flex: 1, fontSize: 13, color: "var(--text-secondary)" }}>{a.title}</div>
                      {a.start_time && <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>{a.start_time.substring(0, 5)}</span>}
                    </div>
                  );
                })}
                {data.activitiesUpcoming.length > 8 && (
                  <div style={{ textAlign: "center", padding: 8 }}>
                    <span onClick={() => navigate("/atividades")} style={{ fontSize: 12, color: "var(--interactive-primary)", cursor: "pointer" }}>Ver agenda completa →</span>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Seu Ritmo */}
          <SectionLabel>Seu ritmo</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr", gap: 10 }}>
            <Stat label="Conversões mês" value={data.conversionsMonth} />
            <Stat label="Neg. ativas" value={data.totalActiveNegotiations} />
            <Stat label="Alertas" value={totalAlerts} color={totalAlerts > 0 ? "#FBBF24" : "var(--interactive-primary)"} />
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 10, marginTop: 28 }}>
            <button type="button" onClick={() => navigate("/atividades")} style={{ flex: 1, padding: "12px", borderRadius: 10, border: "1px solid var(--border-default)", background: "var(--surface-raised)", color: "var(--text-secondary)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              Registrar atividade
            </button>
            <button type="button" onClick={() => navigate("/pipeline")} style={{ flex: 1, padding: "12px", borderRadius: 10, border: "none", background: "var(--interactive-primary)", color: "var(--interactive-on-primary)", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              Ir para Pipeline
            </button>
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════ */}
      {/* CONSULTANT VIEW */}
      {/* ═══════════════════════════════════════ */}
      {isConsultant && (
        <>
          {/* Follow-ups summary */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 8 }}>
            <Stat label="Follow-ups hoje" value={data.myFollowUps.today} color="var(--interactive-primary)" />
            <Stat label="Atrasados" value={data.myFollowUps.overdue} color={data.myFollowUps.overdue > 0 ? "#F87171" : "var(--text-muted)"} />
          </div>

          {/* Urgent alerts */}
          {data.urgent.length > 0 && (
            <>
              <SectionLabel count={data.urgent.length}>Alertas urgentes</SectionLabel>
              <div style={{ display: "grid", gap: 8 }}>
                {data.urgent.slice(0, 5).map(a => (
                  <AlertCard key={a.entity_id} alert={a} onClick={() => goToNeg(a.entity_id)} />
                ))}
              </div>
            </>
          )}

          {/* Broker cards */}
          {data.brokerSummaries.length > 0 && (
            <>
              <SectionLabel count={data.brokerSummaries.length}>Corretores que acompanho</SectionLabel>
              <div style={{ display: "grid", gap: 8 }}>
                {data.brokerSummaries.map(b => <BrokerCard key={b.id} broker={b} />)}
              </div>
            </>
          )}

          {/* Operation summary */}
          <SectionLabel>Operação</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr", gap: 10 }}>
            <Stat label="Neg. ativas" value={data.totalActiveNegotiations} />
            <Stat label="Alertas" value={totalAlerts} color={totalAlerts > 0 ? "#FBBF24" : "var(--interactive-primary)"} />
            <Stat label="Conversões mês" value={data.conversionsMonth} />
          </div>

          {!hasAlerts && data.brokerSummaries.length === 0 && <EmptyState role={role} />}
        </>
      )}

      {/* ═══════════════════════════════════════ */}
      {/* DIRECTOR / MANAGER VIEW */}
      {/* ═══════════════════════════════════════ */}
      {(isDirector || isManager) && (
        <>
          {/* Health */}
          <div style={{ background: "var(--surface-raised)", border: "1px solid var(--border-default)", borderRadius: 12, padding: "20px 22px", marginBottom: 20 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-disabled)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12 }}>
              Saúde da operação
            </div>
            <HealthBar pct={data.healthPct} />
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
              {data.totalActiveNegotiations} negociação{data.totalActiveNegotiations !== 1 ? "ões" : ""} ativa{data.totalActiveNegotiations !== 1 ? "s" : ""}
            </div>
          </div>

          {/* Alert summary */}
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr 1fr", gap: 10, marginBottom: 8 }}>
            <Stat label="Alertas vermelhos" value={data.alertsByType.red} color={data.alertsByType.red > 0 ? "#F87171" : "var(--text-muted)"} />
            <Stat label="Alertas amarelos" value={data.alertsByType.yellow} color={data.alertsByType.yellow > 0 ? "#FBBF24" : "var(--text-muted)"} />
            <Stat label="Corretores inativos" value={data.inactiveBrokers.length} color={data.inactiveBrokers.length > 0 ? "#F87171" : "var(--text-muted)"} sub={data.inactiveBrokers.length > 0 ? `+3 dias sem atividade` : "Todos ativos"} />
            <Stat label="Vendas mês" value={data.conversionsMonth} color="var(--interactive-primary)" />
          </div>

          {/* Urgent alerts */}
          {data.urgent.length > 0 && (
            <>
              <SectionLabel count={data.urgent.length}>Alertas urgentes</SectionLabel>
              <div style={{ display: "grid", gap: 8 }}>
                {data.urgent.slice(0, 8).map(a => (
                  <AlertCard key={a.entity_id} alert={a} onClick={() => goToNeg(a.entity_id)} />
                ))}
              </div>
            </>
          )}

          {/* Inactive brokers */}
          {data.inactiveBrokers.length > 0 && (
            <>
              <SectionLabel count={data.inactiveBrokers.length}>Corretores inativos</SectionLabel>
              <div style={{ display: "grid", gap: 8 }}>
                {data.inactiveBrokers.map(b => <BrokerCard key={b.id} broker={b} />)}
              </div>
            </>
          )}

          {/* Overdue */}
          {data.overdue.length > 0 && (
            <>
              <SectionLabel count={data.overdue.length}>Atenção necessária</SectionLabel>
              <div style={{ display: "grid", gap: 8 }}>
                {data.overdue.slice(0, 8).map(a => (
                  <AlertCard key={a.entity_id} alert={a} onClick={() => goToNeg(a.entity_id)} />
                ))}
              </div>
            </>
          )}

          {!hasAlerts && data.inactiveBrokers.length === 0 && <EmptyState role={role} />}

          {/* Actions */}
          <div style={{ display: "flex", gap: 10, marginTop: 28 }}>
            <button type="button" onClick={() => navigate("/")} style={{ flex: 1, padding: "12px", borderRadius: 10, border: "1px solid var(--border-default)", background: "var(--surface-raised)", color: "var(--text-secondary)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              Ver Dashboard
            </button>
            <button type="button" onClick={() => navigate("/pipeline")} style={{ flex: 1, padding: "12px", borderRadius: 10, border: "none", background: "var(--interactive-primary)", color: "var(--interactive-on-primary)", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              Ir para Pipeline
            </button>
          </div>
        </>
      )}

      {/* Administrative — simplified */}
      {role === "administrative" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Stat label="Neg. ativas" value={data.totalActiveNegotiations} />
            <Stat label="Vendas mês" value={data.conversionsMonth} />
          </div>
          {totalAlerts > 0 && (
            <>
              <SectionLabel count={totalAlerts}>Alertas operacionais</SectionLabel>
              <div style={{ display: "grid", gap: 8 }}>
                {[...data.urgent, ...data.overdue].slice(0, 5).map(a => (
                  <AlertCard key={a.entity_id} alert={a} />
                ))}
              </div>
            </>
          )}
          {!hasAlerts && <EmptyState role={role} />}
        </>
      )}
    </div>
  );
}
