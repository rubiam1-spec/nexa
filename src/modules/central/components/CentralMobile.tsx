import { useNavigate } from "react-router-dom";
import type { CSSProperties } from "react";
import type { CentralData, FocusItem, PulseKPI } from "../hooks/useCentral";
import type { IntelligenceAlert } from "../hooks/useIntelligenceAlerts";
import { useDailyBriefing } from "../../../shared/hooks/useDailyBriefing";
import { formatWeekdayLongBRT } from "../../../shared/utils/dateUtils";
import { NegotiationStatus } from "../../../domain/status/negotiation";

const T = {
  ink: "var(--surface-base)",
  carbon: "var(--surface-raised)",
  stone: "var(--border-default)",
  chalk: "var(--text-primary)",
  bone: "var(--text-secondary)",
  fog: "var(--text-muted)",
  slate: "var(--text-disabled)",
  sprout: "var(--interactive-primary)",
};
const MONO = "var(--font-mono)";
const CARD_BG =
  "linear-gradient(168deg, rgba(34,33,28,0.5) 0%, rgba(18,17,14,0.15) 100%)";
const CARD_BORDER = "1px solid rgba(61,58,48,0.4)";
const RADIUS = 10;

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function cleanMarkdown(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .replace(/\*\*([^*]+?)\*\*/g, "$1")
    .replace(/\*([^*]+?)\*/g, "$1")
    .replace(/`([^`]+?)`/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^[-*+]\s+/gm, "• ")
    .replace(/\[([^\]]+?)\]\(([^)]+?)\)/g, "$1")
    .replace(/→/g, "")
    .replace(/^[\s.•·→>→—-]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ── Shared atoms ──

function Header({
  userName,
  developmentName,
  onOpenSettings,
}: {
  userName: string;
  developmentName?: string;
  onOpenSettings: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 12,
        marginBottom: 20,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <h1
          style={{
            fontFamily: "'Instrument Serif', Georgia, serif",
            fontSize: 24,
            fontStyle: "italic",
            fontWeight: 400,
            color: T.bone,
            margin: 0,
            lineHeight: 1.15,
          }}
        >
          {greeting()}, {userName}
        </h1>
        <div
          style={{
            fontFamily: MONO,
            fontSize: 11,
            color: T.fog,
            marginTop: 6,
            letterSpacing: "0.02em",
            textOverflow: "ellipsis",
            overflow: "hidden",
            whiteSpace: "nowrap",
          }}
        >
          {formatWeekdayLongBRT()}
          {developmentName ? ` · ${developmentName}` : ""}
        </div>
      </div>
      <button
        type="button"
        onClick={onOpenSettings}
        aria-label="Personalizar Central"
        style={{
          padding: 10,
          borderRadius: 10,
          border: `1px solid ${T.stone}`,
          background: "transparent",
          color: T.fog,
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          width: 44,
          height: 44,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
        </svg>
      </button>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: MONO,
        fontSize: 9,
        fontWeight: 700,
        color: T.slate,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        marginTop: 24,
        marginBottom: 10,
      }}
    >
      {children}
    </div>
  );
}

function KPI2x2({ items }: { items: PulseKPI[] }) {
  const list = items.slice(0, 4);
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, 1fr)",
        gap: 8,
      }}
    >
      {list.map((kpi) => (
        <div
          key={kpi.key}
          style={{
            background: CARD_BG,
            border: CARD_BORDER,
            borderRadius: RADIUS,
            padding: "14px 14px 12px",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              fontFamily: MONO,
              fontSize: 9,
              fontWeight: 500,
              color: T.fog,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              marginBottom: 8,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={kpi.label}
          >
            {kpi.label}
          </div>
          <div
            style={{
              fontFamily: MONO,
              fontSize: typeof kpi.value === "string" && kpi.value.length > 6 ? 20 : 24,
              fontWeight: 700,
              lineHeight: 1,
              letterSpacing: "-0.02em",
              color: kpi.color ?? T.chalk,
              marginBottom: 6,
            }}
          >
            {kpi.value}
          </div>
          <span
            style={{
              fontFamily: MONO,
              fontSize: 9,
              fontWeight: 600,
              color: T.fog,
              background: "rgba(61,58,48,0.22)",
              padding: "2px 6px",
              borderRadius: 4,
              display: "inline-block",
              letterSpacing: "0.02em",
            }}
            aria-label="Variação em relação ao período anterior"
          >
            {kpi.sub ?? "—"}
          </span>
        </div>
      ))}
    </div>
  );
}

function OperationalAlertBanner({ focus, aiAlerts, onNavigate }: { focus: FocusItem[]; aiAlerts: IntelligenceAlert[]; onNavigate: (link: string) => void }) {
  const criticalFocus = focus.filter((f) => f.priority <= 2);
  const aiCritical = aiAlerts.filter((a) => a.priority === "critical" && !a.resolved);
  const aiWarning = aiAlerts.filter((a) => a.priority === "warning" && !a.resolved);

  // Prefer focus items (actionable) when present; otherwise summarise AI alerts.
  if (criticalFocus.length > 0) {
    const first = criticalFocus[0];
    const isExpiring = first.type === "reservation_expiring";
    const bg = isExpiring ? "rgba(248,113,113,0.10)" : "rgba(217,119,6,0.10)";
    const border = isExpiring ? "rgba(248,113,113,0.35)" : "rgba(217,119,6,0.35)";
    const color = isExpiring ? "#F87171" : "#D97706";
    return (
      <button
        type="button"
        onClick={() => onNavigate(first.link)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 14px",
          marginTop: 16,
          background: bg,
          border: `1px solid ${border}`,
          borderRadius: RADIUS,
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <span
          style={{
            width: 22,
            height: 22,
            borderRadius: "50%",
            background: color + "25",
            color,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: MONO,
            fontSize: 12,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          !
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: T.chalk }}>{first.title}</div>
          <div style={{ fontSize: 11, color: T.fog, marginTop: 2 }}>
            {criticalFocus.length > 1 ? `${first.sub} · +${criticalFocus.length - 1} alerta${criticalFocus.length - 1 > 1 ? "s" : ""}` : first.sub}
          </div>
        </div>
        <span style={{ color: T.fog, fontSize: 14 }}>›</span>
      </button>
    );
  }

  if (aiCritical.length === 0 && aiWarning.length === 0) return null;

  const isCritical = aiCritical.length > 0;
  const bg = isCritical ? "rgba(248,113,113,0.08)" : "rgba(217,119,6,0.08)";
  const border = isCritical ? "rgba(248,113,113,0.25)" : "rgba(217,119,6,0.25)";
  const color = isCritical ? "#F87171" : "#D97706";
  const label = isCritical
    ? `${aiCritical.length} alerta${aiCritical.length > 1 ? "s" : ""} crítico${aiCritical.length > 1 ? "s" : ""} — ação imediata`
    : `${aiWarning.length} ponto${aiWarning.length > 1 ? "s" : ""} de atenção na operação`;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 14px",
        marginTop: 16,
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: RADIUS,
      }}
    >
      <span
        style={{
          width: 20,
          height: 20,
          borderRadius: "50%",
          background: color + "25",
          color,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: MONO,
          fontSize: 11,
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        !
      </span>
      <div style={{ fontSize: 12.5, color, fontWeight: 600 }}>{label}</div>
    </div>
  );
}

function IntelligenceAlertList({ alerts, onNavigate }: { alerts: IntelligenceAlert[]; onNavigate: (link: string) => void }) {
  if (alerts.length === 0) return null;
  return (
    <div>
      <SectionLabel>Alertas de Inteligência</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {alerts.slice(0, 3).map((alert) => {
          const prio = alert.priority === "critical" ? "#F87171" : alert.priority === "warning" ? "#D97706" : "#60A5FA";
          const link = alert.metadata?.negotiation_id
            ? `/negociacoes/${alert.metadata.negotiation_id}`
            : alert.metadata?.client_id
            ? `/contatos/${alert.metadata.client_id}`
            : null;
          return (
            <button
              key={alert.id}
              type="button"
              onClick={() => link && onNavigate(link)}
              disabled={!link}
              style={{
                width: "100%",
                display: "flex",
                gap: 10,
                padding: "12px 14px",
                background: CARD_BG,
                border: CARD_BORDER,
                borderLeft: `3px solid ${prio}`,
                borderRadius: RADIUS,
                textAlign: "left",
                cursor: link ? "pointer" : "default",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: T.chalk, marginBottom: 2 }}>{alert.title}</div>
                <div style={{ fontSize: 11, color: T.fog, lineHeight: 1.4 }}>{alert.message}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FunnelHorizontal({ data }: { data: CentralData }) {
  const openNegs = data.negotiations.filter((n) => n.status === NegotiationStatus.OPEN).length;
  const inProg = data.negotiations.filter((n) => n.status === NegotiationStatus.IN_PROGRESS).length;
  const stages = [
    { label: "Negociações", count: openNegs + inProg, color: "#60A5FA" },
    { label: "Reservas", count: data.stock.reserved, color: "#D97706" },
    { label: "Vendas", count: data.wonCount, color: T.sprout },
  ];
  const max = Math.max(...stages.map((s) => s.count), 1);
  return (
    <div>
      <SectionLabel>Funil comercial</SectionLabel>
      <div
        style={{
          background: CARD_BG,
          border: CARD_BORDER,
          borderRadius: RADIUS,
          padding: "14px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {stages.map((s) => {
          const pct = Math.max((s.count / max) * 100, 6);
          return (
            <div key={s.label}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 4,
                }}
              >
                <span style={{ fontSize: 12, color: T.bone }}>{s.label}</span>
                <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: s.color }}>{s.count}</span>
              </div>
              <div
                style={{
                  height: 6,
                  borderRadius: 3,
                  background: "rgba(61,58,48,0.4)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${pct}%`,
                    background: s.color,
                    borderRadius: 3,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const AGENDA_COLORS: Record<string, string> = {
  visit_client: "#4ADE80",
  visit_broker: "#4ADE80",
  meeting_external: "#60A5FA",
  meeting_internal: "#60A5FA",
  follow_up: "#A78BFA",
  training: "#D97706",
  phone_call: "#C4BFB3",
  other: "#C4BFB3",
};

const AGENDA_LABELS: Record<string, string> = {
  visit_client: "Visita",
  visit_broker: "Visita",
  meeting_external: "Reunião",
  meeting_internal: "Reunião",
  follow_up: "Follow-up",
  training: "Treinamento",
  phone_call: "Ligação",
  other: "Atividade",
};

function AgendaTimeline({ data, onNavigate }: { data: CentralData; onNavigate: (link: string) => void }) {
  if (data.agenda.length === 0) {
    return (
      <div>
        <SectionLabel>Agenda do dia</SectionLabel>
        <div
          style={{
            fontSize: 12,
            color: T.fog,
            padding: "12px 14px",
            background: CARD_BG,
            border: CARD_BORDER,
            borderRadius: RADIUS,
          }}
        >
          Sem compromissos hoje.
        </div>
      </div>
    );
  }
  return (
    <div>
      <SectionLabel>Agenda do dia</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {data.agenda.slice(0, 6).map((a) => {
          const color = AGENDA_COLORS[a.type] ?? T.slate;
          const typeLabel = AGENDA_LABELS[a.type] ?? "Atividade";
          const time = a.startTime ? a.startTime.substring(0, 5) : "—";
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => a.link && onNavigate(a.link)}
              disabled={!a.link}
              style={{
                width: "100%",
                display: "flex",
                gap: 10,
                padding: "10px 12px",
                background: CARD_BG,
                border: CARD_BORDER,
                borderLeft: `2px solid ${color}`,
                borderRadius: RADIUS,
                textAlign: "left",
                cursor: a.link ? "pointer" : "default",
              }}
            >
              <div style={{ minWidth: 44 }}>
                <div style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: T.fog, letterSpacing: "0.06em" }}>
                  {time}
                </div>
                <div style={{ fontFamily: MONO, fontSize: 8, color, marginTop: 2, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                  {typeLabel}
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: T.chalk, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {a.title}
                </div>
                {(a.clientName || a.responsavelName) && (
                  <div style={{ fontSize: 10, color: T.fog, marginTop: 2 }}>
                    {[a.clientName, a.responsavelName].filter(Boolean).join(" · ")}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TeamSummary({ data }: { data: CentralData }) {
  const team = [...data.internalTeam, ...data.externalTeam].slice(0, 6);
  if (team.length === 0) {
    // TODO: enriquecer com dados de vendas por membro quando o hook expuser
    return (
      <div>
        <SectionLabel>Equipe</SectionLabel>
        <div
          style={{
            fontSize: 12,
            color: T.fog,
            padding: "14px 16px",
            background: CARD_BG,
            border: CARD_BORDER,
            borderRadius: RADIUS,
          }}
        >
          Nenhum membro ativo neste empreendimento.
        </div>
      </div>
    );
  }
  return (
    <div>
      <SectionLabel>Equipe</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {team.map((m) => (
          <div
            key={m.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 12px",
              background: CARD_BG,
              border: CARD_BORDER,
              borderRadius: RADIUS,
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: "rgba(74,222,128,0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                fontWeight: 700,
                color: T.sprout,
                flexShrink: 0,
              }}
            >
              {m.name.charAt(0)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.chalk, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {m.name}
              </div>
              <div style={{ fontSize: 11, color: T.fog }}>
                {m.role} · {m.negotiations} neg · {m.activitiesWeek} ativ
              </div>
            </div>
            {m.followupsOverdue > 0 && (
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: 10,
                  fontWeight: 700,
                  color: "#F87171",
                  background: "rgba(248,113,113,0.12)",
                  padding: "2px 6px",
                  borderRadius: 4,
                }}
              >
                {m.followupsOverdue} atrasado{m.followupsOverdue > 1 ? "s" : ""}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function QuickActions({ onNavigate }: { onNavigate: (path: string) => void }) {
  const btnBase: CSSProperties = {
    height: 48,
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  };
  return (
    <div>
      <SectionLabel>Ações rápidas</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
        <button
          type="button"
          onClick={() => onNavigate("/contatos/novo")}
          style={{
            ...btnBase,
            background: T.sprout,
            color: "var(--interactive-on-primary)",
            border: "none",
          }}
        >
          + Negociação
        </button>
        <button
          type="button"
          onClick={() => onNavigate("/simulador")}
          style={{
            ...btnBase,
            background: "transparent",
            color: T.bone,
            border: `1px solid ${T.stone}`,
          }}
        >
          Simular
        </button>
      </div>
    </div>
  );
}

function FollowUpList({ focus, contacts, onNavigate }: { focus: FocusItem[]; contacts: CentralData["contacts"]; onNavigate: (link: string) => void }) {
  const followups = focus.filter((f) => f.type === "followup_overdue").slice(0, 5);
  const fallback = contacts.filter((c) => c.isOverdue).slice(0, 5);
  const list = followups.length > 0
    ? followups.map((f) => ({ id: f.id, title: f.title, sub: f.sub, link: f.link, critical: f.priority <= 2 }))
    : fallback.map((c) => ({ id: c.id, title: `Sem contato: ${c.name}`, sub: c.assignedToName ?? "Sem responsável", link: `/contatos/${c.id}`, critical: true }));
  if (list.length === 0) return null;
  return (
    <div>
      <SectionLabel>Follow-ups pendentes</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {list.map((item) => {
          const color = item.critical ? "#F87171" : "#60A5FA";
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.link)}
              style={{
                width: "100%",
                display: "flex",
                gap: 10,
                padding: "12px 14px",
                background: CARD_BG,
                border: CARD_BORDER,
                borderLeft: `3px solid ${color}`,
                borderRadius: RADIUS,
                textAlign: "left",
                cursor: "pointer",
                minHeight: 56,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.chalk, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {item.title}
                </div>
                <div style={{ fontSize: 11, color: T.fog }}>{item.sub}</div>
              </div>
              <span style={{ color: T.fog, fontSize: 14, alignSelf: "center" }}>›</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

type HighlightPriority = "critical" | "warning" | "info";

function normalizeHighlightPriority(h: { priority?: string; icon?: string }): HighlightPriority {
  if (h.priority === "critical" || h.priority === "warning" || h.priority === "info") return h.priority;
  // legado {icon, text}: alert => critical, warning => warning, success/info => info
  if (h.icon === "alert") return "critical";
  if (h.icon === "warning") return "warning";
  return "info";
}

function highlightText(h: { title?: string; text?: string }): string {
  return cleanMarkdown(h.title ?? h.text ?? "");
}

const HIGHLIGHT_STYLE: Record<HighlightPriority, { color: string; bg: string; mark: string }> = {
  critical: { color: "#F56565", bg: "rgba(245,101,101,0.08)", mark: "!" },
  warning: { color: "#FBBF24", bg: "rgba(251,191,36,0.08)", mark: "!" },
  info: { color: "#9C9686", bg: "transparent", mark: "·" },
};

function DailyBriefMini({ accountId, developmentId }: { accountId: string | null; developmentId: string | null }) {
  const { briefing, loading } = useDailyBriefing(accountId, developmentId);
  if (loading || !briefing) return null;

  // Dedupe por texto visível (title||text). Texto vazio é descartado.
  const seen = new Set<string>();
  const highlights = (briefing.highlights ?? [])
    .map((h) => ({ ...h, _text: highlightText(h), _priority: normalizeHighlightPriority(h) }))
    .filter((h) => {
      if (!h._text) return false;
      const key = h._text.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 3);

  const hasActions = briefing.actions.length > 0;
  const hasHighlights = highlights.length > 0;
  const hasSummary = !!cleanMarkdown(briefing.summary);
  // Nada para dizer — não renderiza a seção.
  if (!hasHighlights && !hasActions && !hasSummary) return null;

  return (
    <div>
      <SectionLabel>Análise da operação</SectionLabel>
      <div
        style={{
          background: CARD_BG,
          border: CARD_BORDER,
          borderLeft: `3px solid ${T.sprout}`,
          borderRadius: RADIUS,
          padding: "14px 16px",
        }}
      >
        <div style={{ marginBottom: 8 }}>
          <span style={{ fontFamily: MONO, fontSize: 9, color: T.sprout, letterSpacing: "0.12em", textTransform: "uppercase" }}>
            BRIEFING IA
          </span>
        </div>
        {hasSummary ? (
          <div style={{ fontSize: 13, color: T.bone, lineHeight: 1.55, whiteSpace: "pre-line" }}>
            {cleanMarkdown(briefing.summary)}
          </div>
        ) : null}

        {hasHighlights ? (
          <div style={{ marginTop: hasSummary ? 10 : 0, display: "flex", flexDirection: "column", gap: 6 }}>
            {highlights.map((h, i) => {
              const s = HIGHLIGHT_STYLE[h._priority];
              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "center",
                    padding: "10px 12px",
                    borderRadius: 10,
                    background: s.bg,
                    border: s.bg === "transparent" ? "1px solid var(--border-default)" : "none",
                    minHeight: 44,
                  }}
                >
                  <span
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      background: `${s.color}22`,
                      color: s.color,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: MONO,
                      fontSize: 11,
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {s.mark}
                  </span>
                  <span style={{ fontSize: 12.5, color: T.bone, lineHeight: 1.4 }}>{h._text}</span>
                </div>
              );
            })}
          </div>
        ) : null}

        {hasActions ? (
          <div style={{ marginTop: hasHighlights || hasSummary ? 10 : 0, paddingTop: 10, borderTop: `1px solid ${T.stone}` }}>
            <div style={{ fontFamily: MONO, fontSize: 9, color: T.fog, letterSpacing: "0.1em", marginBottom: 6 }}>
              AÇÃO SUGERIDA
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: T.chalk }}>
              {cleanMarkdown(briefing.actions[0].action)}
            </div>
            <div style={{ fontSize: 11, color: T.fog, marginTop: 2 }}>
              {cleanMarkdown(briefing.actions[0].reason)}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ── Role-specific mobile layouts ──

interface BaseProps {
  data: CentralData;
  role: string | null;
  userName: string;
  developmentName?: string;
  accountId: string | null;
  developmentId: string | null;
  aiAlerts: IntelligenceAlert[];
  onOpenSettings: () => void;
}

function CentralMobileDirector(props: BaseProps) {
  const navigate = useNavigate();
  const go = (path: string) => navigate(path);
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <Header userName={props.userName} developmentName={props.developmentName} onOpenSettings={props.onOpenSettings} />
      <KPI2x2 items={props.data.pulse} />
      <OperationalAlertBanner focus={props.data.focus} aiAlerts={props.aiAlerts} onNavigate={go} />
      {props.accountId && props.developmentId ? (
        <DailyBriefMini accountId={props.accountId} developmentId={props.developmentId} />
      ) : null}
      <IntelligenceAlertList alerts={props.aiAlerts} onNavigate={go} />
      <FunnelHorizontal data={props.data} />
      <AgendaTimeline data={props.data} onNavigate={go} />
      <TeamSummary data={props.data} />
    </div>
  );
}

function CentralMobileConsultant(props: BaseProps) {
  const navigate = useNavigate();
  const go = (path: string) => navigate(path);
  const isManager = props.role === "manager";
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <Header userName={props.userName} developmentName={props.developmentName} onOpenSettings={props.onOpenSettings} />
      <KPI2x2 items={props.data.pulse} />
      <OperationalAlertBanner focus={props.data.focus} aiAlerts={props.aiAlerts} onNavigate={go} />
      <QuickActions onNavigate={go} />
      <FollowUpList focus={props.data.focus} contacts={props.data.contacts} onNavigate={go} />
      {isManager && props.accountId && props.developmentId ? (
        <DailyBriefMini accountId={props.accountId} developmentId={props.developmentId} />
      ) : null}
      <AgendaTimeline data={props.data} onNavigate={go} />
    </div>
  );
}

function CentralMobileBroker(props: BaseProps) {
  const navigate = useNavigate();
  const go = (path: string) => navigate(path);
  const openNegs = props.data.negotiations.filter((n) => n.status === NegotiationStatus.OPEN).length;
  const inProg = props.data.negotiations.filter((n) => n.status === NegotiationStatus.IN_PROGRESS).length;
  const pipelinePills = [
    { label: "Abertas", value: openNegs, color: "#60A5FA" },
    { label: "Andamento", value: inProg, color: "#FBBF24" },
    { label: "Ganhas", value: props.data.wonCount, color: T.sprout },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <Header userName={props.userName} developmentName={props.developmentName} onOpenSettings={props.onOpenSettings} />

      {/* Mini pipeline inline */}
      <div>
        <SectionLabel>Meu pipeline</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
          {pipelinePills.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => go("/pipeline")}
              style={{
                background: CARD_BG,
                border: CARD_BORDER,
                borderRadius: RADIUS,
                padding: "12px 10px",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
                minHeight: 72,
              }}
            >
              <span style={{ fontFamily: MONO, fontSize: 22, fontWeight: 700, color: p.color, lineHeight: 1 }}>
                {p.value}
              </span>
              <span style={{ fontFamily: MONO, fontSize: 9, color: T.fog, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                {p.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      <QuickActions onNavigate={go} />

      <OperationalAlertBanner focus={props.data.focus} aiAlerts={props.aiAlerts} onNavigate={go} />

      {/* Unidades disponíveis */}
      {props.data.stock.total > 0 && (
        <div>
          <SectionLabel>Unidades</SectionLabel>
          <button
            type="button"
            onClick={() => go("/unidades")}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "14px 16px",
              background: CARD_BG,
              border: CARD_BORDER,
              borderRadius: RADIUS,
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                background: "rgba(74,222,128,0.12)",
                color: T.sprout,
                fontFamily: MONO,
                fontSize: 18,
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {props.data.stock.available}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.chalk }}>Disponíveis agora</div>
              <div style={{ fontSize: 11, color: T.fog, marginTop: 2 }}>
                {props.data.stock.reserved} reservadas · {props.data.stock.sold} vendidas
              </div>
            </div>
            <span style={{ color: T.fog, fontSize: 14 }}>›</span>
          </button>
        </div>
      )}

      {/* Clientes próprios */}
      {props.data.contacts.length > 0 && (
        <div>
          <SectionLabel>Meus contatos</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {props.data.contacts.slice(0, 4).map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => go(`/contatos/${c.id}`)}
                style={{
                  width: "100%",
                  display: "flex",
                  gap: 10,
                  padding: "12px 14px",
                  background: CARD_BG,
                  border: CARD_BORDER,
                  borderRadius: RADIUS,
                  cursor: "pointer",
                  textAlign: "left",
                  minHeight: 56,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.chalk, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {c.name}
                  </div>
                  <div style={{ fontSize: 11, color: T.fog }}>{c.phone ?? "—"}</div>
                </div>
                {c.isOverdue && (
                  <span
                    style={{
                      fontFamily: MONO,
                      fontSize: 10,
                      fontWeight: 700,
                      color: "#F87171",
                      background: "rgba(248,113,113,0.12)",
                      padding: "2px 6px",
                      borderRadius: 4,
                      alignSelf: "center",
                    }}
                  >
                    Atrasado
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      <AgendaTimeline data={props.data} onNavigate={go} />
    </div>
  );
}

// ── Entry ──

export default function CentralMobile(props: BaseProps) {
  const role = props.role ?? "";
  if (role === "broker") return <CentralMobileBroker {...props} />;
  if (role === "owner" || role === "director") return <CentralMobileDirector {...props} />;
  // manager, commercial_consultant, administrative, concierge — consultant layout
  return <CentralMobileConsultant {...props} />;
}
