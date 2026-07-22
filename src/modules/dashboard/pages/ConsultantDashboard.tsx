import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../app/contexts/AuthContext";
import { useAccount } from "../../../app/contexts/AccountContext";
import { useDevelopment } from "../../../app/contexts/DevelopmentContext";
import { useScreen } from "../../../shared/hooks/useIsMobile";
import { supabase } from "../../../infra/supabase/supabaseClient";
import { getNegotiationStatusLabel } from "../../../domain/negociacao/NegotiationStatusLabel";
import type { NegotiationStatus } from "../../../domain/negociacao/NegotiationStatus";
import NexaBadge from "../../../shared/components/NexaBadge";
import { formatDateShortBRT, formatMonthYearBRT, formatWeekdayLongBRT } from "../../../shared/utils/dateUtils";

// ── Activities Mini Widget for Consultant Dashboard ──

function ConsultantActivitiesWidget({ accountId, userId }: { accountId: string; userId: string }) {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ today: 0, week: 0, hours: 0 });
  const [streak, setStreak] = useState(0);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase || !accountId || !userId) return;
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
      const monthStart = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-01`;
      const { data: acts } = await supabase.from("activities").select("activity_date, duration_minutes, next_action, next_action_date").eq("profile_id", userId).eq("account_id", accountId).gte("activity_date", monthStart).order("activity_date", { ascending: false });
      if (!acts) return;
      const todayCount = acts.filter((a: Record<string, unknown>) => a.activity_date === today).length;
      const weekCount = acts.filter((a: Record<string, unknown>) => (a.activity_date as string) >= weekAgo).length;
      const totalMinutes = acts.reduce((s: number, a: Record<string, unknown>) => s + ((a.duration_minutes as number) || 0), 0);
      setStats({ today: todayCount, week: weekCount, hours: totalMinutes / 60 });
      // Streak
      const dates = [...new Set(acts.map((a: Record<string, unknown>) => a.activity_date as string))].sort().reverse();
      const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
      let s = 0;
      if (dates.length > 0 && (dates[0] === today || dates[0] === yesterday)) {
        const check = new Date(dates[0] + "T12:00:00");
        for (const d of dates) { if (d === check.toISOString().slice(0, 10)) { s++; check.setDate(check.getDate() - 1); } else break; }
      }
      setStreak(s);
      // Pending
      const pending = acts.find((a: Record<string, unknown>) => a.next_action && a.next_action_date && (a.next_action_date as string) <= today);
      setPendingAction(pending ? (pending as Record<string, unknown>).next_action as string : null);
    })();
  }, [accountId, userId]);

  return (
    <div style={{ background: "var(--color-carbon)", border: "1px solid var(--color-stone)", borderRadius: 12, padding: 20, height: "100%", marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--color-fog)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Minhas atividades</div>
        <span onClick={() => navigate("/atividades")} style={{ fontSize: 11, color: "var(--color-sprout)", cursor: "pointer" }}>Ver todas →</span>
      </div>
      <div style={{ fontSize: 13, color: "var(--color-bone)", marginBottom: 8 }}>
        <span style={{ fontWeight: 600, color: "var(--color-chalk)", fontSize: 20 }}>{stats.today}</span>
        <span style={{ color: "var(--color-fog)" }}> hoje</span>
        <span style={{ color: "var(--color-stone)", margin: "0 8px" }}>·</span>
        <span style={{ fontWeight: 600, color: "var(--color-chalk)" }}>{stats.week}</span>
        <span style={{ color: "var(--color-fog)" }}> esta semana</span>
        {stats.hours > 0 && (<><span style={{ color: "var(--color-stone)", margin: "0 8px" }}>·</span><span style={{ fontWeight: 600, color: "var(--color-chalk)" }}>{stats.hours.toFixed(1)}h</span><span style={{ color: "var(--color-fog)" }}> em campo</span></>)}
      </div>
      {streak > 0 && <div style={{ fontSize: 12, color: streak >= 5 ? "#F97316" : "#4ADE80", marginBottom: 6 }}>● {streak} {streak === 1 ? "dia consecutivo" : "dias consecutivos"}</div>}
      {pendingAction && <div style={{ fontSize: 12, color: "#F97316", marginTop: 4 }}>● Pendente: {pendingAction}</div>}
    </div>
  );
}

// ── Types ──

interface ConsultantMetrics {
  negotiationsActive: number;
  proposalsOpen: number;
  reservationsActive: number;
  salesThisMonth: number;
  availableUnits: number;
  totalUnits: number;
  funnel: { negotiation: number; proposal: number; reservation: number; sale: number };
  alerts: { expiredReservations: number; expiringSoon: number; staleNegotiations: number };
  recentNegotiations: RecentNeg[];
}

interface RecentNeg {
  id: string;
  clientName: string | null;
  quadra: string | null;
  lote: string | null;
  brokerName: string | null;
  status: string;
  createdAt: string;
}

// ── Styles ──

const CARD: React.CSSProperties = { background: "var(--color-carbon)", border: "1px solid var(--color-stone)", borderRadius: 12, padding: 20, height: "100%", overflow: "hidden", minWidth: 0 };
const TITLE: React.CSSProperties = { fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--color-fog)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 };
const KPI: React.CSSProperties = { fontSize: 28, fontWeight: 800, color: "var(--color-bone)" };

function fmtDate(d: string) { return formatDateShortBRT(d); }

function Bar({ label, value, max, color = "var(--color-sprout)" }: { label: string; value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: "var(--color-dust)" }}>{label}</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600, color: "var(--color-bone)" }}>{value}</span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: "var(--color-stone)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, opacity: 0.5, borderRadius: 3, transition: "width 300ms" }} />
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--color-stone)" }}>
      <span style={{ fontSize: 12, color: "var(--color-fog)" }}>{label}</span>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600, color: "var(--color-bone)" }}>{value}</span>
    </div>
  );
}

// ── Data hook ──

function useConsultantDashboard(accountId: string | null, developmentId: string | null, ownerProfileId: string | null) {
  const [metrics, setMetrics] = useState<ConsultantMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase || !accountId || !developmentId) { setLoading(false); return; }
    setLoading(true); setError(null);

    try {
      // 1. Consultant's own negotiations (filtered by owner_profile_id)
      let negQuery = supabase
        .from("negotiations")
        .select("id, status, created_at, updated_at, unit_id, client_id, broker_id, clients ( name ), units ( quadra, lote ), brokers ( name )")
        .eq("account_id", accountId)
        .eq("development_id", developmentId);
      if (ownerProfileId) negQuery = negQuery.eq("owner_profile_id", ownerProfileId);
      const { data: negs, error: negErr } = await negQuery.order("created_at", { ascending: false });
      if (negErr) throw new Error(negErr.message);

      const allNegs = negs ?? [];
      const activeNegs = allNegs.filter((n: Record<string, unknown>) => {
        const s = ((n.status as string) ?? "").toUpperCase();
        return s === "OPEN" || s === "IN_PROGRESS";
      });

      // 2. Proposals for consultant's negotiations
      const negIds = allNegs.map((n: Record<string, unknown>) => n.id as string);
      let openProposalsCount = 0;
      if (negIds.length > 0) {
        const { data: proposals } = await supabase.from("proposals").select("id, status").in("negotiation_id", negIds);
        openProposalsCount = (proposals ?? []).filter((p: Record<string, unknown>) => {
          const s = ((p.status as string) ?? "").toUpperCase();
          return s === "SENT" || s === "UNDER_ANALYSIS" || s === "DRAFT";
        }).length;
      }

      // 3. Reservations for consultant's negotiations
      let activeReservationsCount = 0;
      let expiredReservationsCount = 0;
      let expiringSoonCount = 0;
      const now = Date.now();
      const threeDays = 3 * 86400000;
      if (negIds.length > 0) {
        const { data: reservations } = await supabase.from("reservations").select("id, status, expires_at").in("negotiation_id", negIds);
        const allRes = reservations ?? [];
        activeReservationsCount = allRes.filter((r: Record<string, unknown>) => { const s = ((r.status as string) ?? "").toUpperCase(); return s === "ACTIVE" || s === "APPROVED"; }).length;
        expiredReservationsCount = allRes.filter((r: Record<string, unknown>) => ((r.status as string) ?? "").toUpperCase() === "EXPIRED").length;
        expiringSoonCount = allRes.filter((r: Record<string, unknown>) => { const s = ((r.status as string) ?? "").toUpperCase(); if (s !== "ACTIVE" && s !== "APPROVED") return false; const exp = new Date(r.expires_at as string).getTime(); return exp >= now && exp <= now + threeDays; }).length;
      }

      // 4. Sales for consultant's negotiations this month
      let salesThisMonth = 0;
      if (negIds.length > 0) {
        const monthStart = new Date();
        monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
        const { data: sales } = await supabase.from("sales").select("id, status, created_at").in("negotiation_id", negIds).eq("status", "concluida").gte("created_at", monthStart.toISOString());
        salesThisMonth = (sales ?? []).length;
      }

      // 5. Stale negotiations (no activity > 7 days)
      const sevenDaysAgo = new Date(now - 7 * 86400000).toISOString();
      const staleNegs = activeNegs.filter((n: Record<string, unknown>) => {
        const updated = n.updated_at as string | undefined;
        return updated ? new Date(updated).toISOString() < sevenDaysAgo : false;
      });

      // 6. Funnel
      const wonNegs = allNegs.filter((n: Record<string, unknown>) => ((n.status as string) ?? "").toUpperCase() === "WON");

      // 7. Available units
      const { count: availableUnits } = await supabase.from("units").select("id", { count: "exact", head: true }).eq("development_id", developmentId).eq("status", "available");
      const { count: totalUnits } = await supabase.from("units").select("id", { count: "exact", head: true }).eq("development_id", developmentId);

      // 8. Recent negotiations
      const recentNegotiations: RecentNeg[] = allNegs.slice(0, 5).map((n: Record<string, unknown>) => {
        const client = Array.isArray(n.clients) ? n.clients[0] : n.clients;
        const unit = Array.isArray(n.units) ? n.units[0] : n.units;
        const broker = Array.isArray(n.brokers) ? n.brokers[0] : n.brokers;
        return {
          id: n.id as string,
          clientName: (client as Record<string, unknown>)?.name as string | null ?? null,
          quadra: (unit as Record<string, unknown>)?.quadra as string | null ?? null,
          lote: (unit as Record<string, unknown>)?.lote as string | null ?? null,
          brokerName: (broker as Record<string, unknown>)?.name as string | null ?? null,
          status: (n.status as string) ?? "",
          createdAt: n.created_at as string,
        };
      });

      setMetrics({
        negotiationsActive: activeNegs.length,
        proposalsOpen: openProposalsCount,
        reservationsActive: activeReservationsCount,
        salesThisMonth,
        availableUnits: availableUnits ?? 0,
        totalUnits: totalUnits ?? 0,
        funnel: {
          negotiation: activeNegs.length,
          proposal: openProposalsCount,
          reservation: activeReservationsCount,
          sale: wonNegs.length,
        },
        alerts: {
          expiredReservations: expiredReservationsCount,
          expiringSoon: expiringSoonCount,
          staleNegotiations: staleNegs.length,
        },
        recentNegotiations,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar dados.");
    } finally {
      setLoading(false);
    }
  }, [accountId, developmentId, ownerProfileId]);

  useEffect(() => { void load(); }, [load]);
  return { metrics, loading, error };
}

// ── Component ──

export default function ConsultantDashboard() {
  const navigate = useNavigate();
  const { authenticatedProfile } = useAuth();
  const { account, ownerProfileId } = useAccount();
  const { development } = useDevelopment();
  const { isMobile } = useScreen();

  const accountId = account?.accountId ?? null;
  const developmentId = development?.developmentId ?? null;
  const userId = authenticatedProfile?.id ?? null;
  const nome = authenticatedProfile?.fullName ?? "voce";

  const { metrics, loading, error } = useConsultantDashboard(accountId, developmentId, ownerProfileId);

  const saudacao = useMemo(() => {
    const h = new Date().getHours();
    const f = nome.split(" ")[0];
    return h < 12 ? `Bom dia, ${f}` : h < 18 ? `Boa tarde, ${f}` : `Boa noite, ${f}`;
  }, [nome]);

  const mesAtual = formatMonthYearBRT();

  if (loading) {
    return (
      <div>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-secondary)", margin: "0 0 4px" }}>{saudacao}</h1>
          <p style={{ fontSize: 12, color: "var(--text-disabled)", margin: 0, fontFamily: "var(--font-mono)" }}>Carregando...</p>
        </div>
        <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, minmax(0, 1fr))" : "repeat(4, minmax(0, 1fr))", gap: 16 }}>
          {[1, 1, 1, 1, 2, 2].map((s, i) => (
            <div key={i} style={{ gridColumn: isMobile ? "span 1" : `span ${s}`, background: "var(--color-carbon)", border: "1px solid var(--color-stone)", borderRadius: 12, height: 100, animation: "pulse 1.5s ease-in-out infinite" }} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-secondary)", margin: "0 0 4px" }}>{saudacao}</h1>
        <p style={{ color: "var(--color-red)", marginTop: 8 }}>Falha ao carregar indicadores.</p>
        <p style={{ color: "var(--color-fog)", fontSize: 12 }}>{error}</p>
      </div>
    );
  }

  const m = metrics!;
  const funnelMax = Math.max(m.funnel.negotiation, m.funnel.proposal, m.funnel.reservation, m.funnel.sale, 1);
  const hasAlerts = m.alerts.expiredReservations + m.alerts.expiringSoon + m.alerts.staleNegotiations > 0;

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-secondary)", margin: "0 0 4px" }}>{saudacao}</h1>
        <p style={{ fontSize: 12, color: "var(--text-disabled)", margin: 0, fontFamily: "var(--font-mono)" }}>
          {development?.developmentName} · {formatWeekdayLongBRT()}
        </p>
        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          <button type="button" onClick={() => navigate("/simulador")} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid var(--border-strong)", background: "transparent", color: "var(--text-muted)", fontSize: 13, cursor: "pointer" }}>Simular condição</button>
          <button type="button" onClick={() => navigate("/negociacoes")} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "var(--interactive-primary)", color: "var(--interactive-on-primary)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Ver negociações →</button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, minmax(0, 1fr))" : "repeat(4, minmax(0, 1fr))", gap: 16, marginBottom: 20 }}>
        <div style={CARD}>
          <div style={TITLE}>Minhas negociações</div>
          <div style={KPI}>{m.negotiationsActive}</div>
          <div style={{ fontSize: 11, color: "var(--color-fog)", marginTop: 4 }}>Em andamento</div>
        </div>
        <div style={CARD}>
          <div style={TITLE}>Minhas propostas</div>
          <div style={KPI}>{m.proposalsOpen}</div>
          <div style={{ fontSize: 11, color: "var(--color-fog)", marginTop: 4 }}>Aguardando resposta</div>
        </div>
        <div style={CARD}>
          <div style={TITLE}>Minhas reservas</div>
          <div style={KPI}>{m.reservationsActive}</div>
          <div style={{ fontSize: 11, color: "var(--color-fog)", marginTop: 4 }}>Reservas vigentes</div>
        </div>
        <div style={CARD}>
          <div style={TITLE}>Minhas vendas</div>
          <div style={KPI}>{m.salesThisMonth}</div>
          <div style={{ fontSize: 11, color: "var(--color-fog)", marginTop: 4, textTransform: "capitalize" }}>{mesAtual}</div>
        </div>
      </div>

      {/* Funnel + Alerts side by side */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "minmax(0, 1fr)" : "repeat(2, minmax(0, 1fr))", gap: 16, marginBottom: 20 }}>
        <div style={CARD}>
          <div style={TITLE}>Funil operacional</div>
          <Bar label="Negociação" value={m.funnel.negotiation} max={funnelMax} />
          <Bar label="Proposta" value={m.funnel.proposal} max={funnelMax} />
          <Bar label="Reserva" value={m.funnel.reservation} max={funnelMax} />
          <Bar label="Venda" value={m.funnel.sale} max={funnelMax} />
        </div>
        <div style={CARD}>
          <div style={TITLE}>Alertas operacionais</div>
          <Row label="Reservas expiradas" value={m.alerts.expiredReservations} />
          <Row label="Próximas do vencimento" value={m.alerts.expiringSoon} />
          <Row label="Negociações paradas" value={m.alerts.staleNegotiations} />
          {!hasAlerts ? <div style={{ fontSize: 12, color: "var(--color-sprout)", marginTop: 8 }}>Nenhum alerta no momento</div> : null}
        </div>
      </div>

      {/* Available units */}
      <div style={{ ...CARD, marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ lineHeight: 1 }}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4ADE80" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></div>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "var(--color-bone)" }}>{m.availableUnits} <span style={{ fontSize: 13, fontWeight: 400, color: "var(--color-fog)" }}>unidades disponíveis</span></div>
          <div style={{ fontSize: 11, color: "var(--color-fog)", marginTop: 2 }}>de {m.totalUnits} unidades no {development?.developmentName ?? "empreendimento"}</div>
        </div>
      </div>

      {/* Activities widget */}
      {accountId && userId ? <ConsultantActivitiesWidget accountId={accountId} userId={userId} /> : null}

      {/* Recent negotiations */}
      <div style={CARD}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={TITLE}>Minhas negociações recentes</div>
          {m.recentNegotiations.length > 0 ? (
            <button type="button" onClick={() => navigate("/negociacoes")} style={{ fontSize: 11, fontWeight: 600, color: "var(--color-sprout)", background: "none", border: "none", cursor: "pointer" }}>
              Ver todas nas negociações →
            </button>
          ) : null}
        </div>
        {m.recentNegotiations.length === 0 ? (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <div style={{ fontSize: 13, color: "var(--color-fog)", marginBottom: 12 }}>Nenhuma negociação na operação ainda.</div>
            <button type="button" onClick={() => navigate("/simulador")} style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "var(--color-sprout)", color: "var(--color-ink)", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              Abrir Simulador
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {m.recentNegotiations.map((n) => (
              <div
                key={n.id}
                onClick={() => navigate(`/negociacoes/${n.id}`)}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "var(--color-ink)", borderRadius: 8, border: "1px solid var(--color-stone)", cursor: "pointer" }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-bone)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {n.clientName ?? "Cliente não definido"}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--color-fog)", marginTop: 2 }}>
                    {n.quadra && n.lote ? `Q${n.quadra} L${n.lote}` : "Unidade"} · {n.brokerName ?? "Sem corretor"} · {fmtDate(n.createdAt)}
                  </div>
                </div>
                <NexaBadge entity="negotiation" status={n.status as NegotiationStatus} label={getNegotiationStatusLabel(n.status as NegotiationStatus)} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
