import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useScreen } from "../../../shared/hooks/useIsMobile";
import type { DashboardMetrics } from "../../../app/dashboard/buildDashboardMetrics";
import { UnidadeStatus } from "../../../domain/unidade/UnidadeStatus";
import { ProposalStatus } from "../../../domain/proposta/ProposalStatus";
import { WIDGETS_DISPONIVEIS, type WidgetId } from "../config/widgets";
import { supabase } from "../../../infra/supabase/supabaseClient";
import { useAccount } from "../../../app/contexts/AccountContext";

type M = DashboardMetrics;

const CARD: React.CSSProperties = { background: "var(--color-carbon)", border: "1px solid var(--color-stone)", borderRadius: 12, padding: 20, height: "100%", overflow: "hidden", minWidth: 0 };
const TITLE: React.CSSProperties = { fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--color-fog)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 };
const KPI: React.CSSProperties = { fontSize: 28, fontWeight: 800, color: "var(--color-bone)", overflowWrap: "break-word", wordBreak: "break-word" };
const KPI_S: React.CSSProperties = { fontSize: 22, fontWeight: 800, color: "var(--color-sprout)", overflowWrap: "break-word", wordBreak: "break-word" };

function fmtR(v: number) { return "R$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 }); }

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

// ── Individual Widgets ──

function WUnidadesStatus({ m }: { m: M }) {
  const { width: w } = useScreen();
  const items = [
    { label: "Disponíveis", value: m.unitsByStatus[UnidadeStatus.DISPONIVEL], color: "var(--color-sprout)" },
    { label: "Em negociação", value: m.unitsByStatus[UnidadeStatus.EM_NEGOCIACAO], color: "var(--color-terracotta)" },
    { label: "Reservadas", value: m.unitsByStatus[UnidadeStatus.RESERVADO], color: "var(--color-blue)" },
    { label: "Vendidas", value: m.unitsByStatus[UnidadeStatus.VENDIDO], color: "var(--color-purple)" },
  ];
  const total = items.reduce((s, i) => s + i.value, 0);
  return (
    <div style={CARD}>
      <div style={TITLE}>Status das Unidades</div>
      <div style={{ display: "grid", gridTemplateColumns: w < 500 ? "repeat(2, minmax(0, 1fr))" : "repeat(4, minmax(0, 1fr))", gap: w < 500 ? 8 : 12 }}>
        {items.map((i) => (
          <div key={i.label} style={{ textAlign: "center", minWidth: 0 }}>
            <div style={{ fontSize: w < 500 ? 20 : 24, fontWeight: 800, color: i.color }}>{i.value}</div>
            <div style={{ fontSize: w < 500 ? 10 : 11, color: "var(--color-fog)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{i.label}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 12, height: 8, borderRadius: 4, background: "var(--color-stone)", display: "flex", overflow: "hidden" }}>
        {items.map((i) => (
          <div key={i.label} style={{ width: total > 0 ? `${(i.value / total) * 100}%` : "25%", background: i.color, opacity: 0.6 }} />
        ))}
      </div>
    </div>
  );
}

function WVgvTotal({ m }: { m: M }) {
  return (
    <div style={CARD}>
      <div style={TITLE}>VGV Total</div>
      <div style={KPI}>{fmtR(Number(m.vgvTotal) || 0)}</div>
    </div>
  );
}

function WVgvBreakdown({ m }: { m: M }) {
  const eN = Number(m.vgv.emNegociacao) || 0;
  const rV = Number(m.vgv.reservado) || 0;
  const vD = Number(m.vgv.vendido) || 0;
  const max = Math.max(eN, rV, vD, 1);
  return (
    <div style={CARD}>
      <div style={TITLE}>VGV por Status</div>
      <div style={{ marginBottom: 10 }}><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}><span style={{ fontSize: 12, color: "var(--color-dust)" }}>Em negociação</span><span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600, color: "var(--color-bone)" }}>{fmtR(eN)}</span></div><div style={{ height: 6, borderRadius: 3, background: "var(--color-stone)", overflow: "hidden" }}><div style={{ height: "100%", width: `${max > 0 ? Math.round((eN / max) * 100) : 0}%`, background: "var(--color-terracotta)", opacity: 0.5, borderRadius: 3, transition: "width 300ms" }} /></div></div>
      <div style={{ marginBottom: 10 }}><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}><span style={{ fontSize: 12, color: "var(--color-dust)" }}>Reservado</span><span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600, color: "var(--color-bone)" }}>{fmtR(rV)}</span></div><div style={{ height: 6, borderRadius: 3, background: "var(--color-stone)", overflow: "hidden" }}><div style={{ height: "100%", width: `${max > 0 ? Math.round((rV / max) * 100) : 0}%`, background: "var(--color-blue)", opacity: 0.5, borderRadius: 3, transition: "width 300ms" }} /></div></div>
      <div style={{ marginBottom: 10 }}><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}><span style={{ fontSize: 12, color: "var(--color-dust)" }}>Vendido</span><span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600, color: "var(--color-bone)" }}>{fmtR(vD)}</span></div><div style={{ height: 6, borderRadius: 3, background: "var(--color-stone)", overflow: "hidden" }}><div style={{ height: "100%", width: `${max > 0 ? Math.round((vD / max) * 100) : 0}%`, background: "var(--color-purple)", opacity: 0.5, borderRadius: 3, transition: "width 300ms" }} /></div></div>
    </div>
  );
}

function WFunilOperacional({ m }: { m: M }) {
  const mx = Math.max(m.funnel.negotiation, m.funnel.proposal, m.funnel.reservation, m.funnel.sale, 1);
  return (
    <div style={CARD}>
      <div style={TITLE}>Funil Operacional</div>
      <Bar label="Negociação" value={m.funnel.negotiation} max={mx} />
      <Bar label="Proposta" value={m.funnel.proposal} max={mx} />
      <Bar label="Reserva" value={m.funnel.reservation} max={mx} />
      <Bar label="Venda" value={m.funnel.sale} max={mx} />
    </div>
  );
}

function WNegociacoesAtivas({ m }: { m: M }) {
  return <div style={CARD}><div style={TITLE}>Negociações Ativas</div><div style={KPI}>{m.negotiationsActive}</div></div>;
}

function WPropostasAbertas({ m }: { m: M }) {
  const abertas = (m.proposalsByStatus[ProposalStatus.SENT] ?? 0) + (m.proposalsByStatus[ProposalStatus.UNDER_ANALYSIS] ?? 0);
  return (
    <div style={CARD}>
      <div style={TITLE}>Propostas em Aberto</div>
      <div style={KPI}>{abertas}</div>
      {abertas > 0 ? <div style={{ fontSize: 11, color: "var(--color-terracotta)", marginTop: 4 }}>Aguardando ação</div> : null}
    </div>
  );
}

function WReservasAtivas({ m }: { m: M }) {
  const expiring = m.alerts.reservationsExpiringSoon.length;
  return (
    <div style={CARD}>
      <div style={TITLE}>Reservas Ativas</div>
      <div style={KPI}>{m.activeReservations}</div>
      {expiring > 0 ? <div style={{ fontSize: 11, color: "var(--color-terracotta)", marginTop: 4 }}>{expiring} próxima(s) do vencimento</div> : null}
    </div>
  );
}

function WVelocidadeVendas({ m }: { m: M }) {
  return (
    <div style={CARD}>
      <div style={TITLE}>Velocidade de Vendas</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 16 }}>
        <div><div style={KPI_S}>{m.completedSales}</div><div style={{ fontSize: 11, color: "var(--color-fog)" }}>Vendas concluídas</div></div>
        <div><div style={KPI_S}>{m.activeReservations}</div><div style={{ fontSize: 11, color: "var(--color-fog)" }}>Reservas ativas</div></div>
      </div>
    </div>
  );
}

function WRankingCorretores({ m }: { m: M }) {
  const total = m.negotiationsActive + m.activeReservations + m.completedSales;
  return (
    <div style={CARD}>
      <div style={TITLE}>Atividade Comercial</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12, marginBottom: 8 }}>
        <div><div style={{ fontSize: 22, fontWeight: 800, color: "var(--color-bone)" }}>{m.negotiationsActive}</div><div style={{ fontSize: 11, color: "var(--color-fog)" }}>Negociações</div></div>
        <div><div style={{ fontSize: 22, fontWeight: 800, color: "var(--color-bone)" }}>{m.activeReservations}</div><div style={{ fontSize: 11, color: "var(--color-fog)" }}>Reservas</div></div>
        <div><div style={{ fontSize: 22, fontWeight: 800, color: "var(--color-sprout)" }}>{m.completedSales}</div><div style={{ fontSize: 11, color: "var(--color-fog)" }}>Vendas</div></div>
      </div>
      {total === 0 ? <div style={{ fontSize: 12, color: "var(--color-fog)" }}>Nenhuma atividade comercial ativa</div> : null}
    </div>
  );
}

function WAlertasOperacionais({ m }: { m: M }) {
  return (
    <div style={CARD}>
      <div style={TITLE}>Alertas Operacionais</div>
      <Row label="Reservas expiradas" value={m.alerts.expiredReservations.length} />
      <Row label="Próximas do vencimento" value={m.alerts.reservationsExpiringSoon.length} />
      <Row label="Negociações paradas" value={m.alerts.staleNegotiations.length} />
      {m.alerts.expiredReservations.length === 0 && m.alerts.reservationsExpiringSoon.length === 0 && m.alerts.staleNegotiations.length === 0
        ? <div style={{ fontSize: 12, color: "var(--color-sprout)", marginTop: 8 }}>Nenhum alerta no momento</div>
        : null}
    </div>
  );
}

function WMinhasNegociacoes({ m }: { m: M }) {
  return <div style={CARD}><div style={TITLE}>Minhas Negociações</div><div style={KPI}>{m.negotiationsActive}</div><div style={{ fontSize: 11, color: "var(--color-fog)", marginTop: 4 }}>Negociações em andamento</div></div>;
}

function WMinhaComissao({ m }: { m: M }) {
  // Estimated — would need broker-specific data
  const estimado = (Number(m.vgv.emNegociacao) || 0) * 0.04;
  return (
    <div style={CARD}>
      <div style={TITLE}>Minha Comissão Estimada</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: "#60A5FA" }}>{fmtR(estimado)}</div>
      <div style={{ fontSize: 11, color: "var(--color-fog)", marginTop: 4 }}>4% sobre negociações ativas</div>
    </div>
  );
}

function WMinhasReservas({ m }: { m: M }) {
  return <div style={CARD}><div style={TITLE}>Minhas Reservas</div><div style={KPI}>{m.activeReservations}</div><div style={{ fontSize: 11, color: "var(--color-fog)", marginTop: 4 }}>Reservas vigentes</div></div>;
}

function WAtividadesEquipe() {
  const navigate = useNavigate();
  const { account } = useAccount();
  const accountId = account?.accountId ?? null;
  const [stats, setStats] = useState({ today: 0, week: 0 });
  const [topMembers, setTopMembers] = useState<{ name: string; count: number }[]>([]);
  const [inactiveNames, setInactiveNames] = useState<string[]>([]);

  useEffect(() => {
    if (!supabase || !accountId) return;
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
      const monthStart = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-01`;
      const threeDaysAgo = new Date(Date.now() - 3 * 864e5).toISOString().slice(0, 10);
      const { data: acts } = await supabase.from("activities").select("profile_id, activity_date, duration_minutes, profiles!activities_profile_id_fkey(name, role)").eq("account_id", accountId).gte("activity_date", monthStart);
      if (!acts) return;
      setStats({ today: acts.filter((a: Record<string, unknown>) => a.activity_date === today).length, week: acts.filter((a: Record<string, unknown>) => (a.activity_date as string) >= weekAgo).length });
      const byProfile: Record<string, { name: string; count: number }> = {};
      for (const a of acts as Record<string, unknown>[]) {
        const pid = a.profile_id as string;
        const p = a.profiles as Record<string, unknown> | null;
        if (!byProfile[pid]) byProfile[pid] = { name: (p?.name as string) || "?", count: 0 };
        byProfile[pid].count++;
      }
      setTopMembers(Object.values(byProfile).sort((a, b) => b.count - a.count).slice(0, 3));
      const { data: members } = await supabase.from("user_account_access").select("profile_id, role, profiles:profile_id(id, name)").eq("account_id", accountId);
      if (members) {
        const activeIds = new Set((acts as Record<string, unknown>[]).filter((a) => (a.activity_date as string) >= threeDaysAgo).map((a) => a.profile_id as string));
        const inactive = (members as Record<string, unknown>[]).filter((m) => { const r = m.role as string; const p = m.profiles as Record<string, unknown> | null; return (r === "commercial_consultant" || r === "manager") && p && !activeIds.has(p.id as string); }).map((m) => { const p = m.profiles as Record<string, unknown>; return p.name as string; });
        setInactiveNames(inactive);
      }
    })();
  }, [accountId]);

  return (
    <div style={CARD}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={TITLE}>Atividades da equipe</div>
        <span onClick={() => navigate("/atividades")} style={{ fontSize: 11, color: "var(--color-sprout)", cursor: "pointer" }}>Ver todas →</span>
      </div>
      <div style={{ fontSize: 13, color: "var(--color-bone)", marginBottom: 8 }}>
        <span style={{ fontWeight: 600, color: "var(--color-chalk)", fontSize: 20 }}>{stats.today}</span>
        <span style={{ color: "var(--color-fog)" }}> hoje</span>
        <span style={{ color: "var(--color-stone)", margin: "0 8px" }}>·</span>
        <span style={{ fontWeight: 600, color: "var(--color-chalk)" }}>{stats.week}</span>
        <span style={{ color: "var(--color-fog)" }}> esta semana</span>
      </div>
      {topMembers.length > 0 && (
        <div style={{ marginTop: 8 }}>
          {topMembers.map((m, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 12 }}>
              <span style={{ color: "var(--color-bone)" }}>{i + 1}. {m.name}</span>
              <span style={{ color: "var(--color-sprout)", fontFamily: "var(--font-mono)", fontWeight: 600 }}>{m.count}</span>
            </div>
          ))}
        </div>
      )}
      {inactiveNames.length > 0 && (
        <div style={{ fontSize: 11, color: "#FBBF24", marginTop: 8 }}>! {inactiveNames.join(", ")} sem atividade há 3+ dias</div>
      )}
    </div>
  );
}

// ── Render dispatcher ──

export function renderWidget(id: WidgetId, metrics: DashboardMetrics): React.ReactNode {
  switch (id) {
    case "unidades_status": return <WUnidadesStatus m={metrics} />;
    case "vgv_total": return <WVgvTotal m={metrics} />;
    case "vgv_breakdown": return <WVgvBreakdown m={metrics} />;
    case "funil_operacional": return <WFunilOperacional m={metrics} />;
    case "negociacoes_ativas": return <WNegociacoesAtivas m={metrics} />;
    case "propostas_abertas": return <WPropostasAbertas m={metrics} />;
    case "reservas_ativas": return <WReservasAtivas m={metrics} />;
    case "velocidade_vendas": return <WVelocidadeVendas m={metrics} />;
    case "ranking_corretores": return <WRankingCorretores m={metrics} />;
    case "alertas_operacionais": return <WAlertasOperacionais m={metrics} />;
    case "minhas_negociacoes": return <WMinhasNegociacoes m={metrics} />;
    case "minha_comissao": return <WMinhaComissao m={metrics} />;
    case "minhas_reservas": return <WMinhasReservas m={metrics} />;
    case "performance_time": return null; // rendered directly in DashboardPage
    case "atividade_recente": return null; // rendered directly in DashboardPage
    case "atividades_equipe": return <WAtividadesEquipe />;
    default: return null;
  }
}

export function getSpan(id: WidgetId, mobile: boolean): number {
  if (mobile) return 1;
  const sizes: Record<string, number> = { pequeno: 1, medio: 2, grande: 3, largo: 4 };
  const w = WIDGETS_DISPONIVEIS.find((x) => x.id === id);
  return sizes[w?.tamanho ?? "medio"] ?? 2;
}
