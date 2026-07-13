import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useDashboardMetrics } from "../hooks/useDashboardMetrics";
import { useDashboardConfig } from "../hooks/useDashboardConfig";
import { useAuth } from "../../../app/contexts/AuthContext";
import { useAccount } from "../../../app/contexts/AccountContext";
import { useScreen } from "../../../shared/hooks/useIsMobile";
import { getWidgetsPermitidos } from "../config/widgets";
import { renderWidget, getSpan } from "../widgets/DashboardWidgets";
import { supabase } from "../../../infra/supabase/supabaseClient";
import { timeAgo } from "../../../shared/utils/timeAgo";
import BrokerDashboard from "./BrokerDashboard";
import ConsultantDashboard from "./ConsultantDashboard";
import { formatWeekdayLongBRT } from "../../../shared/utils/dateUtils";
import { NexaModal } from "../../../shared/ui/NexaModal";

export default function DashboardPage() {
  const { isBroker, account } = useAccount();
  if (isBroker) return <BrokerDashboard />;
  if (account?.role === "commercial_consultant") return <ConsultantDashboard />;
  const navigate = useNavigate();
  const { authenticatedProfile } = useAuth();
  const screen = useScreen();
  const isMobile = screen.isMobile;
  const { accountContext, developmentContext, errorMessage, isLoading: isLoadingMetrics, metrics, status } = useDashboardMetrics();

  const userId = authenticatedProfile?.id ?? null;
  const accountId = accountContext.account?.accountId ?? null;
  const developmentId = developmentContext.development?.developmentId ?? null;
  const role = authenticatedProfile?.role ?? null;
  const nome = authenticatedProfile?.fullName ?? "voce";

  const { widgetsAtivos, isLoading: isLoadingConfig, toggleWidget, resetarPadrao } = useDashboardConfig(userId, accountId, developmentId, role);
  const [modalAberto, setModalAberto] = useState(false);

  // Team ranking + activity
  const [ranking, setRanking] = useState<{ name: string; sims: number; negs: number; props: number }[]>([]);
  const [activity, setActivity] = useState<{ id: string; type: string; brokerName: string | null; unit: string; clientName: string | null; createdAt: string }[]>([]);
  const loadTeamData = useCallback(async () => {
    if (!supabase || !accountId) return;
    try {
      // Ranking
      const { data: rawBrokerList } = await supabase.from("brokers").select("id, name").eq("account_id", accountId).eq("status", "active").eq("approval_status", "approved");
      // Deduplicate by name
      const seen = new Set<string>();
      const brokerList = (rawBrokerList ?? []).filter((b: Record<string, unknown>) => { const n = b.name as string; if (seen.has(n)) return false; seen.add(n); return true; });
      if (brokerList.length > 0) {
        const rows = await Promise.all(brokerList.map(async (b: Record<string, unknown>) => {
          const [s, n, p] = await Promise.all([
            supabase!.from("pipeline_simulations").select("id", { count: "exact", head: true }).eq("broker_id", b.id).eq("account_id", accountId),
            supabase!.from("negotiations").select("id", { count: "exact", head: true }).eq("broker_id", b.id).eq("account_id", accountId),
            supabase!.from("proposals").select("id", { count: "exact", head: true }).eq("broker_id", b.id).eq("account_id", accountId),
          ]);
          return { name: b.name as string, sims: s.count ?? 0, negs: n.count ?? 0, props: p.count ?? 0 };
        }));
        rows.sort((a, b) => b.negs - a.negs || b.sims - a.sims);
        setRanking(rows);
      }
      // Activity
      const [sRes, nRes] = await Promise.all([
        supabase.from("pipeline_simulations").select("id, created_at, brokers(name), units(quadra, lote), clients(name)").eq("account_id", accountId).order("created_at", { ascending: false }).limit(5),
        supabase.from("negotiations").select("id, created_at, brokers(name), units(quadra, lote), clients(name)").eq("account_id", accountId).order("created_at", { ascending: false }).limit(5),
      ]);
      const acts = [
        ...(sRes.data ?? []).map((s: Record<string, unknown>) => ({ id: s.id as string, type: "simulation", brokerName: ((Array.isArray(s.brokers) ? s.brokers[0] : s.brokers) as Record<string, unknown>)?.name as string | null ?? null, unit: `Q${((Array.isArray(s.units) ? s.units[0] : s.units) as Record<string, unknown>)?.quadra ?? "?"} L${((Array.isArray(s.units) ? s.units[0] : s.units) as Record<string, unknown>)?.lote ?? "?"}`, clientName: ((Array.isArray(s.clients) ? s.clients[0] : s.clients) as Record<string, unknown>)?.name as string | null ?? null, createdAt: s.created_at as string })),
        ...(nRes.data ?? []).map((n: Record<string, unknown>) => ({ id: n.id as string, type: "negotiation", brokerName: ((Array.isArray(n.brokers) ? n.brokers[0] : n.brokers) as Record<string, unknown>)?.name as string | null ?? null, unit: `Q${((Array.isArray(n.units) ? n.units[0] : n.units) as Record<string, unknown>)?.quadra ?? "?"} L${((Array.isArray(n.units) ? n.units[0] : n.units) as Record<string, unknown>)?.lote ?? "?"}`, clientName: ((Array.isArray(n.clients) ? n.clients[0] : n.clients) as Record<string, unknown>)?.name as string | null ?? null, createdAt: n.created_at as string })),
      ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 10);
      setActivity(acts);
    } catch { /* silently ignore */ }
  }, [accountId]);
  useEffect(() => { loadTeamData(); }, [loadTeamData]);

  const saudacao = useMemo(() => {
    const h = new Date().getHours();
    const f = nome.split(" ")[0];
    return h < 12 ? `Bom dia, ${f}` : h < 18 ? `Boa tarde, ${f}` : `Boa noite, ${f}`;
  }, [nome]);

  // Ações do dia — reservas vencendo + negociações paradas
  const [acoesHoje, setAcoesHoje] = useState<{ id: string; tipo: "urgente" | "atencao"; texto: string; cta: string; rota: string }[]>([]);
  const carregarAcoes = useCallback(async () => {
    if (!supabase || !accountId || !developmentId) return;
    const acoes: typeof acoesHoje = [];
    try {
      // Reservas vencendo em até 5 dias
      const { data: reservas } = await supabase
        .from("reservations")
        .select("id, expires_at")
        .eq("account_id", accountId)
        .eq("status", "ativa")
        .lt("expires_at", new Date(Date.now() + 5 * 86400000).toISOString())
        .order("expires_at")
        .limit(3);
      (reservas ?? []).forEach((r: Record<string, unknown>) => {
        const dias = Math.max(0, Math.ceil((new Date(r.expires_at as string).getTime() - Date.now()) / 86400000));
        acoes.push({ id: `res-${r.id}`, tipo: dias <= 2 ? "urgente" : "atencao", texto: `Reserva vence ${dias === 0 ? "hoje" : `em ${dias} dia${dias > 1 ? "s" : ""}`}`, cta: "Ver pipeline", rota: "/pipeline" });
      });
      // Negociações sem atividade há mais de 7 dias
      const { data: paradas } = await supabase
        .from("negotiations")
        .select("id, updated_at, clients ( name )")
        .eq("account_id", accountId)
        .eq("development_id", developmentId)
        .not("status", "in", '("WON","LOST","CANCELLED")')
        .lt("updated_at", new Date(Date.now() - 7 * 86400000).toISOString())
        .order("updated_at")
        .limit(3);
      (paradas ?? []).forEach((n: Record<string, unknown>) => {
        const dias = Math.floor((Date.now() - new Date(n.updated_at as string).getTime()) / 86400000);
        const cl = Array.isArray(n.clients) ? n.clients[0] : n.clients;
        const nome = (cl as Record<string, unknown>)?.name as string | null;
        acoes.push({ id: `neg-${n.id}`, tipo: "atencao", texto: `${nome || "Negociação"} parada há ${dias} dias`, cta: "Retomar", rota: "/pipeline" });
      });
    } catch { /* silently ignore */ }
    setAcoesHoje(acoes.slice(0, 4));
  }, [accountId, developmentId]);
  useEffect(() => { carregarAcoes(); }, [carregarAcoes]);

  const isLoading = isLoadingMetrics || isLoadingConfig;

  if (isLoading) {
    return (
      <div>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-secondary)", margin: "0 0 4px" }}>{saudacao}</h1>
          <p style={{ fontSize: 12, color: "var(--text-disabled)", margin: 0, fontFamily: "var(--font-mono)" }}>Carregando...</p>
        </div>
        <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${screen.columns}, minmax(0, 1fr))`, gap: 16 }}>
          {[4, 1, 1, 1, 1, 2, 2].map((span, i) => (
            <div key={i} style={{ gridColumn: isMobile ? "span 1" : `span ${span}`, background: "var(--color-carbon)", border: "1px solid var(--color-stone)", borderRadius: 12, height: 120, animation: "pulse 1.5s ease-in-out infinite" }} />
          ))}
        </div>
      </div>
    );
  }

  if (accountContext.status === "no_access" || accountContext.status === "error") {
    return <p style={{ color: "var(--color-fog)" }}>{accountContext.errorMessage ?? "Conta ativa indisponível."}</p>;
  }
  if (developmentContext.status === "empty" || developmentContext.status === "error") {
    return <p style={{ color: "var(--color-fog)" }}>{developmentContext.errorMessage ?? "Empreendimento ativo indisponível."}</p>;
  }
  if (status === "error") {
    return (
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-secondary)", margin: "0 0 4px" }}>{saudacao}</h1>
        <p style={{ color: "var(--color-red)", marginTop: 8 }}>Falha ao carregar indicadores.</p>
        <p style={{ color: "var(--color-fog)", fontSize: 12 }}>{errorMessage}</p>
      </div>
    );
  }
  if (!metrics) {
    return <p style={{ color: "var(--color-fog)" }}>Nenhum dado encontrado para o contexto ativo.</p>;
  }

  const gridCols = screen.columns;

  return (
    <div>
      {/* Header inteligente */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-secondary)", margin: "0 0 4px" }}>{saudacao}</h1>
        <p style={{ fontSize: 12, color: "var(--text-disabled)", margin: 0, fontFamily: "var(--font-mono)" }}>
          {developmentContext.development?.developmentName} · {formatWeekdayLongBRT()}
        </p>

        {/* Ações do dia */}
        {acoesHoje.length > 0 ? (
          <div style={{ marginTop: 16, background: "var(--surface-raised)", border: "1px solid var(--border-default)", borderRadius: 12, padding: "14px 18px" }}>
            <div style={{ fontSize: 10, color: "var(--text-disabled)", fontFamily: "var(--font-mono)", letterSpacing: "0.08em", marginBottom: 10 }}>
              {acoesHoje.length} AÇÃO{acoesHoje.length > 1 ? "ES" : ""} PARA HOJE
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {acoesHoje.map((a) => (
                <div key={a.id} onClick={() => navigate(a.rota)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", background: "var(--surface-base)", borderRadius: 8, border: "1px solid var(--border-default)", cursor: "pointer" }}>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", flexShrink: 0, background: a.tipo === "urgente" ? "#F87171" : "#FBBF24", animation: a.tipo === "urgente" ? "dotpulse 1.5s infinite" : "none" }} />
                  <span style={{ flex: 1, fontSize: 13, color: "var(--text-secondary)" }}>{a.texto}</span>
                  <button type="button" onClick={(e) => { e.stopPropagation(); navigate(a.rota); }} style={{ fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 6, border: "1px solid var(--border-strong)", background: "transparent", color: "var(--text-muted)", cursor: "pointer", whiteSpace: "nowrap" }}>{a.cta}</button>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Atalhos rápidos */}
        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          <button type="button" onClick={() => navigate("/simulador")} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid var(--border-strong)", background: "transparent", color: "var(--text-muted)", fontSize: 13, cursor: "pointer" }}>Simular condição</button>
          <button type="button" onClick={() => navigate("/pipeline")} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "var(--interactive-primary)", color: "var(--interactive-on-primary)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Ver pipeline →</button>
          <button type="button" onClick={() => setModalAberto(true)} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid var(--border-strong)", background: "transparent", color: "var(--text-disabled)", fontSize: 13, cursor: "pointer" }}>Personalizar</button>
        </div>
      </div>

      {/* Widget Grid */}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`, gap: 16 }}>
        {widgetsAtivos.map((wid) => (
          <div key={wid} style={{ gridColumn: `span ${getSpan(wid, isMobile)}` }}>
            {renderWidget(wid, metrics)}
          </div>
        ))}
      </div>

      {widgetsAtivos.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, color: "var(--color-fog)" }}>
          <div style={{ fontSize: 14, marginBottom: 8 }}>Nenhum widget ativo</div>
          <button type="button" onClick={() => setModalAberto(true)}
            style={{ background: "var(--color-sprout)", color: "var(--color-ink)", border: "none", borderRadius: 8, padding: "8px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            Personalizar dashboard
          </button>
        </div>
      ) : null}

      {/* Team Ranking */}
      {ranking.length > 0 && widgetsAtivos.includes("performance_time") ? (
        <div style={{ background: "var(--color-carbon)", border: "1px solid var(--color-stone)", borderRadius: 12, padding: 20, marginTop: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--color-fog)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 14 }}>Performance do time</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--color-stone)" }}>
                  {["Corretor", "Simulações", "Negociações", "Propostas"].map((h) => (
                    <th key={h} style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--color-fog)", letterSpacing: "0.06em", textTransform: "uppercase", textAlign: h === "Corretor" ? "left" : "center", padding: "6px 10px", fontWeight: 400 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ranking.map((r) => {
                  const total = r.sims + r.negs + r.props;
                  return (
                    <tr key={r.name} style={{ borderBottom: "1px solid var(--color-stone)", opacity: total === 0 ? 0.4 : 1 }}>
                      <td style={{ fontSize: 13, fontWeight: 600, color: "var(--color-bone)", padding: "10px 10px" }}>{r.name}</td>
                      <td style={{ fontSize: 13, fontFamily: "var(--font-mono)", color: "var(--color-bone)", textAlign: "center", padding: "10px 10px" }}>{r.sims}</td>
                      <td style={{ fontSize: 13, fontFamily: "var(--font-mono)", color: "var(--color-bone)", textAlign: "center", padding: "10px 10px" }}>{r.negs}</td>
                      <td style={{ fontSize: 13, fontFamily: "var(--font-mono)", color: "var(--color-bone)", textAlign: "center", padding: "10px 10px" }}>{r.props}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {/* Recent Activity */}
      {activity.length > 0 && widgetsAtivos.includes("atividade_recente") ? (
        <div style={{ background: "var(--color-carbon)", border: "1px solid var(--color-stone)", borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--color-fog)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 14 }}>Atividade recente</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {activity.map((a) => (
              <div key={`${a.type}-${a.id}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "var(--color-ink)", borderRadius: 8, border: "1px solid var(--color-stone)" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: a.type === "simulation" ? "#9C9686" : a.type === "negotiation" ? "#4ADE80" : "#60A5FA" }} />
                <div style={{ flex: 1, fontSize: 13, color: "var(--color-bone)" }}>
                  <strong>{a.brokerName ?? "Usuário"}</strong>{" "}
                  <span style={{ color: "var(--color-fog)" }}>{a.type === "simulation" ? "salvou simulação" : a.type === "negotiation" ? "criou negociação" : "criou proposta"}</span>{" "}
                  — {a.unit}{a.clientName ? `, ${a.clientName}` : ""}
                </div>
                <span style={{ fontSize: 11, color: "var(--color-fog)", fontFamily: "var(--font-mono)", whiteSpace: "nowrap", flexShrink: 0 }}>{timeAgo(a.createdAt)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Modal */}
      {modalAberto ? (
        <NexaModal onClose={() => setModalAberto(false)}>
          <div style={{ background: "var(--color-carbon)", border: "1px solid var(--color-stone)", borderRadius: 16, padding: 32, width: "100%", maxWidth: 560, maxHeight: "80vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--color-bone)", margin: 0 }}>Personalizar Dashboard</h2>
                <p style={{ fontSize: 12, color: "var(--color-fog)", marginTop: 4 }}>Escolha as métricas que deseja visualizar</p>
              </div>
              <button type="button" onClick={() => setModalAberto(false)} style={{ background: "transparent", border: "none", color: "var(--color-fog)", fontSize: 18, cursor: "pointer", padding: 4 }}>x</button>
            </div>

            <div style={{ display: "grid", gap: 8 }}>
              {getWidgetsPermitidos(role ?? "director").map((widget) => {
                const ativo = widgetsAtivos.includes(widget.id);
                return (
                  <div key={widget.id} onClick={() => toggleWidget(widget.id)}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderRadius: 10, cursor: "pointer", background: ativo ? "rgba(74,222,128,0.08)" : "var(--color-ink)", border: `1px solid ${ativo ? "rgba(74,222,128,0.3)" : "var(--color-stone)"}`, transition: "all 0.15s" }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: ativo ? "var(--color-sprout)" : "var(--color-bone)" }}>{widget.titulo}</div>
                      <div style={{ fontSize: 11, color: "var(--color-fog)", marginTop: 2 }}>{widget.descricao}</div>
                    </div>
                    <div style={{ width: 36, height: 20, borderRadius: 10, background: ativo ? "var(--color-sprout)" : "var(--color-stone)", position: "relative", flexShrink: 0, transition: "background 0.2s" }}>
                      <div style={{ width: 14, height: 14, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: ativo ? 19 : 3, transition: "left 0.2s" }} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button type="button" onClick={resetarPadrao} style={{ background: "transparent", border: "none", color: "var(--color-fog)", fontSize: 12, cursor: "pointer", textDecoration: "underline" }}>
                Restaurar padrão do meu perfil
              </button>
              <button type="button" onClick={() => setModalAberto(false)} style={{ background: "var(--color-sprout)", color: "var(--color-ink)", border: "none", borderRadius: 8, padding: "8px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                Concluir
              </button>
            </div>
          </div>
        </NexaModal>
      ) : null}
    </div>
  );
}
