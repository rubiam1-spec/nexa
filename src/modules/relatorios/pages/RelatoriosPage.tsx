import { useState, useEffect, useMemo, useCallback } from "react";
import { useAccount } from "../../../app/contexts/AccountContext";
import { useDevelopment } from "../../../app/contexts/DevelopmentContext";
import { useScreen } from "../../../shared/hooks/useIsMobile";
import { usePermissions } from "../../../shared/hooks/usePermissions";
import { supabase } from "../../../infra/supabase/supabaseClient";
import { gerarPdfVendas, gerarPdfEquipe, gerarPdfEstoque } from "../utils/gerarPdfRelatorio";
import RelatorioIndividual from "../components/RelatorioIndividual";
import { IcRelatorios, IcClientes, IcCorretores, IcImobiliarias, IcEstoque, IcMedal } from "../../../shared/components/icons/NexaIcons";
import { NEXA_LOGO_HEADER, NEXA_LOGO_FOOTER } from "../../../shared/utils/pdfLogos";
import { formatDateBRT, formatTimeBRT } from "../../../shared/utils/dateUtils";

const T = { ink: "var(--surface-base)", carbon: "var(--surface-raised)", stone: "var(--border-default)", sprout: "var(--interactive-primary)", chalk: "var(--text-primary)", bone: "var(--text-secondary)", fog: "var(--text-muted)", slate: "var(--text-disabled)", blue: "#60A5FA", purple: "#A78BFA", amber: "#FBBF24", red: "#F87171" };
const MONO = "var(--font-mono)";
const V7_BG = "linear-gradient(168deg, rgba(34,33,28,0.5) 0%, rgba(18,17,14,0.15) 100%)";
const V7_BORDER = "1px solid rgba(61,58,48,0.08)";
function fmtM(v: number) { return v >= 1e6 ? `R$ ${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `R$ ${(v / 1e3).toFixed(0)}K` : `R$ ${v.toLocaleString("pt-BR")}`; }
function pct(n: number, d: number) { return d > 0 ? Math.round((n / d) * 100) : 0; }
function initials(name: string) { return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase(); }

function periodRange(period: string, customStart?: string, customEnd?: string) {
  const now = new Date(); const end = now.toISOString(); let start: Date;
  switch (period) { case "today": start = new Date(now.getFullYear(), now.getMonth(), now.getDate()); break; case "7d": start = new Date(Date.now() - 7 * 864e5); break; case "30d": start = new Date(Date.now() - 30 * 864e5); break; case "90d": start = new Date(Date.now() - 90 * 864e5); break; case "year": start = new Date(now.getFullYear(), 0, 1); break; case "custom": start = customStart ? new Date(customStart) : new Date(Date.now() - 30 * 864e5); return { start: start.toISOString(), end: customEnd ? new Date(customEnd + "T23:59:59").toISOString() : end }; default: start = new Date(Date.now() - 30 * 864e5); }
  return { start: start.toISOString(), end };
}

// ── Sub-components (v7) ──
function Kpi({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  const c = color || "#FAF9F6";
  return (
    <div style={{ background: V7_BG, borderRadius: 12, padding: "16px 18px", border: V7_BORDER, borderLeft: `3px solid ${c}60`, flex: 1, minWidth: 100, overflow: "hidden", position: "relative" }}>
      <div style={{ position: "absolute", top: -12, right: -12, width: 50, height: 50, borderRadius: "50%", background: c, opacity: 0.06, filter: "blur(18px)", pointerEvents: "none" }} />
      <div style={{ fontSize: 8, color: "#5C5647", textTransform: "uppercase", letterSpacing: "0.14em", fontFamily: MONO }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: c === "#FAF9F6" ? "#FAF9F6" : c, marginTop: 8, overflowWrap: "break-word", fontFamily: MONO }}>{value}</div>
      {sub && <div style={{ fontSize: 10.5, color: "#5C5647", marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function Sec({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 9, fontFamily: MONO, color: "#5C5647", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12, marginTop: 28, fontWeight: 600 }}>{children}</div>;
}

// ── Main ──
export default function RelatoriosPage() {
  const { account } = useAccount();
  const { development } = useDevelopment();
  const { can } = usePermissions();
  const screen = useScreen();
  const accountId = account?.accountId ?? null;
  const developmentId = development?.developmentId ?? null;
  const [active, setActive] = useState<"menu" | "vendas" | "equipeInterna" | "corretores" | "imobiliarias" | "estoque" | "contatos" | "negociacoes" | "individual">("menu");
  const [period, setPeriod] = useState("30d");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [loading, setLoading] = useState(false);
  const [pdfing, setPdfing] = useState(false);
  const [expandedRankMember, setExpandedRankMember] = useState<string | null>(null);

  const [units, setUnits] = useState<{ id: string; quadra: string; lote: string; valor: number; status: string; area: number }[]>([]);
  const [negotiations, setNegotiations] = useState<{ id: string; status: string; broker_id: string | null; owner_profile_id: string | null; lost_reason: string | null; created_at: string }[]>([]);
  const [proposals, setProposals] = useState<{ id: string; status: string; created_at: string }[]>([]);
  const [reservations, setReservations] = useState<{ id: string; status: string; created_at: string }[]>([]);
  const [sales, setSales] = useState<{ id: string; amount: number; unit_id: string; created_at: string; broker_name: string | null }[]>([]);
  const [team, setTeam] = useState<{ id: string; name: string }[]>([]);
  const [consultants, setConsultants] = useState<{ id: string; name: string; role: string }[]>([]);
  const [brokerList, setBrokerList] = useState<{ id: string; name: string }[]>([]);
  const [brokerages, setBrokerages] = useState<{ id: string; name: string }[]>([]);
  const [activities, setActivities] = useState<{ id: string; profile_id: string; type: string; activity_date: string; title: string; start_time: string | null; created_at: string; client_id: string | null }[]>([]);

  const fetchData = useCallback(async () => {
    if (!supabase || !accountId || !developmentId) return;
    setLoading(true);
    const { start, end } = periodRange(period, customStart, customEnd);
    try {
      const [uR, nR, pR, rR, sR, bR] = await Promise.all([
        supabase.from("units").select("id, quadra, lote, valor, status, area").eq("development_id", developmentId),
        supabase.from("negotiations").select("id, status, broker_id, owner_profile_id, lost_reason, created_at").eq("account_id", accountId).gte("created_at", start).lte("created_at", end),
        supabase.from("proposals").select("id, status, created_at").eq("account_id", accountId).gte("created_at", start).lte("created_at", end),
        supabase.from("reservations").select("id, status, created_at").eq("account_id", accountId).gte("created_at", start).lte("created_at", end),
        supabase.from("sales").select("id, amount, unit_id, created_at, brokers(name)").eq("account_id", accountId).gte("created_at", start).lte("created_at", end),
        supabase.from("brokers").select("id, name").eq("account_id", accountId).eq("status", "active").eq("approval_status", "approved"),
      ]);
      setUnits((uR.data ?? []).map((u: Record<string, unknown>) => ({ ...u, valor: Number(u.valor) || 0, area: Number(u.area) || 0 })) as typeof units);
      setNegotiations((nR.data ?? []) as typeof negotiations);
      setProposals((pR.data ?? []) as typeof proposals);
      setReservations((rR.data ?? []) as typeof reservations);
      setSales((sR.data ?? []).map((s: Record<string, unknown>) => { const b = Array.isArray(s.brokers) ? s.brokers[0] : s.brokers; return { id: s.id as string, amount: Number(s.amount) || 0, unit_id: s.unit_id as string, created_at: s.created_at as string, broker_name: (b as Record<string, unknown>)?.name as string | null ?? null }; }));
      const rawB = (bR.data ?? []) as typeof team;
      const { data: cRows } = await supabase.from("user_account_access").select("role, profiles:user_id(id, name)").eq("account_id", accountId).in("role", ["owner", "director", "manager", "commercial_consultant"]);
      const cons = (cRows ?? []).map((r: Record<string, unknown>) => { const p = r.profiles as Record<string, unknown> | null; return p ? { id: p.id as string, name: p.name as string, role: r.role as string } : null; }).filter(Boolean) as { id: string; name: string; role: string }[];
      setConsultants(cons);
      // Deduplicate brokers
      const seenB = new Set<string>();
      setBrokerList(rawB.filter((b) => { if (seenB.has(b.name)) return false; seenB.add(b.name); return true; }));
      const all = [...rawB, ...cons]; const seen = new Set<string>();
      setTeam(all.filter((b) => { if (seen.has(b.name)) return false; seen.add(b.name); return true; }));
      // Brokerages
      const { data: bgRows } = await supabase.from("brokerages").select("id, name").eq("account_id", accountId);
      setBrokerages((bgRows ?? []) as typeof brokerages);
      // Activities
      const { data: actRows } = await supabase.from("activities").select("id, profile_id, type, activity_date, title, start_time, created_at, client_id").eq("account_id", accountId).gte("activity_date", start.slice(0, 10));
      setActivities((actRows ?? []) as typeof activities);
    } catch (err) { console.error("Erro:", err); }
    finally { setLoading(false); }
  }, [accountId, developmentId, period, customStart, customEnd]);

  // O relatório individual busca seus próprios dados (hook dedicado) — não
  // depende do fetchData de equipe desta página.
  useEffect(() => { if (active !== "menu" && active !== "individual") fetchData(); }, [active, fetchData]);

  // ── Computed ──
  const byQuadra = useMemo(() => {
    const m: Record<string, { total: number; available: number; reserved: number; sold: number; vgvTotal: number; vgvSold: number; vgvAvail: number }> = {};
    for (const u of units) { if (!m[u.quadra]) m[u.quadra] = { total: 0, available: 0, reserved: 0, sold: 0, vgvTotal: 0, vgvSold: 0, vgvAvail: 0 }; m[u.quadra].total++; m[u.quadra].vgvTotal += u.valor; if (u.status === "available") { m[u.quadra].available++; m[u.quadra].vgvAvail += u.valor; } else if (u.status === "reserved") m[u.quadra].reserved++; else if (u.status === "sold") { m[u.quadra].sold++; m[u.quadra].vgvSold += u.valor; } }
    return Object.entries(m).sort(([a], [b]) => { const na = parseInt(a), nb = parseInt(b); return !isNaN(na) && !isNaN(nb) ? na - nb : a.localeCompare(b); });
  }, [units]);

  const avail = units.filter((u) => u.status === "available").length;
  const resv = units.filter((u) => u.status === "reserved").length;
  const sold = units.filter((u) => u.status === "sold").length;
  const vT = units.reduce((s, u) => s + u.valor, 0);
  const vS = units.filter((u) => u.status === "sold").reduce((s, u) => s + u.valor, 0);
  const vA = units.filter((u) => u.status === "available").reduce((s, u) => s + u.valor, 0);
  const conv = negotiations.length > 0 ? pct(sales.length, negotiations.length) : 0;

  const funnel = useMemo(() => {
    const n = negotiations.length, p = proposals.length, r = reservations.length, s = sales.length, mx = Math.max(n, 1);
    return [{ label: "Negociações", count: n, pct: 100, color: T.blue, w: "100%" }, { label: "Propostas", count: p, pct: pct(p, mx), color: T.purple, w: "78%" }, { label: "Reservas", count: r, pct: pct(r, mx), color: T.amber, w: "55%" }, { label: "Vendas", count: s, pct: pct(s, mx), color: T.sprout, w: "38%" }];
  }, [negotiations, proposals, reservations, sales]);

  const bStats = useMemo(() => team.map((b) => {
    const bN = negotiations.filter((n) => n.broker_id === b.id).length;
    const bS = sales.filter((s) => s.broker_name === b.name).length;
    const bV = sales.filter((s) => s.broker_name === b.name).reduce((sum, s) => sum + s.amount, 0);
    return { name: b.name, neg: bN, sales: bS, vgv: bV, conv: pct(bS, bN) };
  }).sort((a, b) => b.sales - a.sales || b.conv - a.conv), [team, negotiations, sales]);

  const pLabel = period === "custom" && customStart && customEnd ? `${formatDateBRT(customStart)} a ${formatDateBRT(customEnd)}` : ({ today: "Hoje", "7d": "Últimos 7 dias", "30d": "Último mês", "90d": "Últimos 3 meses", year: "Este ano" }[period] || period);

  const PERIOD_PILLS: { key: string; label: string }[] = [
    { key: "7d", label: "7 dias" },
    { key: "30d", label: "30 dias" },
    { key: "90d", label: "90 dias" },
    { key: "year", label: "Este ano" },
    { key: "custom", label: "Personalizado" },
  ];
  const Filter = () => (
    <div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        {PERIOD_PILLS.map((p) => {
          const active = period === p.key;
          return (
            <button key={p.key} type="button" onClick={() => { setPeriod(p.key); if (p.key === "custom" && !customStart) { const now = new Date(); const ago = new Date(now.getTime() - 30 * 864e5); setCustomStart(ago.toISOString().slice(0, 10)); setCustomEnd(now.toISOString().slice(0, 10)); } }} style={{ padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", border: active ? "1px solid var(--interactive-primary)" : `1px solid ${T.stone}`, background: active ? "var(--status-sprout-muted)" : "transparent", color: active ? "var(--interactive-primary)" : T.fog, transition: "all 120ms ease", fontFamily: "var(--font-sans)" }}>
              {p.label}
            </button>
          );
        })}
        {period !== "custom" && <span style={{ fontFamily: MONO, fontSize: 10, color: T.slate, marginLeft: 4 }}>{pLabel}</span>}
      </div>
      {period === "custom" && (
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end", marginTop: 10, padding: "12px 14px", background: V7_BG, border: V7_BORDER, borderRadius: 10, flexWrap: "wrap" }}>
          <div>
            <label style={{ fontFamily: MONO, fontSize: 8, color: T.fog, letterSpacing: "0.12em", textTransform: "uppercase", display: "block", marginBottom: 4 }}>DE</label>
            <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} style={{ background: "var(--surface-raised)", border: `1px solid ${T.stone}`, borderRadius: 8, padding: "8px 12px", color: "var(--text-primary)", fontSize: 13, outline: "none", fontFamily: MONO }} />
          </div>
          <span style={{ color: T.slate, fontSize: 14, paddingBottom: 8 }}>→</span>
          <div>
            <label style={{ fontFamily: MONO, fontSize: 8, color: T.fog, letterSpacing: "0.12em", textTransform: "uppercase", display: "block", marginBottom: 4 }}>ATÉ</label>
            <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} style={{ background: "var(--surface-raised)", border: `1px solid ${T.stone}`, borderRadius: 8, padding: "8px 12px", color: "var(--text-primary)", fontSize: 13, outline: "none", fontFamily: MONO }} />
          </div>
          {customStart && customEnd && <span style={{ fontFamily: MONO, fontSize: 10, color: T.fog, paddingBottom: 10 }}>{pLabel}</span>}
        </div>
      )}
    </div>
  );

  const pdfCfg = { period: pLabel, contaNome: account?.accountName || "NEXA", empreendimentoNome: development?.developmentName || "" };

  async function handlePdfVendas() { setPdfing(true); try { const qS = byQuadra.map(([q, d]) => ({ quadra: q, total: d.total, available: d.available, reserved: d.reserved, sold: d.sold, pctSold: pct(d.sold, d.total), vgvSold: d.vgvSold })); await gerarPdfVendas(pdfCfg, { sold, vgvSold: vS, avgTicket: sold > 0 ? vS / sold : 0, conversionRate: conv, funnel: funnel.map((f) => ({ label: f.label, count: f.count, pct: f.pct, color: f.color })), brokerStats: bStats, quadraStats: qS }); } finally { setPdfing(false); } }
  async function handlePdfEquipe() { setPdfing(true); try { await gerarPdfEquipe(pdfCfg, { brokerStats: bStats }); } finally { setPdfing(false); } }
  async function handlePdfEstoque() { setPdfing(true); try { const qS = byQuadra.map(([q, d]) => ({ quadra: q, total: d.total, available: d.available, reserved: d.reserved, sold: d.sold, pctSold: pct(d.sold, d.total), vgvTotal: d.vgvTotal, vgvAvailable: d.vgvAvail, vgvSold: d.vgvSold })); await gerarPdfEstoque(pdfCfg, { totalUnits: units.length, available: avail, reserved: resv, sold, vgvTotal: vT, vgvAvailable: vA, vgvSold: vS, quadraStats: qS }); } finally { setPdfing(false); } }

  const PdfBtn = ({ onClick }: { onClick: () => void }) => <button type="button" disabled={pdfing} onClick={onClick} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: T.sprout, color: T.ink, fontSize: 13, fontWeight: 600, cursor: pdfing ? "not-allowed" : "pointer", opacity: pdfing ? 0.6 : 1 }}>{pdfing ? "Gerando..." : "Gerar PDF"}</button>;

  const Back = () => <button type="button" onClick={() => setActive("menu")} style={{ background: "none", border: "none", color: T.fog, fontSize: 13, cursor: "pointer", padding: 0, marginBottom: 16 }}>← Voltar</button>;

  // ── MENU ──
  if (active === "menu") {
    // Relatórios de EQUIPE exigem can_view_team_ranking (manager/director/owner).
    // O Relatório Individual fica disponível para qualquer um com can_view_reports
    // (consultor vê só a si — o recorte por pessoa é travado no próprio componente).
    const cards = [
      { id: "individual" as const, teamOnly: false, icon: <IcClientes size={22} color={T.sprout} />, title: "Relatório Individual", desc: "Atividades e negócios por pessoa" },
      { id: "vendas" as const, teamOnly: true, icon: <IcRelatorios size={22} color={T.sprout} />, title: "Relatório de Vendas", desc: "VGV, funil e conversão por período" },
      { id: "equipeInterna" as const, teamOnly: true, icon: <IcClientes size={22} color={T.blue} />, title: "Equipe Interna", desc: "Consultoras, atividades e gestão" },
      { id: "corretores" as const, teamOnly: true, icon: <IcCorretores size={22} color={T.purple} />, title: "Corretores", desc: "Ranking, vendas e simulações" },
      { id: "imobiliarias" as const, teamOnly: true, icon: <IcImobiliarias size={22} color={T.amber} />, title: "Imobiliárias", desc: "Volume por imobiliária parceira" },
      { id: "estoque" as const, teamOnly: true, icon: <IcEstoque size={22} color={T.fog} />, title: "Estoque de Unidades", desc: "Mapa de calor e quadras" },
      { id: "negociacoes" as const, teamOnly: true, icon: <IcRelatorios size={22} color="#F97316" />, title: "Negociações", desc: "Funil, conversão, gargalos e paradas" },
      { id: "contatos" as const, teamOnly: true, icon: <IcClientes size={22} color="#F59E0B" />, title: "Contatos", desc: "Funil, origens, temperatura e performance" },
    ].filter((c) => !c.teamOnly || can("can_view_team_ranking"));
    return (
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#E8E5DE", margin: "0 0 3px" }}>Relatórios</h1>
        <div style={{ fontFamily: MONO, fontSize: 9.5, color: "#706B5F", letterSpacing: "0.05em", marginBottom: 28 }}>{development?.developmentName?.toUpperCase()} · GERADOS EM TEMPO REAL</div>
        <div style={{ display: "grid", gridTemplateColumns: screen.isMobile ? "1fr" : screen.isTablet ? "repeat(2, minmax(0, 1fr))" : "repeat(3, minmax(0, 1fr))", gap: 14 }}>
          {cards.map((c) => (
            <div key={c.id} onClick={() => setActive(c.id)} style={{ background: V7_BG, border: V7_BORDER, borderRadius: 12, padding: 22, cursor: "pointer", transition: "border-color 150ms ease, transform 150ms ease" }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(74,222,128,0.3)"; e.currentTarget.style.transform = "translateY(-1px)"; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(61,58,48,0.08)"; e.currentTarget.style.transform = "none"; }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(61,58,48,0.2)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>{c.icon}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#E8E5DE", marginBottom: 5 }}>{c.title}</div>
              <div style={{ fontSize: 12, color: "#706B5F", marginBottom: 16, lineHeight: 1.5 }}>{c.desc}</div>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#4ADE80" }}>Gerar relatório →</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── RELATÓRIO INDIVIDUAL ── (seção dedicada; busca própria via hook)
  if (active === "individual") {
    const { start, end } = periodRange(period, customStart, customEnd);
    return (
      <RelatorioIndividual
        fromDate={start.slice(0, 10)}
        toDate={end.slice(0, 10)}
        fromISO={start}
        toISO={end}
        periodoLabel={pLabel}
        filter={<Filter />}
        back={<Back />}
        isMobile={screen.isMobile}
      />
    );
  }

  if (loading) return <div style={{ maxWidth: 960, margin: "0 auto" }}><Back /><p style={{ color: T.fog, fontFamily: MONO, fontSize: 13 }}>Carregando dados...</p></div>;

  // ── VENDAS ──
  if (active === "vendas") {
    const maxBS = Math.max(...bStats.map((b) => b.sales), 1);
    return (
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <Back />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
          <div><h1 style={{ fontSize: 20, fontWeight: 700, color: "#E8E5DE", margin: 0 }}>Relatório de Vendas</h1><div style={{ fontFamily: MONO, fontSize: 9.5, color: "#706B5F", letterSpacing: "0.05em", marginTop: 4 }}>{development?.developmentName?.toUpperCase()} · {pLabel.toUpperCase()}</div></div>
          <div style={{ display: "flex", gap: 8 }}><Filter /><PdfBtn onClick={handlePdfVendas} /></div>
        </div>
        <div>
          {/* KPIs */}
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${screen.columns}, minmax(0, 1fr))`, gap: 12, marginBottom: 24 }}>
            <Kpi label="Vendas" value={sold} sub="unidades" color="#4ADE80" />
            <Kpi label="VGV Vendido" value={fmtM(vS)} color="#4ADE80" />
            <Kpi label="Ticket Médio" value={fmtM(sold > 0 ? vS / sold : 0)} color="#D97706" />
            <Kpi label="Conversão" value={`${conv}%`} sub="neg → venda" color="#60A5FA" />
          </div>
          {/* Funnel */}
          <div style={{ background: V7_BG, borderRadius: 12, padding: 20, border: V7_BORDER, marginBottom: 24 }}>
            <Sec>Funil de conversão</Sec>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              {funnel.map((f) => (
                <div key={f.label} style={{ width: f.w, background: f.color + "18", borderLeft: `3px solid ${f.color}`, borderRadius: 8, padding: "12px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", transition: "all 0.3s" }}>
                  <span style={{ color: T.chalk, fontSize: 14, fontWeight: 600 }}>{f.label}</span>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                    <span style={{ fontFamily: MONO, color: f.color, fontSize: 20, fontWeight: 700 }}>{f.count}</span>
                    <span style={{ fontFamily: MONO, color: T.slate, fontSize: 11 }}>{f.pct}%</span>
                  </div>
                </div>
              ))}
            </div>
            {negotiations.length === 0 && <div style={{ fontSize: 12, color: T.fog, marginTop: 12, textAlign: "center" }}>Nenhuma negociação no período</div>}
          </div>
          {/* Broker bars */}
          <div style={{ background: V7_BG, borderRadius: 12, padding: 20, border: V7_BORDER, marginBottom: 24 }}>
            <Sec>Vendas por corretor</Sec>
            {bStats.length === 0 ? <div style={{ fontSize: 12, color: T.fog }}>Nenhum membro ativo</div> : bStats.map((b) => (
              <div key={b.name} style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: T.stone, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: T.sprout, flexShrink: 0 }}>{initials(b.name)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ color: T.chalk, fontSize: 14, fontWeight: 600 }}>{b.name}</span>
                    <span style={{ fontFamily: MONO, color: T.fog, fontSize: 12 }}>{b.sales} vendas · {fmtM(b.vgv)}</span>
                  </div>
                  <div style={{ height: 8, borderRadius: 4, background: T.stone, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${Math.max((b.sales / maxBS) * 100, 2)}%`, background: `linear-gradient(90deg, ${T.sprout}, #22C55E)`, borderRadius: 4, transition: "width 0.5s" }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
          {/* Quadra table with mini bars */}
          <div style={{ background: V7_BG, borderRadius: 12, padding: 20, border: V7_BORDER }}>
            <Sec>Vendas por quadra</Sec>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 550 }}>
                <thead><tr style={{ borderBottom: `1px solid ${T.stone}` }}>{["Quadra", "Lotes", "Disp.", "Res.", "Vend.", "% Vendida", "VGV Vendido"].map((h) => <th key={h} style={{ textAlign: h === "Quadra" || h === "% Vendida" ? "left" : "right", padding: "8px 8px", fontSize: 10, fontFamily: MONO, color: T.fog, textTransform: "uppercase", fontWeight: 600 }}>{h}</th>)}</tr></thead>
                <tbody>
                  {byQuadra.map(([q, d]) => { const sp = pct(d.sold, d.total); const bc = sp > 70 ? T.red : sp > 30 ? T.amber : T.sprout; return (
                    <tr key={q} style={{ borderBottom: `1px solid ${T.stone}` }}>
                      <td style={{ padding: "10px 8px", fontWeight: 600, color: T.bone }}>Q{q}</td>
                      <td style={{ padding: "10px 8px", textAlign: "right", fontFamily: MONO, color: T.bone }}>{d.total}</td>
                      <td style={{ padding: "10px 8px", textAlign: "right", fontFamily: MONO, color: T.sprout }}>{d.available}</td>
                      <td style={{ padding: "10px 8px", textAlign: "right", fontFamily: MONO, color: T.blue }}>{d.reserved}</td>
                      <td style={{ padding: "10px 8px", textAlign: "right", fontFamily: MONO, color: T.fog }}>{d.sold}</td>
                      <td style={{ padding: "10px 8px" }}><div style={{ display: "flex", alignItems: "center", gap: 8 }}><div style={{ flex: 1, height: 6, borderRadius: 3, background: T.stone, overflow: "hidden" }}><div style={{ height: "100%", width: `${Math.max(sp, 2)}%`, background: bc, borderRadius: 3 }} /></div><span style={{ fontFamily: MONO, fontSize: 11, color: bc, minWidth: 32 }}>{sp}%</span></div></td>
                      <td style={{ padding: "10px 8px", textAlign: "right", fontFamily: MONO, color: T.bone }}>{fmtM(d.vgvSold)}</td>
                    </tr>); })}
                  <tr style={{ borderTop: `2px solid ${T.slate}` }}><td style={{ padding: "10px 8px", fontWeight: 700, color: T.chalk }}>Total</td><td style={{ padding: "10px 8px", textAlign: "right", fontFamily: MONO, fontWeight: 700, color: T.chalk }}>{units.length}</td><td style={{ padding: "10px 8px", textAlign: "right", fontFamily: MONO, fontWeight: 700, color: T.sprout }}>{avail}</td><td style={{ padding: "10px 8px", textAlign: "right", fontFamily: MONO, fontWeight: 700, color: T.blue }}>{resv}</td><td style={{ padding: "10px 8px", textAlign: "right", fontFamily: MONO, fontWeight: 700, color: T.fog }}>{sold}</td><td style={{ padding: "10px 8px", fontFamily: MONO, fontWeight: 700, color: T.chalk }}>{pct(sold, units.length)}%</td><td style={{ padding: "10px 8px", textAlign: "right", fontFamily: MONO, fontWeight: 700, color: T.chalk }}>{fmtM(vS)}</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── EQUIPE INTERNA ──
  if (active === "equipeInterna") {
    // Only operational team: manager + commercial_consultant (not owner/director)
    const REPORT_ROLES = ["manager", "commercial_consultant"];
    const teamForReport = (consultants as { id: string; name: string; role: string }[]).filter((c) => REPORT_ROLES.includes(c.role));
    const teamActs = activities.filter((a) => teamForReport.some((t) => t.id === a.profile_id));
    const totalVisits = teamActs.filter((a) => (a.type as string).startsWith("visit")).length;
    const totalCalls = teamActs.filter((a) => a.type === "phone_call").length;
    const totalFollowUps = teamActs.filter((a) => a.type === "follow_up").length;
    const ROLE_MAP: Record<string, string> = { owner: "Diretor", director: "Diretor", manager: "Gestor", commercial_consultant: "Consultora" };
    const TYPE_LABELS: Record<string, string> = { visit_broker: "visitas", visit_client: "visitas", visit_development: "visitas", phone_call: "ligações", follow_up: "follow-ups", meeting_internal: "reuniões", meeting_external: "reuniões", training: "treinamentos", whatsapp: "WhatsApp", email: "emails", other: "outros" };
    const SINGULAR_MAP: Record<string, string> = { visitas: "visita", "ligações": "ligação", "reuniões": "reunião", treinamentos: "treinamento", "follow-ups": "follow-up", outros: "outro", emails: "email", notas: "nota", tarefas: "tarefa" };
    const pluralize = (count: number, plural: string): string => { if (count === 1) { const s = SINGULAR_MAP[plural.toLowerCase()] || plural; return `1 ${s}`; } return `${count} ${plural}`; };
    const TYPE_SINGULAR: Record<string, string> = { visit_broker: "Visita", visit_client: "Visita", visit_development: "Visita", phone_call: "Ligação", follow_up: "Follow-up", meeting_internal: "Reunião", meeting_external: "Reunião", training: "Treinamento", whatsapp: "WhatsApp", email: "Email", other: "Outro", visitas: "Visita", "ligações": "Ligação", "reuniões": "Reunião", treinamentos: "Treinamento", "follow-ups": "Follow-up", outros: "Outro" };
    const cStats = teamForReport.map((c) => {
      const myActs = teamActs.filter((a) => a.profile_id === c.id);
      // Build full breakdown with plural/singular
      const typeCounts: Record<string, number> = {};
      myActs.forEach((a) => { const lbl = TYPE_LABELS[a.type as string] ?? (a.type as string); typeCounts[lbl] = (typeCounts[lbl] || 0) + 1; });
      const breakdownArr = Object.entries(typeCounts).sort(([, a], [, b]) => b - a).map(([label, count]) => ({ label, count }));
      const breakdown = breakdownArr.map((b) => pluralize(b.count, b.label)).join(" · ");
      return { id: c.id, name: c.name, role: ROLE_MAP[c.role] ?? c.role, activities: myActs.length, breakdown, breakdownArr, followUps: myActs.filter((a) => a.type === "follow_up").length, visits: myActs.filter((a) => (a.type as string).startsWith("visit")).length, calls: myActs.filter((a) => a.type === "phone_call").length, rawActs: myActs };
    }).sort((a, b) => b.activities - a.activities);
    const maxA = Math.max(...cStats.map((c) => c.activities), 1);
    const totalActs = teamActs.length;

    // Insight
    const topMember = cStats[0];
    const inactive = cStats.filter((c) => c.activities === 0);
    const insightParts: string[] = [];
    if (topMember && topMember.activities > 0) insightParts.push(`${topMember.name.split(" ")[0]} liderou com ${topMember.activities} atividades`);
    if (totalFollowUps === 0) insightParts.push("nenhum follow-up registrado — atenção ao acompanhamento");
    if (inactive.length > 0) insightParts.push(`${inactive.map((m) => m.name.split(" ")[0]).join(" e ")} sem atividades no período`);
    const insight = insightParts.length > 0 ? insightParts.join(". ") + "." : "Sem dados suficientes para gerar insight.";

    // Distribution by type
    const byType = [
      { label: "Visitas", count: totalVisits, color: "#4ADE80" },
      { label: "Ligações", count: totalCalls, color: "#FBBF24" },
      { label: "Follow-ups", count: totalFollowUps, color: "#60A5FA" },
      { label: "Reuniões", count: teamActs.filter((a) => (a.type as string).startsWith("meeting")).length, color: "#A78BFA" },
      { label: "Treinamentos", count: teamActs.filter((a) => a.type === "training").length, color: "#F59E0B" },
      { label: "Outros", count: teamActs.filter((a) => !["visit_broker", "visit_client", "visit_development", "phone_call", "follow_up", "meeting_internal", "meeting_external", "training"].includes(a.type as string)).length, color: "#6B7280" },
    ].filter((t) => t.count > 0);
    const maxType = Math.max(...byType.map((t) => t.count), 1);

    return (
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <Back />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
          <div><h1 style={{ fontSize: 20, fontWeight: 600, color: T.chalk, margin: 0 }}>Atividades da Equipe</h1><p style={{ fontSize: 13, color: T.fog, margin: "4px 0 0" }}>{development?.developmentName} · {pLabel}</p></div>
          <div style={{ display: "flex", gap: 8 }}><Filter /><PdfBtn onClick={async () => {
            setPdfing(true);
            try {
              const { default: jsPDF } = await import("jspdf");
              const doc = new jsPDF("p", "mm", "a4");
              // Load Roboto for UTF-8 accent support
              let ff = "helvetica";
              const strip = (s: string) => s.replace(/[àáâãä]/g, "a").replace(/[ÀÁÂÃÄ]/g, "A").replace(/[èéêë]/g, "e").replace(/[ÈÉÊË]/g, "E").replace(/[ìíîï]/g, "i").replace(/[ÌÍÎÏ]/g, "I").replace(/[òóôõö]/g, "o").replace(/[ÒÓÔÕÖ]/g, "O").replace(/[ùúûü]/g, "u").replace(/[ÙÚÛÜ]/g, "U").replace(/ç/g, "c").replace(/Ç/g, "C").replace(/ñ/g, "n").replace(/Ñ/g, "N");
              try { const lf = async (u: string) => { const r = await fetch(u); if (!r.ok) return null; const b = await r.arrayBuffer(); const a = new Uint8Array(b); let s = ""; const c = 8192; for (let i = 0; i < a.length; i += c) s += String.fromCharCode(...a.subarray(i, i + c)); return btoa(s); };
                const [rg, md] = await Promise.all([lf("https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/fonts/Roboto/Roboto-Regular.ttf"), lf("https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/fonts/Roboto/Roboto-Medium.ttf")]);
                if (rg && md) { doc.addFileToVFS("R.ttf", rg); doc.addFont("R.ttf", "Roboto", "normal"); doc.addFileToVFS("M.ttf", md); doc.addFont("M.ttf", "Roboto", "bold"); doc.setFont("Roboto"); ff = "Roboto"; }
              } catch { /* fallback to helvetica */ }
              const t = (s: string) => ff === "Roboto" ? s : strip(s);
              let y = 18; let pg = 1;
              const W = 210; const M = 20; const C = W - M * 2;
              const ftAll = () => { const np = doc.getNumberOfPages(); for (let p = 1; p <= np; p++) { doc.setPage(p); const fy = 288; try { doc.addImage(NEXA_LOGO_FOOTER, "PNG", M - 2, fy - 5, 60, 10.5); } catch { doc.setFont(ff, "normal"); doc.setFontSize(7); doc.setTextColor(156, 150, 134); doc.text("powered by", M, fy + 1); doc.setFillColor(18, 17, 15); doc.roundedRect(M + 18, fy - 2.2, 4.5, 4.5, 0.8, 0.8, "F"); doc.setFont(ff, "bold"); doc.setFontSize(3); doc.setTextColor(74, 222, 128); doc.text("N", M + 19.3, fy + 0.5); doc.setFontSize(8); doc.setTextColor(28, 27, 24); doc.text("NEXA", M + 24.5, fy + 1); } doc.setFont(ff, "normal"); doc.setFontSize(7); doc.setTextColor(180, 178, 172); doc.text(t("· Documento Confidencial"), M + 62, fy + 1); doc.text(t(`Página ${p}/${np}`), W - M, fy + 1, { align: "right" }); } };
              const ck = (h: number) => { if (y + h > 272) { doc.addPage(); pg++; y = 18; } };
              const totalReun = teamActs.filter((a) => (a.type as string).startsWith("meeting")).length;

              // === PAGE 1: COVER + EXECUTIVE SUMMARY ===
              // Logo — embedded base64 PNG (light version for white background)
              try { doc.addImage(NEXA_LOGO_HEADER, "PNG", M - 2, y - 4, 80, 17); } catch (logoErr) { console.warn("[PDF] Header logo failed:", logoErr); doc.setFillColor(74, 222, 128); doc.roundedRect(M, y - 2, 12, 12, 2, 2, "F"); doc.setFont(ff, "bold"); doc.setFontSize(8); doc.setTextColor(255, 255, 255); doc.text("N", M + 6, y + 5.5, { align: "center" }); doc.setFontSize(13); doc.setTextColor(18, 17, 15); doc.text("NEXA", M + 16, y + 4); doc.setFont(ff, "normal"); doc.setFontSize(5.5); doc.setTextColor(153, 153, 153); doc.text("PLATAFORMA COMERCIAL", M + 16, y + 9); }
              doc.setFontSize(10); doc.setTextColor(100, 100, 95); doc.setFont(ff, "normal"); doc.text(t(`Período: ${pLabel}`), W - M, y + 2, { align: "right" }); doc.text(t(`Emitido: ${formatDateBRT(new Date())} às ${formatTimeBRT(new Date())}`), W - M, y + 7, { align: "right" });
              y += 30; // gap below logo before title (larger header: 80x17mm)
              doc.setFontSize(20); doc.setTextColor(18, 17, 15); doc.setFont(ff, "bold"); doc.text(t("RELATÓRIO DE ATIVIDADES"), M, y); y += 8;
              doc.setFontSize(11); doc.setTextColor(100, 100, 95); doc.setFont(ff, "normal"); doc.text(t(`${development?.developmentName || ""}`), M, y); y += 10;
              doc.setDrawColor(200, 198, 190); doc.setLineWidth(0.5); doc.line(M, y, W - M, y); y += 14;

              // KPIs
              doc.setFontSize(10); doc.setTextColor(120, 118, 110); doc.setFont(ff, "bold"); doc.text(t("RESUMO EXECUTIVO"), M, y); y += 10;
              const kpis = [["ATIVIDADES", totalActs, ""], ["VISITAS", totalVisits, `(${totalActs > 0 ? Math.round((totalVisits / totalActs) * 100) : 0}%)`], [t("LIGAÇÕES"), totalCalls, `(${totalActs > 0 ? Math.round((totalCalls / totalActs) * 100) : 0}%)`], ["FOLLOW-UPS", totalFollowUps, `(${totalActs > 0 ? Math.round((totalFollowUps / totalActs) * 100) : 0}%)`], [t("REUNIÕES"), totalReun, `(${totalActs > 0 ? Math.round((totalReun / totalActs) * 100) : 0}%)`]];
              const kw = C / kpis.length;
              kpis.forEach(([l, v, p], i) => { const x = M + i * kw; doc.setFillColor(248, 248, 245); doc.roundedRect(x, y, kw - 3, 24, 2, 2, "F"); doc.setFontSize(8); doc.setTextColor(130, 128, 120); doc.setFont(ff, "bold"); doc.text(String(l), x + 5, y + 8); doc.setFontSize(22); doc.setTextColor(20, 20, 18); doc.text(String(v), x + 5, y + 19); doc.setFontSize(9); doc.setTextColor(130, 128, 120); doc.setFont(ff, "normal"); doc.text(String(p), x + 5 + doc.getTextWidth(String(v)) * 22 / doc.getFontSize() + 3, y + 19); });
              y += 32;

              // Analysis box
              const activeMembers = cStats.filter((c) => c.activities > 0).length;
              const leaderPct = totalActs > 0 && cStats[0] ? Math.round((cStats[0].activities / totalActs) * 100) : 0;
              const visitPct = totalActs > 0 ? Math.round((totalVisits / totalActs) * 100) : 0;
              const analysisParts = [`A equipe comercial registrou ${totalActs} atividades no período, distribuídas entre ${activeMembers} membros ativos.`];
              if (cStats[0] && cStats[0].activities > 0) { const ln = cStats[0].name.split(" "); const ldn = ln.length > 1 ? `${ln[0]} ${ln[ln.length - 1]}` : ln[0]; analysisParts.push(`${ldn} liderou com ${cStats[0].activities} atividades (${leaderPct}% do total).`); }
              if (visitPct >= 50) analysisParts.push(`Destaque positivo: alta taxa de visitas (${visitPct}%), indicando presença ativa no mercado.`);
              if (totalFollowUps <= 2) analysisParts.push(`Ponto de atenção: apenas ${totalFollowUps} follow-up${totalFollowUps !== 1 ? "s" : ""} registrado${totalFollowUps !== 1 ? "s" : ""} (${totalActs > 0 ? Math.round((totalFollowUps / totalActs) * 100) : 0}%). O acompanhamento de leads precisa ser intensificado.`);
              const analysisText = t(analysisParts.join(" "));
              doc.setFontSize(10.5); const aLines = doc.splitTextToSize(analysisText, C - 18); const aH = Math.max(22, 16 + aLines.length * 5); doc.setFillColor(240, 245, 255); doc.roundedRect(M, y, C, aH, 2, 2, "F"); doc.setFillColor(96, 165, 250); doc.rect(M, y, 2.5, aH, "F");
              doc.setFontSize(9); doc.setTextColor(130, 128, 120); doc.setFont(ff, "bold"); doc.text(t("ANÁLISE DO PERÍODO"), M + 8, y + 7);
              doc.setFontSize(10.5); doc.setTextColor(50, 50, 45); doc.setFont(ff, "normal"); doc.text(aLines, M + 8, y + 14); y += aH + 10;

              // Distribution
              ck(60); doc.setFontSize(10); doc.setTextColor(120, 118, 110); doc.setFont(ff, "bold"); doc.text(t("DISTRIBUIÇÃO POR TIPO"), M, y); y += 10;
              const mxT = Math.max(...byType.map((b) => b.count), 1);
              byType.forEach((b) => { doc.setFontSize(10); doc.setTextColor(60, 60, 55); doc.setFont(ff, "normal"); doc.text(t(b.label), M + 32, y + 2, { align: "right" }); const bw = Math.max((b.count / mxT) * (C * 0.45), 1); doc.setFillColor(74, 222, 128); doc.roundedRect(M + 36, y - 1, bw, 5, 1, 1, "F"); doc.setFontSize(10); doc.setTextColor(30, 30, 28); doc.setFont(ff, "bold"); doc.text(`${b.count}`, W - M - 20, y + 2, { align: "right" }); doc.setFont(ff, "normal"); doc.setTextColor(120, 118, 110); doc.text(`${totalActs > 0 ? Math.round((b.count / totalActs) * 100) : 0}%`, W - M, y + 2, { align: "right" }); y += 9; });
              // Ranking — title + first card must stay together (never orphan title)
              y += 8;
              ck(65); // title(12) + first card header(16) + bar(6) + breakdown(8) + insight(~23) = ~65
              doc.setFontSize(10); doc.setTextColor(120, 118, 110); doc.setFont(ff, "bold"); doc.text(t("RANKING DA EQUIPE INTERNA"), M, y); y += 12;
              cStats.forEach((c, i) => {
                ck(35); // compact: just need name+bar+breakdown
                // Position + Name
                doc.setFontSize(14); doc.setTextColor(i === 0 ? 74 : 60, i === 0 ? 222 : 60, i === 0 ? 128 : 55); doc.setFont(ff, "bold"); doc.text(`#${i + 1}`, M, y + 5);
                doc.setFontSize(13); doc.setTextColor(20, 20, 18); doc.text(t(c.name), M + 14, y + 5);
                doc.setFontSize(10); doc.setTextColor(120, 118, 110); doc.setFont(ff, "normal"); doc.text(t(c.role), M + 14, y + 11);
                doc.setFontSize(20); doc.setTextColor(20, 20, 18); doc.setFont(ff, "bold"); doc.text(String(c.activities), W - M, y + 6, { align: "right" }); doc.setFontSize(9); doc.setTextColor(120, 118, 110); doc.setFont(ff, "normal"); doc.text("atividades", W - M, y + 12, { align: "right" });
                y += 16;
                // Bar + percentage at end
                const pctBar = totalActs > 0 ? c.activities / maxA : 0; const pctVal = totalActs > 0 ? Math.round((c.activities / totalActs) * 100) : 0;
                doc.setFillColor(235, 233, 225); doc.roundedRect(M, y, C - 18, 3, 1, 1, "F"); if (pctBar > 0) { doc.setFillColor(74, 222, 128); doc.roundedRect(M, y, (C - 18) * pctBar, 3, 1, 1, "F"); }
                doc.setFont(ff, "normal"); doc.setFontSize(8); doc.setTextColor(120, 118, 110); doc.text(`${pctVal}%`, W - M, y + 2, { align: "right" }); y += 6;
                // Breakdown
                doc.setFontSize(10); doc.setTextColor(80, 80, 75); doc.text(t(c.breakdown || ""), M, y); y += 8;
                // Considerations — differentiated per member using position + specific numbers
                const consParts: string[] = [];
                const memberPct = totalActs > 0 ? Math.round((c.activities / totalActs) * 100) : 0;
                const pos = i + 1;
                const topBd = c.breakdownArr[0];
                // Opening sentence with position and numbers
                if (pos === 1) { consParts.push(`Liderou a equipe com ${c.activities} atividades (${memberPct}% do total)`); }
                else if (pos === 2 && cStats[0]) { const diff = cStats[0].activities - c.activities; consParts.push(`Segundo maior volume com ${c.activities} atividades, ${diff} a menos que ${cStats[0].name}`); }
                else { consParts.push(`Registrou ${c.activities} atividades no período (${memberPct}% do total)`); }
                // Top type with specific numbers
                if (topBd && c.activities > 0) { const tp = Math.round((topBd.count / c.activities) * 100); consParts.push(`${pluralize(topBd.count, topBd.label)} representaram ${tp}% da atuação`); }
                // Second type (differentiator)
                if (c.breakdownArr.length >= 2 && c.breakdownArr[1].count >= 2) { const sec = c.breakdownArr[1]; consParts.push(`complementado por ${pluralize(sec.count, sec.label)}`); }
                // Follow-ups
                if (c.followUps === 0) consParts.push("Oportunidade: nenhum follow-up registrado — recomenda-se incluir retorno a contatos na rotina semanal");
                else consParts.push(`${c.followUps} follow-up${c.followUps > 1 ? "s" : ""} registrado${c.followUps > 1 ? "s" : ""}, demonstrando acompanhamento ativo`);
                // Reuniões (differentiator)
                const reunCount = c.rawActs.filter((a) => (a.type as string).startsWith("meeting")).length;
                if (reunCount >= 3) consParts.push(`${reunCount} reuniões indicam envolvimento em alinhamentos e gestão`);
                const consText = t(consParts.join(". ") + ".");
                doc.setFillColor(250, 250, 248); doc.roundedRect(M, y, C, 4 + doc.splitTextToSize(consText, C - 10).length * 4.5, 2, 2, "F");
                doc.setFontSize(9); doc.setTextColor(60, 60, 55); doc.setFont(ff, "normal"); const cL = doc.splitTextToSize(consText, C - 10); doc.text(cL, M + 5, y + 5); doc.setFont(ff, "normal"); y += 8 + cL.length * 4.5;
                y += 8; if (i < cStats.length - 1) { doc.setDrawColor(220, 218, 210); doc.line(M, y - 4, W - M, y - 4); }
              });

              // === DETAIL PER MEMBER (compact — continuous flow) ===
              const toTitleCase = (s: string) => { if (!s) return ""; if (s !== s.toUpperCase()) return s; return s.toLowerCase().split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" "); };
              cStats.forEach((c, mi) => {
                // First member always starts new page; others flow if space allows
                if (mi === 0) { doc.addPage(); pg++; y = 18; } else { ck(60); if (y > 18) { doc.setDrawColor(200, 198, 190); doc.setLineWidth(0.5); doc.line(M, y, W - M, y); y += 10; } }
                doc.setFontSize(10); doc.setTextColor(120, 118, 110); doc.setFont(ff, "bold"); doc.text(t(`ATIVIDADES DETALHADAS: ${c.name}`), M, y); y += 6;
                doc.setFontSize(11); doc.setTextColor(50, 50, 45); doc.setFont(ff, "normal"); doc.text(t(`${c.role} · ${c.activities} atividades · ${pLabel}`), M, y); y += 5;
                doc.setFontSize(9); doc.setTextColor(100, 100, 95); doc.text(t(c.breakdown || ""), M, y); y += 10;
                doc.setDrawColor(200, 198, 190); doc.setLineWidth(0.3); doc.line(M, y, W - M, y); y += 6;
                doc.setFontSize(9); doc.setTextColor(130, 128, 120); doc.setFont(ff, "bold"); doc.text("DATA", M, y); doc.text("HORA", M + 22, y); doc.text("TIPO", M + 42, y); doc.text(t("DESCRIÇÃO"), M + 72, y); y += 5;
                doc.setDrawColor(230, 228, 220); doc.line(M, y, W - M, y); y += 5;
                doc.setFont(ff, "normal");
                c.rawActs.sort((a, b) => new Date(b.created_at as string).getTime() - new Date(a.created_at as string).getTime()).forEach((a) => { ck(12);
                  doc.setFontSize(10); doc.setTextColor(100, 100, 95); doc.text(formatDateBRT(a.created_at as string).slice(0, 5), M, y);
                  const hora = (a.start_time as string)?.substring(0, 5) || ""; if (hora) doc.text(hora, M + 22, y);
                  doc.setTextColor(60, 60, 55); doc.text(t(TYPE_SINGULAR[a.type as string] ?? (a.type as string)), M + 42, y);
                  doc.setTextColor(30, 30, 28); const desc = t(toTitleCase((a.title as string) || "-")); const dl = doc.splitTextToSize(desc, C - 72); doc.text(dl[0], M + 72, y);
                  if (dl.length > 1) { y += 5; doc.setTextColor(80, 80, 75); doc.text(dl[1], M + 72, y); }
                  y += 7; doc.setDrawColor(242, 240, 235); doc.line(M + 42, y - 2, W - M, y - 2);
                });
              });
              // === FINAL SECTION: Productivity + Consideration ===
              // Estimate space: title(12) + members(18*n) + legend(22) + line(12) + title(8) + text(~40) = ~112 + 18*n
              const prodNeed = 112 + cStats.length * 18;
              if (y + prodNeed > 272) { doc.addPage(); pg++; y = 18; } else { doc.setDrawColor(200, 198, 190); doc.setLineWidth(0.5); doc.line(M, y + 4, W - M, y + 4); y += 14; }
              doc.setFontSize(12); doc.setTextColor(30, 28, 24); doc.setFont(ff, "bold"); doc.text(t("PRODUTIVIDADE DA EQUIPE"), M, y); y += 12;
              const mxMem = Math.max(...cStats.map((c) => c.activities), 1); const barX = M + 34; const bMW = C * 0.5;
              cStats.forEach((c) => { doc.setFont(ff, "normal"); doc.setFontSize(11); doc.setTextColor(60, 58, 52); doc.text(t(c.name.split(" ")[0]), M, y + 6); doc.setFillColor(230, 228, 222); doc.roundedRect(barX, y, bMW, 8, 2, 2, "F"); const bw = mxMem > 0 ? (c.activities / mxMem) * bMW : 0; if (bw > 0) { doc.setFillColor(74, 222, 128); doc.roundedRect(barX, y, Math.max(bw, 3), 8, 2, 2, "F"); } doc.setFont(ff, "bold"); doc.setFontSize(12); doc.setTextColor(30, 28, 24); doc.text(String(c.activities), barX + bMW + 6, y + 6); y += 18; });
              y += 6; doc.setFontSize(8); doc.setTextColor(140, 136, 128); doc.setFont(ff, "normal"); doc.text(t("Barras proporcionais ao membro com maior volume no período."), M, y); y += 16;
              doc.setDrawColor(74, 222, 128); doc.setLineWidth(1.5); doc.line(M, y, M + C, y); y += 12;
              doc.setFont(ff, "bold"); doc.setFontSize(12); doc.setTextColor(30, 28, 24); doc.text(t("CONSIDERAÇÃO FINAL"), M, y); y += 8;
              // Generate final consideration
              const fcParts: string[] = []; const fcActive = cStats.filter((c) => c.activities > 0).length; const fcTotalFU = cStats.reduce((s, c) => s + c.followUps, 0);
              fcParts.push(`No período analisado, a equipe comercial da ${development?.developmentName || ""} registrou ${totalActs} atividades distribuídas entre ${fcActive} membros ativos.`);
              if (cStats.length >= 2) { const diff = cStats[0].activities - cStats[cStats.length - 1].activities; fcParts.push(diff <= 4 ? t("A distribuição de trabalho está equilibrada entre os membros.") : t(`${cStats[0].name} concentrou a maior parcela do volume. Avaliar redistribuição para equilibrar a operação.`)); }
              if (fcTotalFU <= 2) fcParts.push(t(`Apenas ${fcTotalFU} follow-up${fcTotalFU !== 1 ? "s" : ""} registrado${fcTotalFU !== 1 ? "s" : ""} no período. O acompanhamento de contatos é fundamental para conversão e deve ser incluído na rotina semanal.`));
              else fcParts.push(t(`${fcTotalFU} follow-ups registrados demonstram acompanhamento ativo de clientes.`));
              fcParts.push(t("Recomendação: manter o ritmo de visitas, intensificar follow-ups e registrar todas as interações no NEXA para garantir visibilidade completa da operação comercial."));
              const fcText = t(fcParts.join(" ")); doc.setFont(ff, "normal"); doc.setFontSize(10.5); doc.setTextColor(60, 58, 52); const fcL = doc.splitTextToSize(fcText, C); doc.text(fcL, M, y); y += fcL.length * 5 + 12;
              doc.setFont(ff, "normal"); doc.setFontSize(9); doc.setTextColor(140, 136, 128); doc.text(t("Relatório gerado automaticamente pela NEXA Plataforma Comercial."), M, y); y += 5;
              doc.text(t(`${development?.developmentName || ""} · ${pLabel}`), M, y);
              ftAll();
              doc.save(t(`NEXA_Atividades_${development?.developmentName?.replace(/\s/g, "_") || "Empreendimento"}_${pLabel.replace(/\s/g, "_")}.pdf`));
            } finally { setPdfing(false); }
          }} /></div>
        </div>
        {/* KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(screen.columns, 4)}, minmax(0, 1fr))`, gap: 12, marginBottom: 20 }}>
          <Kpi label="Atividades" value={totalActs} sub="no período" color="#4ADE80" />
          <Kpi label="Visitas" value={totalVisits} color="#60A5FA" />
          <Kpi label="Ligações" value={totalCalls} color="#FBBF24" />
          <Kpi label="Follow-ups" value={totalFollowUps} color="#A78BFA" />
        </div>
        {/* Insight */}
        <div style={{ padding: "14px 18px", background: T.carbon, border: `1px solid ${T.stone}`, borderRadius: 12, borderLeft: "3px solid #60A5FA", marginBottom: 24, fontSize: 14, color: "#CDC9BA", lineHeight: 1.6 }}>{insight}</div>
        {/* Distribution by type */}
        <Sec>Distribuição por tipo</Sec>
        <div style={{ background: T.carbon, border: `1px solid ${T.stone}`, borderRadius: 10, padding: 20, marginBottom: 24 }}>
          {byType.map((t) => (
            <div key={t.label} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: T.fog, width: 100, textAlign: "right", flexShrink: 0 }}>{t.label}</span>
              <div style={{ flex: 1, height: 8, background: T.stone, borderRadius: 4, overflow: "hidden" }}><div style={{ height: "100%", width: `${(t.count / maxType) * 100}%`, background: t.color, borderRadius: 4, transition: "width 0.4s" }} /></div>
              <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 600, color: T.chalk, width: 50, textAlign: "right" }}>{t.count} <span style={{ fontSize: 11, color: T.fog }}>({totalActs > 0 ? Math.round((t.count / totalActs) * 100) : 0}%)</span></span>
            </div>
          ))}
        </div>
        {/* Ranking */}
        <Sec>Ranking da equipe</Sec>
        {cStats.map((c, i) => {
          const isExpanded = expandedRankMember === c.id;
          return (
          <div key={c.name} style={{ background: T.carbon, border: `1px solid ${T.stone}`, borderRadius: 10, marginBottom: 10, overflow: "hidden" }}>
            <div onClick={() => setExpandedRankMember(isExpanded ? null : c.id)} style={{ display: "flex", alignItems: "center", gap: 12, padding: 20, cursor: "pointer" }}>
              <span style={{ fontFamily: MONO, fontSize: 16, fontWeight: 700, color: i === 0 ? T.sprout : T.fog, width: 28, textAlign: "center" }}>#{i + 1}</span>
              <div style={{ width: 40, height: 40, borderRadius: "50%", background: T.stone, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: T.sprout }}>{initials(c.name)}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: T.chalk }}>{c.name}</div>
                <div style={{ fontSize: 11, color: T.fog }}>{c.role}</div>
              </div>
              <div style={{ textAlign: "right", marginRight: 8 }}>
                <div style={{ fontFamily: MONO, fontSize: 22, fontWeight: 700, color: T.chalk }}>{c.activities}</div>
                <div style={{ fontSize: 11, color: T.fog }}>atividades</div>
              </div>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ color: T.bone, transition: "transform 0.2s", transform: isExpanded ? "rotate(180deg)" : "none" }}><path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
            {/* Progress bar */}
            <div style={{ margin: "0 20px", height: 6, background: T.stone, borderRadius: 3, overflow: "hidden" }}><div style={{ height: "100%", width: `${(c.activities / maxA) * 100}%`, background: i === 0 ? T.sprout : T.blue, borderRadius: 3, transition: "width 0.4s" }} /></div>
            {/* Full breakdown */}
            <div style={{ padding: "8px 20px 16px", fontSize: 13, color: "#CDC9BA" }}>{c.breakdown || "—"}</div>
            {/* Drill-down */}
            {isExpanded && c.rawActs.length > 0 && (
              <div style={{ borderTop: `1px solid rgba(255,255,255,0.04)` }}>
                {c.rawActs.sort((a, b) => new Date(b.created_at as string).getTime() - new Date(a.created_at as string).getTime()).map((a) => {
                  const ACT_COLORS: Record<string, string> = { visit_broker: "#4ADE80", visit_client: "#4ADE80", phone_call: "#FBBF24", follow_up: "#60A5FA", meeting_internal: "#A78BFA", meeting_external: "#A78BFA", training: "#F59E0B", other: "#6B7280" };
                  return (
                    <div key={a.id as string} style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 20px", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                      <span style={{ fontFamily: MONO, fontSize: 12, color: T.fog, minWidth: 44 }}>{formatDateBRT(a.created_at as string).slice(0, 5)}</span>
                      <span style={{ fontFamily: MONO, fontSize: 12, color: T.chalk, minWidth: 44 }}>{(a.start_time as string)?.substring(0, 5) ?? "—"}</span>
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: ACT_COLORS[a.type as string] ?? "#6B7280", flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: T.bone, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.title as string || TYPE_LABELS[a.type as string] || (a.type as string)}</div>
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 600, padding: "3px 10px", borderRadius: 20, background: (ACT_COLORS[a.type as string] ?? "#6B7280") + "12", color: ACT_COLORS[a.type as string] ?? "#6B7280", border: `1px solid ${(ACT_COLORS[a.type as string] ?? "#6B7280")}25` }}>{TYPE_LABELS[a.type as string] ?? (a.type as string)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>);
        })}
        {totalActs === 0 && <div style={{ fontSize: 13, color: T.fog, textAlign: "center", padding: 20 }}>Nenhuma atividade registrada no período</div>}
      </div>
    );
  }

  // ── CORRETORES ──
  if (active === "corretores") {
    const brokerNeg = brokerList.map((b) => {
      const bN = negotiations.filter((n) => n.broker_id === b.id).length;
      const bS = sales.filter((s) => s.broker_name === b.name).length;
      const bV = sales.filter((s) => s.broker_name === b.name).reduce((sum, s) => sum + s.amount, 0);
      return { name: b.name, neg: bN, sales: bS, vgv: bV, conv: pct(bS, bN) };
    }).sort((a, b) => b.sales - a.sales || b.conv - a.conv);
    const maxBS = Math.max(...brokerNeg.map((b) => b.sales), 1);
    return (
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <Back />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
          <div><h1 style={{ fontSize: 20, fontWeight: 600, color: T.chalk, margin: 0 }}>Corretores</h1><p style={{ fontSize: 13, color: T.fog, margin: "4px 0 0" }}>{development?.developmentName} · {pLabel}</p></div>
          <div style={{ display: "flex", gap: 8 }}><Filter /><PdfBtn onClick={handlePdfEquipe} /></div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${screen.columns}, minmax(0, 1fr))`, gap: 12, marginBottom: 24 }}>
          <Kpi label="Corretores ativos" value={brokerList.length} color="#A78BFA" />
          <Kpi label="Negociações" value={brokerNeg.reduce((s, b) => s + b.neg, 0)} sub="no período" color="#60A5FA" />
          <Kpi label="Vendas" value={brokerNeg.reduce((s, b) => s + b.sales, 0)} color="#4ADE80" />
          <Kpi label="VGV" value={fmtM(brokerNeg.reduce((s, b) => s + b.vgv, 0))} color="#4ADE80" />
        </div>
        <Sec>Ranking por vendas</Sec>
        {brokerNeg.length === 0 ? <div style={{ color: T.fog, fontSize: 13, padding: 20 }}>Nenhum corretor ativo</div> : brokerNeg.map((b, i) => {
          const showMedal = i < 3;
          return (
            <div key={b.name} style={{ background: T.carbon, border: `1px solid ${T.stone}`, borderRadius: 10, padding: 20, marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                {showMedal && <IcMedal pos={i + 1} />}
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: T.stone, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: T.sprout }}>{initials(b.name)}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: T.chalk }}>{b.name}</div>
                  <div style={{ fontSize: 11, color: T.fog }}>{b.neg} negociações · {b.sales} vendas · {fmtM(b.vgv)} · {b.conv}% conversão</div>
                </div>
              </div>
              <div style={{ height: 8, borderRadius: 4, background: T.stone, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${Math.max((b.sales / maxBS) * 100, 2)}%`, background: `linear-gradient(90deg, ${T.sprout}, #22C55E)`, borderRadius: 4 }} />
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // ── IMOBILIÁRIAS ──
  if (active === "imobiliarias") {
    return (
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <Back />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
          <div><h1 style={{ fontSize: 20, fontWeight: 600, color: T.chalk, margin: 0 }}>Imobiliárias</h1><p style={{ fontSize: 13, color: T.fog, margin: "4px 0 0" }}>{development?.developmentName} · {pLabel}</p></div>
          <div style={{ display: "flex", gap: 8 }}><Filter /></div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${screen.columns}, minmax(0, 1fr))`, gap: 12, marginBottom: 24 }}>
          <Kpi label="Imobiliárias" value={brokerages.length} sub="cadastradas" color="#D97706" />
          <Kpi label="Corretores" value={brokerList.length} sub="vinculados" color="#A78BFA" />
          <Kpi label="Negociações" value={negotiations.length} sub="no período" color="#60A5FA" />
          <Kpi label="Vendas" value={sales.length} sub="no período" color="#4ADE80" />
        </div>
        <Sec>Ranking</Sec>
        {brokerages.length === 0 ? (
          <div style={{ background: T.carbon, border: `1px solid ${T.stone}`, borderRadius: 10, padding: 24, textAlign: "center" }}>
            <div style={{ fontSize: 13, color: T.fog, marginBottom: 8 }}>Nenhuma imobiliária cadastrada</div>
            <div style={{ fontSize: 12, color: T.slate }}>As negociações de corretores autônomos aparecem no relatório de Corretores.</div>
          </div>
        ) : brokerages.map((bg, i) => {
          const showMedal = i < 3;
          return (
            <div key={bg.id} style={{ background: T.carbon, border: `1px solid ${T.stone}`, borderRadius: 10, padding: 20, marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {showMedal && <IcMedal pos={i + 1} />}
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: T.stone, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: T.blue }}>{initials(bg.name)}</div>
                <div><div style={{ fontSize: 15, fontWeight: 600, color: T.chalk }}>{bg.name}</div></div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // ── ESTOQUE ──
  if (active === "estoque") {
    const aDeg = (avail / Math.max(units.length, 1)) * 360;
    const rDeg = (resv / Math.max(units.length, 1)) * 360;
    return (
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <Back />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
          <div><h1 style={{ fontSize: 20, fontWeight: 600, color: T.chalk, margin: "0 0 4px" }}>Estoque de Unidades</h1><p style={{ fontSize: 13, color: T.fog, margin: 0 }}>{development?.developmentName}</p></div>
          <PdfBtn onClick={handlePdfEstoque} />
        </div>
        <div>
          {/* KPIs + donut */}
          <div style={{ display: "flex", gap: 20, marginBottom: 24, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ display: "grid", gridTemplateColumns: screen.isMobile ? "repeat(2, minmax(0, 1fr))" : "repeat(4, minmax(0, 1fr))", gap: 12, flex: 1 }}>
              <Kpi label="Total lotes" value={units.length} color="#9C9686" />
              <Kpi label="Disponíveis" value={avail} sub={`${pct(avail, units.length)}%`} color="#4ADE80" />
              <Kpi label="Reservados" value={resv} sub={`${pct(resv, units.length)}%`} color="#D97706" />
              <Kpi label="Vendidos" value={sold} sub={`${pct(sold, units.length)}%`} color="#EF4444" />
            </div>
            {!screen.isMobile && units.length > 0 && (
              <div style={{ width: 140, height: 140, borderRadius: "50%", background: `conic-gradient(${T.sprout} 0deg ${aDeg}deg, ${T.amber} ${aDeg}deg ${aDeg + rDeg}deg, ${T.purple} ${aDeg + rDeg}deg 360deg)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <div style={{ width: 90, height: 90, borderRadius: "50%", background: T.carbon, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontFamily: MONO, fontSize: 24, fontWeight: 800, color: T.chalk }}>{units.length}</span>
                  <span style={{ fontSize: 10, color: T.fog }}>lotes</span>
                </div>
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 24, fontSize: 13, color: T.fog }}>
            <span>VGV Total: <strong style={{ color: T.chalk }}>{fmtM(vT)}</strong></span>
            <span>VGV Disponível: <strong style={{ color: T.sprout }}>{fmtM(vA)}</strong></span>
            <span>VGV Vendido: <strong style={{ color: T.chalk }}>{fmtM(vS)}</strong></span>
          </div>
          {/* Heat map */}
          <div style={{ background: V7_BG, borderRadius: 12, padding: 20, border: V7_BORDER, marginBottom: 24 }}>
            <Sec>Mapa de calor por quadra</Sec>
            {byQuadra.map(([q, d]) => { const sp = pct(d.sold, d.total); const bc = sp > 70 ? T.red : sp > 30 ? T.amber : T.sprout; return (
              <div key={q} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: T.bone }}>Quadra {q}</span>
                  <span style={{ fontSize: 12, color: T.fog, fontFamily: MONO }}>{sp}% vendida ({d.sold}/{d.total}) · {fmtM(d.vgvSold)}</span>
                </div>
                <div style={{ height: 10, borderRadius: 5, background: T.stone, overflow: "hidden" }}><div style={{ height: "100%", width: `${Math.max(sp, 2)}%`, background: bc, borderRadius: 5, transition: "width 0.3s" }} /></div>
              </div>
            ); })}
          </div>
          {/* Table */}
          <div style={{ background: V7_BG, borderRadius: 12, padding: 20, border: V7_BORDER, marginBottom: 24 }}>
            <Sec>Detalhamento por quadra</Sec>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 600 }}>
                <thead><tr style={{ borderBottom: `1px solid ${T.stone}` }}>{["Quadra", "Lotes", "Disp.", "Res.", "Vend.", "% Vend.", "VGV Total", "VGV Disp.", "VGV Vend."].map((h) => <th key={h} style={{ textAlign: h === "Quadra" ? "left" : "right", padding: "8px", fontSize: 10, fontFamily: MONO, color: T.fog, textTransform: "uppercase", fontWeight: 600 }}>{h}</th>)}</tr></thead>
                <tbody>
                  {byQuadra.map(([q, d]) => <tr key={q} style={{ borderBottom: `1px solid ${T.stone}` }}><td style={{ padding: "8px", fontWeight: 600, color: T.bone }}>Q{q}</td><td style={{ padding: "8px", textAlign: "right", fontFamily: MONO, color: T.bone }}>{d.total}</td><td style={{ padding: "8px", textAlign: "right", fontFamily: MONO, color: T.sprout }}>{d.available}</td><td style={{ padding: "8px", textAlign: "right", fontFamily: MONO, color: T.blue }}>{d.reserved}</td><td style={{ padding: "8px", textAlign: "right", fontFamily: MONO, color: T.fog }}>{d.sold}</td><td style={{ padding: "8px", textAlign: "right", fontFamily: MONO, color: pct(d.sold, d.total) > 70 ? T.red : pct(d.sold, d.total) > 30 ? T.amber : T.sprout }}>{pct(d.sold, d.total)}%</td><td style={{ padding: "8px", textAlign: "right", fontFamily: MONO, color: T.bone }}>{fmtM(d.vgvTotal)}</td><td style={{ padding: "8px", textAlign: "right", fontFamily: MONO, color: T.sprout }}>{fmtM(d.vgvAvail)}</td><td style={{ padding: "8px", textAlign: "right", fontFamily: MONO, color: T.bone }}>{fmtM(d.vgvSold)}</td></tr>)}
                  <tr style={{ borderTop: `2px solid ${T.slate}` }}><td style={{ padding: "8px", fontWeight: 700, color: T.chalk }}>Total</td><td style={{ padding: "8px", textAlign: "right", fontFamily: MONO, fontWeight: 700, color: T.chalk }}>{units.length}</td><td style={{ padding: "8px", textAlign: "right", fontFamily: MONO, fontWeight: 700, color: T.sprout }}>{avail}</td><td style={{ padding: "8px", textAlign: "right", fontFamily: MONO, fontWeight: 700, color: T.blue }}>{resv}</td><td style={{ padding: "8px", textAlign: "right", fontFamily: MONO, fontWeight: 700, color: T.fog }}>{sold}</td><td style={{ padding: "8px", textAlign: "right", fontFamily: MONO, fontWeight: 700, color: T.chalk }}>{pct(sold, units.length)}%</td><td style={{ padding: "8px", textAlign: "right", fontFamily: MONO, fontWeight: 700, color: T.chalk }}>{fmtM(vT)}</td><td style={{ padding: "8px", textAlign: "right", fontFamily: MONO, fontWeight: 700, color: T.sprout }}>{fmtM(vA)}</td><td style={{ padding: "8px", textAlign: "right", fontFamily: MONO, fontWeight: 700, color: T.chalk }}>{fmtM(vS)}</td></tr>
                </tbody>
              </table>
            </div>
          </div>
          {/* Available list */}
          <div style={{ background: V7_BG, borderRadius: 12, padding: 20, border: V7_BORDER }}>
            <Sec>Unidades disponíveis por quadra</Sec>
            {byQuadra.filter(([, d]) => d.available > 0).map(([q]) => <CQ key={q} q={q} us={units.filter((u) => u.quadra === q && u.status === "available")} />)}
            {avail === 0 && <div style={{ fontSize: 12, color: T.fog }}>Nenhuma unidade disponível</div>}
          </div>
        </div>
      </div>
    );
  }
  // ── CONTATOS ──
  if (active === "contatos") {
    return <RelatorioContatos accountId={accountId} isMobile={screen.isMobile} Back={Back} />;
  }

  // ── NEGOCIAÇÕES ──
  if (active === "negociacoes") {
    const DONE = ["won", "lost", "cancelled", "vendida", "perdida", "cancelada", "concluida"];
    const allNegs = negotiations;
    const activeN = allNegs.filter((n) => !DONE.includes((n.status as string)?.toLowerCase()));
    const lostN = allNegs.filter((n) => (n.status as string)?.toLowerCase() === "lost");
    const wonN = allNegs.filter((n) => (n.status as string)?.toLowerCase() === "won");
    const totalProposals = proposals.length;
    const activeReservations = reservations.length;
    const totalSales = sales.length;
    const convRate = allNegs.length > 0 ? Math.round((wonN.length / allNegs.length) * 100) : 0;

    // Funnel
    const funnel = [
      { label: "Negociações", count: allNegs.length, color: "#60A5FA" },
      { label: "Propostas", count: totalProposals, color: "#A78BFA" },
      { label: "Reservas", count: activeReservations, color: "#FBBF24" },
      { label: "Vendas", count: totalSales, color: "#4ADE80" },
    ];
    const maxFunnel = Math.max(...funnel.map((f) => f.count), 1);

    // Insight
    const insightParts: string[] = [];
    if (allNegs.length > 0 && totalSales === 0) insightParts.push(`${allNegs.length} negociações no período mas nenhuma convertida em venda`);
    if (lostN.length > 0) insightParts.push(`${lostN.length} negociação${lostN.length > 1 ? "ões" : ""} perdida${lostN.length > 1 ? "s" : ""}`);
    if (activeN.length > 0) insightParts.push(`${activeN.length} em andamento`);
    if (convRate > 0) insightParts.push(`taxa de conversão de ${convRate}%`);
    // Bottleneck
    if (allNegs.length > 0 && totalProposals === 0) insightParts.push("gargalo: nenhuma proposta gerada");
    else if (totalProposals > 0 && activeReservations === 0) insightParts.push("gargalo: propostas não estão gerando reservas");
    const negInsight = insightParts.length > 0 ? insightParts.join(". ").replace(/^./, (c) => c.toUpperCase()) + "." : "Sem dados suficientes para gerar insight.";

    // Lost reasons
    const lostReasons: Record<string, number> = {};
    lostN.forEach((n) => { const r = (n as Record<string, unknown>).lost_reason as string || "Não informado"; lostReasons[r] = (lostReasons[r] || 0) + 1; });
    const REASON_LABELS: Record<string, string> = { no_budget: "Sem orçamento", no_interest: "Sem interesse", bought_competitor: "Comprou concorrente", no_response: "Sem resposta", too_expensive: "Achou caro", bad_timing: "Momento ruim", other: "Outro" };

    // Ranking by member — only operational team
    const NEG_REPORT_ROLES = ["manager", "commercial_consultant"];
    const teamN = (consultants as { id: string; name: string; role: string }[]).filter((c) => NEG_REPORT_ROLES.includes(c.role));
    const ROLE_MAP2: Record<string, string> = { owner: "Diretor", director: "Diretor", manager: "Gestor", commercial_consultant: "Consultora" };
    const negRanking = teamN.map((m) => {
      const myNegs = allNegs.filter((n) => n.owner_profile_id === m.id || n.broker_id === m.id);
      const myWon = myNegs.filter((n) => (n.status as string)?.toLowerCase() === "won");
      return { name: m.name, role: ROLE_MAP2[m.role] ?? m.role, negs: myNegs.length, won: myWon.length, rate: myNegs.length > 0 ? Math.round((myWon.length / myNegs.length) * 100) : 0 };
    }).sort((a, b) => b.negs - a.negs);

    return (
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <Back />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
          <div><h1 style={{ fontSize: 20, fontWeight: 600, color: T.chalk, margin: 0 }}>Negociações</h1><p style={{ fontSize: 13, color: T.fog, margin: "4px 0 0" }}>{development?.developmentName} · {pLabel}</p></div>
          <Filter />
        </div>
        {/* KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(screen.columns, 5)}, minmax(0, 1fr))`, gap: 12, marginBottom: 20 }}>
          <Kpi label="Negociações" value={allNegs.length} sub="no período" color="#60A5FA" />
          <Kpi label="Propostas" value={totalProposals} color="#A78BFA" />
          <Kpi label="Reservas" value={activeReservations} color="#D97706" />
          <Kpi label="Vendas" value={totalSales} color="#4ADE80" />
          <Kpi label="Conversão" value={`${convRate}%`} color="#FBBF24" />
        </div>
        {/* Insight */}
        <div style={{ padding: "14px 18px", background: T.carbon, border: `1px solid ${T.stone}`, borderRadius: 12, borderLeft: "3px solid #F97316", marginBottom: 24, fontSize: 14, color: "#CDC9BA", lineHeight: 1.6 }}>{negInsight}</div>
        {/* Funnel */}
        <Sec>Funil comercial</Sec>
        <div style={{ background: T.carbon, border: `1px solid ${T.stone}`, borderRadius: 10, padding: 20, marginBottom: 24 }}>
          {funnel.map((f, i) => (
            <div key={f.label}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
                <span style={{ fontSize: 13, color: T.fog, width: 100, textAlign: "right", flexShrink: 0 }}>{f.label}</span>
                <div style={{ flex: 1, height: 8, background: T.stone, borderRadius: 4, overflow: "hidden" }}><div style={{ height: "100%", width: `${(f.count / maxFunnel) * 100}%`, background: f.color, borderRadius: 4, minWidth: f.count > 0 ? 8 : 0, transition: "width 0.4s" }} /></div>
                <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 600, color: T.chalk, width: 30, textAlign: "right" }}>{f.count}</span>
              </div>
              {i < funnel.length - 1 && funnel[i + 1].count > 0 && f.count > 0 && (
                <div style={{ marginLeft: 112, fontSize: 11, color: T.fog, marginBottom: 8 }}>↓ {Math.round((funnel[i + 1].count / f.count) * 100)}%</div>
              )}
              {i < funnel.length - 1 && (funnel[i + 1].count === 0 || f.count === 0) && <div style={{ height: 8 }} />}
            </div>
          ))}
        </div>
        {/* Ranking */}
        <Sec>Performance por membro</Sec>
        {negRanking.map((m, i) => (
          <div key={m.name} style={{ background: T.carbon, border: `1px solid ${T.stone}`, borderRadius: 10, padding: 16, marginBottom: 8, display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontFamily: MONO, fontSize: 16, fontWeight: 700, color: i === 0 && m.negs > 0 ? T.sprout : T.fog, width: 28, textAlign: "center" }}>#{i + 1}</span>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: T.stone, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: T.sprout }}>{initials(m.name)}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: T.chalk }}>{m.name}</div>
              <div style={{ fontSize: 12, color: T.fog }}>{m.role}</div>
            </div>
            <div style={{ fontSize: 13, color: "#CDC9BA" }}>{m.negs} neg. · {m.won} venda{m.won !== 1 ? "s" : ""} · <span style={{ color: m.rate >= 30 ? T.sprout : m.rate >= 10 ? T.amber : T.fog, fontFamily: MONO, fontWeight: 600 }}>{m.rate}%</span></div>
          </div>
        ))}
        {negRanking.length === 0 && <div style={{ fontSize: 13, color: T.fog, textAlign: "center", padding: 20 }}>Sem dados de equipe</div>}
        {/* Lost reasons */}
        {lostN.length > 0 && (
          <>
            <Sec>Motivos de perda</Sec>
            <div style={{ background: T.carbon, border: `1px solid ${T.stone}`, borderRadius: 10, padding: 20 }}>
              {Object.entries(lostReasons).sort(([, a], [, b]) => b - a).map(([reason, count]) => (
                <div key={reason} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${T.stone}` }}>
                  <span style={{ fontSize: 13, color: "#CDC9BA" }}>{REASON_LABELS[reason] ?? reason}</span>
                  <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 600, color: T.red }}>{count}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  return null;
}

function RelatorioContatos({ accountId, isMobile, Back }: { accountId: string | null; isMobile: boolean; Back: () => React.JSX.Element }) {
  const [clients, setClients] = useState<{ id: string; status: string; temperature: string | null; origin: string | null; assigned_to: string | null; created_at: string; converted_at: string | null }[]>([]);
  const [team, setTeam] = useState<{ userId: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase || !accountId) { setLoading(false); return; }
    setLoading(true);
    Promise.all([
      supabase.from("clients").select("id, status, temperature, origin, assigned_to, created_at, converted_at").eq("account_id", accountId).is("deleted_at", null),
      supabase.from("user_account_access").select("user_id, profiles!inner(name)").eq("account_id", accountId),
    ]).then(([{ data: c }, { data: t }]) => {
      setClients((c ?? []) as typeof clients);
      setTeam((t ?? []).map((d: Record<string, unknown>) => { const p = (Array.isArray(d.profiles) ? d.profiles[0] : d.profiles) as Record<string, unknown>; return { userId: d.user_id as string, name: (p?.name as string) ?? "—" }; }));
      setLoading(false);
    });
  }, [accountId]);

  if (loading) return <div style={{ maxWidth: 960, margin: "0 auto" }}><Back /><p style={{ color: T.fog, fontFamily: MONO, fontSize: 13 }}>Carregando dados...</p></div>;

  const total = clients.length;
  const now = new Date();
  const thisMonth = clients.filter((c) => { const d = new Date(c.created_at); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); }).length;
  const converted = clients.filter((c) => ["converted", "active", "negotiating"].includes(c.status)).length;
  const convRate = total > 0 ? Math.round((converted / total) * 100) : 0;
  const withTime = clients.filter((c) => c.converted_at);
  const avgDays = withTime.length > 0 ? Math.round(withTime.reduce((s, c) => s + (new Date(c.converted_at!).getTime() - new Date(c.created_at).getTime()) / 864e5, 0) / withTime.length) : 0;

  // Funnel
  const funnelStatuses = [
    { key: "new", label: "Novos", color: "#6B7280" }, { key: "contacted", label: "Contatados", color: "#A78BFA" },
    { key: "qualifying", label: "Qualificando", color: "#FBBF24" }, { key: "qualified", label: "Qualificados", color: "#4ADE80" },
    { key: "negotiating", label: "Em negociação", color: "#F97316" }, { key: "active", label: "Ativos", color: "#22C55E" },
    { key: "converted", label: "Convertidos", color: "#22C55E" }, { key: "lost", label: "Perdidos", color: "#F87171" },
  ];
  const statusCounts: Record<string, number> = {};
  funnelStatuses.forEach((s) => { statusCounts[s.key] = clients.filter((c) => c.status === s.key).length; });
  // Also count "lead" status as "new"
  statusCounts["new"] = (statusCounts["new"] || 0) + clients.filter((c) => c.status === "lead").length;
  const maxFunnel = Math.max(...Object.values(statusCounts), 1);

  // Origins
  const originCounts: Record<string, number> = {};
  clients.forEach((c) => { const o = c.origin || "sem_origem"; originCounts[o] = (originCounts[o] || 0) + 1; });
  const originsSorted = Object.entries(originCounts).sort(([, a], [, b]) => b - a);
  const maxOrigin = Math.max(...Object.values(originCounts), 1);
  const originLabels: Record<string, string> = { website: "Website", instagram: "Instagram", facebook: "Facebook", google_ads: "Google Ads", whatsapp: "WhatsApp", phone: "Telefone", referral: "Indicação", event: "Evento", walk_in: "Presencial", import: "Importação", sem_origem: "Sem origem", other: "Outro" };
  const originColors: Record<string, string> = { facebook: "#60A5FA", instagram: "#A78BFA", google_ads: "#4ADE80", whatsapp: "#22C55E", website: "#F59E0B", phone: "#F97316", referral: "#38BDF8", event: "#FBBF24", walk_in: "#9C9686", import: "#6B7280", sem_origem: "#6B7280", other: "#6B7280" };

  // Temperature
  const tempCounts = { hot: clients.filter((c) => c.temperature === "hot").length, warm: clients.filter((c) => c.temperature === "warm").length, cold: clients.filter((c) => c.temperature === "cold").length };

  // Performance by responsible
  const byResp: Record<string, { total: number; converted: number }> = {};
  clients.forEach((c) => {
    const key = c.assigned_to || "__none";
    if (!byResp[key]) byResp[key] = { total: 0, converted: 0 };
    byResp[key].total++;
    if (["converted", "active", "negotiating"].includes(c.status)) byResp[key].converted++;
  });
  const ranking = Object.entries(byResp).map(([uid, d]) => ({ userId: uid, name: uid === "__none" ? "Sem responsável" : team.find((m) => m.userId === uid)?.name ?? "—", ...d, rate: d.total > 0 ? Math.round((d.converted / d.total) * 100) : 0 })).sort((a, b) => b.total - a.total);

  return (
    <div style={{ maxWidth: 960, margin: "0 auto" }}>
      <Back />
      <h1 style={{ fontSize: 22, fontWeight: 600, color: T.chalk, margin: "0 0 4px" }}>Relatório de Contatos</h1>
      <p style={{ fontSize: 13, color: T.fog, margin: "0 0 24px" }}>Visão gerencial da base de contatos</p>

      {/* KPIs */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
        <Kpi label="TOTAL" value={total} color="#9C9686" />
        <Kpi label="NOVOS ESTE MÊS" value={thisMonth} color="#60A5FA" />
        <Kpi label="TAXA CONVERSÃO" value={`${convRate}%`} sub={`${converted} convertidos`} color="#4ADE80" />
        <Kpi label="TEMPO MÉDIO" value={avgDays > 0 ? `${avgDays}d` : "—"} sub="até conversão" color="#D97706" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 24 }}>
        {/* Left column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Funnel */}
          <div style={{ background: V7_BG, borderRadius: 12, padding: 20, border: V7_BORDER }}>
            <Sec>Funil de contatos</Sec>
            {funnelStatuses.map((s) => (
              <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: T.fog, width: isMobile ? 80 : 110, textAlign: "right", flexShrink: 0 }}>{s.label}</span>
                <div style={{ flex: 1, height: 22, background: T.stone, borderRadius: 6, overflow: "hidden" }}>
                  <div style={{ width: `${(statusCounts[s.key] / maxFunnel) * 100}%`, height: "100%", background: s.color, borderRadius: 6, minWidth: statusCounts[s.key] > 0 ? 20 : 0, transition: "width 0.5s" }} />
                </div>
                <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 600, color: T.chalk, width: 30, textAlign: "right" }}>{statusCounts[s.key]}</span>
              </div>
            ))}
          </div>

          {/* Temperature */}
          <div style={{ background: V7_BG, borderRadius: 12, padding: 20, border: V7_BORDER }}>
            <Sec>Temperatura</Sec>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              {([["hot", "Quentes", "#F87171", "rgba(248,113,113,0.10)"], ["warm", "Mornos", "#FBBF24", "rgba(251,191,36,0.10)"], ["cold", "Frios", "#60A5FA", "rgba(96,165,250,0.10)"]] as const).map(([k, l, c, bg]) => (
                <div key={k} style={{ background: bg, border: `1px solid ${c}22`, borderRadius: 10, padding: "16px 12px", textAlign: "center" }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: c }}>{tempCounts[k]}</div>
                  <div style={{ fontSize: 12, color: c, marginTop: 4 }}>{l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Origins */}
          <div style={{ background: V7_BG, borderRadius: 12, padding: 20, border: V7_BORDER }}>
            <Sec>Contatos por origem</Sec>
            {originsSorted.slice(0, 8).map(([origin, count]) => (
              <div key={origin} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: T.fog, width: isMobile ? 70 : 90, textAlign: "right", flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{originLabels[origin] ?? origin}</span>
                <div style={{ flex: 1, height: 22, background: T.stone, borderRadius: 6, overflow: "hidden" }}>
                  <div style={{ width: `${(count / maxOrigin) * 100}%`, height: "100%", background: originColors[origin] ?? "#6B7280", borderRadius: 6, minWidth: 20, transition: "width 0.5s" }} />
                </div>
                <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 600, color: T.chalk, width: 30, textAlign: "right" }}>{count}</span>
              </div>
            ))}
          </div>

          {/* Performance */}
          <div style={{ background: V7_BG, borderRadius: 12, padding: 20, border: V7_BORDER }}>
            <Sec>Performance por responsável</Sec>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${T.stone}` }}>
                  <th style={{ textAlign: "left", padding: "8px 0", color: T.fog, fontWeight: 500, fontSize: 11 }}>#</th>
                  <th style={{ textAlign: "left", padding: "8px 0", color: T.fog, fontWeight: 500, fontSize: 11 }}>Responsável</th>
                  <th style={{ textAlign: "right", padding: "8px 0", color: T.fog, fontWeight: 500, fontSize: 11 }}>Contatos</th>
                  <th style={{ textAlign: "right", padding: "8px 0", color: T.fog, fontWeight: 500, fontSize: 11 }}>Conv.</th>
                  <th style={{ textAlign: "right", padding: "8px 0", color: T.fog, fontWeight: 500, fontSize: 11 }}>Taxa</th>
                </tr>
              </thead>
              <tbody>
                {ranking.slice(0, 10).map((r, i) => (
                  <tr key={r.userId} style={{ borderBottom: `1px solid ${T.stone}` }}>
                    <td style={{ padding: "10px 0", color: T.fog }}>{i + 1}</td>
                    <td style={{ padding: "10px 0", color: T.chalk, fontWeight: 500, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</td>
                    <td style={{ padding: "10px 0", color: T.chalk, textAlign: "right", fontFamily: MONO }}>{r.total}</td>
                    <td style={{ padding: "10px 0", color: T.sprout, textAlign: "right", fontFamily: MONO }}>{r.converted}</td>
                    <td style={{ padding: "10px 0", color: r.rate >= 30 ? T.sprout : r.rate >= 15 ? T.amber : T.fog, textAlign: "right", fontFamily: MONO, fontWeight: 600 }}>{r.rate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {ranking.length === 0 && <div style={{ fontSize: 12, color: T.fog, padding: "16px 0", textAlign: "center" }}>Nenhum contato atribuído</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

function CQ({ q, us }: { q: string; us: { lote: string; valor: number; area: number }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginBottom: 8 }}>
      <button type="button" onClick={() => setOpen(!open)} style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", color: "var(--text-secondary)", fontSize: 13, fontWeight: 600, cursor: "pointer", padding: "6px 0", width: "100%" }}>
        <span style={{ color: "var(--text-muted)", fontSize: 12 }}>{open ? "▼" : "▶"}</span>Quadra {q} — {us.length} disponíve{us.length !== 1 ? "is" : "l"}
      </button>
      {open && <div style={{ paddingLeft: 20, display: "flex", flexDirection: "column", gap: 4 }}>
        {us.sort((a, b) => { const na = parseInt(a.lote), nb = parseInt(b.lote); return !isNaN(na) && !isNaN(nb) ? na - nb : a.lote.localeCompare(b.lote); }).map((u) => <div key={u.lote} style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", gap: 16 }}><span style={{ color: "var(--text-secondary)", minWidth: 60 }}>Lote {u.lote}</span>{u.area > 0 && <span>{u.area}m²</span>}<span style={{ color: "#4ADE80", fontFamily: "var(--font-mono)" }}>R$ {u.valor.toLocaleString("pt-BR")}</span></div>)}
      </div>}
    </div>
  );
}
