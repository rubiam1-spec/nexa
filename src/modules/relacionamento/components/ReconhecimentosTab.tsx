import { useState, useEffect } from "react";
import { supabase } from "../../../infra/supabase/supabaseClient";
import RecognitionBannerModal from "./RecognitionBannerModal";
import { type TextConfig } from "./BannerTemplateEditorModal";

// ── Types ──

interface BannerTemplate {
  id: string;
  name: string;
  background_url: string;
  text_config: TextConfig;
}

interface RankedMember {
  brokerId: string;
  name: string;
  wins: number;
  totalNegs: number;
  rawScore: number;
  score: number;
}

interface ActivityLeader {
  profileId: string;
  name: string;
  total: number;
  byType: Record<string, number>;
}

interface RecognitionState {
  loading: boolean;
  topBroker: RankedMember | null;
  activityLeader: ActivityLeader | null;
  ranking: RankedMember[];
}

interface BannerTarget {
  name: string;
  subtitle: string;
}

interface Props {
  accountId: string;
  corPrimaria: string;
  accountLogo: string | null;
  accountName: string;
  footerText: string;
  customTemplates: BannerTemplate[];
}

// ── Constants ──

const MONO = "'JetBrains Mono', monospace";
const SERIF = "'Instrument Serif', Georgia, serif";
const SANS = "'Outfit', sans-serif";

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const ACT_LABELS: Record<string, string> = {
  visit: "visita", call: "ligação", meeting: "reunião",
  email: "email", note: "nota", whatsapp: "WhatsApp",
  task: "tarefa", proposal: "proposta", follow_up: "follow-up",
};

// ── Component ──

export default function ReconhecimentosTab({
  accountId, corPrimaria, accountLogo, accountName, footerText, customTemplates,
}: Props) {
  const [state, setState] = useState<RecognitionState>({
    loading: true, topBroker: null, activityLeader: null, ranking: [],
  });
  const [bannerTarget, setBannerTarget] = useState<BannerTarget | null>(null);

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthName = MONTH_NAMES[now.getMonth()];

  useEffect(() => {
    if (!accountId || !supabase) {
      setState((s) => ({ ...s, loading: false }));
      return;
    }
    let mounted = true;
    async function loadData() {
      setState((s) => ({ ...s, loading: true }));
      try {
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        const [negsRes, activitiesRes] = await Promise.all([
          supabase!.from("negotiations")
            .select("broker_id, status, brokers(name)")
            .eq("account_id", accountId)
            .gte("updated_at", firstDayOfMonth.toISOString()),
          supabase!.from("activities")
            .select("profile_id, type, profiles(name)")
            .eq("account_id", accountId)
            .gte("activity_date", sevenDaysAgo.toISOString().split("T")[0]),
        ]);

        if (!mounted) return;

        // ── Broker ranking from negotiations ──
        const brokerMap: Record<string, { name: string; wins: number; total: number }> = {};
        for (const neg of (negsRes.data ?? []) as any[]) {
          if (!neg.broker_id) continue;
          const bName = (neg.brokers as any)?.name ?? neg.broker_id;
          if (!brokerMap[neg.broker_id]) brokerMap[neg.broker_id] = { name: bName, wins: 0, total: 0 };
          brokerMap[neg.broker_id].total++;
          if (neg.status === "WON") brokerMap[neg.broker_id].wins++;
        }

        const rawMembers = Object.entries(brokerMap).map(([id, d]) => ({
          brokerId: id,
          name: d.name,
          wins: d.wins,
          totalNegs: d.total,
          rawScore: d.wins * 100 + d.total * 10,
          score: 0,
        }));
        const maxScore = Math.max(...rawMembers.map((m) => m.rawScore), 1);
        const ranking = rawMembers
          .map((m) => ({ ...m, score: Math.round((m.rawScore / maxScore) * 100) }))
          .sort((a, b) => b.rawScore - a.rawScore);

        // ── Activity leader ──
        const profileMap: Record<string, { name: string; total: number; byType: Record<string, number> }> = {};
        for (const act of (activitiesRes.data ?? []) as any[]) {
          if (!act.profile_id) continue;
          const pName = (act.profiles as any)?.name ?? act.profile_id;
          if (!profileMap[act.profile_id]) profileMap[act.profile_id] = { name: pName, total: 0, byType: {} };
          profileMap[act.profile_id].total++;
          const t = act.type ?? "outros";
          profileMap[act.profile_id].byType[t] = (profileMap[act.profile_id].byType[t] ?? 0) + 1;
        }
        const activitySorted = Object.values(profileMap).sort((a, b) => b.total - a.total);

        setState({
          loading: false,
          topBroker: ranking[0] ?? null,
          activityLeader: activitySorted[0] ? { profileId: Object.keys(profileMap)[0], ...activitySorted[0] } : null,
          ranking,
        });
      } catch (e) {
        console.error("Erro ao carregar reconhecimentos:", e);
        if (mounted) setState((s) => ({ ...s, loading: false }));
      }
    }
    loadData();
    return () => { mounted = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);

  const { loading, topBroker, activityLeader, ranking } = state;

  // ── Activity breakdown string ──
  function activityBreakdown(byType: Record<string, number>): string {
    return Object.entries(byType)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([type, count]) => `${count} ${ACT_LABELS[type] ?? type}`)
      .join(" · ");
  }

  // ── Empty State ──
  const EmptyCard = ({ message, hint }: { message: string; hint: string }) => (
    <div style={{ padding: "28px 20px", textAlign: "center" }}>
      <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 15, color: "var(--text-muted)", marginBottom: 8 }}>
        {message}
      </div>
      <div style={{ fontFamily: MONO, fontSize: 10, color: "var(--text-disabled)", lineHeight: 1.6, maxWidth: 260, margin: "0 auto" }}>
        {hint}
      </div>
    </div>
  );

  // ── Avatar ──
  const Avatar = ({ name, size = 48, color }: { name: string; size?: number; color: string }) => (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: `${color}18`, border: `2px solid ${color}40`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: SANS, fontSize: size * 0.38, fontWeight: 700, color,
    }}>
      {name.charAt(0).toUpperCase()}
    </div>
  );

  if (loading) {
    return (
      <div style={{ fontFamily: MONO, fontSize: 11, color: "var(--text-disabled)", padding: "32px 0", textAlign: "center" }}>
        Carregando dados...
      </div>
    );
  }

  const topSubtitle = `Corretor do Mês · ${currentMonthName} ${currentYear}`;
  const activeSubtitle = "Mais Ativo da Semana";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div>
        <div style={{ fontFamily: MONO, fontSize: 9, color: "var(--text-disabled)", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 6 }}>
          Reconhecimentos
        </div>
        <p style={{ fontFamily: SANS, fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
          Reconheça quem se destaca na sua operação.
        </p>
      </div>

      {/* ── Top cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>

        {/* Card: Corretor do Mês */}
        <div style={{
          padding: 24, background: "var(--surface-raised)",
          border: topBroker ? `1px solid ${corPrimaria}30` : "1px solid var(--border-default)",
          borderRadius: 14,
        }}>
          <div style={{ fontFamily: MONO, fontSize: 9, color: "var(--text-disabled)", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 16 }}>
            Corretor do Mês · {currentMonthName.toUpperCase()} {currentYear}
          </div>

          {topBroker ? (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
                <Avatar name={topBroker.name} size={52} color={corPrimaria} />
                <div>
                  <div style={{ fontFamily: SANS, fontSize: 17, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
                    {topBroker.name}
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 10, color: "var(--text-muted)" }}>
                    {topBroker.wins} {topBroker.wins === 1 ? "venda" : "vendas"} · {topBroker.totalNegs} {topBroker.totalNegs === 1 ? "negociação" : "negociações"}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setBannerTarget({ name: topBroker.name, subtitle: topSubtitle })}
                style={{
                  width: "100%", padding: "9px 0", borderRadius: 8,
                  background: corPrimaria, border: "none",
                  color: "#1C1B18", fontFamily: SANS, fontSize: 13, fontWeight: 700, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
                </svg>
                Gerar Banner de Reconhecimento
              </button>
            </div>
          ) : (
            <EmptyCard
              message="Nenhuma venda este mês ainda."
              hint="Quando as primeiras vendas forem registradas, o corretor destaque aparecerá aqui automaticamente."
            />
          )}
        </div>

        {/* Card: Mais Ativo da Semana */}
        <div style={{
          padding: 24, background: "var(--surface-raised)",
          border: activityLeader ? "1px solid #60A5FA30" : "1px solid var(--border-default)",
          borderRadius: 14,
        }}>
          <div style={{ fontFamily: MONO, fontSize: 9, color: "var(--text-disabled)", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 16 }}>
            Mais Ativo · Últimos 7 dias
          </div>

          {activityLeader ? (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
                <Avatar name={activityLeader.name} size={52} color="#60A5FA" />
                <div>
                  <div style={{ fontFamily: SANS, fontSize: 17, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
                    {activityLeader.name}
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 10, color: "var(--text-muted)" }}>
                    {activityLeader.total} {activityLeader.total === 1 ? "atividade" : "atividades"}
                    {activityBreakdown(activityLeader.byType) ? ` · ${activityBreakdown(activityLeader.byType)}` : ""}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setBannerTarget({ name: activityLeader.name, subtitle: activeSubtitle })}
                style={{
                  width: "100%", padding: "9px 0", borderRadius: 8,
                  background: "#60A5FA20", border: "1px solid #60A5FA40",
                  color: "#60A5FA", fontFamily: SANS, fontSize: 13, fontWeight: 700, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
                </svg>
                Gerar Banner de Reconhecimento
              </button>
            </div>
          ) : (
            <EmptyCard
              message="Nenhuma atividade esta semana."
              hint="Acompanhe a evolução da equipe aqui conforme as atividades forem registradas no NEXA."
            />
          )}
        </div>
      </div>

      {/* ── Ranking Mensal ── */}
      <div style={{
        padding: 24, background: "var(--surface-raised)",
        border: "1px solid var(--border-default)", borderRadius: 14,
      }}>
        <div style={{ fontFamily: MONO, fontSize: 9, color: "var(--text-disabled)", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 20 }}>
          Ranking · {currentMonthName.toUpperCase()} {currentYear}
        </div>

        {ranking.length === 0 ? (
          <EmptyCard
            message="Sem negociações este mês ainda."
            hint="O ranking será construído automaticamente conforme os corretores registrarem negociações e vendas."
          />
        ) : (
          <div>
            {ranking.slice(0, 10).map((member, idx) => {
              const isFirst = idx === 0;
              const rankColor = idx === 0 ? corPrimaria : idx === 1 ? "var(--text-secondary)" : idx === 2 ? "#9C9686" : "var(--text-disabled)";
              return (
                <div key={member.brokerId} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "11px 0",
                  borderBottom: idx < Math.min(ranking.length, 10) - 1 ? "1px solid var(--border-default)" : "none",
                }}>
                  {/* Position */}
                  <div style={{
                    fontFamily: MONO, fontSize: 14, fontWeight: 700,
                    minWidth: 24, textAlign: "right", color: rankColor,
                    flexShrink: 0,
                  }}>
                    {idx + 1}.
                  </div>

                  {/* Avatar */}
                  <div style={{
                    width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                    background: isFirst ? `${corPrimaria}18` : "var(--surface-base)",
                    border: isFirst ? `1.5px solid ${corPrimaria}50` : "1px solid var(--border-default)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: SANS, fontSize: 12, fontWeight: 700,
                    color: isFirst ? corPrimaria : "var(--text-muted)",
                  }}>
                    {member.name.charAt(0).toUpperCase()}
                  </div>

                  {/* Name + stats */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: SANS, fontSize: 13, fontWeight: isFirst ? 700 : 500,
                      color: "var(--text-primary)",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {member.name}
                    </div>
                    <div style={{ fontFamily: MONO, fontSize: 9, color: "var(--text-muted)", marginTop: 2 }}>
                      {member.wins} {member.wins === 1 ? "venda" : "vendas"} · {member.totalNegs} {member.totalNegs === 1 ? "negociação" : "negociações"}
                    </div>
                  </div>

                  {/* Score bar */}
                  <div style={{ width: 80, flexShrink: 0 }}>
                    <div style={{ height: 4, borderRadius: 2, background: "var(--border-default)", overflow: "hidden" }}>
                      <div style={{
                        height: "100%", borderRadius: 2,
                        background: isFirst ? corPrimaria : "var(--text-disabled)",
                        width: `${member.score}%`,
                        transition: "width 400ms ease",
                      }} />
                    </div>
                  </div>

                  {/* Banner button — first only */}
                  {isFirst && (
                    <button
                      onClick={() => setBannerTarget({ name: member.name, subtitle: topSubtitle })}
                      title="Gerar banner"
                      style={{
                        padding: "5px 8px", borderRadius: 6, border: `1px solid ${corPrimaria}40`,
                        background: `${corPrimaria}10`, color: corPrimaria,
                        cursor: "pointer", display: "flex", alignItems: "center", flexShrink: 0,
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
                      </svg>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Banner modal */}
      {bannerTarget && (
        <RecognitionBannerModal
          isOpen={!!bannerTarget}
          onClose={() => setBannerTarget(null)}
          name={bannerTarget.name}
          subtitle={bannerTarget.subtitle}
          accountLogo={accountLogo}
          accountName={accountName}
          corPrimaria={corPrimaria}
          footerText={footerText}
          customTemplates={customTemplates}
        />
      )}
    </div>
  );
}
