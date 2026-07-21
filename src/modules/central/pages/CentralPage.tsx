import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../app/contexts/AuthContext";
import { useAccount } from "../../../app/contexts/AccountContext";
import { useDevelopment } from "../../../app/contexts/DevelopmentContext";
import { useScreen } from "../../../shared/hooks/useIsMobile";
import { useCentral } from "../hooks/useCentral";
import { supabase } from "../../../infra/supabase/supabaseClient";
import CentralAgenda from "../components/CentralAgenda";
import WeeklyPlanCard from "../components/WeeklyPlanCard";
import CentralMobile from "../components/CentralMobile";
import { NegotiationStatus } from "../../../domain/status/negotiation";
import { formatWeekdayLongBRT, formatTimeBRT, formatDateShortBRT, getTodayDateStringBRT } from "../../../shared/utils/dateUtils";
import { useDailyBriefing, type BriefingHighlight, type BriefingAction } from "../../../shared/hooks/useDailyBriefing";
import { briefingFreshness } from "../briefingFreshness";
import { useIntelligenceAlerts, type IntelligenceAlert } from "../hooks/useIntelligenceAlerts";
import { Line } from "react-chartjs-2";
import { VizFrame } from "../../../shared/viz";
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend } from "chart.js";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

const T = { ink: "var(--surface-base)", carbon: "var(--surface-raised)", stone: "var(--border-default)", chalk: "var(--text-primary)", bone: "var(--text-secondary)", fog: "var(--text-muted)", slate: "var(--text-disabled)", sprout: "var(--interactive-primary)" };
const MONO = "var(--font-mono)";
function greeting() { const h = new Date().getHours(); return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite"; }
function weekday() { return formatWeekdayLongBRT(); }

const NEG_STATUS: Record<string, { label: string; color: string }> = {
  OPEN: { label: "Aberta", color: "#60A5FA" }, IN_PROGRESS: { label: "Em andamento", color: "#A78BFA" },
  em_andamento: { label: "Em andamento", color: "#A78BFA" }, WON: { label: "Ganha", color: "#4ADE80" },
  LOST: { label: "Perdida", color: "#F87171" }, CANCELLED: { label: "Cancelada", color: "#6B7280" },
};
const TEMP_CFG: Record<string, { label: string; color: string }> = { hot: { label: "Quente", color: "#F87171" }, warm: { label: "Morno", color: "#FBBF24" }, cold: { label: "Frio", color: "#60A5FA" } };


// ── v7 Card gradient ──
const CARD_BG = "linear-gradient(168deg, rgba(34,33,28,0.5) 0%, rgba(18,17,14,0.15) 100%)";
const CARD_BORDER = "1px solid rgba(61,58,48,0.1)";

// ── Shared Components ──

function SectionLabel({ children, count }: { children: React.ReactNode; count?: number }) {
  return <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: T.slate, letterSpacing: "0.12em", textTransform: "uppercase", marginTop: 28, marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>{children}{count != null && count > 0 && <span style={{ background: "var(--surface-overlay)", borderRadius: 10, padding: "1px 7px", fontSize: 10, fontWeight: 600, color: T.fog }}>{count}</span>}</div>;
}

function V7Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background: CARD_BG, border: CARD_BORDER, borderRadius: 12, padding: "14px 16px", transition: "border-color 150ms ease, transform 150ms ease", ...style }}>{children}</div>;
}

function Accordion({ title, count, preview, children, defaultOpen }: { title: string; count: number; preview?: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  return (
    <V7Card style={{ padding: 0, overflow: "hidden" }}>
      <button type="button" onClick={() => setOpen(!open)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: "var(--surface-overlay)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: MONO, fontSize: 13, fontWeight: 700, color: T.bone, flexShrink: 0 }}>{count}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: T.chalk }}>{title}</div>
          {preview && !open && <div style={{ fontSize: 12, color: T.fog, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{preview}</div>}
        </div>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ color: T.bone, transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "none", flexShrink: 0 }}><path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      {open && <div style={{ borderTop: `1px solid ${T.stone}`, padding: "12px 16px" }}>{children}</div>}
    </V7Card>
  );
}

function TeamCard({ m }: { m: { id: string; name: string; role: string; avatarUrl: string | null; negotiations: number; activitiesWeek: number; followupsOverdue: number } }) {
  return (
    <V7Card>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", background: T.sprout + "20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: T.sprout, flexShrink: 0 }}>{m.name.charAt(0)}</div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: T.chalk }}>{m.name}</div>
          <div style={{ fontSize: 11, color: T.fog }}>{m.role}</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 12, fontSize: 12 }}>
        <span style={{ color: T.fog }}>{m.negotiations} neg.</span>
        <span style={{ color: T.fog }}>{m.activitiesWeek} ativ.</span>
        {m.followupsOverdue > 0 && <span style={{ color: "#F87171" }}>{m.followupsOverdue} atrasado{m.followupsOverdue > 1 ? "s" : ""}</span>}
      </div>
    </V7Card>
  );
}

// ── KPI Card v7 ──

interface KPIConfig { label: string; icon: string; glowColor: string; iconBg: string; iconColor: string; isMoney?: boolean; progressColor: string; }

const KPI_CFG: Record<string, KPIConfig> = {
  negs: { label: "NEGOCIAÇÕES ATIVAS", icon: "N", glowColor: "#4ADE80", iconBg: "rgba(74,222,128,0.07)", iconColor: "#4ADE80", progressColor: "#4ADE80" },
  reservas: { label: "RESERVAS", icon: "R", glowColor: "#D97706", iconBg: "rgba(217,119,6,0.07)", iconColor: "#D97706", progressColor: "#D97706" },
  vendas: { label: "VENDAS", icon: "V", glowColor: "#60A5FA", iconBg: "rgba(96,165,250,0.07)", iconColor: "#60A5FA", progressColor: "#60A5FA" },
  vgv: { label: "VGV vendido (unidades)", icon: "R$", glowColor: "#4ADE80", iconBg: "rgba(74,222,128,0.07)", iconColor: "#4ADE80", isMoney: true, progressColor: "#4ADE80" },
  ticket: { label: "TICKET MÉDIO", icon: "TK", glowColor: "#A78BFA", iconBg: "rgba(167,139,250,0.07)", iconColor: "#A78BFA", isMoney: true, progressColor: "#A78BFA" },
  contatos: { label: "MEUS CONTATOS", icon: "C", glowColor: "#60A5FA", iconBg: "rgba(96,165,250,0.07)", iconColor: "#60A5FA", progressColor: "#60A5FA" },
  atividades: { label: "ATIVIDADES SEMANA", icon: "A", glowColor: "#A78BFA", iconBg: "rgba(167,139,250,0.07)", iconColor: "#A78BFA", progressColor: "#A78BFA" },
  followups: { label: "FOLLOW-UPS HOJE", icon: "F", glowColor: "#FBBF24", iconBg: "rgba(251,191,36,0.07)", iconColor: "#FBBF24", progressColor: "#FBBF24" },
};

function KPICard({ kpi, totalUnits }: { kpi: { key: string; label: string; value: number | string; sub?: string; color?: string }; totalUnits: number }) {
  const cfg = KPI_CFG[kpi.key] ?? { label: kpi.label.toUpperCase(), icon: "?", glowColor: "#5C5647", iconBg: "rgba(92,86,71,0.07)", iconColor: "#5C5647", progressColor: "#5C5647" };
  const numericValue = typeof kpi.value === "number" ? kpi.value : 0;
  const progressPercent = totalUnits > 0 && typeof kpi.value === "number" ? Math.min((numericValue / totalUnits) * 100, 100) : 0;

  return (
    <div style={{
      background: CARD_BG, borderRadius: 12, padding: "18px 18px 14px",
      border: CARD_BORDER, position: "relative", overflow: "hidden",
      transition: "border-color 150ms ease, transform 150ms ease",
    }}>
      {/* Glow */}
      <div style={{
        position: "absolute", top: -15, right: -15, width: 70, height: 70, borderRadius: "50%",
        background: cfg.glowColor, opacity: 0.06, filter: "blur(22px)", pointerEvents: "none",
      }} />

      {/* Header: label + icon */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <span style={{ fontFamily: MONO, fontSize: 8.5, color: "#5C5647", letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 500 }}>
          {cfg.label}
        </span>
        <div style={{
          width: 28, height: 28, borderRadius: 8, background: cfg.iconBg,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, fontWeight: 700, color: cfg.iconColor, fontFamily: MONO,
        }}>
          {cfg.icon}
        </div>
      </div>

      {/* Value */}
      <div style={{
        fontFamily: MONO, fontSize: cfg.isMoney ? 22 : 32, fontWeight: 700, lineHeight: 1,
        letterSpacing: "-0.03em",
        color: kpi.color ? cfg.iconColor : "#FAF9F6", marginBottom: 4,
      }}>
        {kpi.value}
      </div>

      {/* Context */}
      {kpi.sub && <div style={{ fontSize: 10.5, color: "#5C5647", marginBottom: 4 }}>{kpi.sub}</div>}

      {/* Delta placeholder */}
      <span style={{
        fontFamily: MONO, fontSize: 9.5, fontWeight: 600,
        display: "inline-flex", alignItems: "center", gap: 3,
        padding: "2px 7px", borderRadius: 4,
        color: "#5C5647", background: "rgba(61,58,48,0.15)",
      }}>
        —
      </span>

      {/* Progress bar */}
      {progressPercent > 0 && (
        <div style={{ height: 2.5, background: "rgba(61,58,48,0.2)", borderRadius: 2, marginTop: 12, overflow: "hidden" }}>
          <div style={{ height: "100%", borderRadius: 2, width: `${progressPercent}%`, background: `linear-gradient(90deg, ${cfg.progressColor}, ${cfg.progressColor}88)` }} />
        </div>
      )}
    </div>
  );
}

// ── Sales Chart (placeholder data) ──

function SalesChart() {
  const data = {
    labels: ["Sem 1", "Sem 2", "Sem 3", "Sem 4", "Sem 5", "Sem 6", "Sem 7", "Sem 8"],
    datasets: [
      {
        label: "Vendas acumuladas",
        data: [2, 5, 8, 12, 18, 24, 31, 38],
        borderColor: "#4ADE80",
        backgroundColor: "rgba(74,222,128,0.04)",
        fill: true,
        tension: 0.4,
        borderWidth: 2,
        pointRadius: 3,
        pointBackgroundColor: "#4ADE80",
        pointBorderColor: "#0B0A08",
        pointBorderWidth: 2,
      },
      {
        label: "Meta",
        data: [5, 10, 15, 20, 25, 30, 35, 40],
        borderColor: "rgba(92,86,71,0.3)",
        borderDash: [4, 4],
        borderWidth: 1,
        pointRadius: 0,
        fill: false,
      },
    ],
  };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true, position: "top" as const, align: "end" as const,
        labels: {
          color: "#5C5647",
          font: { family: "'JetBrains Mono'", size: 9 },
          boxWidth: 7, boxHeight: 7,
          useBorderRadius: true, borderRadius: 2, padding: 10,
        },
      },
    },
    scales: {
      x: {
        grid: { color: "rgba(61,58,48,0.06)" },
        ticks: { color: "#3D3A30", font: { family: "'JetBrains Mono'", size: 8 } },
        border: { display: false },
      },
      y: {
        grid: { color: "rgba(61,58,48,0.05)" },
        ticks: { color: "#3D3A30", font: { family: "'JetBrains Mono'", size: 8 } },
        border: { display: false },
        beginAtZero: true,
      },
    },
  };
  // chart.js encapsulado no padrão NexaViz (VizFrame): título/subtítulo/estados
  // vêm do frame único; o canvas (interatividade rica) permanece.
  return (
    <VizFrame title="Vendas por semana" subtitle="últimas 8 semanas · dados de exemplo" height={180}>
      <div style={{ position: "relative", height: 180 }}>
        <Line data={data} options={options} />
      </div>
    </VizFrame>
  );
}

// ── Aniversariantes do Mês ──
interface Aniversariante { id: string; name: string; tipo: string; mes_aniversario: number; dia_aniversario: number; phone?: string | null }

function BirthdaysCard({ accountId }: { accountId: string | null }) {
  const [items, setItems] = useState<Aniversariante[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const now = new Date();
  const mesAtual = now.getMonth() + 1;
  const diaAtual = now.getDate();

  useEffect(() => {
    if (!supabase || !accountId) { setLoading(false); return; }
    let mounted = true;
    (async () => {
      try {
        const { data } = await supabase!.from("vw_aniversariantes").select("*").eq("account_id", accountId).eq("mes_aniversario", mesAtual).order("dia_aniversario");
        if (mounted) setItems((data ?? []) as Aniversariante[]);
      } catch { /* view may not exist yet */ }
      finally { if (mounted) setLoading(false); }
    })();
    return () => { mounted = false; };
  }, [accountId, mesAtual]);

  if (loading) return null;

  const todayCount = items.filter((p) => p.dia_aniversario === diaAtual).length;
  const hasMultipleTypes = new Set(items.map((p) => p.tipo)).size > 1;
  const CARD_STYLE = "linear-gradient(168deg, rgba(34,33,28,0.45), rgba(18,17,14,0.15))";

  return (
    <div style={{ marginTop: 24, marginBottom: 16 }}>
      {/* Overline — matches SectionLabel pattern */}
      <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: T.slate, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10 }}>
        ANIVERSARIANTES DO MÊS
      </div>
      {/* Accordion header — always visible */}
      <div onClick={() => setOpen((o) => !o)} style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "14px 18px", cursor: "pointer",
        background: CARD_STYLE, border: "1px solid rgba(61,58,48,0.08)",
        borderLeft: "3px solid #A78BFA40",
        borderRadius: open ? "12px 12px 0 0" : 12,
        transition: "border-radius 0.15s",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: T.chalk }}>
            {items.length} {items.length === 1 ? "Pessoa" : "Pessoas"}
          </span>
          {todayCount > 0 && (
            <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: "#FFB74D", background: "rgba(255,183,77,0.12)", padding: "2px 8px", borderRadius: 4, letterSpacing: "0.06em" }}>
              {todayCount} HOJE
            </span>
          )}
        </div>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ color: "#5C5647", transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "none", flexShrink: 0 }}>
          <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      {/* Expandable list */}
      {open && (
        <div style={{
          background: CARD_STYLE, border: "1px solid rgba(61,58,48,0.08)",
          borderTop: "none", borderLeft: "3px solid #A78BFA40",
          borderRadius: "0 0 12px 12px", padding: "8px 18px 14px",
          maxHeight: 380, overflowY: "auto",
        }}>
          {items.length > 0 ? items.map((person, i) => {
            const isToday = person.dia_aniversario === diaAtual;
            const isPast = person.dia_aniversario < diaAtual;
            const tipoLabel = person.tipo === "client" ? "Cliente" : person.tipo === "broker" ? "Corretor" : "Equipe";
            const tipoColor = person.tipo === "client" ? "#4ADE80" : person.tipo === "broker" ? "#D97706" : "#60A5FA";
            const phoneClean = person.phone?.replace(/\D/g, "") || "";
            const firstName = person.name.split(" ")[0];
            const waLink = phoneClean ? `https://wa.me/55${phoneClean}?text=${encodeURIComponent(`Feliz aniversário, ${firstName}! 🎂`)}` : null;
            return (
              <div key={person.id + "-" + person.tipo} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: isToday ? "9px 10px" : "7px 0",
                marginBottom: isToday ? 6 : 0,
                borderRadius: isToday ? 8 : 0,
                background: isToday ? "rgba(255,183,77,0.08)" : "transparent",
                border: isToday ? "1px solid rgba(255,183,77,0.25)" : "none",
                borderBottom: !isToday && i < items.length - 1 ? "1px solid rgba(61,58,48,0.06)" : undefined,
                opacity: isPast && !isToday ? 0.45 : 1,
                transition: "opacity 0.1s",
              }}>
                <div style={{ fontFamily: MONO, fontSize: isToday ? 14 : 12, fontWeight: 700, width: 28, textAlign: "center", color: isToday ? "#FFB74D" : "#706B5F" }}>
                  {String(person.dia_aniversario).padStart(2, "0")}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: isToday ? "#E8E5DE" : "#C4BFB3" }}>
                    {person.name}{isToday ? " 🎂" : ""}
                  </div>
                  {isToday && (
                    <div style={{ fontFamily: MONO, fontSize: 8, fontWeight: 700, color: "#FFB74D", letterSpacing: "0.12em", textTransform: "uppercase", marginTop: 2 }}>
                      HOJE!
                    </div>
                  )}
                </div>
                {waLink && isToday && (
                  <a href={waLink} target="_blank" rel="noopener noreferrer"
                    style={{ fontFamily: MONO, fontSize: 9, fontWeight: 600, padding: "4px 10px", borderRadius: 6, color: "#4ADE80", background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)", textDecoration: "none", whiteSpace: "nowrap" }}>
                    WhatsApp
                  </a>
                )}
                {hasMultipleTypes && (
                  <span style={{ fontFamily: MONO, fontSize: 8, fontWeight: 600, padding: "2px 6px", borderRadius: 3, color: tipoColor, background: `${tipoColor}12`, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {tipoLabel}
                  </span>
                )}
              </div>
            );
          }) : (
            <div style={{ fontSize: 12.5, color: "#5C5647", padding: "8px 0" }}>Nenhum aniversariante este mês</div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Central Modules registry & preferences ──

interface CentralModule {
  key: string;
  label: string;
  description: string;
  defaultVisible: Record<string, boolean>;
}

const ALL_ROLES = ["owner", "director", "manager", "commercial_consultant", "broker", "administrative", "concierge"] as const;
function vis(roles: Partial<Record<typeof ALL_ROLES[number], boolean>>): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  ALL_ROLES.forEach((r) => { out[r] = roles[r] ?? false; });
  return out;
}

const CENTRAL_MODULES: CentralModule[] = [
  { key: "quick_actions", label: "Ações Rápidas", description: "Botões de ação rápida", defaultVisible: vis({ owner: true, director: true, manager: true, commercial_consultant: true, broker: true, administrative: true, concierge: true }) },
  { key: "weekly_plan", label: "Plano da Semana", description: "Planejamento semanal publicado", defaultVisible: vis({ owner: true, director: true, manager: true, commercial_consultant: true, administrative: true, concierge: true }) },
  { key: "daily_briefing", label: "Análise da Operação", description: "Briefing com IA sobre a operação", defaultVisible: vis({ owner: true, director: true, manager: true }) },
  { key: "agenda", label: "Agenda", description: "Atividades do dia e da semana", defaultVisible: vis({ owner: true, director: true, manager: true, commercial_consultant: true, broker: true, concierge: true }) },
  { key: "kpis", label: "Indicadores (KPIs)", description: "Negociações, reservas, vendas, VGV", defaultVisible: vis({ owner: true, director: true, manager: true, commercial_consultant: true, broker: true }) },
  { key: "funnel", label: "Funil Comercial", description: "Funil de negociações por etapa", defaultVisible: vis({ owner: true, director: true, manager: true }) },
  { key: "stock", label: "Estoque de Unidades", description: "Disponíveis, reservadas, vendidas", defaultVisible: vis({ owner: true, director: true, manager: true }) },
  { key: "chart", label: "Gráfico de Vendas", description: "Evolução semanal de vendas", defaultVisible: vis({ owner: true, director: true, manager: true }) },
  { key: "intelligence_alerts", label: "Alertas de Inteligência", description: "Alertas IA com sugestões de ação", defaultVisible: vis({ owner: true, director: true, manager: true }) },
  { key: "alerts", label: "Alertas Operacionais", description: "Negociações paradas, propostas vencidas", defaultVisible: vis({ owner: true, director: true, manager: true, commercial_consultant: true, broker: true }) },
  { key: "negotiations", label: "Negociações ativas", description: "Lista das negociações em andamento", defaultVisible: vis({ owner: true, director: true, manager: true, commercial_consultant: true, broker: true }) },
  { key: "contacts", label: "Contatos Recentes", description: "Últimos contatos criados", defaultVisible: vis({ owner: true, director: true, manager: true, commercial_consultant: true, broker: true }) },
  { key: "birthdays", label: "Aniversariantes", description: "Aniversariantes do mês", defaultVisible: vis({ owner: true, director: true, manager: true, concierge: true }) },
  { key: "internal_team", label: "Equipe Interna", description: "Consultores e suas atividades", defaultVisible: vis({ owner: true, director: true, manager: true }) },
  { key: "external_team", label: "Corretores Externos", description: "Corretores e suas negociações", defaultVisible: vis({ owner: true, director: true, manager: true }) },
];

function defaultsForRole(role: string | null): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  CENTRAL_MODULES.forEach((m) => { out[m.key] = m.defaultVisible[role ?? ""] ?? false; });
  return out;
}

function useCentralPreferences(profileId: string | null, accountId: string | null, role: string | null) {
  const [visibility, setVisibility] = useState<Record<string, boolean>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!profileId || !accountId) { setLoaded(false); return; }
      const fallback = defaultsForRole(role);
      if (!supabase) { if (!cancelled) { setVisibility(fallback); setLoaded(true); } return; }
      try {
        const { data } = await supabase
          .from("central_preferences")
          .select("preferences")
          .eq("profile_id", profileId)
          .eq("account_id", accountId)
          .maybeSingle();
        if (cancelled) return;
        const prefs = (data?.preferences as { modules?: Record<string, boolean> } | null) ?? null;
        const merged = { ...fallback, ...(prefs?.modules ?? {}) };
        setVisibility(merged);
      } catch {
        if (!cancelled) setVisibility(fallback);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [profileId, accountId, role]);

  const save = async (next: Record<string, boolean>) => {
    setVisibility(next);
    if (!supabase || !profileId || !accountId) return;
    try {
      await supabase
        .from("central_preferences")
        .upsert({ profile_id: profileId, account_id: accountId, preferences: { modules: next }, updated_at: new Date().toISOString() }, { onConflict: "profile_id,account_id" });
    } catch (err) { console.error("Failed to save central preferences:", err); }
  };

  return { visibility, loaded, save, resetDefaults: () => save(defaultsForRole(role)) };
}

function CentralSettingsPanel({ visibility, onChange, onReset, onClose }: { visibility: Record<string, boolean>; onChange: (key: string, value: boolean) => void; onReset: () => void; onClose: () => void }) {
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 998 }} />
      <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 320, maxWidth: "90vw", background: "var(--surface-base)", borderLeft: `1px solid ${T.stone}`, padding: "24px 20px", zIndex: 999, overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, gap: 12 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: T.chalk }}>Personalizar Central</div>
            <div style={{ fontSize: 12, color: T.fog, marginTop: 2 }}>Escolha o que aparece na sua tela</div>
          </div>
          <button type="button" onClick={onClose} style={{ background: "none", border: "none", color: T.fog, fontSize: 18, cursor: "pointer", padding: 0, lineHeight: 1 }}>✕</button>
        </div>
        {CENTRAL_MODULES.map((mod) => {
          const on = !!visibility[mod.key];
          return (
            <div key={mod.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: `1px solid ${T.stone}` }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.chalk }}>{mod.label}</div>
                <div style={{ fontSize: 11, color: T.fog }}>{mod.description}</div>
              </div>
              <div onClick={() => onChange(mod.key, !on)} style={{ width: 40, height: 22, borderRadius: 11, cursor: "pointer", background: on ? T.sprout : T.stone, position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
                <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#fff", position: "absolute", top: 2, left: on ? 20 : 2, transition: "left 0.2s" }} />
              </div>
            </div>
          );
        })}
        <button type="button" onClick={onReset} style={{ width: "100%", marginTop: 20, padding: 10, border: `1px solid ${T.stone}`, borderRadius: 8, background: "transparent", color: T.bone, fontSize: 12, cursor: "pointer" }}>
          Restaurar padrão
        </button>
      </div>
    </>
  );
}

// ── Main Page ──

export default function CentralPage() {
  const navigate = useNavigate();
  const { authenticatedProfile } = useAuth();
  const { account } = useAccount();
  const { development } = useDevelopment();
  const screen = useScreen();
  const isMobile = !screen.isDesktop;

  const role = account?.role ?? authenticatedProfile?.role ?? null;
  const userId = authenticatedProfile?.id ?? null;
  const accountId = account?.accountId ?? null;
  const developmentId = development?.developmentId ?? null;
  const userName = authenticatedProfile?.fullName?.split(" ")[0] ?? "Usuário";

  const { data, loading, error, isManager } = useCentral(role, userId, accountId, developmentId);
  const { alerts: aiAlerts, criticalCount: aiCritical, warningCount: aiWarning, resolveAlert, generateAlerts, generating: generatingAlerts } = useIntelligenceAlerts(accountId);
  const { visibility, save: savePrefs, resetDefaults } = useCentralPreferences(userId, accountId, role);
  const [showSettings, setShowSettings] = useState(false);
  const isVisible = (key: string) => visibility[key] !== false;

  if (loading) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}><div style={{ color: "#4ADE80", fontFamily: MONO, fontSize: 13 }}>Carregando Central...</div></div>;
  if (error) return <div style={{ padding: 32, color: "#F87171" }}>{error}</div>;
  if (!data) return null;

  // ── Mobile (< 768): role-specific compact layout ──
  if (screen.isMobile) {
    return (
      <>
        <CentralMobile
          data={data}
          role={role}
          userName={userName}
          developmentName={development?.developmentName}
          accountId={accountId}
          developmentId={developmentId}
          aiAlerts={aiAlerts}
          onOpenSettings={() => setShowSettings(true)}
        />
        {showSettings && (
          <CentralSettingsPanel
            visibility={visibility}
            onChange={(key, value) => void savePrefs({ ...visibility, [key]: value })}
            onReset={() => void resetDefaults()}
            onClose={() => setShowSettings(false)}
          />
        )}
      </>
    );
  }

  // Derive funnel from negotiations — normalize status to avoid case mismatch
  const openNegs = data.negotiations.filter((n) => n.status === NegotiationStatus.OPEN).length;
  const inProgressNegs = data.negotiations.filter((n) => n.status === NegotiationStatus.IN_PROGRESS).length;
  const lostNegs = data.lostCount;
  const wonNegs = data.wonCount;
  const funnelMax = Math.max(openNegs, inProgressNegs, data.stock.reserved, wonNegs, lostNegs, 1);
  const funnelStages = [
    { label: "Aberta", count: openNegs, widthPercent: Math.max((openNegs / funnelMax) * 100, 8), color: "#60A5FA" },
    { label: "Andamento", count: inProgressNegs, widthPercent: Math.max((inProgressNegs / funnelMax) * 100, 8), color: "#FBBF24" },
    { label: "Reservadas", count: data.stock.reserved, widthPercent: Math.max((data.stock.reserved / funnelMax) * 100, 8), color: "#A78BFA" },
    { label: "Vendidas", count: wonNegs, widthPercent: Math.max((wonNegs / funnelMax) * 100, 8), color: "#4ADE80" },
    { label: "Perdidas", count: lostNegs, widthPercent: Math.max((lostNegs / funnelMax) * 100, 8), color: "#F87171" },
  ];

  return (
    <div style={{ maxWidth: 840, margin: "0 auto" }}>
      {/* ═══ 1. Greeting + gear ═══ */}
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: isMobile ? 26 : 30, fontWeight: 400, fontStyle: "italic", color: T.bone, margin: 0, lineHeight: 1.2 }}>{greeting()}, {userName}</h1>
          <div style={{ fontFamily: MONO, fontSize: 12, color: T.fog, marginTop: 6, letterSpacing: "0.02em" }}>{weekday()} · {development?.developmentName}</div>
        </div>
        <button type="button" onClick={() => setShowSettings(true)} title="Personalizar Central" aria-label="Personalizar Central" style={{ padding: 8, borderRadius: 8, border: `1px solid ${T.stone}`, background: "transparent", color: T.fog, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>
      </div>

      {/* Quick actions */}
      {isVisible("quick_actions") && (
        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
          {[
            { label: "Simulador", path: "/simulador" },
            { label: "+ Contato", path: "/contatos/novo" },
            { label: "Mapa", path: "/unidades?view=mapa" },
            { label: "Negociações", path: "/negociacoes" },
          ].map((btn) => (
            <button key={btn.label} type="button" onClick={() => navigate(btn.path)} style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${T.stone}`, background: "transparent", color: T.bone, fontSize: 13, cursor: "pointer" }}>{btn.label}</button>
          ))}
        </div>
      )}

      {/* ═══ Plano da Semana ═══ */}
      {isVisible("weekly_plan") && role !== "broker" && accountId && developmentId && (
        <WeeklyPlanCard accountId={accountId} developmentId={developmentId} />
      )}

      {/* ═══ Daily Briefing (managers only) ═══ */}
      {isVisible("daily_briefing") && isManager && role !== "administrative" && accountId && developmentId && <DailyBriefingCard accountId={accountId} developmentId={developmentId} />}

      {/* ═══ Aniversariantes (alta prioridade para concierge) ═══ */}
      {isVisible("birthdays") && role === "concierge" && <BirthdaysCard accountId={accountId} />}

      {/* ═══ Agenda ═══ */}
      {isVisible("agenda") && role !== "administrative" && <CentralAgenda accountId={accountId} role={role} userId={userId} isManager={isManager} />}

      {/* ═══ 3. KPIs ═══ */}
      {isVisible("kpis") && <>
      <SectionLabel>Indicadores</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : `repeat(${Math.min(data.pulse.length, 4)}, 1fr)`, gap: 10 }}>
        {data.pulse.slice(0, 4).map((kpi) => (
          <KPICard key={kpi.key} kpi={kpi} totalUnits={data.stock.total} />
        ))}
      </div>
      {data.pulse.length > 4 && (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : `repeat(${data.pulse.length - 4}, 1fr)`, gap: 10, marginTop: 10 }}>
          {data.pulse.slice(4).map((kpi) => (
            <KPICard key={kpi.key} kpi={kpi} totalUnits={data.stock.total} />
          ))}
        </div>
      )}
      </>}

      {/* ═══ 4. Funnel + Stock (2-col grid) ═══ */}
      {(isVisible("funnel") || isVisible("stock")) && (data.stock.total > 0 || data.negotiations.length > 0) && (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10, marginTop: 20 }}>
          {/* Funnel */}
          {isVisible("funnel") && (data.negotiations.length > 0 || data.lostCount > 0 || data.wonCount > 0) && (
            <div style={{ background: CARD_BG, borderRadius: 12, padding: "20px 22px", border: CARD_BORDER }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#E8E5DE", marginBottom: 2 }}>Funil comercial</div>
              <div style={{ fontFamily: MONO, fontSize: 8.5, color: "#3D3A30", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 14 }}>PIPELINE ATIVO</div>
              {funnelStages.map((stage) => (
                <div key={stage.label} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                  <span style={{ fontFamily: MONO, fontSize: 10, color: "#5C5647", width: 72, textAlign: "right", fontWeight: 500 }}>{stage.label}</span>
                  <div style={{
                    height: 22, borderRadius: 5,
                    width: `${stage.widthPercent}%`, minWidth: 30, flex: 1, maxWidth: `${stage.widthPercent}%`,
                    background: `${stage.color}30`,
                    display: "flex", alignItems: "center", justifyContent: "flex-end",
                    padding: "0 10px",
                    fontFamily: MONO, fontSize: 10.5, fontWeight: 700,
                    color: stage.color,
                  }}>
                    {stage.count}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Stock */}
          {isVisible("stock") && data.stock.total > 0 && (
            <div style={{ background: CARD_BG, borderRadius: 12, padding: "20px 22px", border: CARD_BORDER }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#E8E5DE", marginBottom: 2 }}>Estoque de unidades</div>
              <div style={{ fontFamily: MONO, fontSize: 8.5, color: "#3D3A30", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 14 }}>{data.stock.total} UNIDADES</div>

              {/* Number grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginBottom: 14 }}>
                {[
                  { value: data.stock.sold, label: "Vendidas", color: "#4ADE80" },
                  { value: data.stock.reserved, label: "Reserv.", color: "#D97706" },
                  { value: data.stock.inNegotiation, label: "Negoc.", color: "#60A5FA" },
                  { value: data.stock.available, label: "Dispon.", color: "#5C5647" },
                ].map((item) => (
                  <div key={item.label} style={{ textAlign: "center", padding: "8px 4px", background: "rgba(18,17,14,0.5)", borderRadius: 8 }}>
                    <div style={{ fontFamily: MONO, fontSize: 20, fontWeight: 700, lineHeight: 1, color: item.color }}>{item.value}</div>
                    <div style={{ fontFamily: MONO, fontSize: 7.5, color: "#3D3A30", textTransform: "uppercase", letterSpacing: "0.1em", marginTop: 3 }}>{item.label}</div>
                  </div>
                ))}
              </div>

              {/* Segmented bar */}
              <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden" }}>
                {data.stock.sold > 0 && <div style={{ width: `${(data.stock.sold / data.stock.total) * 100}%`, background: "#4ADE80" }} />}
                {data.stock.reserved > 0 && <div style={{ width: `${(data.stock.reserved / data.stock.total) * 100}%`, background: "#D97706" }} />}
                {data.stock.inNegotiation > 0 && <div style={{ width: `${(data.stock.inNegotiation / data.stock.total) * 100}%`, background: "#60A5FA" }} />}
                {data.stock.available > 0 && <div style={{ width: `${(data.stock.available / data.stock.total) * 100}%`, background: "var(--surface-overlay)" }} />}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ Intelligence Alerts (AI-powered) ═══ */}
      {isVisible("intelligence_alerts") && aiAlerts.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: T.slate, letterSpacing: "0.12em", textTransform: "uppercase" }}>Alertas de Inteligência</span>
              {aiCritical > 0 && <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 4, color: "#F87171", background: "rgba(248,113,113,0.12)" }}>{aiCritical} CRÍTICO{aiCritical !== 1 ? "S" : ""}</span>}
              {aiWarning > 0 && <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 4, color: "#D97706", background: "rgba(217,119,6,0.12)" }}>{aiWarning} ATENÇÃO</span>}
            </div>
            {["owner", "director"].includes(role || "") && (
              <button type="button" onClick={() => void generateAlerts()} disabled={generatingAlerts} style={{ fontFamily: MONO, fontSize: 9, padding: "3px 10px", borderRadius: 6, border: `1px solid ${T.stone}`, background: "transparent", color: T.fog, cursor: generatingAlerts ? "wait" : "pointer", letterSpacing: "0.05em" }}>
                {generatingAlerts ? "Analisando..." : "Atualizar"}
              </button>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {aiAlerts.slice(0, 8).map((alert: IntelligenceAlert) => {
              const prioColor = alert.priority === "critical" ? "#F87171" : alert.priority === "warning" ? "#D97706" : "#60A5FA";
              const link = alert.metadata?.negotiation_id ? `/negociacoes/${alert.metadata.negotiation_id}` : alert.metadata?.client_id ? `/contatos/${alert.metadata.client_id}` : null;
              return (
                <div key={alert.id} style={{ background: CARD_BG, border: CARD_BORDER, borderRadius: 10, borderLeft: `3px solid ${prioColor}`, padding: "12px 14px", transition: "opacity 0.2s" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                        <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: prioColor, letterSpacing: "0.08em", textTransform: "uppercase" }}>{alert.priority}</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: T.chalk }}>{alert.title}</span>
                      </div>
                      <div style={{ fontSize: 11, color: T.fog }}>{alert.message}</div>
                      {alert.ai_suggestion && (
                        <div style={{ marginTop: 6, padding: "6px 10px", borderRadius: 6, background: "rgba(74,222,128,0.04)", border: "1px solid rgba(74,222,128,0.08)", display: "flex", gap: 6, alignItems: "flex-start" }}>
                          <span style={{ fontSize: 10, color: T.sprout, flexShrink: 0, marginTop: 1 }}>✦</span>
                          <span style={{ fontSize: 11, color: T.bone, lineHeight: 1.5 }}>{alert.ai_suggestion}</span>
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 4, flexShrink: 0, alignItems: "center" }}>
                      {link && <button type="button" onClick={() => navigate(link)} style={{ padding: "4px 8px", borderRadius: 6, border: `1px solid ${T.stone}`, background: "transparent", color: T.fog, fontSize: 10, cursor: "pointer" }}>Ver</button>}
                      <button type="button" onClick={() => resolveAlert(alert.id)} style={{ padding: "4px 8px", borderRadius: 6, border: `1px solid ${T.stone}`, background: "transparent", color: T.slate, fontSize: 10, cursor: "pointer" }}>✓</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ 5. Chart + Alerts (2-col grid) ═══ */}
      {(isVisible("chart") || isVisible("alerts")) && (
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10, marginTop: 20 }}>
        {/* Sales chart */}
        {isVisible("chart") && isManager && role !== "administrative" && <SalesChart />}

        {/* Alerts */}
        {isVisible("alerts") && data.focus.length > 0 && (
          <div style={{ background: CARD_BG, borderRadius: 12, padding: "20px 22px", border: CARD_BORDER }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#E8E5DE", marginBottom: 2 }}>Atenção necessária</div>
            <div style={{ fontFamily: MONO, fontSize: 8.5, color: "#3D3A30", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 14 }}>{data.focus.length} ALERTA{data.focus.length !== 1 ? "S" : ""}</div>
            {data.focus.map((item) => {
              const severity = item.priority <= 2 ? "critical" : "warning";
              return (
                <div key={item.id} onClick={() => navigate(item.link)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid rgba(61,58,48,0.06)", cursor: "pointer" }}>
                  <div style={{
                    width: 3, height: 28, borderRadius: 2, flexShrink: 0,
                    background: severity === "critical" ? "#F87171" : "#D97706",
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#C4BFB3" }}>{item.title}</div>
                    <div style={{ fontSize: 9.5, color: "#3D3A30", marginTop: 1 }}>{item.sub}</div>
                  </div>
                  <span style={{ color: "#2A2822", fontSize: 14, transition: "color 100ms" }}>→</span>
                </div>
              );
            })}
          </div>
        )}

        {/* If not manager (no chart), show alerts full-width was already handled by grid */}
      </div>
      )}

      {/* ═══ 6. Negotiations ═══ */}
      {isVisible("negotiations") && <>
        <SectionLabel count={data.negotiations.length}>Negociações</SectionLabel>
        <Accordion title="Negociações ativas" count={data.negotiations.length} preview={data.negotiationsPreview} defaultOpen>
          {data.negotiations.map((n) => {
            const st = NEG_STATUS[n.status] ?? { label: n.status, color: T.fog };
            return (
              <div key={n.id} onClick={() => navigate(`/negociacoes/${n.id}`)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: `1px solid ${T.stone}`, cursor: "pointer" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: T.chalk }}>{n.clientName}</div>
                  <div style={{ fontSize: 12, color: T.fog, marginTop: 1 }}>{n.isThirdParty ? <><span style={{ fontSize: 9, fontWeight: 700, color: "#D97706", background: "rgba(217,119,6,0.08)", padding: "1px 5px", borderRadius: 3, marginRight: 4 }}>IMÓVEL</span>{n.propertyName}</> : n.unitLabel}{n.brokerName ? ` · ${n.brokerName}` : ""}</div>
                </div>
                <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, background: st.color + "18", color: st.color, fontWeight: 600, whiteSpace: "nowrap" }}>{st.label}</span>
              </div>
            );
          })}
          {data.negotiations.length === 0 && <div style={{ fontSize: 13, color: T.fog, textAlign: "center", padding: "16px 0" }}>Nenhuma negociação ativa. Inicie pelo simulador.</div>}
        </Accordion>
      </>}

      {/* ═══ 7. Contacts ═══ */}
      {isVisible("contacts") && data.contacts.length > 0 && role !== "administrative" && (
        <>
          <SectionLabel count={data.contacts.length}>Contatos recentes</SectionLabel>
          <Accordion title="Contatos" count={data.contacts.length} preview={data.contactsPreview}>
            {data.contacts.map((c) => {
              const temp = TEMP_CFG[c.temperature ?? "warm"] ?? TEMP_CFG.warm;
              return (
                <div key={c.id} onClick={() => navigate(`/contatos/${c.id}`)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: `1px solid ${T.stone}`, cursor: "pointer" }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: temp.color, boxShadow: c.temperature === "hot" ? `0 0 6px ${temp.color}40` : "none", flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: T.chalk }}>{c.name}</div>
                    <div style={{ fontSize: 12, color: T.fog, marginTop: 1 }}>{c.phone ?? "—"}{c.assignedToName ? ` · ${c.assignedToName}` : ""}</div>
                  </div>
                  {c.isOverdue && <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "#F8717118", color: "#F87171", fontWeight: 600 }}>Atrasado</span>}
                </div>
              );
            })}
            <div style={{ marginTop: 8 }}><button type="button" onClick={() => navigate("/contatos")} style={{ background: "none", border: "none", color: T.sprout, fontSize: 13, fontWeight: 600, cursor: "pointer", padding: 0 }}>Ver todos →</button></div>
          </Accordion>
        </>
      )}

      {/* ═══ Aniversariantes (prioridade menor para outros perfis) ═══ */}
      {isVisible("birthdays") && role !== "concierge" && <BirthdaysCard accountId={accountId} />}

      {/* ═══ 8-9. Team ═══ */}
      {(isVisible("internal_team") || isVisible("external_team")) && isManager && role !== "administrative" && (data.internalTeam.length > 0 || data.externalTeam.length > 0) && (
        <>
          {isVisible("internal_team") && data.internalTeam.length > 0 && (
            <>
              <SectionLabel count={data.internalTeam.length}>Equipe interna</SectionLabel>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : `repeat(${Math.min(data.internalTeam.length, 3)}, 1fr)`, gap: 10 }}>
                {data.internalTeam.map((m) => <TeamCard key={m.id} m={m} />)}
              </div>
            </>
          )}
          {isVisible("external_team") && data.externalTeam.length > 0 && (
            <>
              <SectionLabel count={data.externalTeam.length}>Corretores externos</SectionLabel>
              {data.externalTeam.every((m) => m.negotiations === 0 && m.activitiesWeek === 0) ? (
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: CARD_BG, border: CARD_BORDER, borderRadius: 10 }}>
                  <div style={{ display: "flex" }}>
                    {data.externalTeam.slice(0, 4).map((m, i) => (
                      <div key={m.id} style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--surface-overlay)", border: "2px solid var(--surface-base)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: T.fog, marginLeft: i > 0 ? -8 : 0, position: "relative", zIndex: 4 - i }}>
                        {m.name.charAt(0)}
                      </div>
                    ))}
                  </div>
                  <span style={{ fontSize: 12, color: T.fog }}>{data.externalTeam.length} corretor{data.externalTeam.length !== 1 ? "es" : ""} · Sem atividade recente</span>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : `repeat(${Math.min(data.externalTeam.length, 3)}, 1fr)`, gap: 10 }}>
                  {data.externalTeam.map((m) => <TeamCard key={m.id} m={m} />)}
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Footer */}
      <div style={{ marginTop: 32, paddingTop: 16, borderTop: `1px solid ${T.stone}`, fontSize: 11, color: T.slate, textAlign: "center" }}>NEXA · {development?.developmentName} · Central V7</div>

      {showSettings && (
        <CentralSettingsPanel
          visibility={visibility}
          onChange={(key, value) => void savePrefs({ ...visibility, [key]: value })}
          onReset={() => void resetDefaults()}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

// ── Daily Briefing Card ──

const ICON_MAP: Record<string, string> = { alert: "⚠", success: "✓", info: "→", warning: "!" };
const ICON_COLORS: Record<string, string> = { alert: "#F87171", success: "#4ADE80", info: "#60A5FA", warning: "#FBBF24" };
const PRIO_COLORS: Record<string, string> = { urgent: "#F87171", high: "#FBBF24", medium: "#60A5FA" };

function healthColorFor(score: number): string {
  if (score >= 80) return "#4ADE80";
  if (score >= 60) return "#FBBF24";
  if (score >= 40) return "#F97316";
  return "#F87171";
}

function briefingAgeLabel(briefingDate: string): string {
  const today = getTodayDateStringBRT();
  const d = new Date(today + "T00:00:00");
  d.setDate(d.getDate() - 1);
  const yesterday = d.toISOString().slice(0, 10);
  if (briefingDate === today) return "Hoje";
  if (briefingDate === yesterday) return "Ontem";
  return formatDateShortBRT(briefingDate);
}

function DailyBriefingCard({ accountId, developmentId }: { accountId: string; developmentId: string }) {
  const { briefing, loading, generating, error, generateBriefing } = useDailyBriefing(accountId, developmentId);
  const [expanded, setExpanded] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem("nexa_briefing_collapsed") === "true"; } catch { return false; }
  });
  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem("nexa_briefing_collapsed", String(next)); } catch { /* ignore */ }
      return next;
    });
  };

  if (loading) return null;

  if (briefing && collapsed) {
    const score = briefing.metrics.health_score ?? 0;
    const hc = healthColorFor(score);
    return (
      <div onClick={toggleCollapsed} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", cursor: "pointer", background: "var(--surface-raised)", border: `1px solid ${T.stone}`, borderRadius: 12, marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontFamily: MONO, fontSize: 9, color: T.fog, letterSpacing: "0.12em" }}>ANÁLISE DA OPERAÇÃO</div>
          <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4, color: hc, background: `${hc}15` }}>
            {score}/100
          </div>
        </div>
        <span style={{ color: T.fog, fontSize: 14 }}>▾</span>
      </div>
    );
  }

  if (!briefing) {
    return (
      <div style={{ padding: 20, borderRadius: 12, border: `1px dashed ${T.stone}`, textAlign: "center", marginBottom: 20, background: "var(--surface-raised)" }}>
        <div style={{ fontFamily: MONO, fontSize: 9, color: T.fog, letterSpacing: "0.12em", marginBottom: 10 }}>MOTOR DE INTELIGÊNCIA</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: T.chalk, marginBottom: 6 }}>Análise inteligente da sua operação</div>
        <div style={{ fontSize: 12, color: T.bone, lineHeight: 1.6, maxWidth: 420, margin: "0 auto 16px" }}>
          A IA analisa negociações paradas, oportunidades, atividade da equipe e gera ações recomendadas priorizadas para o seu dia.
        </div>
        <button type="button" onClick={() => void generateBriefing()} disabled={generating} style={{ padding: "10px 24px", borderRadius: 8, background: generating ? T.stone : "var(--interactive-primary)", color: generating ? T.fog : "var(--interactive-on-primary)", fontWeight: 700, fontSize: 13, border: "none", cursor: generating ? "wait" : "pointer", transition: "all 150ms ease" }}>
          {generating ? "Analisando operação..." : "Gerar análise do dia"}
        </button>
        {error && <div style={{ fontSize: 12, color: "#F87171", marginTop: 10 }}>{error}</div>}
      </div>
    );
  }

  const score = briefing.metrics.health_score ?? 0;
  const hc = healthColorFor(score);
  const ageLabel = briefingAgeLabel(briefing.briefing_date);
  const fresh = briefingFreshness(briefing.created_at, Date.now());
  const topActions = briefing.actions.slice(0, 2);
  const restActions = briefing.actions.slice(2);

  return (
    <div style={{ padding: 20, borderRadius: 12, marginBottom: 20, background: "var(--surface-raised)", border: `1px solid ${T.stone}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, gap: 12 }}>
        <div>
          <div style={{ fontFamily: MONO, fontSize: 9, color: T.fog, letterSpacing: "0.12em" }}>ANÁLISE DA OPERAÇÃO</div>
          <div style={{ fontFamily: MONO, fontSize: 10, color: T.slate, marginTop: 3 }}>gerado {fresh.relative} · {ageLabel} {formatTimeBRT(briefing.created_at)}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {!fresh.isStale && (
            <div style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 8, color: hc, background: `${hc}15`, border: `1px solid ${hc}30` }}>
              {score}/100
            </div>
          )}
          <button type="button" onClick={() => void generateBriefing()} disabled={generating} style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${T.stone}`, background: "transparent", color: T.fog, fontSize: 10, cursor: generating ? "wait" : "pointer" }}>
            {generating ? "..." : "Atualizar"}
          </button>
          <button type="button" onClick={toggleCollapsed} style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${T.stone}`, background: "transparent", color: T.fog, fontSize: 10, cursor: "pointer" }}>
            Minimizar
          </button>
        </div>
      </div>

      {fresh.isStale ? (
        // Honestidade: acima de 48h não renderiza o conteúdo velho.
        <div style={{ padding: "14px 16px", borderRadius: 8, border: `1px solid ${T.stone}`, background: "var(--surface-overlay)" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: T.bone }}>Briefing desatualizado</div>
          <div style={{ fontSize: 12, color: T.fog, marginTop: 4 }}>
            Última geração {ageLabel} ({formatDateShortBRT(briefing.briefing_date)}). Gere uma nova análise para ver o panorama atual da operação.
          </div>
        </div>
      ) : (
      <>
      <div style={{ fontSize: 13, color: T.bone, lineHeight: 1.6, marginBottom: 16 }}>{briefing.summary}</div>

      {briefing.highlights.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          {briefing.highlights.slice(0, 4).map((h: BriefingHighlight, i: number) => (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 6 }}>
              <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: (h.icon && ICON_COLORS[h.icon]) || T.fog, width: 16, textAlign: "center", flexShrink: 0, marginTop: 2 }}>{(h.icon && ICON_MAP[h.icon]) || "·"}</span>
              <span style={{ fontSize: 12, color: T.bone, lineHeight: 1.5 }}>{h.title ?? h.text ?? ""}</span>
            </div>
          ))}
        </div>
      )}

      {topActions.length > 0 && (
        <>
          <div style={{ fontFamily: MONO, fontSize: 9, color: T.fog, letterSpacing: "0.1em", marginBottom: 8 }}>AÇÕES PRIORITÁRIAS</div>
          {topActions.map((a: BriefingAction, i: number) => (
            <div key={i} style={{ padding: "10px 12px", marginBottom: 6, background: "var(--surface-overlay)", borderRadius: 8, borderLeft: `3px solid ${PRIO_COLORS[a.priority] || T.fog}` }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: T.chalk }}>{a.action}</div>
              <div style={{ fontSize: 10, color: T.fog, marginTop: 3 }}>{a.reason}</div>
            </div>
          ))}
          {restActions.length > 0 && (
            <button type="button" onClick={() => setExpanded(!expanded)} style={{ background: "none", border: "none", color: T.sprout, fontSize: 11, fontWeight: 600, cursor: "pointer", marginTop: 4, fontFamily: MONO, letterSpacing: "0.05em", padding: 0 }}>
              {expanded ? "Mostrar menos" : `+ ${restActions.length} ações`}
            </button>
          )}
          {expanded && restActions.map((a: BriefingAction, i: number) => (
            <div key={i} style={{ padding: "10px 12px", marginBottom: 6, marginTop: i === 0 ? 8 : 0, background: "var(--surface-overlay)", borderRadius: 8, borderLeft: `3px solid ${PRIO_COLORS[a.priority] || T.fog}` }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: T.chalk }}>{a.action}</div>
              <div style={{ fontSize: 10, color: T.fog, marginTop: 3 }}>{a.reason}</div>
            </div>
          ))}
        </>
      )}
      </>
      )}

      {error && <div style={{ fontSize: 11, color: "#F87171", marginTop: 10 }}>{error}</div>}
    </div>
  );
}
