import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../app/contexts/AuthContext";
import { useAccount } from "../../../app/contexts/AccountContext";
import { useDevelopment } from "../../../app/contexts/DevelopmentContext";
import { useScreen } from "../../../shared/hooks/useIsMobile";
import { supabase } from "../../../infra/supabase/supabaseClient";
import { NegotiationStatus } from "../../../domain/negociacao/NegotiationStatus";
import { getNegotiationStatusLabel } from "../../../domain/negociacao/NegotiationStatusLabel";
import NexaBadge from "../../../shared/components/NexaBadge";
import { formatDateShortBRT, formatWeekdayLongBRT } from "../../../shared/utils/dateUtils";

// ── Types ──

interface BrokerMetrics {
  negotiationsActive: number;
  proposalsOpen: number;
  reservationsActive: number;
  commissionEstimate: number;
  commissionPct: number;
  availableUnits: number;
  totalUnits: number;
  recentNegotiations: RecentNegotiation[];
}

interface RecentNegotiation {
  id: string;
  clientName: string | null;
  quadra: string | null;
  lote: string | null;
  status: string;
  createdAt: string;
}

// ── Styles ──

const CARD: React.CSSProperties = { background: "var(--color-carbon)", border: "1px solid var(--color-stone)", borderRadius: 12, padding: 20, height: "100%", overflow: "hidden", minWidth: 0 };
const TITLE: React.CSSProperties = { fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--color-fog)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 };
const KPI: React.CSSProperties = { fontSize: 28, fontWeight: 800, color: "var(--color-bone)" };

function fmtR(v: number) { return "R$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 }); }
function fmtDate(d: string) { return formatDateShortBRT(d); }

// ── Data hook ──

function useBrokerDashboard(accountId: string | null, developmentId: string | null, brokerId: string | null) {
  const [metrics, setMetrics] = useState<BrokerMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase || !accountId || !developmentId || !brokerId) {
      setMetrics({ negotiationsActive: 0, proposalsOpen: 0, reservationsActive: 0, commissionEstimate: 0, commissionPct: 6, availableUnits: 0, totalUnits: 0, recentNegotiations: [] });
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    console.log("[NEXA] BrokerDashboard query context:", { brokerId, accountId, developmentId });

    try {
      // 1. Broker's negotiations
      const { data: negotiations, error: negErr } = await supabase
        .from("negotiations")
        .select("id, status, created_at, unit_id, client_id, clients ( name ), units ( quadra, lote, valor )")
        .eq("broker_id", brokerId)
        .eq("account_id", accountId)
        .eq("development_id", developmentId)
        .order("created_at", { ascending: false });

      if (negErr) throw new Error(negErr.message);

      const negs = negotiations ?? [];
      const activeNegs = negs.filter((n: Record<string, unknown>) => {
        const s = (n.status as string ?? "").toUpperCase();
        return s === "OPEN" || s === "IN_PROGRESS";
      });

      // 2. Proposals for broker's negotiations
      const negotiationIds = negs.map((n: Record<string, unknown>) => n.id as string);
      let proposalsOpen = 0;
      if (negotiationIds.length > 0) {
        const { data: proposals } = await supabase
          .from("proposals")
          .select("id, status")
          .in("negotiation_id", negotiationIds);
        proposalsOpen = (proposals ?? []).filter((p: Record<string, unknown>) => {
          const s = (p.status as string ?? "").toUpperCase();
          return s === "SENT" || s === "UNDER_ANALYSIS" || s === "DRAFT";
        }).length;
      }

      // 3. Reservations for broker's negotiations
      let reservationsActive = 0;
      if (negotiationIds.length > 0) {
        const { data: reservations } = await supabase
          .from("reservations")
          .select("id, status")
          .in("negotiation_id", negotiationIds);
        reservationsActive = (reservations ?? []).filter((r: Record<string, unknown>) => {
          const s = (r.status as string ?? "").toUpperCase();
          return s === "ACTIVE" || s === "APPROVED";
        }).length;
      }

      // 4. Commission rate from development_settings
      const { data: devSettings } = await supabase
        .from("development_settings")
        .select("comissao_corretor_pct")
        .eq("development_id", developmentId)
        .maybeSingle();

      const comissaoPct = Number(devSettings?.comissao_corretor_pct) || 6;

      const vgvNegs = activeNegs.reduce((sum: number, n: Record<string, unknown>) => {
        const unit = Array.isArray(n.units) ? n.units[0] : n.units;
        const valor = (unit as Record<string, unknown>)?.valor as number ?? 0;
        return sum + valor;
      }, 0);
      const commissionEstimate = vgvNegs * (comissaoPct / 100);

      // 5. Available units count (DB stores lowercase: available, reserved, sold)
      const { count: availableUnits } = await supabase
        .from("units")
        .select("id", { count: "exact", head: true })
        .eq("development_id", developmentId)
        .eq("status", "available");

      const { count: totalUnits } = await supabase
        .from("units")
        .select("id", { count: "exact", head: true })
        .eq("development_id", developmentId);

      // 6. Recent negotiations (top 5)
      const recentNegotiations: RecentNegotiation[] = negs.slice(0, 5).map((n: Record<string, unknown>) => {
        const client = Array.isArray(n.clients) ? n.clients[0] : n.clients;
        const unit = Array.isArray(n.units) ? n.units[0] : n.units;
        return {
          id: n.id as string,
          clientName: (client as Record<string, unknown>)?.name as string | null ?? null,
          quadra: (unit as Record<string, unknown>)?.quadra as string | null ?? null,
          lote: (unit as Record<string, unknown>)?.lote as string | null ?? null,
          status: (n.status as string) ?? "",
          createdAt: n.created_at as string,
        };
      });

      setMetrics({
        negotiationsActive: activeNegs.length,
        proposalsOpen,
        reservationsActive,
        commissionEstimate,
        commissionPct: comissaoPct,
        availableUnits: availableUnits ?? 0,
        totalUnits: totalUnits ?? 0,
        recentNegotiations,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar dados.");
    } finally {
      setLoading(false);
    }
  }, [accountId, developmentId, brokerId]);

  useEffect(() => { void load(); }, [load]);

  return { metrics, loading, error };
}

// ── Component ──

interface TeamBrokerRank { name: string; negs: number; sales: number }

export default function BrokerDashboard() {
  const navigate = useNavigate();
  const { authenticatedProfile } = useAuth();
  const { account, brokerId, isBrokerManager, brokerageId } = useAccount();
  const { development } = useDevelopment();
  const { isMobile } = useScreen();

  const accountId = account?.accountId ?? null;
  const developmentId = development?.developmentId ?? null;
  const nome = authenticatedProfile?.fullName ?? "voce";

  const userId = authenticatedProfile?.id ?? null;
  const { metrics, loading, error } = useBrokerDashboard(accountId, developmentId, brokerId);

  // Manager team data
  const [brokerageName, setBrokerageName] = useState("");
  const [teamMetrics, setTeamMetrics] = useState({ negsAtivas: 0, propostas: 0, vendasMes: 0 });
  const [teamRank, setTeamRank] = useState<TeamBrokerRank[]>([]);

  useEffect(() => {
    if (!isBrokerManager || !brokerageId || !supabase || !accountId) return;
    (async () => {
      // Get brokerage name
      const { data: bg } = await supabase.from("brokerages").select("nome_fantasia, name").eq("id", brokerageId).maybeSingle();
      setBrokerageName((bg?.nome_fantasia || bg?.name || "") as string);

      // Get team broker profile_ids
      const { data: teamBrs } = await supabase.from("brokers").select("id, name, profile_id").eq("brokerage_id", brokerageId).eq("account_id", accountId).eq("status", "active");
      const team = (teamBrs ?? []) as { id: string; name: string; profile_id: string | null }[];
      const profileIds = team.map((b) => b.profile_id || b.id).filter(Boolean);
      if (profileIds.length === 0) return;

      // Team negotiations
      const { data: teamNegs } = await supabase.from("negotiations").select("id, broker_id, status").in("broker_id", profileIds).eq("account_id", accountId);
      const allNegs = (teamNegs ?? []) as { id: string; broker_id: string; status: string }[];
      const activeNegs = allNegs.filter((n) => { const s = n.status.toUpperCase(); return s === "OPEN" || s === "IN_PROGRESS"; });

      // Team proposals this month
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      const negIds = allNegs.map((n) => n.id);
      let propostas = 0;
      if (negIds.length > 0) {
        const { count } = await supabase.from("proposals").select("id", { count: "exact", head: true }).in("negotiation_id", negIds).gte("created_at", monthStart);
        propostas = count ?? 0;
      }

      // Team sales this month
      const wonNegs = allNegs.filter((n) => n.status.toUpperCase() === "WON").map((n) => n.id);
      let vendasMes = 0;
      if (wonNegs.length > 0) {
        const { count: sc } = await supabase.from("sales").select("id", { count: "exact", head: true }).in("negotiation_id", wonNegs).gte("created_at", monthStart);
        vendasMes = sc ?? 0;
      }

      setTeamMetrics({ negsAtivas: activeNegs.length, propostas, vendasMes });

      // Build ranking
      const rank: TeamBrokerRank[] = team.map((b) => {
        const bId = b.profile_id || b.id;
        const bNegs = allNegs.filter((n) => n.broker_id === bId);
        const bSales = bNegs.filter((n) => n.status.toUpperCase() === "WON").length;
        return { name: b.name, negs: bNegs.length, sales: bSales };
      }).sort((a, b) => b.negs - a.negs);
      setTeamRank(rank);
    })();
  }, [isBrokerManager, brokerageId, accountId]);

  // Queue promotions
  const [promotions, setPromotions] = useState<{ id: string; unit_id: string; quadra: string; lote: string; valor: number }[]>([]);
  useEffect(() => {
    if (!supabase || !userId) return;
    supabase.from("unit_queue_entries").select("id, unit_id, units(quadra, lote, valor)").eq("requested_by", userId).eq("status", "promoted").gte("promoted_at", new Date(Date.now() - 24 * 3600000).toISOString()).then(({ data }) => {
      if (!data) return;
      setPromotions((data as Record<string, unknown>[]).map((p) => {
        const u = (Array.isArray(p.units) ? p.units[0] : p.units) as Record<string, unknown> | null;
        return { id: p.id as string, unit_id: p.unit_id as string, quadra: (u?.quadra as string) ?? "?", lote: (u?.lote as string) ?? "?", valor: (u?.valor as number) ?? 0 };
      }));
    });
  }, [userId]);
  function dismissPromotion(id: string) {
    if (!supabase) return;
    supabase.from("unit_queue_entries").update({ status: "removed", removed_at: new Date().toISOString(), removed_reason: "desistiu" }).eq("id", id).then(() => setPromotions((p) => p.filter((x) => x.id !== id)));
  }

  const saudacao = useMemo(() => {
    const h = new Date().getHours();
    const f = nome.split(" ")[0];
    return h < 12 ? `Bom dia, ${f}` : h < 18 ? `Boa tarde, ${f}` : `Boa noite, ${f}`;
  }, [nome]);

  if (loading) {
    return (
      <div>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-secondary)", margin: "0 0 4px" }}>{saudacao}</h1>
          <p style={{ fontSize: 12, color: "var(--text-disabled)", margin: 0, fontFamily: "var(--font-mono)" }}>Carregando...</p>
        </div>
        <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "minmax(0, 1fr)" : "repeat(4, minmax(0, 1fr))", gap: 16 }}>
          {[1, 1, 1, 1].map((_, i) => (
            <div key={i} style={{ background: "var(--color-carbon)", border: "1px solid var(--color-stone)", borderRadius: 12, height: 100, animation: "pulse 1.5s ease-in-out infinite" }} />
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
          <button type="button" onClick={() => navigate("/pipeline")} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "var(--interactive-primary)", color: "var(--interactive-on-primary)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Ver pipeline →</button>
        </div>
      </div>

      {/* Queue promotions */}
      {promotions.length > 0 && promotions.map((p) => (
        <div key={p.id} style={{ padding: "14px 16px", borderRadius: 10, marginBottom: 12, background: "rgba(74,222,128,0.06)", border: "1px solid rgba(74,222,128,0.2)" }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: "#4ADE80" }}>Q{p.quadra} L{p.lote} está disponível para você!</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>Você foi promovido da fila. Tem prioridade para reservar esta unidade.</div>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button type="button" onClick={() => navigate(`/simulador?unitId=${p.unit_id}`)} style={{ padding: "8px 18px", borderRadius: 8, background: "var(--interactive-primary)", color: "var(--interactive-on-primary)", fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer" }}>Simular agora</button>
            <button type="button" onClick={() => dismissPromotion(p.id)} style={{ padding: "8px 18px", borderRadius: 8, background: "transparent", color: "var(--text-muted)", fontSize: 13, border: "1px solid var(--border-default)", cursor: "pointer" }}>Desistir</button>
          </div>
        </div>
      ))}

      {/* Manager: Team section */}
      {isBrokerManager && brokerageName && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ ...CARD, marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "#D97706" }}>Minha imobiliária</div>
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--color-bone)" }}>{brokerageName}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <div><div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--color-fog)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 3 }}>Neg. equipe</div><div style={{ fontSize: 22, fontWeight: 700, color: "var(--color-bone)" }}>{teamMetrics.negsAtivas}</div></div>
              <div><div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--color-fog)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 3 }}>Propostas/mês</div><div style={{ fontSize: 22, fontWeight: 700, color: "var(--color-bone)" }}>{teamMetrics.propostas}</div></div>
              <div><div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--color-fog)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 3 }}>Vendas/mês</div><div style={{ fontSize: 22, fontWeight: 700, color: teamMetrics.vendasMes > 0 ? "#4ADE80" : "var(--color-bone)" }}>{teamMetrics.vendasMes}</div></div>
            </div>
          </div>
          {teamRank.length > 1 && (
            <div style={CARD}>
              <div style={TITLE}>Equipe</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {teamRank.map((b, i) => (
                  <div key={b.name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: i === 0 ? "rgba(74,222,128,0.04)" : "transparent", borderRadius: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: i === 0 ? "#4ADE80" : "var(--color-fog)", fontFamily: "var(--font-mono)", width: 20, textAlign: "center" }}>{i + 1}</span>
                    <span style={{ flex: 1, fontSize: 13, color: "var(--color-bone)" }}>{b.name}</span>
                    <span style={{ fontSize: 11, color: "var(--color-fog)", fontFamily: "var(--font-mono)" }}>{b.negs} neg · {b.sales} venda{b.sales !== 1 ? "s" : ""}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* KPIs — 4 columns */}
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
          <div style={TITLE}>Minha comissão estimada</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#60A5FA" }}>{fmtR(m.commissionEstimate)}</div>
          <div style={{ fontSize: 11, color: "var(--color-fog)", marginTop: 4 }}>{m.commissionPct}% sobre negociações ativas</div>
        </div>
      </div>

      {/* Available units — minimal info */}
      <div style={{ ...CARD, marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ lineHeight: 1 }}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4ADE80" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></div>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "var(--color-bone)" }}>{m.availableUnits} <span style={{ fontSize: 13, fontWeight: 400, color: "var(--color-fog)" }}>unidades disponíveis</span></div>
          <div style={{ fontSize: 11, color: "var(--color-fog)", marginTop: 2 }}>de {m.totalUnits} unidades no {development?.developmentName ?? "empreendimento"}</div>
        </div>
      </div>

      {/* Recent negotiations */}
      <div style={CARD}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={TITLE}>Minhas negociações recentes</div>
          {m.recentNegotiations.length > 0 ? (
            <button type="button" onClick={() => navigate("/pipeline")} style={{ fontSize: 11, fontWeight: 600, color: "var(--color-sprout)", background: "none", border: "none", cursor: "pointer" }}>
              Ver todas no pipeline →
            </button>
          ) : null}
        </div>
        {m.recentNegotiations.length === 0 ? (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <div style={{ fontSize: 13, color: "var(--color-fog)", marginBottom: 12 }}>
              Você ainda não tem negociações. Comece cadastrando um cliente e simulando uma condição.
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <button type="button" onClick={() => navigate("/clientes")} style={{ padding: "8px 20px", borderRadius: 8, border: "1px solid var(--color-stone)", background: "transparent", color: "var(--color-bone)", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Cadastrar cliente</button>
              <button type="button" onClick={() => navigate("/simulador")} style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "var(--color-sprout)", color: "var(--color-ink)", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Abrir Simulador</button>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {m.recentNegotiations.map((n) => (
              <div
                key={n.id}
                onClick={() => navigate(`/negociacoes/${n.id}`)}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "var(--color-ink)", borderRadius: 8, border: "1px solid var(--color-stone)", cursor: "pointer", transition: "border-color 0.15s" }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-bone)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {n.clientName ?? "Cliente não definido"}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--color-fog)", marginTop: 2 }}>
                    {n.quadra && n.lote ? `Q${n.quadra} L${n.lote}` : "Unidade"} · {fmtDate(n.createdAt)}
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
